<script setup lang="ts">
/**
 * 2 dialog "Đổi mật khẩu" + "Google Drive" dùng chung giữa Shell.vue (desktop)
 * và MobileShell.vue (mobile) — component này không tự vẽ nút bấm mở dialog,
 * cha gọi qua ref: accountDialogs.openPasswordDialog() / openDriveDialog() /
 * logout(). Trước đây logic này chỉ nằm trong Shell.vue nên bản mobile không
 * có đường vào đổi mật khẩu/Google Drive/đăng xuất.
 */
import MDialog from "./mds/MDialog.vue";
import MButton from "./mds/MButton.vue";
import MInput from "./mds/MInput.vue";
import { useAccountMenu } from "../composables/useAccountMenu";

const emit = defineEmits<{ signedOut: [] }>();

const {
  pwOpen, pwCurrent, pwNew, pwConfirm, pwError, pwSaving,
  openPasswordDialog, changePassword,
  driveOpen, driveStatus, driveBusy,
  openDriveDialog, connectDrive, disconnectDrive,
  logout,
} = useAccountMenu(() => emit("signedOut"));

defineExpose({ openPasswordDialog, openDriveDialog, logout });
</script>

<template>
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
</template>
