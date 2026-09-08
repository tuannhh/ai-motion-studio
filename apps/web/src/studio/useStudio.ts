import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { api } from "../lib/api";
import { useToast } from "../components/mds/toast.js";
import { previewOf } from "./preview";
export function useStudio(scriptId: number, userId: number) {
  const toast = useToast();
  const router = useRouter();
  const data = ref<any>(null),
    plan = ref<any>(null),
    baseline = ref(""),
    revision = ref(""),
    loading = ref(true),
    saving = ref(false),
    rendering = ref(false),
    error = ref(""),
    selected = ref(0),
    frame = ref(30),
    seek = ref(30),
    aiBusy = ref(false),
    suggestion = ref<any>(null),
    aiInstruction = ref(""),
    versionOpen = ref(false);
  const editable = (p: any) => ({
    ...p,
    studio: {
      musicVolume: 0.25,
      sfxVolume: 0.35,
      autoSfx: true,
      captions: true,
      ...p.studio,
    },
  });
  const draftKey = `motion-studio:${userId}:${scriptId}`;
  const dirty = computed(
    () => !!plan.value && JSON.stringify(plan.value) !== baseline.value,
  );
  const previewError = ref("");
  let lastPreview: ReturnType<typeof previewOf> | null = null;
  const preview = computed(() => {
    if (!plan.value) return null;
    try {
      lastPreview = previewOf(
        plan.value,
        data.value?.renderedSpec,
        data.value?.renderedPlan,
      );
      previewError.value = "";
    } catch {
      previewError.value =
        "Nội dung đang nhập chưa hợp lệ. Xem trước đang giữ bản hợp lệ gần nhất.";
    }
    return lastPreview;
  });
  const scene = computed(() => plan.value?.scenes[selected.value]);
  const busy = computed(() =>
    data.value?.jobs?.some((j: any) =>
      ["queued", "images", "tts", "rendering"].includes(j.status),
    ),
  );
  const latest = computed(() => data.value?.jobs?.[0]);
  const complete = computed(() =>
    data.value?.jobs?.find((j: any) => j.status === "done"),
  );
  const aiSource = ref("");
  let polling: ReturnType<typeof setTimeout> | undefined;
  async function load(silent = false) {
    try {
      const next = await api<any>(`/v1/scripts/${scriptId}/studio`);
      data.value = next;
      if (!silent) {
        plan.value = editable(next.plan);
        revision.value = next.revision;
        baseline.value = JSON.stringify(plan.value);
        try {
          const draft = JSON.parse(localStorage.getItem(draftKey) || "null");
          if (draft?.revision === next.revision) {
            plan.value = draft.plan;
            toast.info("Đã khôi phục bản nháp trên thiết bị này.");
          }
        } catch {}
        selected.value = Math.min(selected.value, plan.value.scenes.length - 1);
      }
      error.value = "";
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
  }
  async function poll() {
    if (busy.value) await load(true);
    polling = setTimeout(poll, 3500);
  }
  async function discard() {
    localStorage.removeItem(draftKey);
    await load();
  }
  async function save() {
    if (saving.value) return false;
    saving.value = true;
    try {
      const v = await api<any>(`/v1/scripts/${scriptId}/studio`, {
        method: "PUT",
        body: JSON.stringify({ plan: plan.value, revision: revision.value }),
      });
      plan.value = editable(v.plan);
      revision.value = v.revision;
      baseline.value = JSON.stringify(plan.value);
      localStorage.removeItem(draftKey);
      await load(true);
      toast.success("Đã lưu phiên bản kịch bản.");
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      saving.value = false;
    }
  }
  async function render() {
    if (rendering.value || busy.value) return;
    rendering.value = true;
    try {
      if (dirty.value && !(await save())) return;
      await api(`/v1/scripts/${scriptId}/approve`, { method: "POST" });
      await load(true);
      toast.success(
        "Đã bắt đầu dựng video. Bạn có thể theo dõi tiến độ tại đây.",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      rendering.value = false;
    }
  }
  function select(i: number) {
    selected.value = i;
    seek.value = (preview.value?.starts[i] || 0) + 25;
    suggestion.value = null;
  }
  function move(delta: number) {
    const i = selected.value,
      j = i + delta;
    if (j < 0 || j >= plan.value.scenes.length) return;
    const arr = plan.value.scenes;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    select(j);
  }
  function duplicate() {
    if (plan.value.scenes.length >= 14) return;
    const s = JSON.parse(JSON.stringify(scene.value));
    s.id = `scene-${crypto.randomUUID().slice(0, 8)}`;
    s.narration += " (Chỉnh sửa lời đọc cho cảnh mới.)";
    delete s.image;
    delete s.bgImage;
    plan.value.scenes.splice(selected.value + 1, 0, s);
    select(selected.value + 1);
  }
  function remove() {
    if (plan.value.scenes.length <= 2) return;
    plan.value.scenes.splice(selected.value, 1);
    select(Math.max(0, selected.value - 1));
  }
  async function revise() {
    if (aiBusy.value || !aiInstruction.value.trim()) return;
    if (dirty.value && !(await save())) return;
    aiBusy.value = true;
    aiSource.value = JSON.stringify(scene.value);
    try {
      const result = await api<any>(
        `/v1/scripts/${scriptId}/scenes/${encodeURIComponent(scene.value.id)}/revise`,
        {
          method: "POST",
          body: JSON.stringify({ instruction: aiInstruction.value }),
        },
      );
      suggestion.value = result.scene;
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      aiBusy.value = false;
    }
  }
  function applySuggestion() {
    if (JSON.stringify(scene.value) !== aiSource.value) {
      toast.error(
        "Cảnh đã thay đổi. Hãy yêu cầu AI sửa lại trên nội dung mới.",
      );
      return;
    }
    plan.value.scenes[selected.value] = suggestion.value;
    suggestion.value = null;
    aiInstruction.value = "";
  }
  async function restore(id: number) {
    if (
      dirty.value &&
      !window.confirm(
        "Khôi phục phiên bản sẽ bỏ các chỉnh sửa chưa lưu. Tiếp tục?",
      )
    )
      return;
    try {
      const v = await api<any>(
        `/v1/scripts/${scriptId}/versions/${id}/restore`,
        { method: "POST", body: JSON.stringify({ revision: revision.value }) },
      );
      localStorage.removeItem(draftKey);
      plan.value = editable(v.plan);
      revision.value = v.revision;
      baseline.value = JSON.stringify(plan.value);
      await load(true);
      versionOpen.value = false;
      select(0);
      toast.success("Đã khôi phục phiên bản.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  function unload(e: BeforeUnloadEvent) {
    if (dirty.value) {
      e.preventDefault();
      e.returnValue = "";
    }
  }
  watch(
    plan,
    () => {
      if (dirty.value)
        try {
          localStorage.setItem(
            draftKey,
            JSON.stringify({ revision: revision.value, plan: plan.value }),
          );
        } catch {}
    },
    { deep: true },
  );
  const removeGuard = router.beforeEach(
    () =>
      !dirty.value ||
      window.confirm(
        "Bạn có thay đổi chưa lưu. Rời bàn dựng? Bản nháp vẫn được giữ trên thiết bị này.",
      ),
  );
  onMounted(async () => {
    await load();
    poll();
    window.addEventListener("beforeunload", unload);
  });
  onBeforeUnmount(() => {
    clearTimeout(polling);
    removeGuard();
    window.removeEventListener("beforeunload", unload);
  });
  return {
    data,
    plan,
    loading,
    error,
    saving,
    rendering,
    selected,
    frame,
    seek,
    dirty,
    scene,
    preview,
    busy,
    latest,
    complete,
    aiBusy,
    suggestion,
    aiInstruction,
    versionOpen,
    previewError,
    load,
    discard,
    save,
    render,
    select,
    move,
    duplicate,
    remove,
    revise,
    applySuggestion,
    restore,
  };
}
