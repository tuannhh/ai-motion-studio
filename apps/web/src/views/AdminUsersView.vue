<script setup lang="ts">
import { onMounted, ref } from "vue";
import MButton from "../components/mds/MButton.vue";
import MDataTable from "../components/mds/MDataTable.vue";
import MDrawer from "../components/mds/MDrawer.vue";
import MInput from "../components/mds/MInput.vue";
import MRadioGroup from "../components/mds/MRadioGroup.vue";
import MSwitch from "../components/mds/MSwitch.vue";
import MTag from "../components/mds/MTag.vue";
import { useToast } from "../components/mds/toast.js";
import { api, ApiError } from "../lib/api";
import type { UserRow } from "../lib/types";

const toast = useToast();
const users = ref<UserRow[]>([]);
const loading = ref(false);
const drawerOpen = ref(false);
const saving = ref(false);

const email = ref("");
const displayName = ref("");
const password = ref("");
const role = ref<"creator" | "admin">("creator");
const formError = ref("");

const columns = [
  { key: "display_name", label: "Tên hiển thị" },
  { key: "email", label: "Email" },
  { key: "role", label: "Vai trò", width: 110 },
  { key: "project_count", label: "Số video", width: 90, align: "right" },
  { key: "is_active", label: "Hoạt động", width: 110 },
];

async function load(): Promise<void> {
  loading.value = true;
  try {
    users.value = await api<UserRow[]>("/v1/admin/users");
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không tải được người dùng.");
  } finally {
    loading.value = false;
  }
}
onMounted(load);

function openCreate(): void {
  email.value = "";
  displayName.value = "";
  password.value = "";
  role.value = "creator";
  formError.value = "";
  drawerOpen.value = true;
}

async function create(): Promise<void> {
  formError.value = "";
  if (!email.value.trim() || !displayName.value.trim() || password.value.length < 8) {
    formError.value = "Điền đủ email, tên hiển thị và mật khẩu tối thiểu 8 ký tự.";
    return;
  }
  saving.value = true;
  try {
    await api("/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: email.value.trim(),
        displayName: displayName.value.trim(),
        password: password.value,
        role: role.value,
      }),
    });
    toast.success("Đã tạo tài khoản.");
    drawerOpen.value = false;
    await load();
  } catch (cause) {
    formError.value = cause instanceof ApiError ? cause.message : "Không tạo được tài khoản.";
  } finally {
    saving.value = false;
  }
}

async function toggleActive(row: UserRow, value: boolean): Promise<void> {
  try {
    await api(`/v1/admin/users/${row.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: value }),
    });
    row.is_active = value ? 1 : 0;
    toast.success(value ? "Đã mở khoá tài khoản." : "Đã khoá tài khoản.");
  } catch (cause) {
    toast.error(cause instanceof ApiError ? cause.message : "Không cập nhật được.");
  }
}
</script>

<template>
  <div class="p-6">
    <div class="mb-4 flex items-center justify-between">
      <h1 class="m-0 text-xl font-semibold">Người dùng</h1>
      <MButton variant="primary" @click="openCreate">Thêm người dùng</MButton>
    </div>

    <div class="rounded-lg bg-[var(--mds-bg)] shadow-[var(--mds-shadow-card)]">
      <MDataTable :columns="columns" :rows="users" :loading="loading">
        <template #cell-role="{ value }">
          <MTag :color="value === 'admin' ? 'brand' : 'neutral'" size="sm">
            {{ value === "admin" ? "Quản trị" : "Creator" }}
          </MTag>
        </template>
        <template #cell-is_active="{ row }">
          <MSwitch
            :model-value="Boolean((row as UserRow).is_active)"
            @update:model-value="(v: boolean) => toggleActive(row as UserRow, v)"
          />
        </template>
      </MDataTable>
    </div>

    <MDrawer v-model="drawerOpen" title="Thêm người dùng">
      <div class="space-y-4">
        <label class="block text-[13px] font-medium">
          Email <span class="text-[var(--mds-danger)]">*</span>
          <MInput v-model="email" type="email" class="mt-1" placeholder="creator@misa.com.vn" />
        </label>
        <label class="block text-[13px] font-medium">
          Tên hiển thị <span class="text-[var(--mds-danger)]">*</span>
          <MInput v-model="displayName" class="mt-1" placeholder="Nguyễn Văn A" />
        </label>
        <label class="block text-[13px] font-medium">
          Mật khẩu (≥8 ký tự) <span class="text-[var(--mds-danger)]">*</span>
          <MInput v-model="password" type="password" class="mt-1" :error="formError" />
        </label>
        <label class="block text-[13px] font-medium">
          Vai trò
          <MRadioGroup
            v-model="role"
            class="mt-1"
            :options="[
              { label: 'Creator', value: 'creator' },
              { label: 'Quản trị', value: 'admin' },
            ]"
            direction="horizontal"
          />
        </label>
      </div>
      <template #footer>
        <MButton @click="drawerOpen = false">Hủy</MButton>
        <MButton variant="primary" :loading="saving" @click="create">Tạo tài khoản</MButton>
      </template>
    </MDrawer>
  </div>
</template>
