<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import MButton from "../components/mds/MButton.vue";
import MDialog from "../components/mds/MDialog.vue";
import MDrawer from "../components/mds/MDrawer.vue";
import MEmptyState from "../components/mds/MEmptyState.vue";
import MInput from "../components/mds/MInput.vue";
import MSpinner from "../components/mds/MSpinner.vue";
import MTag from "../components/mds/MTag.vue";
import MUpload from "../components/mds/MUpload.vue";
import { useToast } from "../components/mds/toast.js";
import { api, apiForm, ApiError } from "../lib/api";
import type { MusicTrack } from "../lib/types";

/**
 * Thư viện nhạc nền dùng chung (GĐ4) — admin tải nhạc license-free (tải thủ công
 * từ pixabay.com/music, CC0) vào kho; creator chọn khi tạo video. Engine tự
 * ducking nhạc dưới lời đọc.
 */

const toast = useToast();
const tracks = ref<MusicTrack[]>([]);
const loading = ref(true);

async function reload(): Promise<void> {
  try {
    tracks.value = await api<MusicTrack[]>("/v1/music");
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không tải được thư viện nhạc.");
  } finally {
    loading.value = false;
  }
}
onMounted(() => void reload());

// ---- Tải lên ----
const createOpen = ref(false);
const newName = ref("");
const newCredit = ref("");
const newFile = ref<File | null>(null);
const uploadItems = ref<Array<{ id: string; name: string; size: number; status: "pending"; file: File }>>([]);
const nameError = ref("");
const fileError = ref("");
const uploading = ref(false);

function onPickFile(files: File[]): void {
  fileError.value = "";
  const file = files[0] ?? null;
  if (file && file.size > 20 * 1024 * 1024) {
    fileError.value = "File nhạc nặng quá 20MB — hãy nén hoặc chọn bản ngắn hơn.";
    newFile.value = null;
    uploadItems.value = [];
    return;
  }
  newFile.value = file;
  uploadItems.value = file ? [{ id: String(Date.now()), name: file.name, size: file.size, status: "pending", file }] : [];
  if (file && !newName.value) newName.value = file.name.replace(/\.[^.]+$/, "");
}

async function upload(): Promise<void> {
  nameError.value = "";
  fileError.value = "";
  if (newName.value.trim().length < 1) {
    nameError.value = "Nhập tên bản nhạc.";
    return;
  }
  if (!newFile.value) {
    fileError.value = "Chọn file nhạc (mp3, wav, m4a, aac, ogg — ≤20MB).";
    return;
  }
  uploading.value = true;
  try {
    const form = new FormData();
    form.append("name", newName.value.trim());
    if (newCredit.value.trim()) form.append("credit", newCredit.value.trim());
    form.append("file", newFile.value, newFile.value.name);
    await apiForm("/v1/music", form);
    toast.success("Đã thêm bản nhạc vào thư viện.");
    createOpen.value = false;
    newName.value = "";
    newCredit.value = "";
    newFile.value = null;
    uploadItems.value = [];
    await reload();
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không tải được nhạc.");
  } finally {
    uploading.value = false;
  }
}

// ---- Xoá ----
const deleteTarget = ref<MusicTrack | null>(null);
const deleting = ref(false);
async function confirmDelete(): Promise<void> {
  if (!deleteTarget.value) return;
  deleting.value = true;
  try {
    await api(`/v1/music/${deleteTarget.value.id}`, { method: "DELETE" });
    toast.success("Đã xoá bản nhạc.");
    deleteTarget.value = null;
    await reload();
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không xoá được.");
  } finally {
    deleting.value = false;
  }
}

const hasTracks = computed(() => tracks.value.length > 0);
const fmtSize = (b: number) => `${(b / 1e6).toFixed(1)}MB`;
</script>

<template>
  <div class="p-6">
    <header class="mb-4 flex items-center justify-between">
      <div>
        <h1 class="m-0 text-xl font-semibold">Nhạc nền</h1>
        <p class="m-0 mt-1 text-[13px] text-[var(--mds-text-secondary)]">
          Kho nhạc dùng chung cho mọi creator. Tải nhạc miễn phí bản quyền từ
          <a href="https://pixabay.com/music" target="_blank" rel="noreferrer noopener"
            class="text-[var(--mds-brand-600)]">pixabay.com/music</a>
          (CC0) rồi tải lên đây.
        </p>
      </div>
      <MButton variant="primary" @click="createOpen = true">Thêm nhạc</MButton>
    </header>

    <div v-if="loading" class="grid place-items-center py-16"><MSpinner :size="28" /></div>

    <MEmptyState
      v-else-if="!hasTracks"
      title="Thư viện nhạc trống"
      description="Tải bản nhạc CC0 đầu tiên để creator có thể chọn làm nhạc nền khi tạo video."
    >
      <MButton variant="primary" @click="createOpen = true">Thêm nhạc đầu tiên</MButton>
    </MEmptyState>

    <div v-else class="rounded-lg bg-[var(--mds-bg)] shadow-[var(--mds-shadow-card)]">
      <ul class="m-0 list-none p-0">
        <li
          v-for="t in tracks"
          :key="t.id"
          class="flex items-center gap-3 border-b border-[var(--mds-neutral-300,#E9EAEB)] p-4 last:border-0"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <h3 class="m-0 truncate text-[14px] font-semibold">{{ t.name }}</h3>
              <MTag v-if="t.credit" color="neutral" size="sm">{{ t.credit }}</MTag>
            </div>
            <p class="m-0 mt-0.5 text-xs text-[var(--mds-text-secondary)]">
              {{ t.mime }} · {{ fmtSize(t.size_bytes) }}
            </p>
          </div>
          <audio :src="`/v1/music/${t.id}/audio`" controls preload="none" class="h-9" />
          <MButton @click="deleteTarget = t">Xoá</MButton>
        </li>
      </ul>
    </div>

    <!-- Drawer tải lên -->
    <MDrawer v-model="createOpen" title="Thêm nhạc nền" :width="420">
      <div class="space-y-4">
        <label class="block text-[13px] font-medium">
          Tên bản nhạc <span class="text-[var(--mds-danger)]">*</span>
          <MInput v-model="newName" class="mt-1" placeholder="Ví dụ: Ambient tối giản" :error="nameError" />
        </label>
        <label class="block text-[13px] font-medium">
          Nguồn / giấy phép
          <MInput v-model="newCredit" class="mt-1" placeholder="Ví dụ: Pixabay · CC0" />
        </label>
        <div class="text-[13px] font-medium">
          File nhạc <span class="text-[var(--mds-danger)]">*</span>
          <span class="font-normal text-[var(--mds-text-secondary)]"> — mp3, wav, m4a, aac, ogg ≤20MB</span>
          <MUpload :model-value="uploadItems" accept=".mp3,.wav,.m4a,.aac,.ogg,audio/*" :multiple="false" :max-size-m-b="20" label="Chọn file nhạc" @select-files="onPickFile" @remove="onPickFile([])" />
          <p v-if="fileError" class="m-0 mt-1 text-xs text-[var(--mds-danger)]">{{ fileError }}</p>
          <p v-else-if="newFile" class="m-0 mt-1 text-xs text-[var(--mds-text-secondary)]">
            {{ newFile.name }} — {{ fmtSize(newFile.size) }}
          </p>
        </div>
        <p class="m-0 rounded-md bg-[var(--mds-bg-page)] p-3 text-xs text-[var(--mds-text-secondary)]">
          Chỉ tải nhạc bạn có quyền dùng (CC0 / đã mua). Nhạc sẽ tự nhỏ lại khi có lời đọc.
        </p>
      </div>
      <template #footer>
        <MButton @click="createOpen = false">Hủy</MButton>
        <MButton variant="primary" :loading="uploading" @click="upload">Tải lên</MButton>
      </template>
    </MDrawer>

    <!-- Xoá -->
    <MDialog
      :model-value="!!deleteTarget"
      title="Xoá bản nhạc"
      @update:model-value="deleteTarget = null"
    >
      <p class="m-0 text-[13px]">
        Xoá "<b>{{ deleteTarget?.name }}</b>"? Video đã render vẫn giữ nguyên; project đang chọn
        bản này sẽ về không có nhạc nền.
      </p>
      <template #footer>
        <MButton @click="deleteTarget = null">Hủy</MButton>
        <MButton variant="danger" :loading="deleting" @click="confirmDelete">Xoá</MButton>
      </template>
    </MDialog>
  </div>
</template>
