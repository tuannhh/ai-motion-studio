<script setup lang="ts">
import { reactive } from "vue";
import type { ReconstructionState } from "./useReconstruction";
import MButton from "../components/mds/MButton.vue";
const props = defineProps<{ state: ReconstructionState }>();
const s = reactive(props.state);
const labels: Record<string, string> = {
  layout: "Bố cục",
  typography: "Chữ",
  motion: "Chuyển động",
  timing: "Nhịp",
  sound: "SFX",
};
</script>
<template>
  <div class="motion-fields">
    <template v-if="s.run?.state.versions?.length"
      ><div class="motion-inline wrap">
        <MButton
          v-for="v in s.run.state.versions"
          :key="v.index"
          :variant="s.revision === v.index ? 'primary' : 'secondary'"
          @click="s.version(v.index)"
          >Vòng {{ v.index + 1
          }}<span v-if="v.index === s.run.state.bestIndex">
            · Được chọn</span
          ></MButton
        >
      </div>
      <template v-if="s.comparison"
        ><p class="motion-muted">
          Điểm nhận xét của Gemini, không phải tỷ lệ giống đo bằng pixel.
        </p>
        <div class="review-metrics">
          <div v-for="(label, key) in labels" :key="key">
            <strong>{{ s.comparison[key] }}</strong
            ><span>{{ label }}</span>
          </div>
        </div>
        <p>{{ s.comparison.summary }}</p>
        <article
          v-for="(issue, i) in s.comparison.issues"
          :key="i"
          class="motion-issue"
        >
          <button @click="s.seek(issue.at)">{{ issue.at.toFixed(2) }}s</button>
          <div>
            <b>{{ issue.description }}</b>
            <p>{{ issue.fix }}</p>
          </div>
        </article></template
      ></template
    >
    <p v-else class="motion-muted">
      Nhận xét sẽ xuất hiện sau khi AI dựng và xem lại video. Bạn có thể rời
      trang; tác vụ tiếp tục trên máy chủ.
    </p>
    <details v-if="s.run?.state.analysis">
      <summary>
        Phân tích clip gốc · {{ s.run.state.analysis.events.length }} sự kiện
      </summary>
      <p>{{ s.run.state.analysis.summary }}</p>
      <p><b>Giọng kể:</b> {{ s.run.state.analysis.tone }}</p>
      <article
        v-for="(e, i) in s.run.state.analysis.events"
        :key="i"
        class="motion-issue"
      >
        <button @click="s.seek(e.at)">{{ e.at.toFixed(2) }}s</button>
        <div>
          <b>{{ e.subject }}</b>
          <p>{{ e.action }}</p>
          <small>SFX: {{ e.sound }} · Độ tin cậy: {{ e.confidence }}</small>
        </div>
      </article>
      <p
        v-for="note in s.run.state.analysis.limitations"
        :key="note"
        class="motion-muted"
      >
        {{ note }}
      </p>
    </details>
  </div>
</template>
