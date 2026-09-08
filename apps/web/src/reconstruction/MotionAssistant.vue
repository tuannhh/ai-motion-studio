<script setup lang="ts">
import { reactive } from "vue";
import type { ReconstructionState } from "./useReconstruction";
import MTextarea from "../components/mds/MTextarea.vue";
import MButton from "../components/mds/MButton.vue";
const props = defineProps<{ state: ReconstructionState }>();
const s = reactive(props.state);
</script>
<template>
  <div v-if="s.document" class="motion-fields motion-history">
    <label
      >Nhờ AI chỉnh chuyển động<MTextarea
        v-model="s.aiInstruction"
        :disabled="s.active"
        placeholder="Cho chấm cam chạy chậm hơn 0,5 giây, giữ chữ rõ và tăng glow nhẹ…"
        :rows="3" /></label
    ><MButton
      :loading="s.busy"
      :disabled="s.active || s.busy || !s.valid"
      @click="s.revise"
      >AI sửa & dựng thử</MButton
    >
    <p class="motion-muted">
      Tạo bản mới và đối chiếu lại. Các bản trước được giữ nguyên.
    </p>
  </div>
</template>
