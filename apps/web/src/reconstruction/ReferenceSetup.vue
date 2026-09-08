<script setup lang="ts">
import { reactive } from "vue";
import type { ReconstructionState } from "./useReconstruction";
import MInput from "../components/mds/MInput.vue";
import MTextarea from "../components/mds/MTextarea.vue";
import MRadioGroup from "../components/mds/MRadioGroup.vue";
const props = defineProps<{ state: ReconstructionState }>();
const s = reactive(props.state);
</script>
<template>
  <div class="motion-fields">
    <p class="motion-muted">
      Chọn đoạn có hiệu ứng đặc trưng, từ 2–30 giây. AI đọc chuyển động ở 8
      mốc/giây, dựng lại và đối chiếu sau mỗi vòng.
    </p>
    <div class="motion-grid">
      <label
        >Bắt đầu (giây)<MInput
          v-model="s.start"
          type="number"
          :disabled="s.active" /></label
      ><label
        >Thời lượng (giây)<MInput
          v-model="s.duration"
          type="number"
          :disabled="s.active"
      /></label>
    </div>
    <label
      >Chỉ dẫn sáng tạo<MTextarea
        v-model="s.instruction"
        :disabled="s.active"
        placeholder="Giữ nhịp vẽ sơ đồ, hạt sáng và cách chữ xuất hiện…"
        :rows="3"
    /></label>
    <div>
      Vòng dựng và đối chiếu<MRadioGroup
        v-model="s.iterations"
        :disabled="s.active"
        :options="[
          { value: 1, label: '1 vòng' },
          { value: 2, label: '2 vòng' },
          { value: 3, label: '3 vòng' },
        ]"
      />
    </div>
    <p class="motion-muted">
      Mỗi vòng dùng Gemini và dựng MP4 thật. Âm thanh được phối lại bằng SFX
      tương ứng; giọng đọc và nhạc gốc không được sao chép vào bản tái dựng.
    </p>
  </div>
</template>
