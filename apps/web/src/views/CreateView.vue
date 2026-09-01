<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
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

    for (const item of uploadItems.value) {
      item.status = "uploading";
      try {
        const form = new FormData();
        form.append("file", item.file, item.name);
        await apiForm(`/v1/projects/${projectId}/sources`, form);
        item.status = "done";
      } catch (cause) {
        item.status = "error";
        item.errorMessage = cause instanceof ApiError ? cause.message : "Tải lên thất bại.";
        toast.warning(`Tư liệu "${item.name}" tải lên thất bại — vẫn tiếp tục với các tư liệu còn lại.`);
      }
    }

    await api(`/v1/projects/${projectId}/generate`, { method: "POST" });
    toast.success("Đã bắt đầu sinh kịch bản — duyệt kịch bản khi AI hoàn tất.");
    emit("created", projectId);
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không thể tạo dự án.");
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-[760px] p-6 pb-24">
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

    <!-- Thanh hành động ghim cuối trang (chuẩn MDS màn Thêm/Sửa) -->
    <div
      class="fixed bottom-0 right-0 z-10 flex justify-end gap-2 border-t border-[var(--mds-neutral-300,#E9EAEB)] bg-[var(--mds-bg)] px-6 py-3"
      style="left: var(--mds-layout-sidebar-w, 200px)"
    >
      <MButton variant="primary" :loading="submitting" :disabled="!canSubmit" @click="submit">
        Tạo kịch bản
      </MButton>
    </div>
  </div>
</template>
