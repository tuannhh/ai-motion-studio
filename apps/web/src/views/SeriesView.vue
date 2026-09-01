<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import MButton from "../components/mds/MButton.vue";
import MDialog from "../components/mds/MDialog.vue";
import MDrawer from "../components/mds/MDrawer.vue";
import MEmptyState from "../components/mds/MEmptyState.vue";
import MInput from "../components/mds/MInput.vue";
import MTextarea from "../components/mds/MTextarea.vue";
import MProgress from "../components/mds/MProgress.vue";
import MSpinner from "../components/mds/MSpinner.vue";
import MTag from "../components/mds/MTag.vue";
import { useToast } from "../components/mds/toast.js";
import { api, ApiError } from "../lib/api";
import type { SeriesDetail, SeriesEpisode, SeriesRow } from "../lib/types";

/**
 * Trang quản lý Serie (GĐ4): xem các serie, mở chi tiết để xem danh sách tập
 * theo thứ tự, đổi tên/mô tả, xem/tải video từng tập, xoá serie.
 */

const toast = useToast();
const seriesList = ref<SeriesRow[]>([]);
const loading = ref(true);

const JOB_STATUS: Record<string, { label: string; color: string }> = {
  queued: { label: "Chờ render", color: "neutral" },
  images: { label: "Đang tạo ảnh", color: "info" },
  tts: { label: "Đang lồng tiếng", color: "info" },
  rendering: { label: "Đang render", color: "info" },
  done: { label: "Đã render", color: "success" },
  failed: { label: "Lỗi render", color: "danger" },
};

const SCRIPT_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Chờ duyệt", color: "warning" },
  approved: { label: "Đã duyệt", color: "brand" },
};

async function reload(): Promise<void> {
  try {
    seriesList.value = await api<SeriesRow[]>("/v1/series");
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không tải được danh sách serie.");
  } finally {
    loading.value = false;
  }
}

onMounted(() => void reload());

// ---- Chi tiết serie (drawer) ----
const detailOpen = ref(false);
const detail = ref<SeriesDetail | null>(null);
const detailLoading = ref(false);
let pollTimer: ReturnType<typeof setInterval> | null = null;

function stopPoll(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}
onBeforeUnmount(stopPoll);

async function loadDetail(seriesId: number, silent = false): Promise<void> {
  if (!silent) detailLoading.value = true;
  try {
    detail.value = await api<SeriesDetail>(`/v1/series/${seriesId}`);
  } catch (cause) {
    if (!silent) toast.error(cause instanceof ApiError ? cause.message : "Không tải được serie.");
  } finally {
    detailLoading.value = false;
  }
}

async function openDetail(s: SeriesRow): Promise<void> {
  detail.value = null;
  detailOpen.value = true;
  await loadDetail(s.id);
  // Poll 4s khi còn tập đang render
  stopPoll();
  pollTimer = setInterval(() => {
    const active = detail.value?.episodes.some(
      (e) => e.jobStatus && !["done", "failed"].includes(e.jobStatus)
    );
    if (active && detail.value) void loadDetail(detail.value.series.id, true);
  }, 4000);
}

function closeDetail(): void {
  detailOpen.value = false;
  stopPoll();
}

const videoUrl = (e: SeriesEpisode): string => `/v1/jobs/${e.jobId}/video`;

// ---- Tạo serie ----
const createOpen = ref(false);
const newName = ref("");
const newDesc = ref("");
const nameError = ref("");
const creating = ref(false);

async function createSeries(): Promise<void> {
  nameError.value = "";
  if (newName.value.trim().length < 2) {
    nameError.value = "Nhập tên serie, tối thiểu 2 ký tự.";
    return;
  }
  creating.value = true;
  try {
    await api("/v1/series", {
      method: "POST",
      body: JSON.stringify({
        name: newName.value.trim(),
        description: newDesc.value.trim() || undefined,
      }),
    });
    toast.success("Đã tạo serie. Khi tạo video chọn chế độ 'Serie' để thêm tập.");
    createOpen.value = false;
    newName.value = "";
    newDesc.value = "";
    await reload();
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không tạo được serie.");
  } finally {
    creating.value = false;
  }
}

// ---- Sửa serie ----
const editOpen = ref(false);
const editName = ref("");
const editDesc = ref("");
const saving = ref(false);

function openEdit(): void {
  if (!detail.value) return;
  editName.value = detail.value.series.name;
  editDesc.value = detail.value.series.description ?? "";
  editOpen.value = true;
}

async function saveEdit(): Promise<void> {
  if (!detail.value) return;
  saving.value = true;
  try {
    await api(`/v1/series/${detail.value.series.id}`, {
      method: "PUT",
      body: JSON.stringify({
        name: editName.value.trim(),
        description: editDesc.value.trim() || null,
      }),
    });
    toast.success("Đã lưu serie.");
    editOpen.value = false;
    await loadDetail(detail.value.series.id);
    await reload();
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không lưu được.");
  } finally {
    saving.value = false;
  }
}

// ---- Xoá serie ----
const deleteTarget = ref<SeriesRow | null>(null);
const deleting = ref(false);
async function confirmDelete(): Promise<void> {
  if (!deleteTarget.value) return;
  deleting.value = true;
  try {
    await api(`/v1/series/${deleteTarget.value.id}`, { method: "DELETE" });
    toast.success("Đã xoá serie. Các tập đã tạo vẫn giữ nguyên trong Dự án.");
    deleteTarget.value = null;
    if (detail.value && detailOpen.value) closeDetail();
    await reload();
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không xoá được.");
  } finally {
    deleting.value = false;
  }
}

const hasSeries = computed(() => seriesList.value.length > 0);
</script>

<template>
  <div class="p-6">
    <header class="mb-4 flex items-center justify-between">
      <div>
        <h1 class="m-0 text-xl font-semibold">Serie</h1>
        <p class="m-0 mt-1 text-[13px] text-[var(--mds-text-secondary)]">
          Chuỗi video nhiều tập nối tiếp nhau — AI nhớ nội dung tập trước để móc nối tập sau.
        </p>
      </div>
      <MButton variant="primary" @click="createOpen = true">Tạo serie</MButton>
    </header>

    <div v-if="loading" class="grid place-items-center py-16"><MSpinner :size="28" /></div>

    <MEmptyState
      v-else-if="!hasSeries"
      title="Chưa có serie nào"
      description="Tạo serie rồi khi tạo video chọn chế độ 'Serie' để các tập nối tiếp nội dung."
    >
      <MButton variant="primary" @click="createOpen = true">Tạo serie đầu tiên</MButton>
    </MEmptyState>

    <div v-else class="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="s in seriesList"
        :key="s.id"
        class="cursor-pointer rounded-lg bg-[var(--mds-bg)] p-4 shadow-[var(--mds-shadow-card)] transition hover:shadow-[var(--mds-shadow-lg,0_8px_24px_rgba(0,0,0,0.12))]"
        @click="openDetail(s)"
      >
        <div class="flex items-start justify-between gap-2">
          <h2 class="m-0 min-w-0 truncate text-[15px] font-semibold">{{ s.name }}</h2>
          <MTag color="brand" size="sm">{{ s.episode_count }} tập</MTag>
        </div>
        <p class="m-0 mt-2 line-clamp-2 min-h-[36px] text-[13px] text-[var(--mds-text-secondary)]">
          {{ s.description || "Chưa có mô tả." }}
        </p>
        <p class="m-0 mt-2 text-xs text-[var(--mds-text-secondary)]">
          {{ s.project_count }} dự án · tạo {{ new Date(s.created_at).toLocaleDateString("vi-VN") }}
        </p>
      </article>
    </div>

    <!-- Drawer chi tiết serie -->
    <MDrawer
      :model-value="detailOpen"
      :title="detail?.series.name ?? 'Chi tiết serie'"
      :width="560"
      @update:model-value="(v: boolean) => (v ? null : closeDetail())"
    >
      <div v-if="detailLoading" class="grid place-items-center py-16"><MSpinner :size="24" /></div>

      <div v-else-if="detail" class="space-y-4">
        <p v-if="detail.series.description" class="m-0 text-[13px] text-[var(--mds-text-secondary)]">
          {{ detail.series.description }}
        </p>

        <div class="flex gap-2">
          <MButton @click="openEdit">Đổi tên / mô tả</MButton>
          <MButton
            variant="danger"
            @click="deleteTarget = { id: detail.series.id, name: detail.series.name } as SeriesRow"
          >
            Xoá serie
          </MButton>
        </div>

        <MEmptyState
          v-if="!detail.episodes.length"
          title="Serie chưa có tập nào"
          description="Vào 'Tạo video', chọn chế độ 'Serie' và chọn serie này để thêm tập đầu tiên."
        />

        <ol v-else class="m-0 list-none space-y-3 p-0">
          <li
            v-for="e in detail.episodes"
            :key="e.scriptId"
            class="rounded-lg border border-[var(--mds-neutral-300,#E9EAEB)] p-3"
          >
            <div class="flex items-start gap-3">
              <span
                class="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--mds-brand-50,#EFF4FF)] text-[13px] font-semibold text-[var(--mds-brand-600,#245FDF)]"
              >
                {{ e.episode }}
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                  <h3 class="m-0 min-w-0 truncate text-[14px] font-semibold">{{ e.title }}</h3>
                  <div class="flex shrink-0 gap-1">
                    <MTag
                      v-if="SCRIPT_STATUS[e.scriptStatus]"
                      :color="SCRIPT_STATUS[e.scriptStatus].color"
                      size="sm"
                    >
                      {{ SCRIPT_STATUS[e.scriptStatus].label }}
                    </MTag>
                    <MTag v-if="e.jobStatus" :color="JOB_STATUS[e.jobStatus]?.color" size="sm">
                      {{ JOB_STATUS[e.jobStatus]?.label ?? e.jobStatus }}
                    </MTag>
                  </div>
                </div>
                <p class="m-0 mt-0.5 line-clamp-2 text-xs text-[var(--mds-text-secondary)]">
                  {{ e.angle }}
                </p>

                <MProgress
                  v-if="e.jobStatus && !['done', 'failed'].includes(e.jobStatus)"
                  class="mt-2"
                  :value="e.jobProgress ?? 0"
                />

                <video
                  v-if="e.hasVideo"
                  :src="videoUrl(e)"
                  controls
                  preload="none"
                  class="mt-2 w-40 rounded-md bg-black"
                />
              </div>
            </div>
          </li>
        </ol>
      </div>
    </MDrawer>

    <!-- Tạo serie -->
    <MDialog :model-value="createOpen" title="Tạo serie" @update:model-value="createOpen = $event">
      <div class="space-y-3">
        <label class="block text-[13px] font-medium">
          Tên serie <span class="text-[var(--mds-danger)]">*</span>
          <MInput v-model="newName" class="mt-1" placeholder="Ví dụ: AI 101" :error="nameError" />
        </label>
        <label class="block text-[13px] font-medium">
          Mô tả
          <MTextarea v-model="newDesc" class="mt-1" :rows="3" placeholder="Serie nói về chủ đề gì (không bắt buộc)" />
        </label>
      </div>
      <template #footer>
        <MButton @click="createOpen = false">Hủy</MButton>
        <MButton variant="primary" :loading="creating" @click="createSeries">Tạo</MButton>
      </template>
    </MDialog>

    <!-- Sửa serie -->
    <MDialog :model-value="editOpen" title="Đổi tên / mô tả serie" @update:model-value="editOpen = $event">
      <div class="space-y-3">
        <label class="block text-[13px] font-medium">
          Tên serie
          <MInput v-model="editName" class="mt-1" />
        </label>
        <label class="block text-[13px] font-medium">
          Mô tả
          <MTextarea v-model="editDesc" class="mt-1" :rows="3" />
        </label>
      </div>
      <template #footer>
        <MButton @click="editOpen = false">Hủy</MButton>
        <MButton variant="primary" :loading="saving" @click="saveEdit">Lưu</MButton>
      </template>
    </MDialog>

    <!-- Xoá serie -->
    <MDialog
      :model-value="!!deleteTarget"
      title="Xoá serie"
      @update:model-value="deleteTarget = null"
    >
      <p class="m-0 text-[13px]">
        Xoá serie "<b>{{ deleteTarget?.name }}</b>"? Các tập đã tạo vẫn giữ nguyên trong Dự án,
        chỉ mất liên kết serie.
      </p>
      <template #footer>
        <MButton @click="deleteTarget = null">Hủy</MButton>
        <MButton variant="danger" :loading="deleting" @click="confirmDelete">Xoá</MButton>
      </template>
    </MDialog>
  </div>
</template>
