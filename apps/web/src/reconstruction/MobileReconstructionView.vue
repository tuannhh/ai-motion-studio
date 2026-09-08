<script setup lang="ts">
import { reactive, ref } from "vue";
import { useReconstruction, STAGES } from "./useReconstruction";
import MotionAudio from "./MotionAudio.vue";
import MotionAssistant from "./MotionAssistant.vue";
import MotionLayers from "./MotionLayers.vue";
import MotionCompare from "./MotionCompare.vue";
import ReferenceSetup from "./ReferenceSetup.vue";
import ReferenceReview from "./ReferenceReview.vue";
import MMobileTopBar from "../components/mobile/MMobileTopBar.vue";
import MButton from "../components/mds/MButton.vue";
import "./reconstruction.css";
const props = defineProps<{ templateId: number; userId: number }>();
const state = useReconstruction(props.templateId, props.userId),
  s = reactive(state),
  tab = ref("preview");
</script>
<template>
  <section class="motion-native mds-mobile-app">
    <MMobileTopBar
      title="Tái dựng chuyển động"
      @back="s.router.push('/video-template')"
    />
    <div v-if="s.error" class="motion-error" role="alert">{{ s.error }}</div>
    <div v-if="s.active" class="motion-progress" role="status">
      <span>{{ STAGES[s.run.state.stage] }}</span
      ><progress :value="s.run.state.progress" max="100" />
    </div>
    <nav class="motion-tabs">
      <button
        v-for="t in [
          { id: 'preview', name: 'Xem' },
          { id: 'setup', name: 'Thiết lập' },
          { id: 'layers', name: 'Chỉnh sửa' },
          { id: 'review', name: 'Nghiệm thu' },
        ]"
        :key="t.id"
        :class="{ chosen: tab === t.id }"
        @click="tab = t.id"
      >
        {{ t.name }}
      </button>
    </nav>
    <main>
      <MotionCompare
        v-show="tab === 'preview'"
        :state="state"
        mobile
      /><ReferenceSetup v-if="tab === 'setup'" :state="state" /><template
        v-if="tab === 'layers'"
        ><MotionLayers
          v-if="s.document"
          :document="s.document"
          :selected="s.selected"
          :frame="s.frame"
          :disabled="s.active"
          @select="s.selected = $event"
          @seek="s.seek"
          @add-key="s.addKey" />
        <p v-else>AI chưa tạo các lớp chuyển động.</p>
        <details v-if="s.document">
          <summary>Âm thanh & màu nền</summary>
          <MotionAudio :document="s.document" :disabled="s.active" />
        </details>
        <MotionAssistant :state="state" /></template
      ><template v-if="tab === 'review'"
        ><video
          v-if="s.run?.status === 'done'"
          class="motion-mobile-video"
          :src="s.asset('best.mp4')"
          controls
          playsinline
        />
        <div v-if="s.run?.status === 'done'" class="motion-fields">
          <a :href="s.asset('best.mp4')" download>Tải video MP4</a
          ><MButton :disabled="s.dirty || s.busy" @click="s.use"
            >Dùng cho video mới</MButton
          >
        </div>
        <ReferenceReview :state="state" />
        <details>
          <summary>Lịch sử các bản dựng</summary>
          <MButton v-for="r in s.runs" :key="r.id" @click="s.selectRun(r.id)"
            >Bản #{{ r.id }} · {{ r.status }}</MButton
          >
        </details></template
      >
    </main>
    <footer>
      <MButton v-if="s.dirty" @click="s.discard">Bỏ sửa</MButton
      ><MButton v-else @click="tab = 'setup'">Chọn đoạn</MButton
      ><MButton
        variant="primary"
        :disabled="s.active || s.busy || s.loading || (s.dirty && !s.valid)"
        :loading="s.busy"
        @click="s.dirty ? s.render() : s.create()"
        >{{ s.dirty ? "Lưu & dựng" : "Tái dựng" }}</MButton
      >
    </footer>
  </section>
</template>
