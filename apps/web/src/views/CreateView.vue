<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from "vue";
import MButton from "../components/mds/MButton.vue";
import MRadioGroup from "../components/mds/MRadioGroup.vue";
import MSelect from "../components/mds/MSelect.vue";
import MTextarea from "../components/mds/MTextarea.vue";
import MUpload from "../components/mds/MUpload.vue";
import RangeField from "../components/RangeField.vue";
import { useToast } from "../components/mds/toast.js";
import { api, apiForm, ApiError } from "../lib/api";
import MInput from "../components/mds/MInput.vue";
import type { MusicTrack, SeriesRow, TemplateRow, WatermarkPreset } from "../lib/types";

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
const voiceStyle = ref<"thoisu" | "tintuc">("tintuc");
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

const ACCEPT = ".txt,.md,.docx,.pdf,.mp3,.wav,.m4a,.mp4,.mov,.webm";

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
}

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

async function submit(): Promise<void> {
  ideaError.value = "";
  if (idea.value.trim().length < 10) {
    ideaError.value = "Nhập ý tưởng video, tối thiểu 10 ký tự.";
    return;
  }
  submitting.value = true;
  try {
    const { id: projectId } = await api<{ id: number }>("/v1/projects", {
      method: "POST",
      body: JSON.stringify({
        idea: idea.value.trim(),
        sourceMode: sourceMode.value,
        mode: mode.value,
        variantCount: variantCount.value,
        presetHint: presetHint.value || undefined,
        durationSec: durationSec.value,
        voiceGender: voiceGender.value,
        voiceRegion: voiceRegion.value,
        voiceStyle: voiceStyle.value,
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
      }),
    });

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
    toast.success("Đã bắt đầu sinh kịch bản — duyệt kịch bản khi AI hoàn tất.");
    resetForm();
    emit("created", projectId);
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không thể tạo dự án.");
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="flex min-h-full flex-col">
    <div class="mx-auto w-full max-w-[760px] flex-1 p-6">
    <header class="mb-4">
      <h1 class="m-0 text-xl font-semibold">Tạo video mới</h1>
      <p class="m-0 mt-1 text-[13px] text-[var(--mds-text-secondary)]">
        Nhập ý tưởng, đính kèm tư liệu (nếu có) — AI sinh kịch bản để bạn duyệt trước khi render.
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
          v-if="selectedTemplate?.profile"
          class="mt-1 block font-normal text-[var(--mds-text-secondary)]"
        >
          Preset khoá theo mẫu: {{ selectedTemplate.profile.preset }} ·
          {{ selectedTemplate.workflow.approveGate ? "có bước duyệt kịch bản" : "tự render không chờ duyệt" }}
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
        <p class="m-0 mb-1 text-[13px] font-medium">
          Tư liệu tham khảo
          <span class="font-normal text-[var(--mds-text-secondary)]">
            — txt, docx, pdf, âm thanh, video (≤18MB/file)</span>
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

    <!-- Thanh hành động ghim cuối trang (sticky trong vùng nội dung — tự canh theo
         bề rộng sidebar khi thu gọn/mở, không để lộ khoảng trống cạnh footer) -->
    <div
      class="sticky bottom-0 z-10 border-t border-[var(--mds-neutral-300,#E9EAEB)] bg-[var(--mds-bg)] px-6 py-3"
    >
      <div class="mx-auto flex w-full max-w-[760px] justify-end gap-2">
        <MButton variant="primary" :loading="submitting" :disabled="!canSubmit" @click="submit">
          Tạo kịch bản
        </MButton>
      </div>
    </div>
  </div>
</template>
