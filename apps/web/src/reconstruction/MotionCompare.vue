<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import type { ReconstructionState } from "./useReconstruction";
import RemotionPreview from "../studio/RemotionPreview.vue";
import MButton from "../components/mds/MButton.vue";
const props = defineProps<{ state: ReconstructionState; mobile?: boolean }>();
const s = reactive(props.state);
const source = ref<HTMLVideoElement | null>(null),
  preview = ref<any>(null),
  view = ref("rebuild"),
  outputMode = ref("render"),
  result = ref<HTMLVideoElement | null>(null);
function scrub() {
  source.value?.pause();
  if (source.value) source.value.currentTime = s.frame / 30;
  preview.value?.seekTo(s.frame);
  if (result.value) {
    result.value.pause();
    result.value.currentTime = s.frame / 30;
  }
}
function sync() {
  if (source.value) {
    s.frame = Math.round(source.value.currentTime * 30);
    if (
      result.value &&
      Math.abs(result.value.currentTime - source.value.currentTime) > 0.12
    )
      result.value.currentTime = source.value.currentTime;
  }
}
async function play() {
  if (!source.value) return;
  try {
    if (source.value.paused) {
      await source.value.play();
      if (result.value) await result.value.play();
      else preview.value?.play();
    } else {
      source.value.pause();
      result.value?.pause();
      preview.value?.pause();
    }
  } catch (e) {
    s.error = "Không phát được video tham chiếu.";
  }
}
watch(
  () => s.frame,
  () => {
    if (
      result.value?.paused &&
      Math.abs(result.value.currentTime - s.frame / 30) > 0.1
    )
      result.value.currentTime = s.frame / 30;
    if (
      source.value?.paused &&
      Math.abs(source.value.currentTime - s.frame / 30) > 0.1
    )
      source.value.currentTime = s.frame / 30;
  },
);
</script>
<template>
  <div>
    <div v-if="mobile" class="motion-inline">
      <MButton
        :variant="view === 'rebuild' ? 'primary' : 'secondary'"
        @click="view = 'rebuild'"
        >Bản dựng</MButton
      ><MButton
        :variant="view === 'source' ? 'primary' : 'secondary'"
        @click="view = 'source'"
        >Clip gốc</MButton
      >
    </div>
    <div :class="mobile ? 'motion-single' : 'motion-pair'">
      <figure v-show="!mobile || view === 'source'">
        <figcaption>
          01 / CLIP GỐC
          <span
            >{{ s.run?.options.startSec ?? s.start }}s →
            {{
              (s.run?.options.startSec ?? s.start) +
              (s.run?.options.durationSec ?? s.duration)
            }}s</span
          >
        </figcaption>
        <div class="motion-screen">
          <video
            ref="source"
            :src="
              s.run?.state.stage &&
              s.run.state.stage !== 'queued' &&
              s.run.state.stage !== 'preparing'
                ? s.asset('reference.mp4')
                : `/v1/templates/${s.template?.id}/video`
            "
            controls
            muted
            playsinline
            preload="metadata"
            @timeupdate="sync"
          />
        </div>
      </figure>
      <figure v-show="!mobile || view === 'rebuild'">
        <figcaption>
          02 / BẢN TÁI DỰNG
          <span>{{ s.dirty ? "Đang chỉnh sửa" : "Có thể sửa từng lớp" }}</span>
        </figcaption>
        <div class="motion-screen">
          <video
            v-if="
              s.run?.status === 'done' && !s.dirty && outputMode === 'render'
            "
            ref="result"
            :key="s.revision"
            :src="s.asset(`render-${s.revision}.mp4`)"
            controls
            playsinline
            preload="metadata"
          /><RemotionPreview
            v-else-if="s.preview"
            ref="preview"
            :spec="s.preview"
            :seek="s.frame"
            :controls="false"
          />
          <div v-else class="motion-wait">
            <b>{{
              s.active
                ? "AI đang dựng chuyển động…"
                : "Chuyển động bắt đầu từ đây"
            }}</b>
            <p>
              Mỗi lớp, mỗi đường vẽ và mỗi nhịp xuất hiện đều chỉnh sửa được.
            </p>
          </div>
        </div>
      </figure>
    </div>
    <div v-if="s.run?.status === 'done'" class="motion-inline">
      <MButton
        @click="outputMode = outputMode === 'render' ? 'edit' : 'render'"
        >{{
          outputMode === "render" ? "Xem các lớp có thể sửa" : "Xem MP4 đã dựng"
        }}</MButton
      >
    </div>
    <div v-if="s.preview" class="motion-scrubber">
      <MButton @click="play">Phát / dừng đối chiếu</MButton
      ><input
        v-model.number="s.frame"
        type="range"
        min="0"
        :max="Math.round((s.document?.durationSec ?? 8) * 30) - 1"
        aria-label="Mốc đối chiếu"
        @input="scrub"
      /><output>{{ (s.frame / 30).toFixed(2) }}s</output>
    </div>
  </div>
</template>
