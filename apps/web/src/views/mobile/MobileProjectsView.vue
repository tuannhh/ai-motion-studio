<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { FEATURE_ROUTES } from "../../router";
import { entityPath } from "../../lib/slug";
import MButton from "../../components/mds/MButton.vue";
import MEmptyState from "../../components/mds/MEmptyState.vue";
import MIcon from "../../components/mds/MIcon.vue";
import MProgress from "../../components/mds/MProgress.vue";
import MSpinner from "../../components/mds/MSpinner.vue";
import MTag from "../../components/mds/MTag.vue";
import MTextarea from "../../components/mds/MTextarea.vue";
import MMobileTopBar from "../../components/mobile/MMobileTopBar.vue";
import { useToast } from "../../components/mds/toast.js";
import { api, ApiError } from "../../lib/api";
import type { ProjectDetail, ProjectRow, ScriptRow } from "../../lib/types";

const toast = useToast();
const route = useRoute();
const router = useRouter();
const projects = ref<ProjectRow[]>([]);
const detail = ref<ProjectDetail | null>(null);
const loading = ref(false);
const detailLoading = ref(false);
const loadingMore = ref(false);
const nextCursor = ref<number | null>(null);
const approvingId = ref<number | null>(null);
const savingId = ref<number | null>(null);
const playingJobId = ref<number | null>(null);
let pollTimer: ReturnType<typeof setInterval> | null = null;

type ProjectPage = { items: ProjectRow[]; nextCursor: number | null };
const projectStatus: Record<string, { label: string; color: string }> = {
  draft: { label: "Nháp", color: "neutral" }, generating: { label: "Đang sinh", color: "info" },
  ready: { label: "Sẵn sàng", color: "success" }, failed: { label: "Lỗi", color: "danger" },
};
const scriptStatus: Record<string, { label: string; color: string }> = {
  pending: { label: "Chờ duyệt", color: "warning" }, approved: { label: "Đã duyệt", color: "success" }, rejected: { label: "Từ chối", color: "neutral" },
};
const jobLabels: Record<string, string> = { queued: "Trong hàng đợi", images: "Đang tạo ảnh", tts: "Đang lồng tiếng", rendering: "Đang render", done: "Hoàn tất", failed: "Render lỗi" };

const isBusy = computed(() => detail.value?.project.status === "generating" || detail.value?.sources.some((item) => item.status === "extracting") || detail.value?.scripts.some((item) => item.job_status && !["done", "failed"].includes(item.job_status)));

async function loadList(): Promise<void> {
  loading.value = true;
  try {
    const page = await api<ProjectPage>("/v1/projects?limit=20");
    projects.value = page.items;
    nextCursor.value = page.nextCursor;
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không tải được danh sách video.");
  } finally { loading.value = false; }
}
async function loadMore(): Promise<void> {
  if (nextCursor.value == null || loadingMore.value) return;
  loadingMore.value = true;
  try {
    const page = await api<ProjectPage>(`/v1/projects?limit=20&cursor=${nextCursor.value}`);
    projects.value.push(...page.items);
    nextCursor.value = page.nextCursor;
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không tải thêm được.");
  } finally { loadingMore.value = false; }
}
async function openDetail(id: number, silent = false): Promise<void> {
  if (!silent) detailLoading.value = true;
  try { detail.value = await api<ProjectDetail>(`/v1/projects/${id}`); }
  catch (cause) { if (!silent) toast.error(cause instanceof ApiError ? cause.message : "Không tải được video."); }
  finally { detailLoading.value = false; }
}
async function openDetailByPublicId(publicId: string): Promise<void> {
  detailLoading.value = true;
  try { detail.value = await api<ProjectDetail>(`/v1/projects/public/${publicId}`); }
  catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không tải được video.");
    router.replace(FEATURE_ROUTES.projects);
  } finally { detailLoading.value = false; }
}
function goToProject(project: ProjectRow): void { router.push(entityPath("video-da-tao", project.idea, project.public_id)); }
function closeDetail(): void { router.push(FEATURE_ROUTES.projects); }
async function approve(script: ScriptRow): Promise<void> {
  approvingId.value = script.id;
  try {
    await api(`/v1/scripts/${script.id}/approve`, { method: "POST" });
    toast.success("Đã duyệt, video đang được render.");
    if (detail.value) await openDetail(detail.value.project.id, true);
  } catch (cause) { toast.error(cause instanceof ApiError ? cause.message : "Không duyệt được kịch bản."); }
  finally { approvingId.value = null; }
}
async function reject(script: ScriptRow): Promise<void> {
  try {
    await api(`/v1/scripts/${script.id}/reject`, { method: "POST" });
    if (detail.value) await openDetail(detail.value.project.id, true);
  } catch (cause) { toast.error(cause instanceof ApiError ? cause.message : "Không cập nhật được kịch bản."); }
}
async function saveNarration(script: ScriptRow): Promise<void> {
  savingId.value = script.id;
  try {
    await api(`/v1/scripts/${script.id}/narration`, { method: "PUT", body: JSON.stringify({ scenes: script.scenes.map((scene) => ({ id: scene.id, narration: scene.narration })) }) });
    toast.success("Đã lưu lời đọc.");
    if (detail.value) await openDetail(detail.value.project.id, true);
  } catch (cause) { toast.error(cause instanceof ApiError ? cause.message : "Không lưu được lời đọc."); }
  finally { savingId.value = null; }
}

watch(isBusy, (busy) => {
  if (busy && detail.value && !pollTimer) pollTimer = setInterval(() => detail.value && void openDetail(detail.value.project.id, true), 4000);
  if (!busy && pollTimer) { clearInterval(pollTimer); pollTimer = null; }
});
onBeforeUnmount(() => { if (pollTimer) clearInterval(pollTimer); });
onMounted(async () => {
  await loadList();
  if (typeof route.params.id === "string") await openDetailByPublicId(route.params.id);
});
watch(
  () => route.params.id,
  async (id) => {
    if (typeof id === "string") await openDetailByPublicId(id);
    else { detail.value = null; playingJobId.value = null; await loadList(); }
  }
);
</script>

<template>
  <div class="mds-mobile-app flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--mds-bg)] text-[var(--mds-text)]">
    <template v-if="detail">
      <MMobileTopBar :title="detail.project.idea" back-label="Quay lại danh sách video" @back="closeDetail">
        <template #actions><MButton variant="icon" aria-label="Làm mới" @click="detail && openDetail(detail.project.id)"><template #icon><MIcon name="refresh" :size="20" /></template></MButton></template>
      </MMobileTopBar>
      <main class="min-h-0 flex-1 overflow-y-auto pb-5"><div class="mx-auto w-full max-w-[840px]">
        <section class="mds-mobile-gutter-x border-b border-[var(--mds-border-light)] py-4">
          <div class="flex items-center gap-2"><MTag :color="projectStatus[detail.project.status]?.color" size="sm">{{ projectStatus[detail.project.status]?.label }}</MTag><span class="text-[12px] text-[var(--mds-text-secondary)]">{{ detail.project.mode === 'series' ? 'Serie' : 'Đa chiều' }} · {{ detail.project.duration_sec }}s</span><MSpinner v-if="isBusy" :size="16" /></div>
          <p v-if="detail.project.error_message" class="mt-3 rounded-lg bg-[var(--mds-bg-danger-light)] p-3 text-[13px] text-[var(--mds-danger)]">{{ detail.project.error_message }}</p>
        </section>
        <section v-if="detail.sources.length" class="mds-mobile-gutter-x border-b border-[var(--mds-border-light)] py-4"><h2 class="m-0 text-[16px] font-semibold">Tư liệu</h2><div v-for="source in detail.sources" :key="source.id" class="flex min-w-0 items-center gap-2 border-b border-[var(--mds-border-light)] py-3 last:border-0"><MIcon name="file-text" :size="20" class="shrink-0 text-[var(--mds-icon-neutral)]" /><span class="min-w-0 flex-1 truncate text-[13px]">{{ source.file_name }}</span><MTag :color="source.status === 'ready' ? 'success' : source.status === 'failed' ? 'danger' : 'info'" size="sm">{{ source.status === 'ready' ? 'Đã xong' : source.status === 'failed' ? 'Lỗi' : 'Đang xử lý' }}</MTag></div></section>
        <section v-for="script in detail.scripts" :key="script.id" class="mds-mobile-gutter-x border-b border-[var(--mds-border-light)] py-5">
          <div class="flex min-w-0 items-start justify-between gap-3"><div class="min-w-0"><h2 class="m-0 truncate text-[16px] font-semibold">{{ script.title }}</h2><p class="m-0 mt-1 text-[12px] text-[var(--mds-text-secondary)]">{{ script.angle }} · {{ script.preset }}</p></div><MTag :color="scriptStatus[script.status]?.color" size="sm">{{ scriptStatus[script.status]?.label }}</MTag></div>
          <div v-if="script.scenes.length" class="mt-4 space-y-3"><div v-for="(scene, index) in script.scenes" :key="scene.id" class="rounded-lg bg-[var(--mds-bg-page)] p-3"><p class="m-0 text-[12px] font-semibold text-[var(--mds-text-secondary)]">Scene {{ index + 1 }}</p><p v-if="scene.display" class="m-0 mt-2 whitespace-pre-wrap text-[13px] leading-5">{{ scene.display }}</p><label class="mt-2 block text-[12px] font-medium text-[var(--mds-brand-600)]">Lời đọc<MTextarea v-if="script.status === 'pending'" v-model="scene.narration" class="mt-1" :rows="2" :maxlength="320" /><p v-else class="m-0 mt-1 whitespace-pre-wrap text-[13px] leading-5">{{ scene.narration }}</p></label></div></div>
          <MProgress v-if="script.job_id && script.job_status !== 'done' && script.job_status !== 'failed'" class="mt-4" :value="script.job_progress || 0" :label="jobLabels[script.job_status || 'queued']" />
          <p v-if="script.job_status === 'failed'" class="mt-3 text-[13px] text-[var(--mds-danger)]">{{ script.job_error || 'Render video thất bại.' }}</p>
          <video v-if="script.job_status === 'done' && playingJobId === script.job_id" class="mt-4 max-h-[58vh] w-full rounded-lg bg-black" controls autoplay :src="`/v1/jobs/${script.job_id}/video`" />
          <div class="mds-mobile-row-gap-2 mt-4 flex flex-wrap gap-2"><MButton v-if="script.status === 'pending'" :loading="savingId === script.id" @click="saveNarration(script)">Lưu lời đọc</MButton><MButton v-if="script.status !== 'rejected' && (!script.job_id || script.job_status === 'failed')" variant="primary" :loading="approvingId === script.id" @click="approve(script)">{{ script.job_status === 'failed' ? 'Render lại' : 'Duyệt render' }}</MButton><MButton v-if="script.status !== 'rejected' && (!script.job_id || script.job_status === 'failed')" variant="ghost" @click="reject(script)">Từ chối</MButton><MButton v-if="script.job_status === 'done'" variant="primary" @click="playingJobId = script.job_id">Xem video</MButton></div>
        </section>
      </div></main>
    </template>
    <template v-else>
      <MMobileTopBar title="Video đã tạo" :show-back="false"><template #actions><MButton variant="icon" aria-label="Làm mới" @click="loadList"><template #icon><MIcon name="refresh" :size="20" /></template></MButton></template></MMobileTopBar>
      <main class="min-h-0 flex-1 overflow-y-auto"><div class="mx-auto w-full max-w-[840px]"><div v-if="loading" class="grid place-items-center py-16"><MSpinner :size="28" /></div><MEmptyState v-else-if="!projects.length" title="Chưa có video" description="Tạo kịch bản đầu tiên để bắt đầu sản xuất video." /><article v-for="project in projects" v-else :key="project.id" class="mds-mobile-gutter-x flex min-h-[76px] min-w-0 items-center gap-3 border-b border-[var(--mds-border-light)] py-3 active:bg-[var(--mds-bg-hover-soft)]" @click="goToProject(project)"><div class="min-w-0 flex-1"><h2 class="m-0 truncate text-[14px] font-semibold leading-5">{{ project.idea }}</h2><p class="m-0 mt-1 truncate text-[12px] text-[var(--mds-text-secondary)]">{{ project.mode === 'series' ? 'Serie' : 'Đa chiều' }} · {{ project.script_count }} kịch bản · {{ project.created_at }}</p></div><MTag :color="projectStatus[project.status]?.color" size="sm">{{ projectStatus[project.status]?.label }}</MTag><MIcon name="chevron-right" :size="20" class="shrink-0 text-[var(--mds-icon-neutral)]" /></article><div v-if="nextCursor != null" class="p-4 text-center"><MButton :loading="loadingMore" @click="loadMore">Tải thêm</MButton></div></div></main>
    </template>
  </div>
</template>
