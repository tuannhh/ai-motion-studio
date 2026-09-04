/**
 * Tài khoản: đăng xuất, đổi mật khẩu, kết nối Google Drive — logic dùng chung
 * giữa Shell.vue (desktop) và MobileShell.vue (mobile). Trước đây logic này
 * chỉ nằm trong Shell.vue nên bản mobile không có đường vào các thao tác này.
 */
import { onMounted, ref } from "vue";
import { useToast } from "../components/mds/toast.js";
import { api, ApiError } from "../lib/api";
import type { GDriveStatus } from "../lib/types";

export function useAccountMenu(onSignedOut: () => void) {
  const toast = useToast();

  async function logout(): Promise<void> {
    try {
      await api("/v1/auth/logout", { method: "POST" });
    } finally {
      onSignedOut();
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
    pwCurrent.value = "";
    pwNew.value = "";
    pwConfirm.value = "";
    pwError.value = "";
    pwOpen.value = true;
  }

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

  return {
    logout,
    pwOpen, pwCurrent, pwNew, pwConfirm, pwError, pwSaving,
    openPasswordDialog, changePassword,
    driveOpen, driveStatus, driveBusy,
    openDriveDialog, connectDrive, disconnectDrive,
  };
}
