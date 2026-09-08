<script setup lang="ts">
import { reactive, ref } from "vue";
import { useReconstruction, STAGES } from "./useReconstruction";
import MotionAudio from "./MotionAudio.vue";
import MotionAssistant from "./MotionAssistant.vue";
import MotionLayers from "./MotionLayers.vue";
import MotionCompare from "./MotionCompare.vue";
import ReferenceSetup from "./ReferenceSetup.vue";
import ReferenceReview from "./ReferenceReview.vue";
import MButton from "../components/mds/MButton.vue";
import MTextarea from "../components/mds/MTextarea.vue";
import "./reconstruction.css";
const props = defineProps<{ templateId: number; userId: number }>();
const state = useReconstruction(props.templateId, props.userId),
  s = reactive(state),
  tab = ref("setup");
</script>
<template>
  <section class="motion-lab">
    <header class="motion-header">
      <div>
        <MButton variant="ghost" @click="s.router.push('/video-template')"
          >← Video mẫu</MButton
        >
        <h1>
          Bàn tái dựng <span>{{ s.template?.name }}</span>
        </h1>
      </div>
      <div class="motion-inline">
        <a v-if="s.run?.status === 'done'" :href="s.asset('best.mp4')" download
          >Tải MP4</a
        ><MButton
          :disabled="s.run?.status !== 'done' || s.dirty || s.busy"
          :loading="s.busy"
          @click="s.use"
          >Dùng cho video mới</MButton
        ><MButton
          v-if="!s.dirty"
          variant="primary"
          :disabled="s.active || s.busy || s.loading"
          :loading="s.busy"
          @click="s.dirty ? s.render() : s.create()"
          >{{ s.dirty ? "Dựng bản đã sửa" : "Phân tích & tái dựng" }}</MButton
        >
      </div>
    </header>
    <div v-if="s.error" class="motion-error" role="alert">{{ s.error }}</div>
    <div v-if="s.active" class="motion-progress" role="status">
      <span>{{ STAGES[s.run.state.stage] ?? "Đang xử lý" }}</span
      ><progress :value="s.run.state.progress" max="100" /><span
        >{{ s.run.state.progress }}%</span
      >
    </div>
    <div class="motion-workspace">
      <aside class="motion-sidebar">
        <nav class="motion-tabs">
          <button :class="{ chosen: tab === 'setup' }" @click="tab = 'setup'">
            Thiết lập</button
          ><button
            :class="{ chosen: tab === 'layers' }"
            @click="tab = 'layers'"
          >
            Các lớp</button
          ><button :class="{ chosen: tab === 'audio' }" @click="tab = 'audio'">
            SFX
          </button>
        </nav>
        <ReferenceSetup v-if="tab === 'setup'" :state="state" /><template
          v-else-if="tab === 'layers'"
          ><MotionLayers
            v-if="s.document"
            :document="s.document"
            :selected="s.selected"
            :frame="s.frame"
            :disabled="s.active"
            @select="s.selected = $event"
            @seek="s.seek"
            @add-key="s.addKey"
          />
          <p v-else class="motion-muted">
            Các lớp sẽ xuất hiện sau bước tạo chuyển động.
          </p></template
        ><MotionAudio
          v-else-if="s.document"
          :document="s.document"
          :disabled="s.active"
        /><MotionAssistant :state="state" />
        <details class="motion-history">
          <summary>Lịch sử · {{ s.runs.length }} bản</summary>
          <button v-for="r in s.runs" :key="r.id" @click="s.selectRun(r.id)">
            Bản #{{ r.id }} · {{ r.options.startSec }}–{{
              r.options.startSec + r.options.durationSec
            }}s · {{ r.status }}
          </button>
        </details>
      </aside>
      <main class="motion-stage">
        <MotionCompare :state="state" />
        <div class="motion-caption">
          <b>Từ quan sát → chuyển động có thể chỉnh sửa.</b
          ><span
            >Hình và chữ được dựng bằng SVG/Remotion; không chèn lại video gốc
            vào đầu ra.</span
          >
        </div>
        <details v-if="s.document" class="motion-code">
          <summary>Dữ liệu chuyển động & mã Remotion</summary>
          <p>
            Mở JSON để chỉnh cấu trúc lớp, keyframe, đường vẽ và cue SFX. Dữ
            liệu được kiểm tra trước khi dựng.
          </p>
          <MButton @click="s.jsonText = JSON.stringify(s.document, null, 2)">
            Lấy dữ liệu các lớp hiện tại
          </MButton>
          <MTextarea v-model="s.jsonText" :rows="12" /><MButton
            @click="s.applyJson"
            >Áp dụng JSON</MButton
          ><a v-if="s.run?.status === 'done'" :href="s.asset('motion.json')"
            >Tải JSON</a
          ><a v-if="s.run?.status === 'done'" :href="s.asset('MotionScene.tsx')"
            >Tải mã Remotion</a
          >
        </details>
      </main>
      <aside class="motion-review">
        <h2>Đối chiếu & cải thiện</h2>
        <ReferenceReview :state="state" />
      </aside>
    </div>
    <footer v-if="s.dirty" class="motion-footer">
      <span
        >Có thay đổi chưa dựng ·
        {{ s.valid ? "Sẵn sàng dựng" : "Có mốc chuyển động chưa hợp lệ" }}</span
      ><MButton @click="s.discard">Bỏ thay đổi</MButton
      ><MButton
        variant="primary"
        :disabled="s.busy || s.active || !s.valid"
        :loading="s.busy"
        @click="s.render"
        >Lưu & dựng bản sửa</MButton
      >
    </footer>
  </section>
</template>
