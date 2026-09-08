import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import { onBeforeRouteLeave, useRoute, useRouter } from "vue-router";
import { api } from "../lib/api";
import { useToast } from "../components/mds/toast.js";
import {
  motionDocumentSchema,
  type MotionDocument,
} from "@ams/motion-engine/src/motion/schema";
import { videoSpecSchema } from "@ams/motion-engine/src/schema/spec";
export const STAGES: Record<string, string> = {
  queued: "Đang chờ",
  preparing: "Cắt đoạn tham chiếu",
  analyzing: "Đọc chuyển động & âm thanh",
  composing: "Tạo các lớp chuyển động",
  rendering: "Dựng video",
  comparing: "Đối chiếu với clip gốc",
  refining: "Sửa theo kết quả đối chiếu",
  done: "Sẵn sàng nghiệm thu",
};
export function useReconstruction(templateId: number, userId: number) {
  const router = useRouter(),
    route = useRoute(),
    toast = useToast();
  const template = ref<any>(null),
    runs = ref<any[]>([]),
    run = ref<any>(null),
    loading = ref(true),
    busy = ref(false),
    error = ref("");
  const start = ref(0),
    duration = ref(8),
    iterations = ref(2),
    instruction = ref(""),
    document = ref<MotionDocument | null>(null),
    baseline = ref(""),
    selected = ref(""),
    frame = ref(0),
    revision = ref(0),
    jsonText = ref(""),
    aiInstruction = ref("");
  const active = computed(() =>
    ["queued", "running"].includes(run.value?.status),
  );
  const dirty = computed(
    () =>
      document.value !== null &&
      JSON.stringify(document.value) !== baseline.value,
  );
  const node = computed(() =>
    document.value?.nodes.find((n) => n.id === selected.value),
  );
  const validation = computed(() =>
    document.value ? motionDocumentSchema.safeParse(document.value) : null,
  );
  const valid = computed(() => validation.value?.success === true);
  const preview = computed(() =>
    validation.value?.success
      ? videoSpecSchema.parse({
          version: 1,
          meta: { title: "Chuyển động từ clip mẫu", slug: "reference-preview" },
          style: { preset: "paper", captions: false, progress: false },
          audio: { autoSfx: false },
          scenes: [
            {
              id: "motion",
              type: "motion",
              document: validation.value.data,
              soundDesign: "none",
            },
          ],
        })
      : null,
  );
  const comparison = computed(
    () =>
      run.value?.state?.versions?.find((v: any) => v.index === revision.value)
        ?.comparison,
  );
  const draftKey = `ams-motion-${userId}-${templateId}`;
  const asset = (name: string) =>
    run.value ? `/v1/motion-runs/${run.value.id}/assets/${name}` : "";
  function setDocument(doc: any) {
    document.value = structuredClone(doc);
    baseline.value = JSON.stringify(document.value);
    jsonText.value = JSON.stringify(doc, null, 2);
    selected.value = doc?.nodes?.[0]?.id ?? "";
  }
  async function selectRun(id: number, force = false) {
    if (
      !force &&
      dirty.value &&
      !window.confirm("Bỏ thay đổi chưa dựng để mở phiên bản khác?")
    )
      return;
    const next = await api<any>(`/v1/motion-runs/${id}`);
    run.value = next;
    if (next.status === "failed")
      error.value =
        next.error || "Bản tái dựng gặp lỗi. Có thể thử lại từ thiết lập.";
    start.value = next.options.startSec;
    duration.value = next.options.durationSec;
    iterations.value = next.options.iterations;
    instruction.value = next.options.instruction;
    revision.value =
      next.state.bestIndex ??
      Math.max(0, (next.state.versions?.length ?? 1) - 1);
    const doc =
      next.state.versions?.find((v: any) => v.index === revision.value)
        ?.document ?? next.state.document;
    if (doc) setDocument(doc);
    else {
      document.value = null;
      baseline.value = "";
    }
    await router.replace({ query: { ...route.query, run: String(id) } });
  }
  async function refresh() {
    runs.value = await api<any[]>(`/v1/motion-runs/templates/${templateId}`);
    if (run.value && active.value) {
      const next = await api<any>(`/v1/motion-runs/${run.value.id}`);
      run.value = next;
      if (next.status === "failed")
        error.value =
          next.error || "Bản tái dựng gặp lỗi. Có thể thử lại từ thiết lập.";
      if (!dirty.value && next.state.document) {
        setDocument(next.state.document);
        revision.value =
          next.state.bestIndex ??
          Math.max(0, (next.state.versions?.length ?? 1) - 1);
      }
    }
  }
  async function act(fn: () => Promise<void>) {
    busy.value = true;
    error.value = "";
    try {
      await fn();
    } catch (e) {
      error.value = (e as Error).message;
      toast.error(error.value);
    } finally {
      busy.value = false;
    }
  }
  async function create() {
    await act(async () => {
      const next = await api<{ id: number }>(
        `/v1/motion-runs/templates/${templateId}`,
        {
          method: "POST",
          body: JSON.stringify({
            startSec: Number(start.value),
            durationSec: Number(duration.value),
            iterations: Number(iterations.value),
            instruction: instruction.value,
          }),
        },
      );
      await selectRun(next.id, true);
      await refresh();
    });
  }
  async function render() {
    if (!valid.value) {
      error.value =
        "Chuyển động chưa hợp lệ. Kiểm tra mốc thời gian và các lớp.";
      return;
    }
    await act(async () => {
      const next = await api<{ id: number }>(
        `/v1/motion-runs/${run.value.id}/revise`,
        {
          method: "POST",
          body: JSON.stringify({ document: document.value, iterations: 1 }),
        },
      );
      localStorage.removeItem(draftKey);
      await selectRun(next.id, true);
      await refresh();
    });
  }
  async function revise() {
    if (!valid.value || aiInstruction.value.trim().length < 5) {
      error.value = "Nhập yêu cầu sửa tối thiểu 5 ký tự.";
      return;
    }
    await act(async () => {
      const next = await api<{ id: number }>(
        `/v1/motion-runs/${run.value.id}/revise`,
        {
          method: "POST",
          body: JSON.stringify({
            document: document.value,
            iterations: 1,
            instruction: aiInstruction.value,
          }),
        },
      );
      await selectRun(next.id, true);
      await refresh();
    });
  }
  async function use() {
    if (dirty.value) {
      error.value = "Hãy dựng bản sửa trước khi dùng làm mẫu.";
      return;
    }
    await act(async () => {
      await api(`/v1/motion-runs/${run.value.id}/use`, {
        method: "POST",
        body: JSON.stringify({ version: revision.value }),
      });
      toast.success(
        "Đã lưu chuyển động vào mẫu. Video mới sẽ dùng chuyển động này với nội dung mới.",
      );
      await router.push({
        path: "/tao-video",
        query: { template: String(templateId) },
      });
    });
  }
  function version(index: number) {
    if (dirty.value && !window.confirm("Bỏ thay đổi chưa dựng?")) return;
    revision.value = index;
    setDocument(
      run.value.state.versions.find((v: any) => v.index === index).document,
    );
  }
  function seek(sec: number) {
    frame.value = Math.round(sec * 30);
  }
  function addKey() {
    if (!node.value) return;
    const at = Number((frame.value / 30).toFixed(3));
    if (node.value.keyframes.some((k) => Math.abs(k.at - at) < 0.001)) return;
    node.value.keyframes.push({
      at,
      x: node.value.x,
      y: node.value.y,
      opacity: node.value.opacity,
      easing: "ease-out",
    });
    node.value.keyframes.sort((a, b) => a.at - b.at);
  }
  function applyJson() {
    try {
      setDocumentWithoutBaseline(
        motionDocumentSchema.parse(JSON.parse(jsonText.value)),
      );
      error.value = "";
    } catch (e) {
      error.value = "JSON chưa hợp lệ: " + (e as Error).message;
    }
  }
  function setDocumentWithoutBaseline(doc: MotionDocument) {
    document.value = doc;
    selected.value = doc.nodes[0]?.id ?? "";
  }
  function discard() {
    if (baseline.value) setDocument(JSON.parse(baseline.value));
    localStorage.removeItem(draftKey);
  }
  let timer: ReturnType<typeof setInterval> | undefined;
  const unload = (e: BeforeUnloadEvent) => {
    if (dirty.value) {
      e.preventDefault();
      e.returnValue = "";
    }
  };
  onMounted(async () => {
    try {
      template.value = await api(`/v1/templates/${templateId}`);
      await refresh();
      const id = Number(route.query.run) || runs.value[0]?.id;
      if (id) await selectRun(id, true);
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw);
        if (
          draft.runId === run.value?.id &&
          draft.baseline === baseline.value
        ) {
          document.value = motionDocumentSchema.parse(draft.document);
          toast.info("Đã khôi phục bản chỉnh sửa trên máy này.");
        }
      }
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      loading.value = false;
    }
    timer = setInterval(() => {
      if (active.value)
        void refresh().catch((e) => {
          error.value = e.message;
        });
    }, 3500);
    window.addEventListener("beforeunload", unload);
  });
  onBeforeUnmount(() => {
    if (timer) clearInterval(timer);
    window.removeEventListener("beforeunload", unload);
  });
  onBeforeRouteLeave(
    () =>
      !dirty.value ||
      window.confirm("Thay đổi đang lưu nháp trên máy này. Rời bàn tái dựng?"),
  );
  watch(
    document,
    () => {
      if (dirty.value)
        try {
          localStorage.setItem(
            draftKey,
            JSON.stringify({
              runId: run.value?.id,
              baseline: baseline.value,
              document: document.value,
            }),
          );
        } catch {
          error.value =
            "Không lưu được nháp trên trình duyệt. Hãy lưu và dựng bản sửa trước khi rời trang.";
        }
    },
    { deep: true },
  );
  return {
    template,
    runs,
    run,
    loading,
    busy,
    error,
    start,
    duration,
    iterations,
    instruction,
    document,
    selected,
    node,
    frame,
    revision,
    jsonText,
    aiInstruction,
    revise,
    active,
    dirty,
    valid,
    validation,
    preview,
    comparison,
    asset,
    create,
    render,
    use,
    selectRun: (id: number) => act(() => selectRun(id)),
    version,
    seek,
    addKey,
    applyJson,
    discard,
    router,
  };
}
export type ReconstructionState = ReturnType<typeof useReconstruction>;
