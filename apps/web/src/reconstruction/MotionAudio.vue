<script setup lang="ts">
import type { MotionDocument } from "@ams/motion-engine/src/motion/schema";
import MInput from "../components/mds/MInput.vue";
import MSelect from "../components/mds/MSelect.vue";
import MButton from "../components/mds/MButton.vue";
const props = defineProps<{ document: MotionDocument; disabled?: boolean }>();
const options = ["whoosh", "ding", "pop", "impact", "paper"].map((value) => ({
  value,
  label: value,
}));
</script>
<template>
  <div class="motion-fields">
    <label
      >Màu nền<MInput
        v-model="document.background"
        :disabled="disabled" /></label
    ><b>Hiệu ứng âm thanh · {{ document.cues.length }} cue</b>
    <div v-for="(cue, i) in document.cues" :key="i" class="keyframe">
      <div class="motion-grid">
        <label
          >Thời điểm (giây)<MInput
            v-model="cue.at"
            type="number"
            :disabled="disabled" /></label
        ><label
          >Âm thanh<MSelect
            v-model="cue.kind"
            :options="options"
            :disabled="disabled" /></label
        ><label
          >Âm lượng (0–1)<MInput
            v-model="cue.volume"
            type="number"
            :disabled="disabled"
        /></label>
      </div>
      <MButton :disabled="disabled" @click="document.cues.splice(i, 1)"
        >Xoá cue</MButton
      >
    </div>
    <MButton
      :disabled="disabled || document.cues.length >= 40"
      @click="
        document.cues.push({
          at: 0,
          kind: 'ding',
          volume: 0.5,
          reason: 'Người dùng thêm',
        })
      "
      >Thêm hiệu ứng âm thanh</MButton
    >
  </div>
</template>
