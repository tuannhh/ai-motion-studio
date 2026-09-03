<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import MHeaderBar from "../components/mds/MHeaderBar.vue";
import MSidebar from "../components/mds/MSidebar.vue";
import MButton from "../components/mds/MButton.vue";
import MDialog from "../components/mds/MDialog.vue";
import MInput from "../components/mds/MInput.vue";
import misaLogo from "../assets/brand/misa-logo.png";
import CreateView from "./CreateView.vue";
import ProjectsView from "./ProjectsView.vue";
import WatermarkLibraryView from "./WatermarkLibraryView.vue";
import TemplatesView from "./TemplatesView.vue";
import SeriesView from "./SeriesView.vue";
import AdminMusicView from "./AdminMusicView.vue";
import AdminUsersView from "./AdminUsersView.vue";
import { useToast } from "../components/mds/toast.js";
import { api, ApiError, type SessionUser } from "../lib/api";
import type { GDriveStatus } from "../lib/types";

const props = defineProps<{ user: SessionUser }>();
const emit = defineEmits<{ signedOut: [] }>();
const toast = useToast();

const active = ref("create");
const collapsed = ref(false);
const userMenuOpen = ref(false);
/** project đang mở chi tiết (ProjectsView quản lý) — set khi tạo xong để nhảy thẳng vào */
const focusProjectId = ref<number | null>(null);
/** project đang SỬA THIẾT LẬP & LÀM LẠI (mở từ nút trong "Video đã tạo") — null = tạo mới bình thường */
const editProjectId = ref<number | null>(null);

/** Bấm menu bên trái: tự tay chọn "Tạo video" luôn quay về form trống (không kẹt ở chế độ sửa cũ) */
function onSidebarNav(key: string): void {
  active.value = key;
  if (key === "create") editProjectId.value = null;
}

const items = computed(() => {
  const base = [
    { key: "create", label: "Tạo video", icon: "plus" },
    { key: "projects", label: "Video đã tạo", icon: "list" },
    { key: "series", label: "Serie", icon: "copy" },
    { key: "templates", label: "Video Template", icon: "layout-grid" },
    { key: "watermark", label: "Watermark", icon: "photo" },
  ];
  if (props.user.role === "admin") {
    base.push(
      { key: "music", label: "Nhạc nền", icon: "speakerphone" },
      { key: "users", label: "Người dùng", icon: "users" }
    );
  }
  return base;
});

function onProjectCreated(projectId: number): void {
  focusProjectId.value = projectId;
  editProjectId.value = null;
  active.value = "projects";
}

function onEditSetup(projectId: number): void {
  editProjectId.value = projectId;
  active.value = "create";
}

async function logout(): Promise<void> {
  try {
    await api("/v1/auth/logout", { method: "POST" });
  } finally {
    emit("signedOut");
  }
}

// ---- Đổi mật khẩu ----
const pwOpen = ref(false);
const pwCurrent = ref("");
const pwNew = ref("");
const pwConfirm = ref("");
const pwError = ref("");
const pwSaving = ref(false);

function openPasswordDialog(): void {
  userMenuOpen.value = false;
  pwCurrent.value = "";
  pwNew.value = "";
  pwConfirm.value = "";
  pwError.value = "";
  pwOpen.value = true;
}

// ---- Google Drive ----
const driveOpen = ref(false);
const driveStatus = ref<GDriveStatus>({ connected: false });
const driveBusy = ref(false);

async function loadDriveStatus(): Promise<void> {
  try {
    driveStatus.value = await api<GDriveStatus>("/v1/integrations/gdrive/status");
  } catch {
    /* im lặng — Drive là tính năng phụ */
  }
}

function openDriveDialog(): void {
  userMenuOpen.value = false;
  driveOpen.value = true;
  void loadDriveStatus();
}

async function connectDrive(): Promise<void> {
  driveBusy.value = true;
  try {
    const { authUrl } = await api<{ authUrl: string }>(
      "/v1/integrations/gdrive/connect",
      { method: "POST" }
    );
    window.location.href = authUrl; // sang trang đồng ý của Google
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không mở được kết nối Drive.");
    driveBusy.value = false;
  }
}

async function disconnectDrive(): Promise<void> {
  driveBusy.value = true;
  try {
    await api("/v1/integrations/gdrive", { method: "DELETE" });
    driveStatus.value = { connected: false };
    toast.success("Đã ngắt kết nối Google Drive.");
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không ngắt được kết nối.");
  } finally {
    driveBusy.value = false;
  }
}

// Xử lý redirect trở về sau OAuth (?drive=connected|error&reason=...)
onMounted(() => {
  const params = new URLSearchParams(window.location.search);
  const drive = params.get("drive");
  if (drive === "connected") {
    toast.success("Đã kết nối Google Drive.");
    void loadDriveStatus();
  } else if (drive === "error") {
    toast.error(`Kết nối Drive thất bại: ${params.get("reason") || "không rõ"}`);
  }
  if (drive) {
    params.delete("drive");
    params.delete("reason");
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }
  void loadDriveStatus();
});

async function changePassword(): Promise<void> {
  pwError.value = "";
  if (pwNew.value.length < 8) {
    pwError.value = "Mật khẩu mới tối thiểu 8 ký tự, gồm chữ và số.";
    return;
  }
  if (pwNew.value !== pwConfirm.value) {
    pwError.value = "Xác nhận mật khẩu không khớp.";
    return;
  }
  pwSaving.value = true;
  try {
    await api("/v1/auth/password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: pwCurrent.value,
        newPassword: pwNew.value,
      }),
    });
    toast.success("Đã đổi mật khẩu. Các thiết bị khác đã bị đăng xuất.");
    pwOpen.value = false;
  } catch (cause) {
    pwError.value = cause instanceof ApiError ? cause.message : "Không đổi được mật khẩu.";
  } finally {
    pwSaving.value = false;
  }
}
</script>

<template>
  <div class="flex h-[100dvh] min-h-0 flex-col bg-[var(--mds-bg-page)]">
    <MHeaderBar
      app-name="AI Motion Studio"
      :user="{ name: user.displayName }"
      @user-click="userMenuOpen = !userMenuOpen"
    >
      <template #logo>
        <span class="flex h-9 items-center rounded bg-white px-1.5">
          <img :src="misaLogo" alt="MISA - Tin cậy - Tiện ích - Tận tình" class="h-full w-auto object-contain" />
        </span>
      </template>
    </MHeaderBar>
    <div
      v-if="userMenuOpen"
      class="absolute right-4 top-[52px] z-50 w-56 rounded-lg bg-[var(--mds-bg)] p-3 shadow-[var(--mds-shadow-lg,0_8px_24px_rgba(0,0,0,0.16))]"
    >
      <p class="m-0 text-[13px] font-semibold">{{ user.displayName }}</p>
      <p class="m-0 mt-0.5 text-xs text-[var(--mds-text-secondary)]">{{ user.email }}</p>
      <MButton class="mt-3 [&]:w-full" @click="openDriveDialog">Google Drive</MButton>
      <MButton class="mt-2 [&]:w-full" @click="openPasswordDialog">Đổi mật khẩu</MButton>
      <MButton class="mt-2 [&]:w-full" @click="logout">Đăng xuất</MButton>
    </div>
    <div class="flex min-h-0 flex-1" @click="userMenuOpen = false">
      <MSidebar
        :model-value="active"
        @update:model-value="onSidebarNav"
        v-model:collapsed="collapsed"
        :items="items"
      />
      <main class="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
        <!-- KeepAlive: giữ nội dung form Tạo video khi chuyển sang menu khác rồi
             quay lại (không mất dữ liệu đang nhập; form tự reset sau khi tạo xong) -->
        <KeepAlive>
          <CreateView
            v-if="active === 'create'"
            :edit-project-id="editProjectId"
            @created="onProjectCreated"
          />
        </KeepAlive>
        <ProjectsView
          v-if="active === 'projects'"
          :focus-project-id="focusProjectId"
          @focused="focusProjectId = null"
          @edit-setup="onEditSetup"
        />
        <SeriesView v-else-if="active === 'series'" />
        <TemplatesView v-else-if="active === 'templates'" />
        <WatermarkLibraryView
          v-else-if="active === 'watermark'"
          :is-admin="user.role === 'admin'"
        />
        <AdminMusicView v-else-if="active === 'music'" />
        <AdminUsersView v-else-if="active === 'users'" />
      </main>
    </div>

    <!-- Đổi mật khẩu tự phục vụ -->
    <MDialog
      :model-value="pwOpen"
      title="Đổi mật khẩu"
      @update:model-value="pwOpen = $event"
    >
      <div class="space-y-3">
        <label class="block text-[13px] font-medium">
          Mật khẩu hiện tại
          <MInput v-model="pwCurrent" class="mt-1" type="password" placeholder="Nhập mật khẩu đang dùng" />
        </label>
        <label class="block text-[13px] font-medium">
          Mật khẩu mới
          <MInput v-model="pwNew" class="mt-1" type="password" placeholder="Tối thiểu 8 ký tự, có chữ và số" />
        </label>
        <label class="block text-[13px] font-medium">
          Xác nhận mật khẩu mới
          <MInput v-model="pwConfirm" class="mt-1" type="password" placeholder="Nhập lại mật khẩu mới" />
        </label>
        <p v-if="pwError" class="m-0 text-[13px] text-[var(--mds-danger)]">{{ pwError }}</p>
        <p class="m-0 rounded-md bg-[var(--mds-bg-page)] p-3 text-xs text-[var(--mds-text-secondary)]">
          Sau khi đổi, mọi thiết bị khác đang đăng nhập sẽ bị đăng xuất.
        </p>
      </div>
      <template #footer>
        <MButton @click="pwOpen = false">Hủy</MButton>
        <MButton variant="primary" :loading="pwSaving" @click="changePassword">Đổi mật khẩu</MButton>
      </template>
    </MDialog>

    <!-- Kết nối Google Drive -->
    <MDialog
      :model-value="driveOpen"
      title="Google Drive"
      @update:model-value="driveOpen = $event"
    >
      <div class="space-y-3">
        <template v-if="driveStatus.connected">
          <p class="m-0 text-[13px]">
            Đã kết nối:
            <span class="font-semibold">{{ driveStatus.email || "tài khoản Google" }}</span>
          </p>
          <p class="m-0 text-xs text-[var(--mds-text-secondary)]">
            Bạn có thể xuất video đã render lên Drive từ nút “Xuất lên Drive” ở mỗi video.
          </p>
        </template>
        <template v-else>
          <p class="m-0 text-[13px]">
            Kết nối tài khoản Google để lưu video render thẳng lên Google Drive của bạn.
          </p>
          <p class="m-0 rounded-md bg-[var(--mds-bg-page)] p-3 text-xs text-[var(--mds-text-secondary)]">
            App chỉ được quyền tạo/ghi file do chính nó tải lên (scope <code>drive.file</code>) —
            không đọc được các file khác trong Drive của bạn.
          </p>
        </template>
      </div>
      <template #footer>
        <MButton @click="driveOpen = false">Đóng</MButton>
        <MButton
          v-if="driveStatus.connected"
          variant="danger"
          :loading="driveBusy"
          @click="disconnectDrive"
        >
          Ngắt kết nối
        </MButton>
        <MButton v-else variant="primary" :loading="driveBusy" @click="connectDrive">
          Kết nối Google Drive
        </MButton>
      </template>
    </MDialog>
  </div>
</template>
