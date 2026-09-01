<script setup lang="ts">
import { ref } from "vue";
import MButton from "../components/mds/MButton.vue";
import MIcon from "../components/mds/MIcon.vue";
import MInput from "../components/mds/MInput.vue";
import { api, ApiError, setCsrfToken, type SessionUser } from "../lib/api";

const emit = defineEmits<{ signedIn: [user: SessionUser] }>();
const email = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);

async function submit(): Promise<void> {
  error.value = "";
  loading.value = true;
  try {
    const result = await api<{ user: SessionUser; csrfToken: string }>("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: email.value, password: password.value }),
    });
    setCsrfToken(result.csrfToken);
    emit("signedIn", result.user);
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : "Không thể đăng nhập.";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="grid min-h-screen place-items-center bg-[var(--mds-bg-page)] p-4">
    <section class="w-full max-w-[420px] rounded-lg bg-[var(--mds-bg)] p-6 shadow-[var(--mds-shadow-card)]">
      <div class="mb-6 flex items-center gap-3">
        <div class="grid h-10 w-10 place-items-center rounded-lg bg-[var(--mds-bg-brand-brand-light)] text-[var(--mds-brand-600)]">
          <MIcon name="camera" :size="24" />
        </div>
        <div>
          <h1 class="m-0 text-xl font-semibold leading-7">AI Motion Studio</h1>
          <p class="m-0 mt-1 text-[13px] text-[var(--mds-text-secondary)]">
            Đăng nhập để tạo video motion-graphics bằng AI.
          </p>
        </div>
      </div>
      <form class="space-y-4" @submit.prevent="submit">
        <label class="block text-[13px] font-medium">
          Email <span class="text-[var(--mds-danger)]">*</span>
          <MInput v-model="email" type="email" placeholder="email@misa.com.vn" class="mt-1" />
        </label>
        <label class="block text-[13px] font-medium">
          Mật khẩu <span class="text-[var(--mds-danger)]">*</span>
          <MInput v-model="password" type="password" placeholder="Nhập mật khẩu" class="mt-1" :error="error" />
        </label>
        <MButton variant="primary" :loading="loading" class="[&]:w-full" @click="submit">
          Đăng nhập
        </MButton>
      </form>
    </section>
  </main>
</template>
