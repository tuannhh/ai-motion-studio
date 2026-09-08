<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import MButton from "../components/mds/MButton.vue";
import MIcon from "../components/mds/MIcon.vue";
import MProgress from "../components/mds/MProgress.vue";
import RemotionPreview from "./RemotionPreview.vue";
import SceneInspector from "./SceneInspector.vue";
import { useStudio } from "./useStudio";
import { SCENE_LABELS, timecode } from "./preview";
import "./studio.css";
const props = defineProps<{ scriptId: number; userId: number }>();
const router = useRouter();
const {
  data,
  plan,
  loading,
  error,
  saving,
  rendering,
  selected,
  frame,
  seek,
  dirty,
  scene,
  preview,
  busy,
  latest,
  complete,
  aiBusy,
  suggestion,
  aiInstruction,
  previewError,
  load,
  save,
  render,
  select,
  move,
  duplicate,
  remove,
  revise,
  applySuggestion,
  restore,
} = useStudio(props.scriptId, props.userId);
const page = ref("scene");
</script>
<template>
  <main class="mds-mobile-app mobile-studio">
    <header class="mobile-editor-top">
      <MButton
        variant="icon"
        title="Quay lại"
        @click="router.push('/video-da-tao')"
        ><MIcon name="arrow-left"
      /></MButton>
      <div>
        <b>Bàn dựng</b
        ><span>{{ dirty ? "Có chỉnh sửa chưa lưu" : "Đã lưu kịch bản" }}</span>
      </div>
      <MButton :disabled="busy || !dirty" :loading="saving" @click="save"
        >Lưu</MButton
      >
    </header>
    <div v-if="loading || error" class="studio-loading">
      {{ error || "Đang mở bàn dựng…"
      }}<MButton v-if="error" @click="load()">Thử lại</MButton>
    </div>
    <template v-else-if="plan && preview"
      ><section class="mobile-editor-stage">
        <div class="mobile-player">
          <RemotionPreview
            :spec="preview.spec"
            :seek="seek"
            @frame="frame = $event"
          />
        </div>
        <div>
          {{ timecode(frame) }} / {{ timecode(preview.total) }} ·
          {{ plan.scenes.length }} cảnh
        </div>
      </section>
      <div v-if="busy" class="mobile-progress">
        <MProgress :value="latest.progress" label="Đang dựng video" />
      </div>
      <p v-if="latest?.status === 'failed'" role="alert">
        {{ latest.error_message }}
      </p>
      <p v-if="previewError" class="preview-warning">{{ previewError }}</p>
      <nav class="mobile-scene-strip" aria-label="Chọn cảnh">
        <button
          v-for="(s, i) in plan.scenes"
          :key="s.id"
          :class="{ active: selected === i }"
          @click="select(Number(i))"
        >
          {{ Number(i) + 1 }} · {{ SCENE_LABELS[s.type] }}
        </button>
      </nav>
      <nav class="mobile-editor-tabs">
        <button :class="{ active: page === 'scene' }" @click="page = 'scene'">
          Biên tập</button
        ><button
          :class="{ active: page === 'versions' }"
          @click="page = 'versions'"
        >
          Phiên bản</button
        ><button
          :class="{ active: page === 'export' }"
          @click="page = 'export'"
        >
          Nghiệm thu
        </button>
      </nav>
      <section v-if="page === 'scene'" class="mobile-scene-editor">
        <div class="mobile-scene-tools">
          <b>Cảnh {{ selected + 1 }}</b
          ><MButton
            variant="icon"
            title="Đưa cảnh lên"
            :disabled="busy || selected === 0"
            @click="move(-1)"
            ><MIcon name="arrow-up" /></MButton
          ><MButton
            variant="icon"
            title="Đưa cảnh xuống"
            :disabled="busy || selected === plan.scenes.length - 1"
            @click="move(1)"
            ><MIcon name="arrow-down" /></MButton
          ><MButton
            variant="icon"
            title="Nhân đôi cảnh"
            :disabled="busy || plan.scenes.length >= 14"
            @click="duplicate"
            ><MIcon name="copy" /></MButton
          ><MButton
            variant="icon"
            title="Xóa cảnh"
            :disabled="busy || plan.scenes.length <= 2"
            @click="remove"
            ><MIcon name="trash"
          /></MButton>
        </div>
        <SceneInspector
          :key="scene.id"
          :scene="scene"
          :plan="plan"
          :disabled="busy"
          :ai-busy="aiBusy"
          :suggestion="suggestion"
          v-model:instruction="aiInstruction"
          @revise="revise"
          @apply="applySuggestion"
          @dismiss="suggestion = null"
        />
      </section>
      <section v-else-if="page === 'versions'" class="mobile-section">
        <p v-if="!data.versions.length">Chưa có phiên bản trước.</p>
        <div v-for="v in data.versions" :key="v.id" class="version-row">
          <div>
            <b>{{ v.label }}</b>
            <p>{{ new Date(v.created_at).toLocaleString("vi-VN") }}</p>
          </div>
          <MButton :disabled="busy" @click="restore(v.id)">Khôi phục</MButton>
        </div>
      </section>
      <section v-else class="mobile-section">
        <template v-if="complete"
          ><video
            :src="`/v1/jobs/${complete.id}/video`"
            controls
            class="mobile-export-video"
          /><a
            :href="`/v1/jobs/${complete.id}/video`"
            :download="`${plan.slug}.mp4`"
            >Tải video MP4</a
          ></template
        >
        <p v-else>Chọn Duyệt & dựng để tạo video có giọng đọc và hiệu ứng.</p>
      </section>
      <footer class="mobile-editor-footer">
        <span>{{ busy ? "Đang dựng…" : "9:16 · Full HD" }}</span
        ><MButton
          variant="primary"
          :loading="rendering"
          :disabled="busy || saving"
          @click="render"
          >{{ complete ? "Dựng bản mới" : "Duyệt & dựng" }}</MButton
        >
      </footer></template
    >
  </main>
</template>
<style scoped>
.mobile-studio {
  height: 100dvh;
  overflow-y: auto;
  min-height: 0;
  background: var(--mds-bg-page);
  padding-bottom: calc(82px + env(safe-area-inset-bottom));
  color: var(--mds-text);
  font-size: 13px;
}
.mobile-editor-top {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  background: var(--mds-bg);
  position: sticky;
  top: 0;
  z-index: 20;
}
.mobile-editor-top > div {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.mobile-editor-top span {
  font-size: 10px;
  color: var(--mds-text-secondary);
}
.mobile-editor-stage {
  padding: 16px;
  text-align: center;
  background: var(--mds-base-neutral-900);
  color: var(--mds-neutral-400);
  font-size: 10px;
}
.mobile-player {
  height: 310px;
  aspect-ratio: 9/16;
  margin: 0 auto 12px;
}
.mobile-scene-strip {
  display: flex;
  overflow-x: auto;
  padding: 12px;
  gap: 8px;
}
.mobile-scene-strip > button {
  flex-shrink: 0;
  border: 1px solid var(--mds-neutral-300);
  border-radius: 8px;
  padding: 10px;
  background: var(--mds-bg);
  min-height: 48px;
}
.mobile-scene-strip > button.active {
  color: var(--mds-brand-600);
  border-color: var(--mds-brand-500);
  background: var(--mds-brand-50);
}
.mobile-editor-tabs {
  display: flex;
  padding: 0 12px;
  background: var(--mds-bg);
}
.mobile-editor-tabs > button {
  flex: 1;
  background: transparent;
  border: 0;
  min-height: 48px;
  color: var(--mds-text-secondary);
  font-size: 12px;
}
.mobile-editor-tabs > button.active {
  color: var(--mds-brand-600);
  box-shadow: inset 0 -2px var(--mds-brand-500);
}
.mobile-scene-editor {
  margin: 12px;
  background: var(--mds-bg);
  border-radius: 8px;
  box-shadow: var(--mds-shadow-card);
  overflow: hidden;
}
.mobile-scene-tools {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--mds-neutral-300);
}
.mobile-scene-tools > b {
  flex: 1;
}
.mobile-section {
  padding: 16px;
}
.mobile-editor-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--mds-bg);
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  box-shadow: var(--mds-shadow-card);
  z-index: 20;
}
.mobile-editor-footer > span {
  font-size: 11px;
  color: var(--mds-text-secondary);
}
.mobile-progress {
  padding: 12px;
}
.mobile-export-video {
  width: 100%;
  max-height: 460px;
}
.mobile-section a {
  display: block;
  padding: 18px;
  color: var(--mds-brand-600);
}
.mobile-studio :deep(.inspector-tabs) {
  gap: 0;
  padding: 0;
}
.mobile-studio :deep(.inspector-tabs button) {
  flex: 1;
  min-height: 48px;
  font-size: 10px;
}
.mobile-studio :deep(.inspector-body) {
  overflow: visible;
}
.mobile-studio :deep(.scene-tools button) {
  min-height: 48px !important;
  min-width: 48px !important;
}
.mobile-studio :deep(.prompt-chips button) {
  min-height: 48px;
}
.mobile-studio :deep(input[type="range"]) {
  min-height: 48px;
}
@media (min-width: 600px) {
  .mobile-player {
    height: 380px;
  }
  .mobile-scene-editor,
  .mobile-section {
    max-width: 700px;
    margin: 12px auto;
  }
}
@media (prefers-reduced-motion: reduce) {
  * {
    scroll-behavior: auto !important;
  }
}
</style>
