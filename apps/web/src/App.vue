<script setup lang="ts">
import { onMounted, ref } from "vue";
import MToast from "./components/mds/MToast.vue";
import LoginView from "./views/LoginView.vue";
import Shell from "./views/Shell.vue";
import MobileShell from "./views/mobile/MobileShell.vue";
import { api, setCsrfToken, type SessionUser } from "./lib/api";
import { useMisaSurface } from "./lib/mobile-surface";

const user = ref<SessionUser | null>(null);
const isLoading = ref(true);
const { isNative } = useMisaSurface();

onMounted(async () => {
  try {
    const data = await api<{ user: SessionUser; csrfToken: string }>("/v1/auth/me");
    user.value = data.user;
    setCsrfToken(data.csrfToken);
  } catch {
    user.value = null;
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <main
    v-if="isLoading"
    class="grid min-h-screen place-items-center bg-[var(--mds-bg-page)] text-[var(--mds-text-secondary)]"
  >
    Đang khởi động AI Motion Studio…
  </main>
  <LoginView v-else-if="!user" @signed-in="user = $event" />
  <MobileShell v-else-if="isNative" :user="user" />
  <Shell v-else :user="user" @signed-out="user = null" />
  <MToast />
</template>
