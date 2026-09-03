<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import MButton from "../../components/mds/MButton.vue";
import MIcon from "../../components/mds/MIcon.vue";
import MMobileBottomNav from "../../components/mobile/MMobileBottomNav.vue";
import MMobileTopBar from "../../components/mobile/MMobileTopBar.vue";
import { requestHostBack } from "../../lib/mobile-surface";
import type { SessionUser } from "../../lib/api";
import MobileCreateView from "./MobileCreateView.vue";
import MobileProjectsView from "./MobileProjectsView.vue";
import MobileResourceView from "./MobileResourceView.vue";

type MobileRoute = "create" | "projects" | "series" | "templates" | "watermark" | "music" | "users" | "more";

const props = defineProps<{ user: SessionUser }>();
const route = ref<MobileRoute>("create");

const isAdmin = computed(() => props.user.role === "admin");
const availableRoutes = computed<MobileRoute[]>(() => [
  "create", "projects", "series", "templates", "watermark", "more",
  ...(isAdmin.value ? (["music", "users"] as MobileRoute[]) : []),
]);
const bottomItems = [
  { key: "create", label: "Tạo video", icon: "plus", kind: "fab" as const },
  { key: "projects", label: "Video", icon: "list" },
  { key: "series", label: "Serie", icon: "copy" },
  { key: "more", label: "Thêm", icon: "layout-grid" },
];
const bottomActive = computed(() => ["templates", "watermark", "music", "users"].includes(route.value) ? "more" : route.value);
const moreItems = computed(() => [
  { key: "templates" as const, label: "Video Template", description: "Quản lý video mẫu", icon: "layout-grid" },
  { key: "watermark" as const, label: "Watermark", description: "Ảnh và chữ nhận diện", icon: "photo" },
  ...(isAdmin.value ? [
    { key: "music" as const, label: "Nhạc nền", description: "Thư viện nhạc dùng chung", icon: "speakerphone" },
    { key: "users" as const, label: "Người dùng", description: "Tài khoản và quyền truy cập", icon: "users" },
  ] : []),
]);

function readHash(): void {
  const candidate = window.location.hash.replace(/^#m-/, "") as MobileRoute;
  route.value = availableRoutes.value.includes(candidate) ? candidate : "create";
}

function navigate(next: string): void {
  const candidate = next as MobileRoute;
  route.value = availableRoutes.value.includes(candidate) ? candidate : "create";
  const hash = `#m-${route.value}`;
  if (window.location.hash !== hash) window.history.replaceState(null, "", hash);
}

function goBack(): void {
  if (["templates", "watermark", "music", "users"].includes(route.value)) {
    navigate("more");
    return;
  }
  requestHostBack();
}

onMounted(() => {
  readHash();
  window.addEventListener("hashchange", readHash);
});
onBeforeUnmount(() => window.removeEventListener("hashchange", readHash));
</script>

<template>
  <div class="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[var(--mds-bg-page)]">
    <MobileCreateView v-if="route === 'create'" @created="navigate('projects')" @close="goBack" />
    <MobileProjectsView v-else-if="route === 'projects'" />
    <MobileResourceView v-else-if="route === 'series'" kind="series" :is-admin="isAdmin" @back="goBack" />
    <MobileResourceView v-else-if="route === 'templates'" kind="templates" :is-admin="isAdmin" @back="goBack" />
    <MobileResourceView v-else-if="route === 'watermark'" kind="watermark" :is-admin="isAdmin" @back="goBack" />
    <MobileResourceView v-else-if="route === 'music'" kind="music" :is-admin="isAdmin" @back="goBack" />
    <MobileResourceView v-else-if="route === 'users'" kind="users" :is-admin="isAdmin" @back="goBack" />
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
