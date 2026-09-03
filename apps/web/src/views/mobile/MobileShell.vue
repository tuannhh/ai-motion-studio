<script setup lang="ts">
import { computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import MButton from "../../components/mds/MButton.vue";
import MIcon from "../../components/mds/MIcon.vue";
import MMobileBottomNav from "../../components/mobile/MMobileBottomNav.vue";
import MMobileTopBar from "../../components/mobile/MMobileTopBar.vue";
import { requestHostBack } from "../../lib/mobile-surface";
import { api, type SessionUser } from "../../lib/api";
import { FEATURE_ROUTES, MOBILE_MORE_ROUTE } from "../../router";
import { entityPath } from "../../lib/slug";
import MobileCreateView from "./MobileCreateView.vue";
import MobileProjectsView from "./MobileProjectsView.vue";
import MobileResourceView from "./MobileResourceView.vue";

type MobileRoute = "create" | "projects" | "series" | "templates" | "watermark" | "music" | "users" | "more";

const props = defineProps<{ user: SessionUser }>();
const route = useRoute();
const router = useRouter();
const isAdmin = computed(() => props.user.role === "admin");

const ROUTE_PATHS: Record<MobileRoute, string> = {
  create: FEATURE_ROUTES.create,
  projects: FEATURE_ROUTES.projects,
  series: FEATURE_ROUTES.series,
  templates: FEATURE_ROUTES.templates,
  watermark: FEATURE_ROUTES.watermark,
  music: FEATURE_ROUTES.music,
  users: FEATURE_ROUTES.users,
  more: MOBILE_MORE_ROUTE,
};

/** URL hiện tại → tab/menu đang mở. Mọi route con của 1 tính năng (vd chi tiết
 * video) vẫn khớp đúng tab cha nhờ startsWith. */
function keyForPath(path: string): MobileRoute {
  if (path.startsWith(FEATURE_ROUTES.projects)) return "projects";
  if (path.startsWith(FEATURE_ROUTES.series)) return "series";
  if (path.startsWith(FEATURE_ROUTES.templates)) return "templates";
  if (path.startsWith(FEATURE_ROUTES.watermark)) return "watermark";
  if (path.startsWith(FEATURE_ROUTES.music)) return "music";
  if (path.startsWith(FEATURE_ROUTES.users)) return "users";
  if (path === MOBILE_MORE_ROUTE) return "more";
  return "create";
}

const activeKey = computed<MobileRoute>(() => {
  const key = keyForPath(route.path);
  return (key === "music" || key === "users") && !isAdmin.value ? "create" : key;
});

/** Creator (không phải admin) gõ thẳng /nhac-nen hay /nguoi-dung → đưa về Tạo
 * video thay vì âm thầm hiện "create" trong khi URL vẫn trỏ trang admin. */
watch(
  () => route.path,
  (path) => {
    const key = keyForPath(path);
    if ((key === "music" || key === "users") && !isAdmin.value) router.replace(FEATURE_ROUTES.create);
  },
  { immediate: true }
);

const bottomItems = [
  { key: "create", label: "Tạo video", icon: "plus", kind: "fab" as const },
  { key: "projects", label: "Video", icon: "list" },
  { key: "series", label: "Serie", icon: "copy" },
  { key: "more", label: "Thêm", icon: "layout-grid" },
];
const bottomActive = computed(() => ["templates", "watermark", "music", "users"].includes(activeKey.value) ? "more" : activeKey.value);
const moreItems = computed(() => [
  { key: "templates" as const, label: "Video Template", description: "Quản lý video mẫu", icon: "layout-grid" },
  { key: "watermark" as const, label: "Watermark", description: "Ảnh và chữ nhận diện", icon: "photo" },
  ...(isAdmin.value ? [
    { key: "music" as const, label: "Nhạc nền", description: "Thư viện nhạc dùng chung", icon: "speakerphone" },
    { key: "users" as const, label: "Người dùng", description: "Tài khoản và quyền truy cập", icon: "users" },
  ] : []),
]);

function navigate(next: string): void {
  router.push(ROUTE_PATHS[next as MobileRoute] ?? FEATURE_ROUTES.create);
}

function goBack(): void {
  if (["templates", "watermark", "music", "users"].includes(activeKey.value)) {
    navigate("more");
    return;
  }
  requestHostBack();
}

/** Tạo video xong: tra public_id + idea để nhảy thẳng vào link đẹp của video
 * vừa tạo (khớp hành vi Shell.vue desktop). */
async function onProjectCreated(projectId: number): Promise<void> {
  try {
    const { project } = await api<{ project: { public_id: string; idea: string } }>(
      `/v1/projects/${projectId}`
    );
    router.push(entityPath("video-da-tao", project.idea, project.public_id));
  } catch {
    router.push(FEATURE_ROUTES.projects);
  }
}
</script>

<template>
  <div class="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[var(--mds-bg-page)]">
    <MobileCreateView v-if="activeKey === 'create'" @created="onProjectCreated" @close="goBack" />
    <MobileProjectsView v-else-if="activeKey === 'projects'" />
    <MobileResourceView v-else-if="activeKey === 'series'" kind="series" :is-admin="isAdmin" @back="goBack" />
    <MobileResourceView v-else-if="activeKey === 'templates'" kind="templates" :is-admin="isAdmin" @back="goBack" />
    <MobileResourceView v-else-if="activeKey === 'watermark'" kind="watermark" :is-admin="isAdmin" @back="goBack" />
    <MobileResourceView v-else-if="activeKey === 'music'" kind="music" :is-admin="isAdmin" @back="goBack" />
    <MobileResourceView v-else-if="activeKey === 'users'" kind="users" :is-admin="isAdmin" @back="goBack" />
    <section v-else class="mds-mobile-app flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--mds-bg)] text-[var(--mds-text)]">
      <MMobileTopBar title="Thêm" :show-back="false" />
      <main class="min-h-0 flex-1 overflow-y-auto">
        <div class="mx-auto w-full max-w-[720px] divide-y divide-[var(--mds-border-light)]">
          <button
            v-for="item in moreItems"
            :key="item.key"
            type="button"
            class="mds-mobile-gutter-x flex min-h-[72px] w-full items-center gap-3 bg-[var(--mds-bg)] py-3 text-left active:bg-[var(--mds-bg-hover-soft)]"
            @click="navigate(item.key)"
          >
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--mds-brand-50)] text-[var(--mds-brand-600)]"><MIcon :name="item.icon" :size="22" /></span>
            <span class="min-w-0 flex-1"><span class="block truncate text-[14px] font-semibold">{{ item.label }}</span><span class="mt-1 block truncate text-[12px] text-[var(--mds-text-secondary)]">{{ item.description }}</span></span>
            <MIcon name="chevron-right" :size="20" class="shrink-0 text-[var(--mds-icon-neutral)]" />
          </button>
        </div>
        <div class="mds-mobile-gutter-x mx-auto w-full max-w-[720px] pt-6">
          <MButton variant="ghost" class="[&]:w-full" @click="goBack"><template #icon><MIcon name="arrow-left" :size="18" /></template>Quay lại MISA AMIS</MButton>
        </div>
      </main>
    </section>

    <MMobileBottomNav :items="bottomItems" :active="bottomActive" @select="navigate" />
  </div>
</template>
