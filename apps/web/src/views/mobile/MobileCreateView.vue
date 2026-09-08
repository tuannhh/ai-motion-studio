<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import MButton from "../../components/mds/MButton.vue";
import MIcon from "../../components/mds/MIcon.vue";
import MInput from "../../components/mds/MInput.vue";
import MRadioGroup from "../../components/mds/MRadioGroup.vue";
import MSelect from "../../components/mds/MSelect.vue";
import MTextarea from "../../components/mds/MTextarea.vue";
import MUpload from "../../components/mds/MUpload.vue";
import RangeField from "../../components/RangeField.vue";
import MMobileTopBar from "../../components/mobile/MMobileTopBar.vue";
import { useToast } from "../../components/mds/toast.js";
import MusicUpload from "../../studio/MusicUpload.vue";
import { api, apiForm, ApiError } from "../../lib/api";
import type {
  MusicTrack,
  SeriesRow,
  TemplateRow,
  WatermarkPreset,
} from "../../lib/types";

const emit = defineEmits<{ created: [projectId: number]; close: [] }>();
const toast = useToast();

const idea = ref("");
const ideaError = ref("");
const sourceMode = ref<"user" | "ai" | "combine">("user");
const linkInputs = ref([""]);
const uploadItems = ref<
  Array<{
    id: string;
    name: string;
    size: number;
    status: "pending";
    file: File;
  }>
>([]);
const mode = ref<"angles" | "series">("angles");
const variantCount = ref(1);
const seriesId = ref<number | "">("");
const newSeriesName = ref("");
const presetHint = ref("");
const durationSec = ref(45);
const musicTrackId = ref<number | "">("");
const watermarkPresetId = ref<number | "">("");
const templateId = ref<number | "">("");
const voiceGender = ref<"female" | "male">("female");
const voiceRegion = ref<"bac" | "nam">("bac");
const voiceStyle = ref<"tintuc" | "thoisu" | "tvc">("tintuc");
const voiceMood = ref<"neutral" | "cheerful" | "energetic">("neutral");
const voiceAge = ref<"thanhnien" | "trungnien" | "nguoidilam">("nguoidilam");
const voiceSpeed = ref<1 | 1.2>(1);
const submitting = ref(false);

const seriesList = ref<SeriesRow[]>([]);
const musicTracks = ref<MusicTrack[]>([]);
const watermarkPresets = ref<WatermarkPreset[]>([]);
const templates = ref<TemplateRow[]>([]);

const ACCEPT =
  ".txt,.md,.docx,.pdf,.mp3,.wav,.m4a,.mp4,.mov,.webm,.jpg,.jpeg,.png,.webp";
const showUserSources = computed(() => sourceMode.value !== "ai");
const selectedTemplate = computed(() =>
  templates.value.find((item) => item.id === templateId.value),
);
const seriesOptions = computed(() => [
  { label: "Serie mới", value: "" },
  ...seriesList.value.map((item) => ({
    label: `${item.name} (${item.episode_count} tập)`,
    value: item.id,
  })),
]);
async function onMusicUploaded(id: number) {
  musicTracks.value = await api<MusicTrack[]>("/v1/music");
  musicTrackId.value = id;
}
const musicOptions = computed(() => [
  { label: "Không dùng nhạc", value: "" },
  ...musicTracks.value.map((item) => ({ label: item.name, value: item.id })),
]);
const watermarkOptions = computed(() => [
  { label: "Mặc định hệ thống", value: "" },
  ...watermarkPresets.value.map((item) => ({
    label: item.name,
    value: item.id,
  })),
]);
const templateOptions = computed(() => [
  { label: "Thiết lập thủ công", value: "" },
  ...templates.value
    .filter((item) => item.status === "ready")
    .map((item) => ({ label: item.name, value: item.id })),
]);
const variantOptions = computed(() =>
  [1, 2, 3, 4, 5].map((value) => ({
    label: mode.value === "series" ? `${value} tập` : `${value} kịch bản`,
    value,
  })),
);

async function loadOptions(): Promise<void> {
  try {
    const [series, music, watermarks, templateRows] = await Promise.all([
      api<SeriesRow[]>("/v1/series"),
      api<MusicTrack[]>("/v1/music"),
      api<WatermarkPreset[]>("/v1/watermark-presets"),
      api<TemplateRow[]>("/v1/templates"),
    ]);
    seriesList.value = series;
    musicTracks.value = music;
    watermarkPresets.value = watermarks;
    templates.value = templateRows;
    const requestedTemplate = Number(new URLSearchParams(window.location.search).get("template"));
    if (templateRows.some(t=>t.id===requestedTemplate && t.status==='ready')) templateId.value=requestedTemplate;
  } catch {
    // Các danh mục phụ không được chặn luồng tạo video.
  }
}
onMounted(() => void loadOptions());

function addLink(): void {
  linkInputs.value.push("");
}
function removeLink(index: number): void {
  linkInputs.value.splice(index, 1);
  if (!linkInputs.value.length) linkInputs.value.push("");
}
function selectFiles(files: File[]): void {
  uploadItems.value.push(
    ...files.map((file) => ({
      id: `${Date.now()}-${file.name}`,
      name: file.name,
      size: file.size,
      status: "pending" as const,
      file,
    })),
  );
}
function removeFile(id: string): void {
  uploadItems.value = uploadItems.value.filter((item) => item.id !== id);
}

async function waitForExtraction(projectId: number): Promise<void> {
  for (let index = 0; index < 45; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    try {
      const detail = await api<{ sources: Array<{ status: string }> }>(
        `/v1/projects/${projectId}`,
      );
      if (!detail.sources.some((source) => source.status === "extracting"))
        return;
    } catch {
      // Hết một nhịp polling không làm hỏng cả thao tác.
    }
  }
}

async function submit(): Promise<void> {
  ideaError.value = "";
  if (idea.value.trim().length < 10) {
    ideaError.value = "Nhập ý tưởng video, tối thiểu 10 ký tự.";
    await nextTick();
    document
      .querySelector<HTMLTextAreaElement>("[data-mobile-idea] textarea")
      ?.focus();
    return;
  }
  submitting.value = true;
  try {
    const { id } = await api<{ id: number }>("/v1/projects", {
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
        voiceMood: voiceMood.value,
        voiceAge: voiceAge.value,
        voiceSpeed: voiceSpeed.value,
        templateId: templateId.value || undefined,
        musicTrackId: musicTrackId.value || undefined,
        watermarkPresetId: watermarkPresetId.value || undefined,
        seriesId:
          mode.value === "series" ? seriesId.value || undefined : undefined,
        newSeriesName:
          mode.value === "series"
            ? newSeriesName.value.trim() || undefined
            : undefined,
      }),
    });
    let hasSources = false;
    if (showUserSources.value) {
      for (const item of uploadItems.value) {
        const form = new FormData();
        form.append("file", item.file, item.name);
        await apiForm(`/v1/projects/${id}/sources`, form);
        hasSources = true;
      }
      for (const raw of linkInputs.value) {
        if (!raw.trim()) continue;
        await api(`/v1/projects/${id}/sources/link`, {
          method: "POST",
          body: JSON.stringify({ url: raw.trim() }),
        });
        hasSources = true;
      }
    }
    if (hasSources) {
      toast.info("Đang trích xuất tư liệu…");
      await waitForExtraction(id);
    }
    await api(`/v1/projects/${id}/generate`, { method: "POST" });
    toast.success("Đã bắt đầu sinh kịch bản.");
    emit("created", id);
  } catch (cause) {
    toast.error(
      cause instanceof ApiError ? cause.message : "Không thể tạo dự án.",
    );
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div
    class="mds-mobile-app flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--mds-bg)] text-[var(--mds-text)]"
  >
    <MMobileTopBar title="Tạo video" @back="emit('close')" />
    <main class="min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto w-full max-w-[720px]">
        <section
          class="mds-mobile-gutter-x border-b border-[var(--mds-border-light)] py-5"
        >
          <h2 class="m-0 text-[16px] font-semibold leading-[22px]">
            Ý tưởng video
          </h2>
          <p
            class="m-0 mt-1 text-[12px] leading-4 text-[var(--mds-text-secondary)]"
          >
            AI sẽ tạo kịch bản để bạn duyệt trước khi render.
          </p>
          <div class="mt-4" data-mobile-idea>
            <label class="mb-1 block text-[13px] font-medium"
              >Ý tưởng <span class="text-[var(--mds-danger)]">*</span></label
            >
            <MTextarea
              v-model="idea"
              :rows="4"
              :maxlength="2000"
              :error="ideaError"
              placeholder="Ví dụ: 5 cách dùng AI tăng năng suất làm việc"
            />
          </div>
        </section>

        <section
          class="mds-mobile-gutter-x border-b border-[var(--mds-border-light)] py-5"
        >
          <h2 class="m-0 text-[16px] font-semibold leading-[22px]">Tư liệu</h2>
          <div class="mds-mobile-column-gap-4 mt-4 flex flex-col gap-4">
            <fieldset>
              <legend class="mb-1 text-[13px] font-medium">
                Nguồn kịch bản
              </legend>
              <MRadioGroup
                v-model="sourceMode"
                :options="[
                  { label: 'Tư liệu tôi cung cấp', value: 'user' },
                  { label: 'AI tự tìm trên web', value: 'ai' },
                  { label: 'Kết hợp cả hai', value: 'combine' },
                ]"
                direction="vertical"
              />
            </fieldset>
            <template v-if="showUserSources">
              <MUpload
                :model-value="uploadItems"
                :accept="ACCEPT"
                :max-size-m-b="18"
                label="Tệp tham khảo"
                @select-files="selectFiles"
                @remove="removeFile"
              />
              <div>
                <label class="mb-1 block text-[13px] font-medium"
                  >Link tham khảo</label
                >
                <div
                  v-for="(_, index) in linkInputs"
                  :key="index"
                  class="mds-mobile-row-gap-2 mb-2 flex gap-2"
                >
                  <MInput
                    v-model="linkInputs[index]"
                    class="min-w-0 flex-1"
                    placeholder="https://..."
                    inputmode="url"
                  />
                  <MButton
                    v-if="linkInputs.length > 1"
                    variant="icon"
                    aria-label="Xóa link"
                    @click="removeLink(index)"
                    ><template #icon><MIcon name="x" :size="20" /></template
                  ></MButton>
                </div>
                <MButton variant="ghost" @click="addLink"
                  ><MIcon name="plus" :size="16" /> Thêm link</MButton
                >
              </div>
            </template>
          </div>
        </section>

        <section
          class="mds-mobile-gutter-x border-b border-[var(--mds-border-light)] py-5"
        >
          <h2 class="m-0 text-[16px] font-semibold leading-[22px]">
            Thiết lập video
          </h2>
          <div class="mds-mobile-column-gap-4 mt-4 flex flex-col gap-4">
            <label v-if="templates.length" class="block text-[13px] font-medium"
              >Video Template<MSelect
                v-model="templateId"
                class="mt-1"
                :options="templateOptions"
            /></label>
            <p
              v-if="selectedTemplate && !selectedTemplate.workflow.approveGate"
              class="m-0 flex gap-2 rounded-lg bg-[var(--mds-warning-bg,#FFF7E6)] p-3 text-[12px] leading-4 text-[var(--mds-warning-text,#8A5A00)]"
            >
              <MIcon name="alert-triangle" :size="20" class="shrink-0" />Mẫu này
              tự render sau khi sinh kịch bản.
            </p>
            <fieldset>
              <legend class="mb-1 text-[13px] font-medium">
                Chế độ kịch bản
              </legend>
              <MRadioGroup
                v-model="mode"
                :options="[
                  { label: 'Đa chiều', value: 'angles' },
                  { label: 'Serie', value: 'series' },
                ]"
                direction="horizontal"
              />
            </fieldset>
            <label class="block text-[13px] font-medium"
              >Số kịch bản<MSelect
                v-model="variantCount"
                class="mt-1"
                :options="variantOptions"
            /></label>
            <template v-if="mode === 'series'"
              ><label class="block text-[13px] font-medium"
                >Serie<MSelect
                  v-model="seriesId"
                  class="mt-1"
                  :options="seriesOptions" /></label
              ><label
                v-if="seriesId === ''"
                class="block text-[13px] font-medium"
                >Tên serie mới<MInput
                  v-model="newSeriesName"
                  class="mt-1"
                  placeholder="Nhập tên serie" /></label
            ></template>
            <label class="block text-[13px] font-medium"
              >Tông màu<MSelect
                v-model="presetHint"
                class="mt-1"
                :options="[
                  { label: 'AI tự chọn', value: '' },
                  { label: 'Midnight', value: 'midnight' },
                  { label: 'Noir', value: 'noir' },
                  { label: 'Paper', value: 'paper' },
                  { label: 'Aurora', value: 'aurora' },
                ]"
                :disabled="!!selectedTemplate"
            /></label>
            <div>
              <p class="mb-1 text-[13px] font-medium">Thời lượng mục tiêu</p>
              <RangeField
                v-model="durationSec"
                :min="20"
                :max="120"
                :step="5"
                :format="(value) => `${value}s`"
              />
            </div>
            <label class="block text-[13px] font-medium"
              >Nhạc nền<MSelect
                v-model="musicTrackId"
                class="mt-1"
                :options="musicOptions" /><MusicUpload
                @uploaded="onMusicUploaded"
            /></label>
            <label class="block text-[13px] font-medium"
              >Watermark<MSelect
                v-model="watermarkPresetId"
                class="mt-1"
                :options="watermarkOptions"
            /></label>
          </div>
        </section>

        <section class="mds-mobile-gutter-x py-5">
          <h2 class="m-0 text-[16px] font-semibold leading-[22px]">
            Giọng đọc
          </h2>
          <div class="mds-mobile-column-gap-4 mt-4 flex flex-col gap-4">
            <fieldset>
              <legend class="mb-1 text-[13px] font-medium">Giọng</legend>
              <MRadioGroup
                v-model="voiceGender"
                :options="[
                  { label: 'Nữ', value: 'female' },
                  { label: 'Nam', value: 'male' },
                ]"
                direction="horizontal"
              />
            </fieldset>
            <fieldset>
              <legend class="mb-1 text-[13px] font-medium">Miền</legend>
              <MRadioGroup
                v-model="voiceRegion"
                :options="[
                  { label: 'Miền Bắc', value: 'bac' },
                  { label: 'Miền Nam', value: 'nam' },
                ]"
                direction="horizontal"
              />
            </fieldset>
            <fieldset>
              <legend class="mb-1 text-[13px] font-medium">Phong cách</legend>
              <MRadioGroup
                v-model="voiceStyle"
                :options="[
                  { label: 'Tin tức', value: 'tintuc' },
                  { label: 'Thời sự', value: 'thoisu' },
                  { label: 'Quảng cáo TVC', value: 'tvc' },
                ]"
                direction="horizontal"
              />
            </fieldset>
            <fieldset>
              <legend class="mb-1 text-[13px] font-medium">Tâm trạng</legend>
              <MRadioGroup
                v-model="voiceMood"
                :options="[
                  { label: 'Trung tính', value: 'neutral' },
                  { label: 'Vui vẻ', value: 'cheerful' },
                  { label: 'Năng động', value: 'energetic' },
                ]"
                direction="horizontal"
              />
            </fieldset>
            <fieldset>
              <legend class="mb-1 text-[13px] font-medium">Độ tuổi</legend>
              <MRadioGroup
                v-model="voiceAge"
                :options="[
                  { label: 'Thanh niên', value: 'thanhnien' },
                  { label: 'Trung niên', value: 'trungnien' },
                  { label: 'Người đi làm', value: 'nguoidilam' },
                ]"
                direction="horizontal"
              />
            </fieldset>
            <fieldset>
              <legend class="mb-1 text-[13px] font-medium">Tốc độ</legend>
              <MRadioGroup
                v-model="voiceSpeed"
                :options="[
                  { label: 'Bình thường', value: 1 },
                  { label: 'Nhanh 1,2x', value: 1.2 },
                ]"
                direction="horizontal"
              />
            </fieldset>
          </div>
        </section>
      </div>
    </main>
    <footer
      class="border-t border-[var(--mds-border-light)] bg-[var(--mds-bg)] py-2"
    >
      <div
        class="mds-mobile-gutter-x mx-auto flex w-full max-w-[720px] justify-end"
      >
        <MButton variant="primary" :loading="submitting" @click="submit"
          >Tạo kịch bản</MButton
        >
      </div>
    </footer>
  </div>
</template>
