<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { FEATURE_ROUTES } from "../router";
import { entityPath } from "../lib/slug";
import MHeaderBar from "../components/mds/MHeaderBar.vue";
import MSidebar from "../components/mds/MSidebar.vue";
import MButton from "../components/mds/MButton.vue";
import AccountDialogs from "../components/AccountDialogs.vue";
import misaLogo from "../assets/brand/misa-logo.png";
import ReconstructionView from "../reconstruction/ReconstructionView.vue";
import StudioView from "../studio/StudioView.vue";
import CreateStudio from "../studio/CreateStudio.vue";
import ProjectsView from "./ProjectsView.vue";
import WatermarkLibraryView from "./WatermarkLibraryView.vue";
import TemplatesView from "./TemplatesView.vue";
import SeriesView from "./SeriesView.vue";
import AdminMusicView from "./AdminMusicView.vue";
import AdminUsersView from "./AdminUsersView.vue";
import { api, type SessionUser } from "../lib/api";

const props = defineProps<{ user: SessionUser }>();
const emit = defineEmits<{ signedOut: [] }>();

const route = useRoute();
const router = useRouter();
const collapsed = ref(false);
const userMenuOpen = ref(false);
const accountDialogs = ref<InstanceType<typeof AccountDialogs> | null>(null);
/** project đang SỬA THIẾT LẬP & LÀM LẠI (mở từ nút trong "Video đã tạo") — null = tạo mới bình thường */
const editProjectId = ref<number | null>(null);

/** "active" tab của sidebar tính từ URL hiện tại (nguồn sự thật là route, không
 * phải ref riêng) — mọi route con của 1 tính năng (vd chi tiết video) vẫn sáng
 * đúng mục cha trên sidebar. */
const active = computed(() => {
  const p = route.path;
  if (p.startsWith("/tai-dung/")) return "reconstruction";
  if (p.startsWith(FEATURE_ROUTES.studio)) return "studio";
  if (p.startsWith(FEATURE_ROUTES.projects)) return "projects";
  if (p.startsWith(FEATURE_ROUTES.templates)) return "templates";
  if (p.startsWith(FEATURE_ROUTES.series)) return "series";
  if (p.startsWith(FEATURE_ROUTES.watermark)) return "watermark";
  if (p.startsWith(FEATURE_ROUTES.music)) return "music";
  if (p.startsWith(FEATURE_ROUTES.users)) return "users";
  return "create";
});

/** Bấm menu bên trái: tự tay chọn "Tạo video" luôn quay về form trống (không kẹt ở chế độ sửa cũ) */
function onSidebarNav(key: string): void {
  if (key === "create") editProjectId.value = null;
  const path =
    FEATURE_ROUTES[key as keyof typeof FEATURE_ROUTES] ?? FEATURE_ROUTES.create;
  router.push(path);
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
      { key: "users", label: "Người dùng", icon: "users" },
    );
  }
  return base;
});

/** Tạo/lưu xong: tra public_id + idea của project vừa tạo để nhảy thẳng vào
 * link đẹp /video-da-tao/:slug/:id (thay vì chỉ id số nội bộ). */
async function onProjectCreated(projectId: number): Promise<void> {
  editProjectId.value = null;
  try {
    const { project } = await api<{
      project: { public_id: string; idea: string };
    }>(`/v1/projects/${projectId}`);
    router.push(entityPath("video-da-tao", project.idea, project.public_id));
  } catch {
    router.push(FEATURE_ROUTES.projects);
  }
}

function onEditSetup(projectId: number): void {
  editProjectId.value = projectId;
  router.push(FEATURE_ROUTES.create);
}

function logout(): void {
  void accountDialogs.value?.logout();
}

function openPasswordDialog(): void {
  userMenuOpen.value = false;
  accountDialogs.value?.openPasswordDialog();
}

function openDriveDialog(): void {
  userMenuOpen.value = false;
  accountDialogs.value?.openDriveDialog();
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
          <img
            :src="misaLogo"
            alt="MISA - Tin cậy - Tiện ích - Tận tình"
            class="h-full w-auto object-contain"
          />
        </span>
      </template>
    </MHeaderBar>
    <div
      v-if="userMenuOpen"
      class="absolute right-4 top-[52px] z-50 w-56 rounded-lg bg-[var(--mds-bg)] p-3 shadow-[var(--mds-shadow-lg,0_8px_24px_rgba(0,0,0,0.16))]"
    >
      <p class="m-0 text-[13px] font-semibold">{{ user.displayName }}</p>
      <p class="m-0 mt-0.5 text-xs text-[var(--mds-text-secondary)]">
        {{ user.email }}
      </p>
      <MButton class="mt-3 [&]:w-full" @click="openDriveDialog"
        >Google Drive</MButton
      >
      <MButton class="mt-2 [&]:w-full" @click="openPasswordDialog"
        >Đổi mật khẩu</MButton
      >
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
        <ReconstructionView v-if="active === 'reconstruction'" :key="String(route.params.templateId)" :template-id="Number(route.params.templateId)" :user-id="user.id" />
        <StudioView
          v-else-if="active === 'studio'"
          :key="String(route.params.scriptId)"
          :script-id="Number(route.params.scriptId)"
          :user-id="user.id"
          @back="router.push(FEATURE_ROUTES.projects)"
          @setup="onEditSetup"
        />
        <!-- KeepAlive: giữ nội dung form Tạo video khi chuyển sang menu khác rồi
             quay lại (không mất dữ liệu đang nhập; form tự reset sau khi tạo xong) -->
        <KeepAlive>
          <CreateStudio
            v-if="active === 'create'"
            :edit-project-id="editProjectId"
            @created="onProjectCreated"
          />
        </KeepAlive>
        <ProjectsView v-if="active === 'projects'" @edit-setup="onEditSetup" />
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

    <AccountDialogs ref="accountDialogs" @signed-out="emit('signedOut')" />
  </div>
</template>
