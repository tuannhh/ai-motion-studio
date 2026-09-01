<script setup lang="ts">
// TODO(MDS): bộ ui/components chưa có control Slider — dựng inline theo token
// MDS (track neutral-300, fill/thumb brand-600). Đề xuất bổ sung MSlider vào bộ chung.
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: number;
    min: number;
    max: number;
    step?: number;
    /** hàm format giá trị hiển thị bên phải */
    format?: (v: number) => string;
    disabled?: boolean;
  }>(),
  { step: 1, format: (v: number) => String(v), disabled: false }
);
const emit = defineEmits<{ "update:modelValue": [value: number] }>();

const percent = computed(
  () => ((props.modelValue - props.min) / (props.max - props.min)) * 100
);

function onInput(e: Event): void {
  emit("update:modelValue", Number((e.target as HTMLInputElement).value));
}
</script>

<template>
  <div class="flex items-center gap-3">
    <input
      class="ams-range flex-1"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      :disabled="disabled"
      :style="{ '--fill': percent + '%' }"
      @input="onInput"
    />
    <span class="w-14 shrink-0 text-right text-[13px] font-semibold tabular-nums">
      {{ format(modelValue) }}
    </span>
  </div>
</template>

<style scoped>
.ams-range {
  appearance: none;
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(
    to right,
    var(--mds-brand-600) var(--fill),
    var(--mds-neutral-300, #e9eaeb) var(--fill)
  );
  outline: none;
}
.ams-range::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--mds-bg, #fff);
  border: 2px solid var(--mds-brand-600);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
  cursor: pointer;
}
.ams-range:disabled { opacity: 0.5; }
.ams-range:focus-visible::-webkit-slider-thumb {
  box-shadow: 0 0 0 3px var(--mds-brand-100, #dbe7ff);
}
</style>
