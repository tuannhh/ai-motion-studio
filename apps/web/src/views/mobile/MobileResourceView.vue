<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import MButton from "../../components/mds/MButton.vue";
import MEmptyState from "../../components/mds/MEmptyState.vue";
import MIcon from "../../components/mds/MIcon.vue";
import MInput from "../../components/mds/MInput.vue";
import MRadioGroup from "../../components/mds/MRadioGroup.vue";
import MSpinner from "../../components/mds/MSpinner.vue";
import MTag from "../../components/mds/MTag.vue";
import MTextarea from "../../components/mds/MTextarea.vue";
import MUpload from "../../components/mds/MUpload.vue";
import MMobileTopBar from "../../components/mobile/MMobileTopBar.vue";
import { useToast } from "../../components/mds/toast.js";
import { api, apiForm, ApiError } from "../../lib/api";

type ResourceKind = "series" | "templates" | "watermark" | "music" | "users";
const props = defineProps<{ kind: ResourceKind; isAdmin: boolean }>();
const emit = defineEmits<{ back: [] }>();
const toast = useToast();

const meta = computed(() => ({
  series: { title: "Serie", icon: "copy", endpoint: "/v1/series", empty: "Chưa có serie nào", add: "Tạo serie" },
  templates: { title: "Video Template", icon: "layout-grid", endpoint: "/v1/templates", empty: "Chưa có video mẫu", add: "Tạo mẫu" },
  watermark: { title: "Watermark", icon: "photo", endpoint: "/v1/watermark-presets", empty: "Chưa có watermark", add: "Thêm watermark" },
  music: { title: "Nhạc nền", icon: "speakerphone", endpoint: "/v1/music", empty: "Thư viện nhạc trống", add: "Thêm nhạc" },
  users: { title: "Người dùng", icon: "users", endpoint: "/v1/admin/users", empty: "Chưa có người dùng", add: "Thêm người dùng" },
}[props.kind]));

const rows = ref<Record<string, unknown>[]>([]);
const loading = ref(false);
const formOpen = ref(false);
const saving = ref(false);
const name = ref("");
const description = ref("");
const email = ref("");
const password = ref("");
const role = ref<"creator" | "admin">("creator");
const watermarkKind = ref<"text" | "image">("text");
const watermarkText = ref("");
const selectedFile = ref<File | null>(null);
const uploadItems = ref<Array<{ id: string; name: string; size: number; status: "pending"; file: File }>>([]);
const formError = ref("");

async function load(): Promise<void> {
  loading.value = true;
  try { rows.value = await api<Record<string, unknown>[]>(meta.value.endpoint); }
  catch (cause) { toast.error(cause instanceof ApiError ? cause.message : "Không tải được dữ liệu."); }
  finally { loading.value = false; }
}
onMounted(() => void load());

function resetForm(): void {
  name.value = ""; description.value = ""; email.value = ""; password.value = ""; role.value = "creator";
  watermarkKind.value = "text"; watermarkText.value = ""; selectedFile.value = null; uploadItems.value = []; formError.value = "";
}
function openCreate(): void { resetForm(); formOpen.value = true; }
function selectFile(files: File[]): void {
  selectedFile.value = files[0] ?? null;
  uploadItems.value = selectedFile.value ? [{ id: String(Date.now()), name: selectedFile.value.name, size: selectedFile.value.size, status: "pending", file: selectedFile.value }] : [];
  if (selectedFile.value && !name.value) name.value = selectedFile.value.name.replace(/\.[^.]+$/, "");
}
function removeFile(): void { selectedFile.value = null; uploadItems.value = []; }

async function save(): Promise<void> {
  formError.value = "";
  if (props.kind === "users") {
    if (!email.value.trim() || !name.value.trim() || password.value.length < 8) { formError.value = "Điền email, tên và mật khẩu tối thiểu 8 ký tự."; return; }
  } else if (name.value.trim().length < 2) { formError.value = "Nhập tên, tối thiểu 2 ký tự."; return; }
  if (["templates", "music"].includes(props.kind) && !selectedFile.value) { formError.value = "Chọn tệp để tiếp tục."; return; }
  if (props.kind === "watermark" && watermarkKind.value === "text" && !watermarkText.value.trim()) { formError.value = "Nhập nội dung watermark."; return; }

  saving.value = true;
  try {
    if (props.kind === "series") {
      await api("/v1/series", { method: "POST", body: JSON.stringify({ name: name.value.trim(), description: description.value.trim() || undefined }) });
    } else if (props.kind === "templates" && selectedFile.value) {
      const form = new FormData(); form.append("name", name.value.trim()); form.append("video", selectedFile.value, selectedFile.value.name); await apiForm("/v1/templates", form);
    } else if (props.kind === "watermark") {
      const response = await api<{ id: number }>("/v1/watermark-presets", { method: "POST", body: JSON.stringify({ name: name.value.trim(), kind: watermarkKind.value, text: watermarkKind.value === "text" ? watermarkText.value.trim() : undefined, x: 0.5, y: 0.06, opacity: 0.5, scale: 0.16 }) });
      if (watermarkKind.value === "image" && selectedFile.value) { const form = new FormData(); form.append("file", selectedFile.value, selectedFile.value.name); await apiForm(`/v1/watermark-presets/${response.id}/image`, form); }
    } else if (props.kind === "music" && selectedFile.value) {
      const form = new FormData(); form.append("name", name.value.trim()); form.append("file", selectedFile.value, selectedFile.value.name); await apiForm("/v1/music", form);
    } else if (props.kind === "users") {
      await api("/v1/admin/users", { method: "POST", body: JSON.stringify({ email: email.value.trim(), displayName: name.value.trim(), password: password.value, role: role.value }) });
    }
    toast.success("Đã lưu."); formOpen.value = false; await load();
  } catch (cause) { toast.error(cause instanceof ApiError ? cause.message : "Không thể lưu dữ liệu."); }
  finally { saving.value = false; }
}

function rowTitle(row: Record<string, unknown>): string {
  return String(row.name ?? row.display_name ?? "Chưa đặt tên");
}
function rowMeta(row: Record<string, unknown>): string {
  if (props.kind === "series") return `${row.episode_count ?? 0} tập · ${row.project_count ?? 0} video`;
  if (props.kind === "templates") return `${row.sourceVideoName || "Video mẫu"} · ${row.updatedAt || ""}`;
  if (props.kind === "watermark") return row.kind === "text" ? `Chữ: ${row.text || ""}` : "Hình ảnh";
  if (props.kind === "music") return `${row.credit || "Không rõ nguồn"} · ${row.mime || ""}`;
  return `${row.email || ""} · ${row.project_count ?? 0} video`;
}
function rowTag(row: Record<string, unknown>): { label: string; color: string } | null {
  if (props.kind === "templates") return { label: row.status === "ready" ? "Sẵn sàng" : row.status === "failed" ? "Lỗi" : "Đang phân tích", color: row.status === "ready" ? "success" : row.status === "failed" ? "danger" : "info" };
  if (props.kind === "users") return { label: row.role === "admin" ? "Quản trị" : "Creator", color: row.role === "admin" ? "brand" : "neutral" };
  return null;
}
</script>

<template>
  <div class="mds-mobile-app flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--mds-bg)] text-[var(--mds-text)]">
    <template v-if="formOpen">
      <MMobileTopBar :title="meta.add" @back="formOpen = false" />
      <main class="min-h-0 flex-1 overflow-y-auto"><div class="mds-mobile-gutter-x m-auto w-full max-w-[720px] py-5">
        <div class="mds-mobile-column-gap-4 flex flex-col gap-4">
          <p v-if="formError" class="m-0 rounded-lg bg-[var(--mds-bg-danger-light)] p-3 text-[13px] text-[var(--mds-danger)]">{{ formError }}</p>
          <label v-if="props.kind === 'users'" class="block text-[13px] font-medium">Email <span class="text-[var(--mds-danger)]">*</span><MInput v-model="email" class="mt-1" type="email" inputmode="email" placeholder="creator@misa.com.vn" /></label>
          <label class="block text-[13px] font-medium">{{ props.kind === 'users' ? 'Tên hiển thị' : 'Tên' }} <span class="text-[var(--mds-danger)]">*</span><MInput v-model="name" class="mt-1" :placeholder="props.kind === 'series' ? 'Ví dụ: AI mỗi ngày' : 'Nhập tên'" /></label>
          <label v-if="props.kind === 'series'" class="block text-[13px] font-medium">Mô tả<MTextarea v-model="description" class="mt-1" :rows="3" :maxlength="250" placeholder="Mô tả ngắn gọn" /></label>
          <label v-if="props.kind === 'users'" class="block text-[13px] font-medium">Mật khẩu <span class="text-[var(--mds-danger)]">*</span><MInput v-model="password" class="mt-1" type="password" placeholder="Tối thiểu 8 ký tự" /></label>
          <fieldset v-if="props.kind === 'users'"><legend class="mb-1 text-[13px] font-medium">Vai trò</legend><MRadioGroup v-model="role" :options="[{ label: 'Creator', value: 'creator' }, { label: 'Quản trị', value: 'admin' }]" direction="horizontal" /></fieldset>
          <fieldset v-if="props.kind === 'watermark'"><legend class="mb-1 text-[13px] font-medium">Loại watermark</legend><MRadioGroup v-model="watermarkKind" :options="[{ label: 'Chữ', value: 'text' }, { label: 'Hình', value: 'image' }]" direction="horizontal" /></fieldset>
          <label v-if="props.kind === 'watermark' && watermarkKind === 'text'" class="block text-[13px] font-medium">Nội dung chữ<MInput v-model="watermarkText" class="mt-1" maxlength="40" placeholder="© Kênh của bạn" /></label>
          <MUpload v-if="props.kind === 'templates' || props.kind === 'music' || (props.kind === 'watermark' && watermarkKind === 'image')" :model-value="uploadItems" :accept="props.kind === 'templates' ? '.mp4,.mov,.webm,video/*' : props.kind === 'music' ? '.mp3,.wav,.m4a,.aac,.ogg,audio/*' : 'image/png,image/jpeg,image/webp'" :max-size-m-b="props.kind === 'music' ? 20 : props.kind === 'templates' ? 18 : 4" :label="props.kind === 'templates' ? 'Video mẫu' : props.kind === 'music' ? 'File nhạc' : 'Ảnh watermark'" @select-files="selectFile" @remove="removeFile" />
        </div>
      </div></main>
      <footer class="border-t border-[var(--mds-border-light)] bg-[var(--mds-bg)] py-2"><div class="mds-mobile-gutter-x mx-auto flex w-full max-w-[720px] justify-end"><MButton variant="primary" :loading="saving" @click="save">Lưu</MButton></div></footer>
    </template>
    <template v-else>
      <MMobileTopBar :title="meta.title" back-label="Quay lại" @back="emit('back')"><template #actions><MButton variant="icon" aria-label="Làm mới" @click="load"><template #icon><MIcon name="refresh" :size="20" /></template></MButton></template></MMobileTopBar>
      <main class="min-h-0 flex-1 overflow-y-auto"><div class="mx-auto w-full max-w-[840px]"><div v-if="loading" class="grid place-items-center py-16"><MSpinner :size="28" /></div><MEmptyState v-else-if="!rows.length" :title="meta.empty" description="Thêm dữ liệu để bắt đầu sử dụng tính năng này." /><article v-for="row in rows" v-else :key="String(row.id)" class="mds-mobile-gutter-x flex min-h-[68px] min-w-0 items-center gap-3 border-b border-[var(--mds-border-light)] py-3"><MIcon :name="meta.icon" :size="24" class="shrink-0 text-[var(--mds-icon-neutral)]" /><div class="min-w-0 flex-1"><h2 class="m-0 truncate text-[14px] font-semibold">{{ rowTitle(row) }}</h2><p class="m-0 mt-1 truncate text-[12px] text-[var(--mds-text-secondary)]">{{ rowMeta(row) }}</p></div><MTag v-if="rowTag(row)" :color="rowTag(row)?.color" size="sm">{{ rowTag(row)?.label }}</MTag></article></div></main>
      <footer class="border-t border-[var(--mds-border-light)] bg-[var(--mds-bg)] py-2"><div class="mds-mobile-gutter-x mx-auto flex w-full max-w-[840px] justify-end"><MButton variant="primary" @click="openCreate"><MIcon name="plus" :size="16" /> {{ meta.add }}</MButton></div></footer>
    </template>
  </div>
</template>
