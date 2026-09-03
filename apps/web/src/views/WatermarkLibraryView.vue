<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import MButton from "../components/mds/MButton.vue";
import MDialog from "../components/mds/MDialog.vue";
import MDrawer from "../components/mds/MDrawer.vue";
import MEmptyState from "../components/mds/MEmptyState.vue";
import MIcon from "../components/mds/MIcon.vue";
import MInput from "../components/mds/MInput.vue";
import MRadioGroup from "../components/mds/MRadioGroup.vue";
import MUpload from "../components/mds/MUpload.vue";
import RangeField from "../components/RangeField.vue";
import WatermarkView from "./WatermarkView.vue";
import { useToast } from "../components/mds/toast.js";
import { api, apiForm, ApiError } from "../lib/api";
import type { WatermarkPreset } from "../lib/types";

/**
 * Thư viện watermark (GĐ4): tạo nhiều watermark có tên, chọn khi tạo video.
 * Vị trí đặt bằng KÉO trực tiếp trên khung preview 9:16 (không slider ngang/dọc).
 *
 * Cấu hình "watermark mặc định hệ thống" (admin) nhúng ngay TRONG trang này (mục thu/mở
 * cuối trang) thay vì một mục menu riêng — trước đây tách 2 trang khiến người dùng nhầm
 * là trùng nhau (phản hồi 2026-09-03: "thực chất nó nằm trong mục Watermark đã có rồi").
 */
const props = defineProps<{ isAdmin?: boolean }>();
const defaultOpen = ref(false);
const toast = useToast();
const presets = ref<WatermarkPreset[]>([]);
const loading = ref(true);

async function reload(): Promise<void> {
  try {
    presets.value = await api<WatermarkPreset[]>("/v1/watermark-presets");
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không tải được thư viện watermark.");
  } finally {
    loading.value = false;
  }
}
onMounted(reload);

// ---- Thêm/sửa ----
const drawerOpen = ref(false);
const editingId = ref<number | null>(null);
const editingHasImage = ref(false);
const name = ref("");
const kind = ref<"text" | "image">("text");
const text = ref("");
const opacity = ref(0.5);
const scale = ref(0.16);
const posX = ref(0.5);
const posY = ref(0.06);
const imageFile = ref<File | null>(null);
const imageUploadItems = ref<Array<{ id: string; name: string; size: number; status: "pending"; file: File }>>([]);
const localImageUrl = ref("");
const saving = ref(false);

// Khung preview 9:16 thu nhỏ của 1080×1920. Mọi kích thước watermark tính theo
// ĐÚNG tỷ lệ khung như engine render (WYSIWYG) — trước đây preview nhân thêm ×4 nên
// nhìn to gấp 4 lần so với video thật.
const PREVIEW_W = 240;
const PREVIEW_H = 427;
const RENDER_W = 1080; // khớp WIDTH của motion-engine
const previewRef = ref<HTMLElement | null>(null);
const dragging = ref(false);
// Engine: fontSize = WIDTH * scale * 0.14 (xem core/Watermark.tsx). Preview co theo
// PREVIEW_W/RENDER_W để hiển thị đúng bằng video thật.
const previewFontSize = computed(() => RENDER_W * scale.value * 0.14 * (PREVIEW_W / RENDER_W));
const previewImageWidth = computed(() => PREVIEW_W * scale.value);
const previewImageUrl = computed(() => {
  if (localImageUrl.value) return localImageUrl.value;
  if (editingId.value !== null && editingHasImage.value)
    return `/v1/watermark-presets/${editingId.value}/image`;
  return "";
});

function resetForm(): void {
  name.value = "";
  kind.value = "text";
  text.value = "";
  opacity.value = 0.5;
  scale.value = 0.16;
  posX.value = 0.5;
  posY.value = 0.06;
  imageFile.value = null;
  imageUploadItems.value = [];
  if (localImageUrl.value) URL.revokeObjectURL(localImageUrl.value);
  localImageUrl.value = "";
}

function openCreate(): void {
  editingId.value = null;
  editingHasImage.value = false;
  resetForm();
  drawerOpen.value = true;
}

function openEdit(p: WatermarkPreset): void {
  editingId.value = p.id;
  editingHasImage.value = p.hasImage;
  name.value = p.name;
  kind.value = p.kind;
  text.value = p.text ?? "";
  opacity.value = p.opacity;
  scale.value = p.scale;
  posX.value = p.x;
  posY.value = p.y;
  imageFile.value = null;
  imageUploadItems.value = [];
  if (localImageUrl.value) URL.revokeObjectURL(localImageUrl.value);
  localImageUrl.value = "";
  drawerOpen.value = true;
}

function onPickImage(files: File[]): void {
  const file = files[0] ?? null;
  imageFile.value = file;
  imageUploadItems.value = file
    ? [{ id: String(Date.now()), name: file.name, size: file.size, status: "pending", file }]
    : [];
  if (localImageUrl.value) URL.revokeObjectURL(localImageUrl.value);
  localImageUrl.value = file ? URL.createObjectURL(file) : "";
}

// Kéo watermark trên preview để đặt vị trí
function startDrag(e: PointerEvent): void {
  dragging.value = true;
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
  moveDrag(e);
}
function moveDrag(e: PointerEvent): void {
  if (!dragging.value || !previewRef.value) return;
  const rect = previewRef.value.getBoundingClientRect();
  posX.value = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  posY.value = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
}
function endDrag(): void {
  dragging.value = false;
}

async function save(): Promise<void> {
  if (name.value.trim().length < 1) {
    toast.error("Nhập tên watermark.");
    return;
  }
  if (kind.value === "text" && !text.value.trim()) {
    toast.error("Watermark dạng chữ cần nội dung.");
    return;
  }
  if (kind.value === "image" && editingId.value === null && !imageFile.value) {
    toast.error("Chọn ảnh watermark (PNG/JPEG/WebP ≤4MB).");
    return;
  }
  saving.value = true;
  try {
    const body = {
      name: name.value.trim(),
      kind: kind.value,
      text: kind.value === "text" ? text.value.trim() : undefined,
      x: posX.value,
      y: posY.value,
      opacity: opacity.value,
      scale: scale.value,
    };
    let id = editingId.value;
    if (id === null) {
      const res = await api<{ id: number }>("/v1/watermark-presets", {
        method: "POST",
        body: JSON.stringify(body),
      });
      id = res.id;
    } else {
      await api(`/v1/watermark-presets/${id}`, { method: "PUT", body: JSON.stringify(body) });
    }
    if (kind.value === "image" && imageFile.value) {
      const form = new FormData();
      form.append("file", imageFile.value, imageFile.value.name);
      await apiForm(`/v1/watermark-presets/${id}/image`, form);
    }
    toast.success("Đã lưu watermark.");
    drawerOpen.value = false;
    await reload();
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không lưu được watermark.");
  } finally {
    saving.value = false;
  }
}

const deleteTarget = ref<WatermarkPreset | null>(null);
async function confirmDelete(): Promise<void> {
  if (!deleteTarget.value) return;
  try {
    await api(`/v1/watermark-presets/${deleteTarget.value.id}`, { method: "DELETE" });
    toast.success("Đã xoá watermark.");
    deleteTarget.value = null;
    await reload();
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không xoá được.");
  }
}
</script>

<template>
  <div class="p-6">
    <header class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0 max-w-[560px]">
        <h1 class="m-0 text-xl font-semibold">Thư viện Watermark</h1>
        <p class="m-0 mt-1 text-[13px] text-[var(--mds-text-secondary)]">
          Tạo nhiều watermark, lưu lại và chọn khi tạo video. Không thiết lập thì video dùng
          watermark mặc định của hệ thống.
        </p>
      </div>
      <MButton variant="primary" class="shrink-0" @click="openCreate">Thêm watermark</MButton>
    </header>

    <div v-if="loading" class="py-10 text-center text-[13px] text-[var(--mds-text-secondary)]">
      Đang tải…
    </div>
    <MEmptyState
      v-else-if="!presets.length"
      title="Chưa có watermark nào"
      description="Bấm 'Thêm watermark' để tạo cái đầu tiên."
    />
    <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="p in presets"
        :key="p.id"
        class="rounded-lg bg-[var(--mds-bg)] p-4 shadow-[var(--mds-shadow-card)]"
      >
        <h3 class="m-0 truncate text-[15px] font-semibold">{{ p.name }}</h3>
        <p class="m-0 mt-0.5 text-[13px] text-[var(--mds-text-secondary)]">
          {{ p.kind === "text" ? `Chữ: “${p.text}”` : "Ảnh" }} · mờ {{ Math.round(p.opacity * 100) }}%
        </p>
        <div class="mt-3 flex items-center gap-2">
          <MButton size="sm" @click="openEdit(p)">Sửa</MButton>
          <MButton size="sm" @click="deleteTarget = p">
            <MIcon name="trash" :size="16" /> Xoá
          </MButton>
        </div>
      </div>
    </div>

    <!-- Drawer thêm/sửa -->
    <MDrawer
      v-model="drawerOpen"
      :title="editingId === null ? 'Thêm watermark' : 'Sửa watermark'"
      :width="560"
    >
      <div class="flex flex-wrap gap-5">
        <!-- Preview 9:16 — kéo watermark để đặt vị trí -->
        <div class="shrink-0">
          <div
            ref="previewRef"
            class="relative select-none overflow-hidden rounded-lg"
            :style="{
              width: PREVIEW_W + 'px',
              height: PREVIEW_H + 'px',
              background: 'linear-gradient(160deg,#101C3A 0%,#0B1020 60%,#1A0F2E 100%)',
              cursor: 'grab',
            }"
            @pointerdown="startDrag"
            @pointermove="moveDrag"
            @pointerup="endDrag"
          >
            <p class="absolute left-4 top-20 m-0 w-3/4 text-[15px] font-bold leading-5 text-white/90">
              Khung video mẫu 1080×1920
            </p>
            <div
              class="pointer-events-none absolute"
              :style="{
                left: posX * 100 + '%',
                top: posY * 100 + '%',
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
                v-else-if="previewImageUrl"
                :src="previewImageUrl"
                :style="{ width: previewImageWidth + 'px' }"
                alt="watermark"
              />
              <span v-else class="text-[12px] text-white/60">(chọn ảnh)</span>
            </div>
          </div>
          <p class="m-0 mt-1 text-center text-[11px] text-[var(--mds-text-secondary)]">
            Kéo watermark để đặt vị trí
          </p>
        </div>

        <!-- Cấu hình -->
        <div class="min-w-[220px] flex-1 space-y-4">
          <label class="block text-[13px] font-medium">
            Tên watermark <span class="text-[var(--mds-danger)]">*</span>
            <MInput v-model="name" class="mt-1" :maxlength="60" placeholder="VD: Kênh chính, Logo trắng…" />
          </label>
          <label class="block text-[13px] font-medium">
            Loại
            <MRadioGroup
              v-model="kind"
              class="mt-1"
              :options="[
                { label: 'Chữ', value: 'text' },
                { label: 'Ảnh', value: 'image' },
              ]"
              direction="horizontal"
            />
          </label>
          <label v-if="kind === 'text'" class="block text-[13px] font-medium">
            Nội dung chữ <span class="text-[var(--mds-danger)]">*</span>
            <MInput v-model="text" class="mt-1" :maxlength="40" placeholder="© Kênh của bạn" />
          </label>
          <MUpload
            v-else
            :model-value="imageUploadItems"
            accept="image/png,image/jpeg,image/webp"
            :multiple="false"
            :max-size-m-b="4"
            :label="`Ảnh watermark${editingId !== null ? ' — chọn để thay ảnh' : ''}`"
            @select-files="onPickImage"
            @remove="onPickImage([])"
          />
          <div class="text-[13px] font-medium">
            Độ mờ
            <RangeField v-model="opacity" :min="0.05" :max="1" :step="0.05" :format="(v: number) => `${Math.round(v * 100)}%`" />
          </div>
          <div class="text-[13px] font-medium">
            Kích thước
            <RangeField v-model="scale" :min="0.03" :max="0.6" :step="0.01" :format="(v: number) => `${Math.round(v * 100)}%`" />
          </div>
        </div>
      </div>
      <template #footer>
        <MButton @click="drawerOpen = false">Hủy</MButton>
        <MButton variant="primary" :loading="saving" @click="save">Lưu</MButton>
      </template>
    </MDrawer>

    <MDialog
      :model-value="!!deleteTarget"
      title="Xoá watermark?"
      type="danger"
      confirm-text="Xoá"
      @update:model-value="!$event && (deleteTarget = null)"
      @confirm="confirmDelete"
    >
      Xoá “{{ deleteTarget?.name }}” — video đang dùng sẽ quay về watermark mặc định. Không hoàn tác.
    </MDialog>

    <!-- Admin: cấu hình watermark mặc định hệ thống (thu gọn — ít dùng hơn thư viện trên) -->
    <section v-if="isAdmin" class="mt-8 border-t border-[var(--mds-neutral-300,#E9EAEB)] pt-5">
      <button
        type="button"
        class="flex w-full items-center justify-between gap-3 text-left"
        :aria-expanded="defaultOpen"
        @click="defaultOpen = !defaultOpen"
      >
        <span>
          <h2 class="m-0 text-[15px] font-semibold">Watermark mặc định hệ thống</h2>
          <p class="m-0 mt-0.5 text-[13px] text-[var(--mds-text-secondary)]">
            Áp cho video của creator chưa chọn watermark riêng ở trên.
          </p>
        </span>
        <MIcon :name="defaultOpen ? 'chevron-up' : 'chevron-down'" :size="16" class="shrink-0" />
      </button>
      <WatermarkView v-if="defaultOpen" scope="global" embedded class="mt-4" />
    </section>
  </div>
</template>
