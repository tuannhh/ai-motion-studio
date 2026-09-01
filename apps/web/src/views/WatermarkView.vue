<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import MButton from "../components/mds/MButton.vue";
import MInput from "../components/mds/MInput.vue";
import MRadioGroup from "../components/mds/MRadioGroup.vue";
import RangeField from "../components/RangeField.vue";
import { useToast } from "../components/mds/toast.js";
import { api, apiForm, ApiError } from "../lib/api";
import type { WatermarkConfig } from "../lib/types";

/**
 * Editor watermark toàn hệ thống (admin): text hoặc ảnh, kéo thả vị trí
 * trực tiếp trên khung preview 9:16, chỉnh độ mờ + kích thước bằng slider.
 * Giá trị x/y/scale theo tỷ lệ khung — khớp schema style.watermark của engine.
 */
const props = defineProps<{
  /** 'mine' = watermark riêng của người đăng nhập; 'global' = mặc định hệ thống (admin) */
  scope: "mine" | "global";
}>();
const BASE = () => (props.scope === "mine" ? "/v1/watermark" : "/v1/admin/watermark");

const toast = useToast();

const kind = ref<"inherit" | "none" | "text" | "image">(props.scope === "mine" ? "inherit" : "none");
const text = ref("");
const x = ref(0.5);
const y = ref(0.06);
const opacity = ref(0.5);
const scale = ref(0.16);
const hasImage = ref(false);
const imageVersion = ref(0);
const saving = ref(false);
const uploading = ref(false);
const loaded = ref(false);

/** khung preview: 270×480 (tỷ lệ đúng 1080×1920, hệ số 1/4) */
const PREVIEW_W = 270;
const PREVIEW_H = 480;
const previewRef = ref<HTMLElement | null>(null);
const dragging = ref(false);

const imageUrl = computed(() =>
  hasImage.value ? `${BASE()}/image?v=${imageVersion.value}` : ""
);
/** khớp công thức engine: text fontSize = WIDTH*scale*0.14; ảnh width = WIDTH*scale */
const previewFontSize = computed(() => PREVIEW_W * scale.value * 0.14 * 4);
const previewImageWidth = computed(() => PREVIEW_W * scale.value);

async function load(): Promise<void> {
  try {
    const wm = await api<WatermarkConfig>(BASE());
    kind.value = wm.kind as typeof kind.value;
    text.value = wm.text ?? "";
    x.value = wm.x;
    y.value = wm.y;
    opacity.value = wm.opacity;
    scale.value = wm.scale;
    hasImage.value = wm.hasImage;
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không tải được cấu hình.");
  } finally {
    loaded.value = true;
  }
}
onMounted(load);

function startDrag(event: PointerEvent): void {
  if (kind.value === "none" || kind.value === "inherit") return;
  dragging.value = true;
  (event.target as HTMLElement).setPointerCapture(event.pointerId);
  moveDrag(event);
}
function moveDrag(event: PointerEvent): void {
  if (!dragging.value || !previewRef.value) return;
  const rect = previewRef.value.getBoundingClientRect();
  x.value = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
  y.value = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
}
function endDrag(): void {
  dragging.value = false;
}

async function uploadImage(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  uploading.value = true;
  try {
    const form = new FormData();
    form.append("file", file, file.name);
    await apiForm(`${BASE()}/image`, form);
    hasImage.value = true;
    imageVersion.value += 1;
    if (kind.value === "none") kind.value = "image";
    toast.success("Đã tải ảnh watermark.");
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không tải được ảnh.");
  } finally {
    uploading.value = false;
  }
}

async function save(): Promise<void> {
  if (kind.value === "text" && !text.value.trim()) {
    toast.error("Nhập nội dung text cho watermark.");
    return;
  }
  saving.value = true;
  try {
    await api(BASE(), {
      method: "PUT",
      body: JSON.stringify({
        kind: kind.value,
        text: text.value.trim() || undefined,
        x: x.value,
        y: y.value,
        opacity: opacity.value,
        scale: scale.value,
      }),
    });
    toast.success("Đã lưu — mọi video render mới sẽ dùng watermark này.");
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không lưu được cấu hình.");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="p-6 pb-24">
    <h1 class="m-0 text-xl font-semibold">
      {{ scope === "mine" ? "Watermark của tôi" : "Watermark mặc định hệ thống" }}
    </h1>
    <p class="m-0 mt-1 text-[13px] text-[var(--mds-text-secondary)]">
      {{
        scope === "mine"
          ? "Áp cho mọi video bạn render. Chưa thiết lập thì hệ thống dùng watermark mặc định của quản trị."
          : "Dùng cho creator chưa tự thiết lập watermark riêng. Kéo watermark trên khung preview để đổi vị trí."
      }}
    </p>

    <div v-if="loaded" class="mt-4 flex flex-wrap gap-6">
      <!-- Preview 9:16 -->
      <div
        ref="previewRef"
        class="relative shrink-0 select-none overflow-hidden rounded-lg"
        :style="{
          width: PREVIEW_W + 'px',
          height: PREVIEW_H + 'px',
          background: 'linear-gradient(160deg,#101C3A 0%,#0B1020 60%,#1A0F2E 100%)',
          cursor: kind === 'text' || kind === 'image' ? 'crosshair' : 'default',
        }"
        @pointerdown="startDrag"
        @pointermove="moveDrag"
        @pointerup="endDrag"
      >
        <p class="absolute left-4 top-24 m-0 w-3/4 text-[17px] font-bold leading-6 text-white/90">
          Khung video mẫu 1080×1920
        </p>
        <p class="absolute bottom-16 left-4 m-0 text-[11px] text-white/50">
          Phụ đề karaoke sẽ chạy ở vùng này
        </p>
        <div
          v-if="kind === 'text' || kind === 'image'"
          class="pointer-events-none absolute"
          :style="{
            left: x * 100 + '%',
            top: y * 100 + '%',
            transform: 'translate(-50%, -50%)',
            opacity: opacity,
          }"
        >
          <span
            v-if="kind === 'text'"
            class="whitespace-nowrap font-semibold tracking-wide text-white"
            :style="{ fontSize: previewFontSize + 'px' }"
          >
            {{ text || "Watermark" }}
          </span>
          <img
            v-else-if="imageUrl"
            :src="imageUrl"
            :style="{ width: previewImageWidth + 'px' }"
            alt="watermark"
          />
        </div>
      </div>

      <!-- Cấu hình -->
      <section class="min-w-[320px] max-w-[440px] flex-1 rounded-lg bg-[var(--mds-bg)] p-5 shadow-[var(--mds-shadow-card)]">
        <label class="block text-[13px] font-medium">
          Loại watermark
          <MRadioGroup
            v-model="kind"
            class="mt-1"
            :options="
              scope === 'mine'
                ? [
                    { label: 'Dùng mặc định hệ thống', value: 'inherit' },
                    { label: 'Không dùng', value: 'none' },
                    { label: 'Text', value: 'text' },
                    { label: 'Hình ảnh', value: 'image' },
                  ]
                : [
                    { label: 'Không dùng', value: 'none' },
                    { label: 'Text', value: 'text' },
                    { label: 'Hình ảnh', value: 'image' },
                  ]
            "
            direction="horizontal"
          />
        </label>

        <label v-if="kind === 'text'" class="mt-4 block text-[13px] font-medium">
          Nội dung text (≤40 ký tự)
          <MInput v-model="text" class="mt-1" placeholder="© Kênh của bạn" :maxlength="40" />
        </label>

        <div v-if="kind === 'image'" class="mt-4">
          <p class="m-0 mb-1 text-[13px] font-medium">Ảnh watermark (PNG/JPEG/WebP, nên là PNG nền trong)</p>
          <label
            class="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--mds-neutral-400,#CED1D6)] px-3 py-2 text-[13px] hover:border-[var(--mds-brand-600)]"
          >
            <input type="file" class="hidden" accept="image/png,image/jpeg,image/webp" @change="uploadImage" />
            {{ uploading ? "Đang tải lên…" : hasImage ? "Thay ảnh khác" : "Chọn ảnh" }}
          </label>
        </div>

        <div v-if="kind === 'text' || kind === 'image'" class="mt-5 space-y-4">
          <div>
            <p class="m-0 mb-1 text-[13px] font-medium">Độ mờ</p>
            <RangeField v-model="opacity" :min="0.05" :max="1" :step="0.05" :format="(v) => Math.round(v * 100) + '%'" />
          </div>
          <div>
            <p class="m-0 mb-1 text-[13px] font-medium">Kích thước</p>
            <RangeField v-model="scale" :min="0.03" :max="0.6" :step="0.01" :format="(v) => Math.round(v * 100) + '%'" />
          </div>
          <p class="m-0 text-xs text-[var(--mds-text-secondary)]">
            Vị trí: x {{ Math.round(x * 100) }}% · y {{ Math.round(y * 100) }}% — kéo trực tiếp trên preview.
          </p>
        </div>
      </section>
    </div>

    <!-- Thanh lưu ghim cuối trang -->
    <div
      class="fixed bottom-0 right-0 z-10 flex justify-end gap-2 border-t border-[var(--mds-neutral-300,#E9EAEB)] bg-[var(--mds-bg)] px-6 py-3"
      style="left: var(--mds-layout-sidebar-w, 200px)"
    >
      <MButton variant="primary" :loading="saving" @click="save">Lưu watermark</MButton>
    </div>
  </div>
</template>
