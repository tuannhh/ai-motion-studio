<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from "vue";
import MButton from "../components/mds/MButton.vue";
import MIcon from "../components/mds/MIcon.vue";
import MProgress from "../components/mds/MProgress.vue";
import MDialog from "../components/mds/MDialog.vue";
import RemotionPreview from "./RemotionPreview.vue";
import SceneInspector from "./SceneInspector.vue";
import { useStudio } from "./useStudio";
import { SCENE_LABELS, headlineOf, timecode } from "./preview";
import "./studio.css";
const props = defineProps<{ scriptId: number; userId: number }>();
const emit = defineEmits<{ back: []; setup: [number] }>();
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
  versionOpen,
  previewError,
  load,
  discard,
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
const sourcesOpen = ref(false);
const player = ref<InstanceType<typeof RemotionPreview> | null>(null);
const statusLabel: Record<string, string> = {
  queued: "Đang chờ dựng",
  images: "Đang chuẩn bị hình ảnh",
  tts: "Đang tạo giọng đọc",
  rendering: "Đang kết xuất video",
  done: "Video đã sẵn sàng",
  failed: "Chưa dựng thành công",
};
const selectedTime = computed(() =>
  preview.value ? timecode(preview.value.starts[selected.value]) : "00:00",
);
function key(e: KeyboardEvent) {
  const input = (e.target as HTMLElement)?.closest(
    "input,textarea,select,[contenteditable=true]",
  );
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    if (!busy.value) void save();
  } else if (!input && e.code === "Space") {
    e.preventDefault();
    player.value?.toggle();
  } else if (!input && e.key === "ArrowRight")
    select(Math.min((plan.value?.scenes.length || 1) - 1, selected.value + 1));
  else if (!input && e.key === "ArrowLeft")
    select(Math.max(0, selected.value - 1));
}
onMounted(() => window.addEventListener("keydown", key));
onBeforeUnmount(() => window.removeEventListener("keydown", key));
</script>
<template>
  <div v-if="loading" class="studio-loading">Đang mở bàn dựng…</div>
  <div v-else-if="error" class="studio-loading">
    <p>{{ error }}</p>
    <MButton @click="load()">Thử lại</MButton
    ><MButton @click="emit('back')">Quay lại</MButton>
  </div>
  <div v-else-if="plan && preview" class="studio-workspace">
    <header class="studio-toolbar">
      <MButton variant="icon" title="Quay lại dự án" @click="emit('back')"
        ><MIcon name="arrow-left"
      /></MButton>
      <div class="studio-title">
        <span class="studio-eyebrow"
          >BÀN DỰNG / {{ plan.scenes.length }} CẢNH</span
        >
        <h1>{{ plan.title }}</h1>
      </div>
      <span class="saved-state" :class="{ unsaved: dirty }">{{
        dirty ? "Có thay đổi chưa lưu" : "Đã lưu"
      }}</span
      ><MButton @click="sourcesOpen = true">Tư liệu</MButton
      ><MButton title="Lịch sử phiên bản" @click="versionOpen = true"
        ><MIcon name="clock" />Phiên bản</MButton
      ><MButton :disabled="busy" @click="emit('setup', data.projectId)"
        >Thiết lập</MButton
      ><MButton
        variant="primary"
        :loading="rendering"
        :disabled="busy || saving"
        @click="render"
        ><MIcon name="photo" />{{
          complete ? "Dựng bản mới" : "Duyệt & dựng video"
        }}</MButton
      >
    </header>
    <nav class="production-steps" aria-label="Quy trình tạo video">
      <span class="done">01 <b>Ý tưởng & tư liệu</b></span
      ><i /><span class="done">02 <b>Kịch bản</b></span
      ><i /><span class="current">03 <b>Biên tập & chuyển động</b></span
      ><i /><span :class="{ done: complete }">04 <b>Nghiệm thu</b></span>
    </nav>
    <div
      v-if="latest && (busy || latest.status === 'failed')"
      class="studio-job"
      role="status"
    >
      <MProgress
        v-if="busy"
        :value="latest.progress"
        :label="statusLabel[latest.status]"
      />
      <p v-else>{{ latest.error_message }}</p>
    </div>
    <p v-if="previewError" class="preview-warning" role="status">
      {{ previewError }}
    </p>
    <div class="studio-columns">
      <aside class="scene-list">
        <div class="panel-heading">
          <b>Kịch bản hình ảnh</b><span>{{ plan.scenes.length }} cảnh</span>
        </div>
        <div class="scene-list-scroll">
          <button
            v-for="(s, i) in plan.scenes"
            :key="s.id"
            class="scene-card"
            :class="{ selected: selected === i }"
            @click="select(Number(i))"
          >
            <span class="scene-number">{{
              String(Number(i) + 1).padStart(2, "0")
            }}</span>
            <div class="scene-mini" :data-preset="plan.preset">
              <span>{{ SCENE_LABELS[s.type] }}</span
              ><b>{{ headlineOf(s).replace(/\*\*/g, "") }}</b>
              <div class="mini-decoration"><i /><i /><i /></div>
            </div>
            <div class="scene-card-copy">
              <b>{{ SCENE_LABELS[s.type] }}</b
              ><span>{{ timecode(preview.starts[Number(i)]) }}</span>
              <p>{{ headlineOf(s).replace(/\*\*/g, "") }}</p>
            </div>
          </button>
        </div>
        <div class="scene-list-footer">Mỗi cảnh, một ý tưởng rõ ràng.</div>
      </aside>
      <section class="stage-panel">
        <div class="stage-label">
          <span><i class="live-dot" />XEM TRƯỚC TRỰC TIẾP</span
          ><span>9:16 · 1080 × 1920</span>
        </div>
        <div class="stage-canvas">
          <div class="player-frame">
            <RemotionPreview
              ref="player"
              :spec="preview.spec"
              :seek="seek"
              @frame="frame = $event"
            />
          </div>
        </div>
        <div class="stage-bottom">
          <span
            >{{ timecode(frame) }}
            <em>/ {{ timecode(preview.total) }}</em></span
          ><span>{{
            preview.pending.length
              ? "Một số ảnh đang chờ dựng"
              : "Hình ảnh từ bộ dựng video"
          }}</span
          ><span>30 fps</span>
        </div>
      </section>
      <aside class="inspector-panel">
        <div class="panel-heading">
          <div>
            <span class="studio-eyebrow"
              >CẢNH {{ String(selected + 1).padStart(2, "0") }} ·
              {{ selectedTime }}</span
            >
            <h2>{{ SCENE_LABELS[scene.type] }}</h2>
          </div>
          <div class="scene-tools">
            <MButton
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
      </aside>
    </div>
    <section class="studio-timeline" aria-label="Timeline">
      <div class="timeline-head">
        <b>DÒNG THỜI GIAN</b><span>Space để phát / dừng · ← → chọn cảnh</span
        ><b>{{ timecode(preview.total) }}</b>
      </div>
      <div class="timeline-track">
        <button
          v-for="(s, i) in plan.scenes"
          :key="s.id"
          :class="{ active: selected === i }"
          :style="{
            flex: Math.max(
              1,
              (preview.starts[Number(i) + 1] ?? preview.total) -
                preview.starts[Number(i)],
            ),
          }"
          @click="select(Number(i))"
        >
          <small
            >{{ String(Number(i) + 1).padStart(2, "0") }} ·
            {{ timecode(preview.starts[Number(i)]) }}</small
          ><b>{{ SCENE_LABELS[s.type] }}</b
          ><span>{{
            s.type === "motion" && s.document?.cues?.length
              ? `${s.document.cues.length} cue SFX`
              : s.soundDesign === "none"
                ? "Yên lặng"
                : s.soundDesign === "auto"
                  ? "SFX tự động"
                  : s.soundDesign
          }}</span>
        </button>
      </div>
      <div class="audio-track">
        <MIcon name="speakerphone" :size="16" /><span>Lời đọc & hiệu ứng</span>
        <div
          style="
            flex: 1;
            height: 4px;
            border-radius: 4px;
            background: var(--mds-border);
          "
        />
        <small>{{
          complete ? "Đã tạo giọng đọc" : "Giọng đọc được tạo khi dựng"
        }}</small>
      </div>
    </section>
    <footer class="studio-footer">
      <div class="footer-status">
        <span v-if="busy">{{ statusLabel[latest.status] }}</span
        ><template v-else-if="complete"
          ><span class="success-dot" />Bản xuất #{{ complete.id }} đã sẵn sàng
          <a :href="`/v1/jobs/${complete.id}/video`" target="_blank"
            >Xem video</a
          ><a
            :href="`/v1/jobs/${complete.id}/video`"
            :download="`${plan.slug}.mp4`"
            >Tải MP4</a
          ></template
        ><span v-else
          >Chỉnh sửa hình ảnh, lời đọc và chuyển động trước khi duyệt.</span
        >
      </div>
      <MButton :disabled="!dirty || busy" @click="discard">Bỏ thay đổi</MButton
      ><MButton
        :loading="saving"
        :disabled="!dirty || busy"
        title="Lưu kịch bản (⌘/Ctrl + S)"
        @click="save"
        ><MIcon name="device-floppy" />Lưu kịch bản</MButton
      >
    </footer>
    <MDialog v-model="sourcesOpen" title="Tư liệu & nguồn tra cứu" width="640px"
      ><p class="studio-muted">
        Nguồn nội dung:
        {{
          data.sourceMode === "user"
            ? "Tư liệu của bạn"
            : data.sourceMode === "ai"
              ? "AI tìm kiếm"
              : "Kết hợp tư liệu và tìm kiếm"
        }}.
      </p>
      <div v-for="s in data.sources" :key="s.id" class="version-row">
        <b>{{ s.file_name }}</b
        ><span>{{ s.status === "ready" ? "Đã trích xuất" : s.status }}</span>
      </div>
      <template v-if="data.research"
        ><p>
          {{
            data.research.searched
              ? "AI đã thực hiện tìm kiếm web."
              : "Lần này AI chưa gọi công cụ tìm kiếm web."
          }}
        </p>
        <p class="studio-muted">{{ data.research.queries.join(" · ") }}</p>
        <p v-for="(s, i) in data.research.sources" :key="i">
          <a
            :href="s.uri"
            target="_blank"
            rel="noopener noreferrer"
            style="color: var(--mds-brand-600)"
            >{{ s.title }} ↗</a
          >
        </p></template
      >
      <p v-else-if="data.sourceMode !== 'user'" class="studio-muted">
        Chưa có bằng chứng tra cứu cho lần tạo này.
      </p></MDialog
    >
    <MDialog v-model="versionOpen" title="Lịch sử biên tập" width="560px"
      ><p class="studio-muted">
        Mỗi lần lưu giữ lại phiên bản trước đó. Các video đã xuất vẫn được giữ
        nguyên.
      </p>
      <div v-for="v in data.versions" :key="v.id" class="version-row">
        <div>
          <b>{{ v.label }}</b>
          <p>{{ new Date(v.created_at).toLocaleString("vi-VN") }}</p>
        </div>
        <MButton :disabled="busy" @click="restore(v.id)">Khôi phục</MButton>
      </div>
      <p v-if="!data.versions.length">
        Chưa có phiên bản trước. Lưu chỉnh sửa đầu tiên để bắt đầu.
      </p></MDialog
    >
  </div>
</template>
