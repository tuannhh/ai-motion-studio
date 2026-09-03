<script setup lang="ts">
import MIcon from "../mds/MIcon.vue";

defineProps<{ items: Array<{ key: string; label: string; icon: string; kind?: "fab" }>; active: string }>();
const emit = defineEmits<{ select: [key: string] }>();
</script>

<template>
  <nav
    aria-label="Điều hướng AI Motion Studio"
    class="grid shrink-0 border-t border-[var(--mds-border-light)] bg-[var(--mds-bg)]"
    :style="{
      gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
      minHeight: 'calc(var(--mds-mobile-bottom-nav-height) + var(--mds-mobile-safe-bottom))',
      paddingBottom: 'var(--mds-mobile-safe-bottom)',
    }"
  >
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      class="mds-mobile-nav-item mds-mobile-column-gap-1 flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-1 text-center active:bg-[var(--mds-bg-hover-soft)]"
      :class="active === item.key ? 'font-medium text-[var(--mds-brand-600)]' : 'text-[var(--mds-text-secondary)]'"
      :aria-current="active === item.key ? 'page' : undefined"
      :aria-label="item.label"
      :title="item.label"
      @click="emit('select', item.key)"
    >
      <span v-if="item.kind === 'fab'" class="-mt-5 grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--mds-brand-600)] text-white shadow-[var(--mds-shadow-md)]">
        <MIcon :name="item.icon" :size="24" />
      </span>
      <MIcon v-else :name="item.icon" :size="24" />
      <span class="block w-full truncate whitespace-nowrap text-[11px] leading-[14px]">{{ item.label }}</span>
    </button>
  </nav>
</template>
