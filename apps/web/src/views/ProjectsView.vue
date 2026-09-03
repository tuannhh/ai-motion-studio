<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { FEATURE_ROUTES } from "../router";
import { entityPath } from "../lib/slug";
import MButton from "../components/mds/MButton.vue";
import MDataTable from "../components/mds/MDataTable.vue";
import MEmptyState from "../components/mds/MEmptyState.vue";
import MIcon from "../components/mds/MIcon.vue";
import MImageViewer from "../components/mds/MImageViewer.vue";
import MProgress from "../components/mds/MProgress.vue";
import MSpinner from "../components/mds/MSpinner.vue";
import MTag from "../components/mds/MTag.vue";
import MTextarea from "../components/mds/MTextarea.vue";
import { useToast } from "../components/mds/toast.js";
import { api, ApiError } from "../lib/api";
import type { DriveExport, ProjectDetail, ProjectRow, ScriptRow } from "../lib/types";

const emit = defineEmits<{ "edit-setup": [projectId: number] }>();
const toast = useToast();
const route = useRoute();
const router = useRouter();

const projects = ref<ProjectRow[]>([]);
const loading = ref(false);
const loadingMore = ref(false);
const nextCursor = ref<number | null>(null);

type ProjectPage = { items: ProjectRow[]; nextCursor: number | null };
const detail = ref<ProjectDetail | null>(null);
const detailLoading = ref(false);
const approvingId = ref<number | null>(null);
const playingJobId = ref<number | null>(null);
// Xem lại ảnh tư liệu (upload trực tiếp hoặc ảnh tự trích từ docx/pdf) — để người
// dùng xác nhận hệ thống đã trích đúng ảnh nào trước khi duyệt kịch bản.
const sourceImageViewerOpen = ref(false);
const sourceImageIndex = ref(0);
const sourceImages = computed(() =>
  (detail.value?.sources ?? [])
    .filter((s) => s.mime.startsWith("image/") && s.status === "ready")
    .map((s) => ({
      src: `/v1/projects/${detail.value!.project.id}/sources/${s.id}/file`,
      name: s.file_name,
      alt: s.file_name,
    }))
);
function openSourceImage(sourceId: number): void {
  const idx = (detail.value?.sources ?? [])
    .filter((s) => s.mime.startsWith("image/") && s.status === "ready")
    .findIndex((s) => s.id === sourceId);
  if (idx < 0) return;
  sourceImageIndex.value = idx;
  sourceImageViewerOpen.value = true;
}
// Kịch bản đã render đang được mở lại để SỬA lời thoại (rồi render lại)
const editingIds = ref<Set<number>>(new Set());
let pollTimer: ReturnType<typeof setInterval> | null = null;

// Export Drive theo jobId: link đã export + trạng thái đang upload
const driveExports = ref<Record<number, DriveExport>>({});
const driveExporting = ref<number | null>(null);

async function loadDriveExport(jobId: number): Promise<void> {
  try {
    const ex = await api<DriveExport | null>(`/v1/jobs/${jobId}/export/drive`);
    if (ex) driveExports.value = { ...driveExports.value, [jobId]: ex };
  } catch {
    /* bỏ qua — chỉ để hiện link nếu đã export */
  }
}

async function exportToDrive(jobId: number): Promise<void> {
  driveExporting.value = jobId;
  try {
    const ex = await api<DriveExport>(`/v1/jobs/${jobId}/export/drive`, { method: "POST" });
    driveExports.value = { ...driveExports.value, [jobId]: ex };
    toast.success("Đã xuất video lên Google Drive.");
  } catch (cause) {
    const msg = cause instanceof ApiError ? cause.message : "Không xuất được lên Drive.";
    toast.error(
      msg.includes("Chưa kết nối")
        ? "Chưa kết nối Google Drive — mở menu tài khoản để kết nối."
        : msg
    );
  } finally {
    driveExporting.value = null;
  }
}

const VOICE_STYLE_LABEL: Record<string, string> = {
  thoisu: "thời sự",
  tintuc: "tin tức",
  tvc: "quảng cáo TVC",
};
const VOICE_MOOD_LABEL: Record<string, string> = {
  neutral: "",
  cheerful: "vui vẻ",
  energetic: "năng động",
};
const VOICE_AGE_LABEL: Record<string, string> = {
  thanhnien: "thanh niên",
  trungnien: "trung niên",
  nguoidilam: "người đi làm",
};
const voiceSummary = computed(() => {
  const p = detail.value?.project;
  if (!p) return "";
  const parts = [
    `Giọng ${p.voice_gender === "male" ? "nam" : "nữ"} miền ${p.voice_region === "nam" ? "Nam" : "Bắc"}`,
    VOICE_STYLE_LABEL[p.voice_style] ?? p.voice_style,
    VOICE_AGE_LABEL[p.voice_age] ?? p.voice_age,
    VOICE_MOOD_LABEL[p.voice_mood] || "",
    Number(p.voice_speed) === 1.2 ? "nhanh 1,2x" : "tốc độ thường",
  ].filter(Boolean);
  return parts.join(", ");
});

const PROJECT_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: "Nháp", color: "neutral" },
  generating: { label: "Đang sinh kịch bản", color: "info" },
  ready: { label: "Kịch bản sẵn sàng", color: "success" },
  failed: { label: "Lỗi", color: "danger" },
};
const SCRIPT_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "Chờ duyệt", color: "warning" },
  approved: { label: "Đã duyệt", color: "success" },
  rejected: { label: "Từ chối", color: "neutral" },
};
const JOB_STATUS: Record<string, string> = {
  queued: "Trong hàng đợi",
  images: "Đang sinh ảnh minh họa",
  tts: "Đang tạo giọng đọc",
  rendering: "Đang render video",
  done: "Hoàn tất",
  failed: "Render lỗi",
};

const columns = [
  { key: "idea", label: "Ý tưởng" },
  { key: "mode", label: "Chế độ", width: 110 },
  { key: "script_count", label: "Kịch bản", width: 90, align: "right" },
  { key: "status", label: "Trạng thái", width: 160 },
  { key: "created_at", label: "Tạo lúc", width: 150 },
];

async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const page = await api<ProjectPage>("/v1/projects?limit=20");
    projects.value = page.items;
    nextCursor.value = page.nextCursor;
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không tải được danh sách.");
  } finally {
    loading.value = false;
  }
}

async function loadMore(): Promise<void> {
  if (nextCursor.value == null || loadingMore.value) return;
  loadingMore.value = true;
  try {
    const page = await api<ProjectPage>(`/v1/projects?limit=20&cursor=${nextCursor.value}`);
    projects.value = [...projects.value, ...page.items];
    nextCursor.value = page.nextCursor;
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không tải thêm được.");
  } finally {
    loadingMore.value = false;
  }
}

function applyDetail(next: ProjectDetail): void {
  detail.value = next;
  // Lấy link Drive đã export (nếu có) cho các video đã render xong
  for (const s of next.scripts) {
    if (s.job_status === "done" && s.job_id) void loadDriveExport(s.job_id);
  }
}

async function openDetail(projectId: number, silent = false): Promise<void> {
  if (!silent) detailLoading.value = true;
  try {
    applyDetail(await api<ProjectDetail>(`/v1/projects/${projectId}`));
  } catch (cause) {
    if (!silent) toast.error(cause instanceof ApiError ? cause.message : "Không tải được dự án.");
  } finally {
    detailLoading.value = false;
  }
}

/** Mở chi tiết từ URL /video-da-tao/:slug/:id (id = public_id, không phải id số) */
async function openDetailByPublicId(publicId: string): Promise<void> {
  detailLoading.value = true;
  try {
    applyDetail(await api<ProjectDetail>(`/v1/projects/public/${publicId}`));
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không tải được dự án.");
    router.replace(FEATURE_ROUTES.projects);
  } finally {
    detailLoading.value = false;
  }
}

/** Điều hướng sang link đẹp của 1 project (nguồn sự thật của "đang mở chi tiết" là route). */
function goToProject(row: { idea: string; public_id: string }): void {
  router.push(entityPath("video-da-tao", row.idea, row.public_id));
}

/** còn việc đang chạy → poll tiếp */
const isBusy = computed(() => {
  const d = detail.value;
  if (!d) return false;
  if (d.project.status === "generating") return true;
  if (d.sources.some((s) => s.status === "extracting")) return true;
  return d.scripts.some((s) => s.job_status && !["done", "failed"].includes(s.job_status));
});

watch([detail, isBusy], () => {
  if (detail.value && isBusy.value && !pollTimer) {
    pollTimer = setInterval(() => {
      if (detail.value) void openDetail(detail.value.project.id, true);
    }, 4000);
  } else if ((!detail.value || !isBusy.value) && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
});
onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer);
});

async function approve(script: ScriptRow): Promise<void> {
  approvingId.value = script.id;
  try {
    await api(`/v1/scripts/${script.id}/approve`, { method: "POST" });
    toast.success("Đã duyệt — video sẽ được render tự động.");
    if (detail.value) await openDetail(detail.value.project.id, true);
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không duyệt được kịch bản.");
  } finally {
    approvingId.value = null;
  }
}

// #9 Sửa lời thoại trước khi duyệt
const savingEditId = ref<number | null>(null);
async function saveNarration(script: ScriptRow): Promise<void> {
  savingEditId.value = script.id;
  try {
    await api(`/v1/scripts/${script.id}/narration`, {
      method: "PUT",
      body: JSON.stringify({
        scenes: script.scenes.map((s) => ({ id: s.id, narration: s.narration })),
      }),
    });
    toast.success("Đã lưu chỉnh sửa lời thoại.");
    if (detail.value) await openDetail(detail.value.project.id, true);
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không lưu được lời thoại.");
  } finally {
    savingEditId.value = null;
  }
}

// Sửa lại kịch bản của video ĐÃ render: bật ô sửa (pending luôn cho sửa sẵn)
function isEditing(script: ScriptRow): boolean {
  return script.status === "pending" || editingIds.value.has(script.id);
}
function startEdit(script: ScriptRow): void {
  editingIds.value = new Set(editingIds.value).add(script.id);
}
function cancelEdit(script: ScriptRow): void {
  const next = new Set(editingIds.value);
  next.delete(script.id);
  editingIds.value = next;
  // Nạp lại để khôi phục lời thoại gốc (bỏ các sửa chưa lưu)
  if (detail.value) void openDetail(detail.value.project.id, true);
}

// Lưu lời thoại đã sửa rồi RENDER LẠI (dùng cho kịch bản đã render trước đó)
async function saveAndRerender(script: ScriptRow): Promise<void> {
  savingEditId.value = script.id;
  try {
    await api(`/v1/scripts/${script.id}/narration`, {
      method: "PUT",
      body: JSON.stringify({
        scenes: script.scenes.map((s) => ({ id: s.id, narration: s.narration })),
      }),
    });
    await api(`/v1/scripts/${script.id}/approve`, { method: "POST" });
    const next = new Set(editingIds.value);
    next.delete(script.id);
    editingIds.value = next;
    toast.success("Đã lưu lời thoại — đang render lại video.");
    if (detail.value) await openDetail(detail.value.project.id, true);
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không render lại được.");
  } finally {
    savingEditId.value = null;
  }
}

async function reject(script: ScriptRow): Promise<void> {
  try {
    await api(`/v1/scripts/${script.id}/reject`, { method: "POST" });
    if (detail.value) await openDetail(detail.value.project.id, true);
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không cập nhật được.");
  }
}

function backToList(): void {
  router.push(FEATURE_ROUTES.projects);
}

onMounted(async () => {
  await loadList();
  if (typeof route.params.id === "string") await openDetailByPublicId(route.params.id);
});

/** URL thay đổi (mở project khác / bấm back về danh sách) → đồng bộ lại view. */
watch(
  () => route.params.id,
  async (id) => {
    if (typeof id === "string") {
      await openDetailByPublicId(id);
    } else {
      detail.value = null;
      playingJobId.value = null;
      await loadList();
    }
  }
);
</script>

<template>
  <!-- ===== Chi tiết dự án ===== -->
  <div v-if="detail" class="p-6">
    <div class="mb-4 flex items-start justify-between gap-3">
      <div class="flex items-start gap-2">
        <MButton variant="icon" @click="backToList"><MIcon name="arrow-left" /></MButton>
        <div>
          <h1 class="m-0 text-lg font-semibold leading-6">{{ detail.project.idea }}</h1>
          <p class="m-0 mt-1 flex flex-wrap items-center gap-2 text-[13px] text-[var(--mds-text-secondary)]">
            <MTag :color="PROJECT_STATUS[detail.project.status]?.color" size="sm">
              {{ PROJECT_STATUS[detail.project.status]?.label }}
            </MTag>
            <span>{{ detail.project.mode === "series" ? "Serie nối tập" : "Đa chiều" }}</span>
            <span>·</span>
            <span>{{ voiceSummary }}</span>
            <span v-if="detail.project.duration_sec">· ≈{{ detail.project.duration_sec }}s</span>
          </p>
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <MSpinner v-if="isBusy" :size="20" />
        <MButton
          v-if="detail.project.status !== 'generating'"
          title="Xem lại bước thiết lập ban đầu — đổi thời lượng, tư liệu, giọng đọc… rồi tạo lại (video hiện có vẫn giữ nguyên)"
          @click="emit('edit-setup', detail.project.id)"
        >
          <MIcon name="edit" :size="16" /> Sửa thiết lập &amp; tạo lại
        </MButton>
      </div>
    </div>

    <p
      v-if="detail.project.status === 'failed'"
      class="mb-4 rounded-lg bg-[var(--mds-bg-danger-light,#FEF3F2)] p-3 text-[13px] text-[var(--mds-danger,#F04438)]"
    >
      Sinh kịch bản thất bại: {{ detail.project.error_message }}
    </p>

    <!-- Tư liệu -->
    <section
      v-if="detail.sources.length"
      class="mb-4 rounded-lg bg-[var(--mds-bg)] p-4 shadow-[var(--mds-shadow-card)]"
    >
      <h2 class="m-0 mb-2 text-[15px] font-semibold">Tư liệu ({{ detail.sources.length }})</h2>
      <ul class="m-0 list-none p-0">
        <li
          v-for="s in detail.sources"
          :key="s.id"
          class="flex items-center gap-2 border-b border-[var(--mds-neutral-300,#E9EAEB)] py-1.5 text-[13px] last:border-0"
        >
          <button
            v-if="s.mime.startsWith('image/') && s.status === 'ready'"
            type="button"
            class="h-8 w-8 shrink-0 overflow-hidden rounded border border-[var(--mds-neutral-300,#E9EAEB)]"
            title="Xem ảnh đã trích xuất"
            @click="openSourceImage(s.id)"
          >
            <img
              :src="`/v1/projects/${detail.project.id}/sources/${s.id}/file`"
              :alt="s.file_name"
              class="h-full w-full object-cover"
            />
          </button>
          <MIcon v-else name="file-text" :size="16" class="shrink-0 text-[var(--mds-text-secondary)]" />
          <span class="min-w-0 flex-1 truncate">{{ s.file_name }}</span>
          <MTag
            :color="s.status === 'ready' ? 'success' : s.status === 'failed' ? 'danger' : 'info'"
            size="sm"
          >
            {{ s.status === "ready" ? "Đã trích xuất" : s.status === "failed" ? "Lỗi" : "Đang trích xuất" }}
          </MTag>
        </li>
      </ul>
    </section>

    <MImageViewer
      v-model="sourceImageViewerOpen"
      :images="sourceImages"
      :initial-index="sourceImageIndex"
    />

    <!-- Kịch bản chờ duyệt -->
    <div v-if="detail.project.status === 'generating'" class="rounded-lg bg-[var(--mds-bg)] p-8 text-center shadow-[var(--mds-shadow-card)]">
      <MSpinner :size="28" />
      <p class="m-0 mt-3 text-[13px] text-[var(--mds-text-secondary)]">
        AI đang viết kịch bản — thường mất dưới 1 phút…
      </p>
    </div>

    <section
      v-for="script in detail.scripts"
      :key="script.id"
      class="mb-4 rounded-lg bg-[var(--mds-bg)] p-4 shadow-[var(--mds-shadow-card)]"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="min-w-0">
          <h3 class="m-0 truncate text-[15px] font-semibold">{{ script.title }}</h3>
          <p class="m-0 mt-0.5 text-[13px] text-[var(--mds-text-secondary)]">
            {{ script.angle }} · preset {{ script.preset }}
          </p>
        </div>
        <div class="flex items-center gap-2">
          <MTag :color="SCRIPT_STATUS[script.status]?.color" size="sm">
            {{ SCRIPT_STATUS[script.status]?.label }}
          </MTag>
          <template v-if="!script.job_id || script.job_status === 'failed'">
            <MButton v-if="script.status !== 'rejected'" @click="reject(script)">Từ chối</MButton>
            <MButton
              variant="primary"
              :loading="approvingId === script.id"
              @click="approve(script)"
            >
              {{ script.job_status === "failed" ? "Render lại" : "Duyệt & render" }}
            </MButton>
          </template>
        </div>
      </div>

      <!-- Kịch bản: chữ trên hình + lời đọc voice-off từng scene để duyệt -->
      <details class="mt-3" :open="script.status === 'pending' || editingIds.has(script.id)">
        <summary class="cursor-pointer text-[13px] font-medium text-[var(--mds-brand-600)]">
          {{ isEditing(script) && script.scenes?.length ? "Xem kịch bản & sửa lời đọc từng scene" : "Xem kịch bản & lời đọc từng scene" }}
        </summary>

        <div v-if="script.scenes?.length" class="mt-2 space-y-3">
          <p class="m-0 text-[12px] text-[var(--mds-text-secondary)]">
            Mỗi scene gồm <b>chữ trên hình</b> (nhìn thấy) và <b>lời đọc voice-off</b> (nghe thấy) — hai phần
            cố ý KHÁC nhau để lời đọc bổ sung chứ không lặp lại chữ trên hình.
          </p>
          <div
            v-for="(sc, i) in script.scenes"
            :key="sc.id"
            class="rounded-lg border border-[var(--mds-border)] p-2.5"
          >
            <p class="m-0 mb-1.5 text-[12px] font-semibold text-[var(--mds-text-secondary)]">
              Scene {{ i + 1 }} — {{ sc.type }}
            </p>
            <!-- Chữ trên hình (read-only) -->
            <div v-if="sc.display" class="mb-2">
              <p class="m-0 mb-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--mds-text-tertiary,#98A2B3)]">
                Chữ trên hình
              </p>
              <p class="m-0 whitespace-pre-wrap rounded-md bg-[var(--mds-bg-page)] p-2 text-[13px] leading-5">{{ sc.display }}</p>
            </div>
            <!-- Lời đọc voice-off -->
            <div>
              <p class="m-0 mb-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--mds-brand-600)]">
                Lời đọc (voice-off)
              </p>
              <MTextarea
                v-if="isEditing(script)"
                v-model="sc.narration"
                :rows="2"
                :maxlength="320"
              />
              <p
                v-else
                class="m-0 whitespace-pre-wrap rounded-md bg-[var(--mds-bg-page)] p-2 text-[13px] leading-5"
              >{{ sc.narration }}</p>
            </div>
          </div>
          <!-- Kịch bản CHƯA duyệt: lưu rồi duyệt & render riêng -->
          <template v-if="script.status === 'pending'">
            <MButton :loading="savingEditId === script.id" @click="saveNarration(script)">
              <MIcon name="device-floppy" :size="16" /> Lưu chỉnh sửa
            </MButton>
            <p class="m-0 text-[12px] text-[var(--mds-text-secondary)]">
              Chỉ sửa được <b>lời đọc</b>; chữ trên hình do bố cục scene quyết định. Sửa xong bấm "Lưu chỉnh sửa", rồi "Duyệt & render".
              Số/năm/ngày sẽ được đọc thành chữ tiếng Việt khi lồng tiếng.
            </p>
          </template>
          <!-- Kịch bản ĐÃ render, đang mở lại để sửa: lưu & render lại luôn -->
          <template v-else-if="editingIds.has(script.id)">
            <div class="flex flex-wrap items-center gap-2">
              <MButton variant="primary" :loading="savingEditId === script.id" @click="saveAndRerender(script)">
                <MIcon name="refresh" :size="16" /> Lưu &amp; render lại
              </MButton>
              <MButton :disabled="savingEditId === script.id" @click="cancelEdit(script)">Huỷ</MButton>
            </div>
            <p class="m-0 text-[12px] text-[var(--mds-text-secondary)]">
              Sửa <b>lời đọc</b> rồi bấm "Lưu &amp; render lại" — hệ thống dựng lại video mới từ lời thoại đã sửa
              (video cũ vẫn giữ tới khi bản mới xong). Chữ trên hình do bố cục scene quyết định, không sửa ở đây.
            </p>
          </template>
          <!-- Kịch bản đã render, chưa vào chế độ sửa: nút mở sửa lại -->
          <template v-else-if="script.job_status === 'done' || script.job_status === 'failed'">
            <MButton @click="startEdit(script)">
              <MIcon name="edit" :size="16" /> Sửa lời thoại &amp; render lại
            </MButton>
          </template>
        </div>

        <!-- Fallback khi plan hỏng không tách được scene -->
        <pre
          v-else
          class="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-[var(--mds-bg-page)] p-3 text-[13px] leading-5"
        >{{ script.narration_md }}</pre>
      </details>

      <!-- Tiến độ render -->
      <div v-if="script.job_id && script.job_status !== 'done'" class="mt-3">
        <p v-if="script.job_status === 'failed'" class="m-0 text-[13px] text-[var(--mds-danger,#F04438)]">
          Render lỗi: {{ script.job_error }}
        </p>
        <MProgress
          v-else
          :value="script.job_progress ?? 0"
          :label="JOB_STATUS[script.job_status ?? 'queued']"
        />
      </div>

      <!-- Video kết quả -->
      <div v-if="script.job_status === 'done'" class="mt-3">
        <video
          v-if="playingJobId === script.job_id"
          class="max-h-[480px] rounded-lg bg-black"
          controls
          autoplay
          :src="`/v1/jobs/${script.job_id}/video`"
        />
        <div class="flex items-center gap-2">
          <MButton v-if="playingJobId !== script.job_id" variant="primary" @click="playingJobId = script.job_id">
            Xem video
          </MButton>
          <MButton v-if="!editingIds.has(script.id)" @click="startEdit(script)">
            <MIcon name="edit" :size="16" /> Sửa lời thoại &amp; render lại
          </MButton>
          <a
            class="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--mds-brand-600)] no-underline"
            :href="`/v1/jobs/${script.job_id}/video`"
            :download="`${script.slug}.mp4`"
          >
            <MIcon name="download" :size="16" /> Tải MP4
          </a>
          <!-- Xuất lên Google Drive -->
          <a
            v-if="script.job_id && driveExports[script.job_id]?.webLink"
            class="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--mds-success,#12805c)] no-underline"
            :href="driveExports[script.job_id].webLink!"
            target="_blank"
            rel="noopener"
          >
            <MIcon name="external-link" :size="16" /> Đã lưu Drive — mở
          </a>
          <MButton
            v-else-if="script.job_id"
            :loading="driveExporting === script.job_id"
            @click="exportToDrive(script.job_id)"
          >
            <MIcon name="cloud-upload" :size="16" /> Xuất lên Drive
          </MButton>
        </div>
      </div>
    </section>
  </div>

  <!-- ===== Danh sách dự án ===== -->
  <div v-else class="p-6">
    <div class="mb-4 flex items-center justify-between">
      <h1 class="m-0 text-xl font-semibold">Video đã tạo</h1>
    </div>
    <div class="rounded-lg bg-[var(--mds-bg)] shadow-[var(--mds-shadow-card)]">
      <MDataTable
        :columns="columns"
        :rows="projects"
        :loading="loading || detailLoading"
        @row-click="(row: ProjectRow) => goToProject(row)"
      >
        <template #cell-mode="{ value }">
          {{ value === "series" ? "Serie" : "Đa chiều" }}
        </template>
        <template #cell-status="{ value }">
          <MTag :color="PROJECT_STATUS[value]?.color" size="sm">
            {{ PROJECT_STATUS[value]?.label }}
          </MTag>
        </template>
        <template #cell-created_at="{ value }">
          {{ new Date(value).toLocaleString("vi-VN") }}
        </template>
        <template #empty>
          <MEmptyState
            type="initial"
            title="Chưa có dự án nào"
            description="Bắt đầu từ mục Tạo video ở thanh bên trái."
          />
        </template>
      </MDataTable>
    </div>
    <div v-if="nextCursor != null" class="mt-4 flex justify-center">
      <MButton :loading="loadingMore" @click="loadMore">Tải thêm</MButton>
    </div>
  </div>
</template>
