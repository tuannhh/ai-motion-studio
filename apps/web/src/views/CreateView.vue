<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from "vue";
import MButton from "../components/mds/MButton.vue";
import MIcon from "../components/mds/MIcon.vue";
import MRadioGroup from "../components/mds/MRadioGroup.vue";
import MSelect from "../components/mds/MSelect.vue";
import MTextarea from "../components/mds/MTextarea.vue";
import MUpload from "../components/mds/MUpload.vue";
import RangeField from "../components/RangeField.vue";
import { useToast } from "../components/mds/toast.js";
import { api, apiForm, ApiError } from "../lib/api";
import MInput from "../components/mds/MInput.vue";
import MTag from "../components/mds/MTag.vue";
import type {
  MusicTrack,
  ProjectDetail,
  SeriesRow,
  SourceRow,
  TemplateRow,
  WatermarkPreset,
} from "../lib/types";

/** editProjectId = đang sửa thiết lập & làm lại 1 project đã có (từ "Video đã tạo");
 * null = tạo mới bình thường. Video đã render trước đó KHÔNG bị mất khi làm lại. */
const props = defineProps<{ editProjectId?: number | null }>();
const emit = defineEmits<{ created: [projectId: number] }>();
const toast = useToast();

const idea = ref("");
const sourceMode = ref<"user" | "ai" | "combine">("user");
/** Link tư liệu người dùng dán vào (mặc định 1 ô rỗng, bấm "Thêm link" để có thêm) */
const linkInputs = ref<string[]>([""]);
const mode = ref<"angles" | "series">("angles");
const variantCount = ref(1);
const presetHint = ref("");
const durationSec = ref(45);
const voiceGender = ref<"male" | "female">("female");
const voiceRegion = ref<"bac" | "nam">("bac");
const voiceStyle = ref<"thoisu" | "tintuc" | "tvc">("tintuc");
const voiceMood = ref<"neutral" | "cheerful" | "energetic">("neutral");
const voiceAge = ref<"thanhnien" | "trungnien" | "nguoidilam">("nguoidilam");
const voiceSpeed = ref<1 | 1.2>(1);
const ideaError = ref("");
const submitting = ref(false);

// Template-from-video: chọn mẫu → prefill + khoá preset theo phong cách đã học
const templates = ref<TemplateRow[]>([]);
const templateId = ref<number | "">("");
onMounted(async () => {
  try {
    const all = await api<TemplateRow[]>("/v1/templates");
    templates.value = all.filter((t) => t.status === "ready");
  } catch {
    // không có template không chặn màn tạo video
  }
});
// Serie manager: chế độ series chọn serie có sẵn (AI nhớ ngữ cảnh tập trước)
// hoặc tạo serie mới bằng tên
const seriesList = ref<SeriesRow[]>([]);
const seriesId = ref<number | "">("");
const newSeriesName = ref("");
onMounted(async () => {
  try {
    seriesList.value = await api<SeriesRow[]>("/v1/series");
  } catch {
    // không có serie không chặn màn tạo video
  }
});
const seriesOptions = computed(() => [
  { label: "Serie mới — nhập tên bên dưới", value: "" as const },
  ...seriesList.value.map((s) => ({
    label: `${s.name} (${s.episode_count} tập)`,
    value: s.id,
  })),
]);

// Nhạc nền: chọn từ thư viện chung (admin tải lên); engine tự ducking dưới voiceover
const musicTracks = ref<MusicTrack[]>([]);
const musicTrackId = ref<number | "">("");
onMounted(async () => {
  try {
    musicTracks.value = await api<MusicTrack[]>("/v1/music");
  } catch {
    // không có nhạc không chặn màn tạo video
  }
});
const musicOptions = computed(() => [
  { label: "Không dùng nhạc nền", value: "" as const },
  ...musicTracks.value.map((m) => ({ label: m.name, value: m.id })),
]);

// Watermark: chọn từ thư viện của user (không chọn = watermark mặc định hệ thống)
const watermarkPresets = ref<WatermarkPreset[]>([]);
const watermarkPresetId = ref<number | "">("");
onMounted(async () => {
  try {
    watermarkPresets.value = await api<WatermarkPreset[]>("/v1/watermark-presets");
  } catch {
    // không có watermark không chặn màn tạo video
  }
});
const watermarkOptions = computed(() => [
  { label: "Mặc định hệ thống", value: "" as const },
  ...watermarkPresets.value.map((w) => ({ label: w.name, value: w.id })),
]);

const templateOptions = computed(() => [
  { label: "Không dùng — thiết lập thủ công", value: "" as const },
  ...templates.value.map((t) => ({ label: t.name, value: t.id })),
]);
const selectedTemplate = computed(
  () => templates.value.find((t) => t.id === templateId.value) ?? null
);
watch(selectedTemplate, (t) => {
  if (!t) {
    presetHint.value = "";
    return;
  }
  // Template CHỈ khoá phong cách/preset + pipeline kịch bản. Chế độ, số kịch bản,
  // thời lượng, giọng là do người dùng đặt Ở MÀN NÀY (không bị template ghi đè).
  if (t.profile) presetHint.value = t.profile.preset;
});

type UploadItem = {
  id: string;
  name: string;
  size: number;
  status: "pending" | "uploading" | "done" | "error";
  errorMessage?: string;
  file: File;
};
const uploadItems = ref<UploadItem[]>([]);

const ACCEPT = ".txt,.md,.docx,.pdf,.mp3,.wav,.m4a,.mp4,.mov,.webm,.jpg,.jpeg,.png,.webp";

function onSelectFiles(files: File[]): void {
  for (const file of files) {
    uploadItems.value.push({
      id: `${Date.now()}-${file.name}`,
      name: file.name,
      size: file.size,
      status: "pending",
      file,
    });
  }
}
function onRemove(id: string): void {
  uploadItems.value = uploadItems.value.filter((i) => i.id !== id);
}

function addLink(): void {
  linkInputs.value.push("");
}
function removeLink(index: number): void {
  linkInputs.value.splice(index, 1);
  if (linkInputs.value.length === 0) linkInputs.value.push("");
}
// Chỉ hiện phần tư liệu người dùng (file + link) khi nguồn không phải "AI tự tìm"
const showUserSources = computed(() => sourceMode.value !== "ai");

const variantOptions = computed(() =>
  [1, 2, 3, 4, 5].map((n) => ({
    label: mode.value === "series" ? `${n} tập` : `${n} kịch bản`,
    value: n,
  }))
);
const presetOptions = [
  { label: "AI tự chọn theo nội dung", value: "" },
  { label: "Midnight — công nghệ, tối xanh", value: "midnight" },
  { label: "Noir — tin nóng, đen + đỏ", value: "noir" },
  { label: "Paper — giáo dục, kem tối giản", value: "paper" },
  { label: "Aurora — sáng tạo, tím", value: "aurora" },
];

const canSubmit = computed(() => idea.value.trim().length >= 10 && !submitting.value);

/** Reset form về trạng thái trống (gọi sau khi tạo xong) */
function resetForm(): void {
  idea.value = "";
  sourceMode.value = "user";
  linkInputs.value = [""];
  uploadItems.value = [];
  templateId.value = "";
  seriesId.value = "";
  newSeriesName.value = "";
  musicTrackId.value = "";
  watermarkPresetId.value = "";
  presetHint.value = "";
  mode.value = "angles";
  variantCount.value = 1;
  durationSec.value = 45;
  existingSources.value = [];
}

// ---- Sửa thiết lập & làm lại (mở từ "Video đã tạo") ----
const editLoading = ref(false);
/** Tư liệu ĐÃ có sẵn trên project đang sửa (khác uploadItems = tư liệu MỚI thêm) */
const existingSources = ref<SourceRow[]>([]);
const removingSourceId = ref<number | null>(null);

async function loadForEdit(projectId: number): Promise<void> {
  editLoading.value = true;
  try {
    const { project, sources } = await api<ProjectDetail>(`/v1/projects/${projectId}`);
    idea.value = project.idea;
    sourceMode.value = project.source_mode;
    mode.value = project.mode;
    variantCount.value = project.variant_count;
    presetHint.value = project.preset_hint ?? "";
    durationSec.value = project.duration_sec ?? 45;
    voiceGender.value = project.voice_gender;
    voiceRegion.value = project.voice_region;
    voiceStyle.value = project.voice_style;
    voiceMood.value = project.voice_mood;
    voiceAge.value = project.voice_age;
    voiceSpeed.value = Number(project.voice_speed) === 1.2 ? 1.2 : 1;
    templateId.value = project.template_id ?? "";
    seriesId.value = project.series_id ?? "";
    newSeriesName.value = "";
    musicTrackId.value = project.music_track_id ?? "";
    watermarkPresetId.value = project.watermark_preset_id ?? "";
    existingSources.value = sources;
    linkInputs.value = [""];
    uploadItems.value = [];
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không nạp được thiết lập project.");
  } finally {
    editLoading.value = false;
  }
}

async function removeExistingSource(sourceId: number): Promise<void> {
  if (!props.editProjectId) return;
  removingSourceId.value = sourceId;
  try {
    await api(`/v1/projects/${props.editProjectId}/sources/${sourceId}`, { method: "DELETE" });
    existingSources.value = existingSources.value.filter((s) => s.id !== sourceId);
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không xoá được tư liệu.");
  } finally {
    removingSourceId.value = null;
  }
}

watch(
  () => props.editProjectId,
  (id) => {
    if (id) void loadForEdit(id);
    else resetForm();
  },
  { immediate: true }
);

/** KeepAlive: mỗi lần quay lại màn, nạp lại các danh sách chọn (template/serie/nhạc/watermark mới tạo) */
onActivated(async () => {
  try {
    const [tpls, series, music, wms] = await Promise.all([
      api<TemplateRow[]>("/v1/templates"),
      api<SeriesRow[]>("/v1/series"),
      api<MusicTrack[]>("/v1/music"),
      api<WatermarkPreset[]>("/v1/watermark-presets"),
    ]);
    templates.value = tpls.filter((t) => t.status === "ready");
    seriesList.value = series;
    musicTracks.value = music;
    watermarkPresets.value = wms;
  } catch {
    // lỗi nạp danh sách không chặn màn tạo video
  }
});

/** Đợi mọi tư liệu trích xuất xong (status khác 'extracting'). Trả false nếu quá hạn (~90s). */
async function waitForExtraction(projectId: number): Promise<boolean> {
  for (let i = 0; i < 45; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const detail = await api<{ sources: Array<{ status: string }> }>(
        `/v1/projects/${projectId}`
      );
      if (!detail.sources.some((s) => s.status === "extracting")) return true;
    } catch {
      // lỗi 1 nhịp poll không dừng cả vòng
    }
  }
  return false;
}

function buildSettingsPayload() {
  return {
    idea: idea.value.trim(),
    sourceMode: sourceMode.value,
    mode: mode.value,
    variantCount: variantCount.value,
    presetHint: presetHint.value || undefined,
    durationSec: durationSec.value,
    voiceGender: voiceGender.value,
    voiceRegion: voiceRegion.value,
    voiceStyle: voiceStyle.value,
    voiceMood: voiceMood.value,
    voiceAge: voiceAge.value,
    voiceSpeed: voiceSpeed.value,
    templateId: templateId.value === "" ? undefined : templateId.value,
    musicTrackId: musicTrackId.value === "" ? undefined : musicTrackId.value,
    watermarkPresetId:
      watermarkPresetId.value === "" ? undefined : watermarkPresetId.value,
    seriesId:
      mode.value === "series" && seriesId.value !== "" ? seriesId.value : undefined,
    newSeriesName:
      mode.value === "series" && seriesId.value === "" && newSeriesName.value.trim()
        ? newSeriesName.value.trim()
        : undefined,
  };
}

async function submit(): Promise<void> {
  ideaError.value = "";
  if (idea.value.trim().length < 10) {
    ideaError.value = "Nhập ý tưởng video, tối thiểu 10 ký tự.";
    return;
  }
  submitting.value = true;
  try {
    let projectId: number;
    if (props.editProjectId) {
      projectId = props.editProjectId;
      await api(`/v1/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify(buildSettingsPayload()),
      });
    } else {
      const created = await api<{ id: number }>("/v1/projects", {
        method: "POST",
        body: JSON.stringify(buildSettingsPayload()),
      });
      projectId = created.id;
    }

    // Chỉ nạp tư liệu người dùng khi nguồn là "user"/"combine" (bỏ qua khi "AI tự tìm")
    let hasSources = false;
    if (sourceMode.value !== "ai") {
      for (const item of uploadItems.value) {
        item.status = "uploading";
        try {
          const form = new FormData();
          form.append("file", item.file, item.name);
          await apiForm(`/v1/projects/${projectId}/sources`, form);
          item.status = "done";
          hasSources = true;
        } catch (cause) {
          item.status = "error";
          item.errorMessage = cause instanceof ApiError ? cause.message : "Tải lên thất bại.";
          toast.warning(`Tư liệu "${item.name}" tải lên thất bại — vẫn tiếp tục với các tư liệu còn lại.`);
        }
      }
      for (const raw of linkInputs.value) {
        const url = raw.trim();
        if (!url) continue;
        try {
          await api(`/v1/projects/${projectId}/sources/link`, {
            method: "POST",
            body: JSON.stringify({ url }),
          });
          hasSources = true;
        } catch (cause) {
          toast.warning(
            `Link "${url.slice(0, 40)}" lỗi: ${cause instanceof ApiError ? cause.message : "không thêm được"} — vẫn tiếp tục.`
          );
        }
      }
    }

    // #8: bấm "Tạo kịch bản" xong mới trích xuất — đợi trích xuất xong rồi mới sinh.
    if (hasSources) {
      toast.info("Đang trích xuất tư liệu…");
      const ok = await waitForExtraction(projectId);
      if (!ok) {
        toast.warning("Tư liệu trích xuất chậm — vẫn tiếp tục sinh kịch bản với phần đã sẵn sàng.");
      }
    }

    await api(`/v1/projects/${projectId}/generate`, { method: "POST" });
    toast.success(
      props.editProjectId
        ? "Đã lưu thiết lập mới — đang sinh lại kịch bản (video cũ vẫn giữ nguyên)."
        : "Đã bắt đầu sinh kịch bản — duyệt kịch bản khi AI hoàn tất."
    );
    if (!props.editProjectId) resetForm();
    emit("created", projectId);
  } catch (cause) {
    toast.error(
      cause instanceof ApiError
        ? cause.message
        : props.editProjectId
          ? "Không lưu được thiết lập."
          : "Không thể tạo dự án."
    );
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="min-h-0 flex-1 overflow-auto">
      <div class="mx-auto w-full max-w-[760px] p-6">
    <header class="mb-4">
      <h1 class="m-0 text-xl font-semibold">
        {{ editProjectId ? "Sửa thiết lập & làm lại" : "Tạo video mới" }}
      </h1>
      <p class="m-0 mt-1 text-[13px] text-[var(--mds-text-secondary)]">
        {{
          editProjectId
            ? "Đổi thời lượng, tư liệu, giọng đọc… rồi sinh lại kịch bản. Video đã render trước đó vẫn giữ nguyên."
            : "Nhập ý tưởng, đính kèm tư liệu (nếu có) — AI sinh kịch bản để bạn duyệt trước khi render."
        }}
      </p>
    </header>

    <section class="rounded-lg bg-[var(--mds-bg)] p-5 shadow-[var(--mds-shadow-card)]">
      <label class="block text-[13px] font-medium">
        Ý tưởng video <span class="text-[var(--mds-danger)]">*</span>
        <MTextarea
          v-model="idea"
          class="mt-1"
          :rows="3"
          :maxlength="2000"
          placeholder="Ví dụ: 5 cách dùng AI tăng năng suất cho dân văn phòng, tập trung ví dụ thực tế..."
          :error="ideaError"
        />
      </label>

      <label v-if="templates.length" class="mt-4 block text-[13px] font-medium">
        Video Template (phong cách + pipeline đã học từ video mẫu)
        <MSelect v-model="templateId" class="mt-1" :options="templateOptions" />
        <span
          v-if="selectedTemplate?.profile && selectedTemplate.workflow.approveGate"
          class="mt-1 block font-normal text-[var(--mds-text-secondary)]"
        >
          Preset khoá theo mẫu: {{ selectedTemplate.profile.preset }} · có bước duyệt kịch bản
        </span>
        <span
          v-else-if="selectedTemplate?.profile"
          class="mt-1 flex items-start gap-1.5 rounded-md bg-[var(--mds-warning-bg,#FFF7E6)] p-2 font-normal text-[var(--mds-warning-text,#8A5A00)]"
        >
          <MIcon name="alert-triangle" :size="16" class="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Mẫu này <strong>tự render ngay, KHÔNG chờ bạn duyệt</strong> kịch bản (preset
            {{ selectedTemplate.profile.preset }}). Muốn xem/sửa kịch bản trước khi render thì bật
            "Gate duyệt kịch bản" trong Video Template, hoặc bỏ chọn mẫu này.
          </span>
        </span>
      </label>

      <div class="mt-4">
        <p class="m-0 mb-1 text-[13px] font-medium">Nguồn tư liệu sinh kịch bản</p>
        <MRadioGroup
          v-model="sourceMode"
          :options="[
            { label: 'Chỉ dùng tư liệu tôi cung cấp (file + link)', value: 'user' },
            { label: 'Để AI tự tìm tài liệu trên web theo ý tưởng', value: 'ai' },
            { label: 'Kết hợp — tư liệu của tôi + AI tự tìm thêm', value: 'combine' },
          ]"
          direction="vertical"
        />
        <p
          v-if="sourceMode !== 'user'"
          class="m-0 mt-1 text-xs text-[var(--mds-text-secondary)]"
        >
          AI dùng Google Search để tra cứu — thông tin có thể chưa được kiểm chứng, hãy duyệt kịch bản kỹ.
        </p>
      </div>

      <div v-if="showUserSources" class="mt-4">
        <div v-if="editProjectId && existingSources.length" class="mb-3">
          <p class="m-0 mb-1 text-[13px] font-medium">Tư liệu hiện có ({{ existingSources.length }})</p>
          <ul class="m-0 list-none space-y-1 p-0">
            <li
              v-for="s in existingSources"
              :key="s.id"
              class="flex items-center gap-2 rounded-md bg-[var(--mds-bg-page)] px-2 py-1.5 text-[13px]"
            >
              <MIcon name="file-text" :size="16" class="shrink-0 text-[var(--mds-text-secondary)]" />
              <span class="min-w-0 flex-1 truncate">{{ s.file_name }}</span>
              <MTag :color="s.status === 'ready' ? 'success' : s.status === 'failed' ? 'danger' : 'info'" size="sm">
                {{ s.status === "ready" ? "Đã trích xuất" : s.status === "failed" ? "Lỗi" : "Đang trích xuất" }}
              </MTag>
              <MButton
                :loading="removingSourceId === s.id"
                title="Xoá tư liệu"
                @click="removeExistingSource(s.id)"
              >
                <MIcon name="trash" :size="16" />
              </MButton>
            </li>
          </ul>
        </div>
        <p class="m-0 mb-1 text-[13px] font-medium">
          {{ editProjectId ? "Thêm tư liệu mới" : "Tư liệu tham khảo" }}
          <span class="font-normal text-[var(--mds-text-secondary)]">
            — txt, docx, pdf, âm thanh, video, ảnh (jpg/png/webp) (≤18MB/file). Ảnh thật của bạn sẽ được AI ưu tiên dùng làm minh hoạ.</span>
        </p>
        <MUpload
          v-model="uploadItems"
          :accept="ACCEPT"
          :max-size-m-b="18"
          label="Đính kèm tư liệu"
          @select-files="onSelectFiles"
          @remove="onRemove"
        />

        <p class="m-0 mb-1 mt-4 text-[13px] font-medium">
          Link tư liệu
          <span class="font-normal text-[var(--mds-text-secondary)]">
            — dán đường dẫn bài viết/trang web (http/https)</span>
        </p>
        <div class="space-y-2">
          <div v-for="(_, i) in linkInputs" :key="i" class="flex items-center gap-2">
            <MInput
              v-model="linkInputs[i]"
              class="flex-1"
              :maxlength="2000"
              placeholder="https://vd.com/bai-viet"
            />
            <MButton
              v-if="linkInputs.length > 1"
              class="shrink-0"
              title="Xoá link"
              @click="removeLink(i)"
            >
              Xoá
            </MButton>
          </div>
        </div>
        <MButton class="mt-2" @click="addLink">+ Thêm link</MButton>
      </div>

      <div class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <label class="block text-[13px] font-medium">
          Chế độ kịch bản
          <MRadioGroup
            v-model="mode"
            class="mt-1"
            :options="[
              { label: 'Đa chiều — nhiều góc nhìn', value: 'angles' },
              { label: 'Serie — các tập nối tiếp', value: 'series' },
            ]"
            direction="vertical"
          />
        </label>
        <label class="block text-[13px] font-medium">
          Số kịch bản
          <MSelect v-model="variantCount" class="mt-1" :options="variantOptions" />
        </label>
        <template v-if="mode === 'series'">
          <label class="block text-[13px] font-medium">
            Serie
            <MSelect v-model="seriesId" class="mt-1" :options="seriesOptions" />
            <span class="mt-1 block font-normal text-[var(--mds-text-secondary)]">
              Chọn serie có sẵn — AI nhớ nội dung các tập trước để nối tiếp, không lặp lại.
            </span>
          </label>
          <label v-if="seriesId === ''" class="block text-[13px] font-medium">
            Tên serie mới
            <MInput
              v-model="newSeriesName"
              class="mt-1"
              :maxlength="40"
              placeholder="Ví dụ: AI 101"
            />
          </label>
        </template>
        <label class="block text-[13px] font-medium md:col-span-2">
          Tông màu (preset)
          <MSelect
            v-model="presetHint"
            class="mt-1"
            :options="presetOptions"
            :disabled="!!selectedTemplate"
          />
        </label>
      </div>

      <div class="mt-5">
        <p class="m-0 mb-1 text-[13px] font-medium">Thời lượng video mục tiêu</p>
        <RangeField
          v-model="durationSec"
          :min="20"
          :max="120"
          :step="5"
          :format="(v) => `${v}s`"
        />
      </div>

      <label v-if="musicTracks.length" class="mt-5 block text-[13px] font-medium">
        Nhạc nền
        <MSelect v-model="musicTrackId" class="mt-1" :options="musicOptions" />
        <span class="mt-1 block font-normal text-[var(--mds-text-secondary)]">
          Nhạc tự nhỏ lại khi có lời đọc (sidechain ducking) — chọn "Không dùng" nếu muốn chỉ giọng đọc.
        </span>
      </label>

      <label class="mt-5 block text-[13px] font-medium">
        Watermark
        <MSelect v-model="watermarkPresetId" class="mt-1" :options="watermarkOptions" />
        <span class="mt-1 block font-normal text-[var(--mds-text-secondary)]">
          Chọn từ thư viện Watermark của bạn — không chọn thì dùng watermark mặc định hệ thống.
        </span>
      </label>
    </section>

    <section class="mt-4 rounded-lg bg-[var(--mds-bg)] p-5 shadow-[var(--mds-shadow-card)]">
      <h2 class="m-0 text-[15px] font-semibold">Giọng đọc</h2>
      <p class="m-0 mt-0.5 text-[13px] text-[var(--mds-text-secondary)]">
        Mỗi video dùng đúng một giọng thống nhất từ đầu đến cuối.
      </p>
      <div class="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
        <label class="block text-[13px] font-medium">
          Giọng
          <MRadioGroup
            v-model="voiceGender"
            class="mt-1"
            :options="[
              { label: 'Nữ', value: 'female' },
              { label: 'Nam', value: 'male' },
            ]"
            direction="horizontal"
          />
        </label>
        <label class="block text-[13px] font-medium">
          Miền
          <MRadioGroup
            v-model="voiceRegion"
            class="mt-1"
            :options="[
              { label: 'Miền Bắc', value: 'bac' },
              { label: 'Miền Nam', value: 'nam' },
            ]"
            direction="horizontal"
          />
        </label>
        <label class="block text-[13px] font-medium">
          Phong cách đọc
          <MRadioGroup
            v-model="voiceStyle"
            class="mt-1"
            :options="[
              { label: 'Tin tức — gọn, dứt khoát', value: 'tintuc' },
              { label: 'Thời sự — trang trọng', value: 'thoisu' },
              { label: 'Quảng cáo — TVC sôi nổi', value: 'tvc' },
            ]"
            direction="horizontal"
          />
        </label>
        <label class="block text-[13px] font-medium">
          Tâm trạng
          <MRadioGroup
            v-model="voiceMood"
            class="mt-1"
            :options="[
              { label: 'Trung tính', value: 'neutral' },
              { label: 'Vui vẻ', value: 'cheerful' },
              { label: 'Năng động', value: 'energetic' },
            ]"
            direction="horizontal"
          />
        </label>
        <label class="block text-[13px] font-medium">
          Độ tuổi giọng đọc
          <MRadioGroup
            v-model="voiceAge"
            class="mt-1"
            :options="[
              { label: 'Thanh niên', value: 'thanhnien' },
              { label: 'Trung niên', value: 'trungnien' },
              { label: 'Người đi làm', value: 'nguoidilam' },
            ]"
            direction="horizontal"
          />
        </label>
        <label class="block text-[13px] font-medium">
          Tốc độ đọc
          <MRadioGroup
            v-model="voiceSpeed"
            class="mt-1"
            :options="[
              { label: 'Bình thường', value: 1 },
              { label: 'Nhanh (1,2x)', value: 1.2 },
            ]"
            direction="horizontal"
          />
        </label>
      </div>
      </section>
      </div>
    </div>

    <!-- Thanh hành động ghim đáy: footer là flex-item shrink-0 của cột nội dung nên
         luôn nằm sát đáy vùng main, phần cuộn nằm ở div overflow-auto phía trên
         (không phụ thuộc chiều cao %, không lộ khoảng trống khi nội dung ngắn) -->
    <div
      class="shrink-0 border-t border-[var(--mds-neutral-300,#E9EAEB)] bg-[var(--mds-bg)] px-6 py-3"
    >
      <div class="mx-auto flex w-full max-w-[760px] justify-end gap-2">
        <MButton variant="primary" :loading="submitting" :disabled="!canSubmit || editLoading" @click="submit">
          {{ editProjectId ? "Lưu & làm lại" : "Tạo kịch bản" }}
        </MButton>
      </div>
    </div>
  </div>
</template>
