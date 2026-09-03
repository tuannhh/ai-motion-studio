import { computed, onBeforeUnmount, onMounted, ref } from "vue";

type MisaSurface = "desktop" | "native";

function readSurface(): MisaSurface {
  if (typeof window === "undefined") return "desktop";
  const requested = new URLSearchParams(window.location.search).get("surface");
  const hostSurface = document.documentElement.dataset.misaSurface;
  if (requested === "native" || hostSurface === "native") return "native";
  // iPad ở ngang có thể vượt breakpoint desktop; thiết bị cảm ứng không hover
  // vẫn dùng shell native. Host MISA AMIS luôn có thể ép bằng data-misa-surface.
  return window.matchMedia("(max-width: 1279px), (pointer: coarse) and (hover: none)").matches
    ? "native"
    : "desktop";
}

/**
 * Chọn cây trình bày theo surface/container. Native host có thể đặt
 * data-misa-surface="native"; browser test dùng cùng cây qua width container.
 * Không dùng user-agent hay role để chọn shell.
 */
export function useMisaSurface() {
  const surface = ref<MisaSurface>(readSurface());
  const refresh = () => {
    surface.value = readSurface();
  };

  onMounted(() => {
    window.addEventListener("resize", refresh);
    window.addEventListener("misa-amis:surface-change", refresh);
  });
  onBeforeUnmount(() => {
    window.removeEventListener("resize", refresh);
    window.removeEventListener("misa-amis:surface-change", refresh);
  });

  return { surface, isNative: computed(() => surface.value === "native") };
}

/**
 * Điểm tích hợp duy nhất với MISA AMIS native host. DevOps/native bridge lắng
 * nghe event này để đóng mini-app; browser test có fallback history an toàn.
 */
export function requestHostBack(): void {
  window.dispatchEvent(new CustomEvent("misa-amis:back-request"));
  if (window.history.length > 1) window.history.back();
}
