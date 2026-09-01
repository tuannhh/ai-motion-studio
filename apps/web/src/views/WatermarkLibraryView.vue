<script setup lang="ts">
import { onMounted, ref } from "vue";
import MButton from "../components/mds/MButton.vue";
import MDrawer from "../components/mds/MDrawer.vue";
import MEmptyState from "../components/mds/MEmptyState.vue";
import MIcon from "../components/mds/MIcon.vue";
import MInput from "../components/mds/MInput.vue";
import MRadioGroup from "../components/mds/MRadioGroup.vue";
import RangeField from "../components/RangeField.vue";
import { useToast } from "../components/mds/toast.js";
import { api, apiForm, ApiError } from "../lib/api";
import type { WatermarkPreset } from "../lib/types";

/**
 * Thư viện watermark (GĐ4): tạo nhiều watermark có tên, chọn khi tạo video.
 * Thay mô hình 1-watermark/user (lưu cái mới đè cái cũ). Admin & creator đều dùng.
 */
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
const name = ref("");
const kind = ref<"text" | "image">("text");
const text = ref("");
const opacity = ref(0.5);
const scale = ref(0.16);
const posX = ref(0.5);
const posY = ref(0.06);
const imageFile = ref<File | null>(null);
const saving = ref(false);

function openCreate(): void {
  editingId.value = null;
  name.value = "";
  kind.value = "text";
  text.value = "";
  opacity.value = 0.5;
  scale.value = 0.16;
  posX.value = 0.5;
  posY.value = 0.06;
  imageFile.value = null;
  drawerOpen.value = true;
}

function openEdit(p: WatermarkPreset): void {
  editingId.value = p.id;
  name.value = p.name;
  kind.value = p.kind;
  text.value = p.text ?? "";
  opacity.value = p.opacity;
  scale.value = p.scale;
  posX.value = p.x;
  posY.value = p.y;
  imageFile.value = null;
  drawerOpen.value = true;
}

function onPickImage(e: Event): void {
  imageFile.value = (e.target as HTMLInputElement).files?.[0] ?? null;
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
    <header class="mb-4 flex items-center justify-between">
      <div>
        <h1 class="m-0 text-xl font-semibold">Thư viện Watermark</h1>
        <p class="m-0 mt-1 text-[13px] text-[var(--mds-text-secondary)]">
          Tạo nhiều watermark, lưu lại và chọn khi tạo video. Không thiết lập thì video dùng
          watermark mặc định của hệ thống.
        </p>
      </div>
      <MButton variant="primary" @click="openCreate">Thêm watermark</MButton>
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
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="m-0 truncate text-[15px] font-semibold">{{ p.name }}</h3>
            <p class="m-0 mt-0.5 text-[13px] text-[var(--mds-text-secondary)]">
              {{ p.kind === "text" ? `Chữ: “${p.text}”` : "Ảnh" }} · mờ {{ Math.round(p.opacity * 100) }}%
            </p>
          </div>
        </div>
        <div class="mt-3 flex items-center gap-2">
          <MButton size="sm" @click="openEdit(p)">Sửa</MButton>
          <MButton size="sm" @click="deleteTarget = p">
            <MIcon name="trash" :size="16" /> Xoá
          </MButton>
        </div>
      </div>
    </div>

    <!-- Drawer thêm/sửa -->
    <MDrawer v-model="drawerOpen" :title="editingId === null ? 'Thêm watermark' : 'Sửa watermark'">
      <div class="space-y-4">
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
        <label v-else class="block text-[13px] font-medium">
          Ảnh (PNG/JPEG/WebP ≤4MB){{ editingId !== null ? " — chọn để thay ảnh" : "" }}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            class="mt-1 block w-full text-[13px]"
            @change="onPickImage"
          />
        </label>
        <div class="text-[13px] font-medium">
          Độ mờ
          <RangeField v-model="opacity" :min="0.05" :max="1" :step="0.05" :format="(v: number) => `${Math.round(v * 100)}%`" />
        </div>
        <div class="text-[13px] font-medium">
          Kích thước
          <RangeField v-model="scale" :min="0.03" :max="0.6" :step="0.01" :format="(v: number) => `${Math.round(v * 100)}%`" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="text-[13px] font-medium">
            Vị trí ngang
            <RangeField v-model="posX" :min="0" :max="1" :step="0.05" :format="(v: number) => `${Math.round(v * 100)}%`" />
          </div>
          <div class="text-[13px] font-medium">
            Vị trí dọc
            <RangeField v-model="posY" :min="0" :max="1" :step="0.02" :format="(v: number) => `${Math.round(v * 100)}%`" />
          </div>
        </div>
      </div>
      <template #footer>
        <MButton @click="drawerOpen = false">Hủy</MButton>
        <MButton variant="primary" :loading="saving" @click="save">Lưu</MButton>
      </template>
    </MDrawer>

    <!-- Xác nhận xoá -->
    <div
      v-if="deleteTarget"
      class="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4"
      @click.self="deleteTarget = null"
    >
      <div class="w-full max-w-[360px] rounded-lg bg-[var(--mds-bg)] p-5 shadow-2xl">
        <h3 class="m-0 text-[16px] font-semibold">Xoá watermark?</h3>
        <p class="m-0 mt-2 text-[13px] text-[var(--mds-text-secondary)]">
          Xoá “{{ deleteTarget.name }}” — video đang dùng sẽ quay về watermark mặc định. Không hoàn tác.
        </p>
        <div class="mt-4 flex justify-end gap-2">
          <MButton @click="deleteTarget = null">Hủy</MButton>
          <MButton variant="primary" @click="confirmDelete">Xoá</MButton>
        </div>
      </div>
    </div>
  </div>
</template>
