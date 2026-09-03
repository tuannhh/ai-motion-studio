<script setup lang="ts">
import MButton from "../mds/MButton.vue";
import MIcon from "../mds/MIcon.vue";

defineProps({
  title: { type: String, required: true },
  showBack: { type: Boolean, default: true },
  showMore: { type: Boolean, default: false },
  backLabel: { type: String, default: "Quay lại MISA AMIS" },
});

const emit = defineEmits<{ back: []; more: [] }>();
</script>

<template>
  <header
    class="shrink-0 border-b border-[var(--mds-border-light)] bg-[var(--mds-bg)]"
    :style="{ paddingTop: 'var(--mds-mobile-safe-top)' }"
  >
    <div class="mds-mobile-row-gap-1 flex h-[var(--mds-mobile-topbar-height)] min-w-0 items-center gap-1 px-2">
      <MButton
        v-if="showBack"
        variant="icon"
        class="[&]:rounded-full"
        :aria-label="backLabel"
        @click="emit('back')"
      >
        <template #icon><MIcon name="arrow-left" :size="24" /></template>
      </MButton>
      <slot name="leading" />
      <h1 class="min-w-0 flex-1 truncate px-1 text-[20px] font-semibold leading-7 text-[var(--mds-text)]">
        {{ title }}
      </h1>
      <div v-if="$slots.actions" class="mds-mobile-row-gap-1 flex shrink-0 items-center gap-1">
        <slot name="actions" />
      </div>
      <MButton v-if="showMore" variant="icon" class="[&]:rounded-full" aria-label="Thêm thao tác" @click="emit('more')">
        <template #icon><MIcon name="dots" :size="24" /></template>
      </MButton>
    </div>
  </header>
</template>
