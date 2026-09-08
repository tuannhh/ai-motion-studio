<script setup lang="ts">
import { ref } from "vue";
import MInput from "../components/mds/MInput.vue";
import MTextarea from "../components/mds/MTextarea.vue";
import MSelect from "../components/mds/MSelect.vue";
import MButton from "../components/mds/MButton.vue";
import MSwitch from "../components/mds/MSwitch.vue";
import MotionAudio from "../reconstruction/MotionAudio.vue";
import MotionLayers from "../reconstruction/MotionLayers.vue";
import "../reconstruction/reconstruction.css";
import SceneContentEditor from "../components/SceneContentEditor.vue";
const props = defineProps<{
  scene: any;
  plan: any;
  disabled?: boolean;
  aiBusy?: boolean;
  suggestion?: any;
  instruction: string;
}>();
const emit = defineEmits<{
  "update:instruction": [string];
  revise: [];
  apply: [];
  dismiss: [];
}>();
const tab = ref("content");
const selectedLayer = ref("");
const transitions = [
  ["auto", "Theo phong cách"],
  ["fade", "Mờ chuyển cảnh"],
  ["whip", "Lướt nhanh · Whip pan"],
  ["zoom", "Phóng xuyên cảnh"],
  ["wipe", "Quét màu nhấn"],
  ["iris", "Mở vòng tròn"],
  ["slide", "Trượt ngang"],
].map(([value, label]) => ({ value, label }));
const sounds = [
  ["auto", "Phối âm tự động"],
  ["none", "Không hiệu ứng"],
  ["whoosh", "Whoosh · chuyển cảnh"],
  ["ding", "Ding · điểm nhấn"],
  ["pop", "Pop · xuất hiện"],
  ["impact", "Impact · nhấn mạnh"],
  ["paper", "Giấy · editorial"],
].map(([value, label]) => ({ value, label }));
const motions = [
  ["auto", "Theo phong cách"],
  ["zoom-in", "Tiến gần"],
  ["zoom-out", "Lùi xa"],
  ["pan-left", "Quét sang trái"],
  ["pan-right", "Quét sang phải"],
  ["still", "Tĩnh"],
].map(([value, label]) => ({ value, label }));
function ensureAudio() {
  props.plan.studio ??= {
    musicVolume: 0.25,
    sfxVolume: 0.35,
    autoSfx: true,
    captions: true,
  };
}
ensureAudio();
</script>
<template>
  <div class="inspector">
    <div class="inspector-tabs" role="tablist" aria-label="Chỉnh sửa cảnh">
      <button
        v-for="t in [
          { id: 'content', label: 'Nội dung' },
          { id: 'motion', label: 'Chuyển động' },
          { id: 'audio', label: 'Âm thanh' },
          { id: 'ai', label: 'Trợ lý AI' },
        ]"
        :key="t.id"
        role="tab"
        :aria-selected="tab === t.id"
        :class="{ active: tab === t.id }"
        @click="tab = t.id"
      >
        {{ t.label }}
      </button>
    </div>
    <fieldset :disabled="disabled || aiBusy" class="inspector-body">
      <template v-if="tab === 'content'">
        <div class="field-title">
          CHỮ TRÊN HÌNH <span>Sửa để xem ngay</span>
        </div>
        <template v-if="scene.type === 'motion'">
          <label class="studio-field"
            >Tên cảnh<MInput v-model="scene.title"
          /></label>
          <label
            v-for="n in scene.document.nodes.filter(
              (n: any) => n.kind === 'text',
            )"
            :key="n.id"
            class="studio-field"
            >{{ n.name }}
            <template v-if="n.spans?.length"
              ><MInput
                v-for="(span, si) in n.spans"
                :key="si"
                v-model="span.text"
            /></template>
            <MTextarea v-else v-model="n.text" :rows="2" />
          </label>
        </template>
        <SceneContentEditor
          v-else
          :key="scene.id + scene.type"
          :scene-type="scene.type"
          :content="scene"
        />
        <label v-if="scene.type === 'stat'" class="studio-field"
          >Giá trị<MInput
            type="number"
            :model-value="String(scene.value)"
            @update:model-value="scene.value = Number($event)"
        /></label>
        <template v-if="scene.type === 'chart' || scene.type === 'rank'">
          <label
            v-for="(p, i) in scene.points || scene.items"
            :key="i"
            class="studio-field"
            >Giá trị · {{ p.label
            }}<MInput
              type="number"
              :model-value="String(p.value)"
              @update:model-value="p.value = Number($event)"
          /></label>
        </template>
        <div class="inspector-divider" />
        <label class="studio-field"
          ><span class="field-title"
            >LỜI ĐỌC <span>{{ scene.narration.length }} / 320</span></span
          ><MTextarea
            v-model="scene.narration"
            :rows="4"
            :maxlength="320"
          /><small>Giọng đọc được tạo lại khi bạn dựng video.</small></label
        >
        <label v-if="scene.imagePrompt !== undefined" class="studio-field"
          >Mô tả ảnh minh họa<MTextarea
            v-model="scene.imagePrompt"
            :rows="3"
            :maxlength="400"
        /></label>
        <label v-if="scene.bgImagePrompt !== undefined" class="studio-field"
          >Mô tả ảnh nền<MTextarea
            v-model="scene.bgImagePrompt"
            :rows="3"
            :maxlength="400"
        /></label>
      </template>
      <template v-else-if="tab === 'motion'">
        <MotionLayers
          :can-add-key="false"
          v-if="scene.type === 'motion'"
          :document="scene.document"
          :selected="selectedLayer || scene.document.nodes[0]?.id"
          :frame="0"
          :disabled="disabled"
          @select="selectedLayer = $event"
        />
        <label class="studio-field"
          >Chuyển sang cảnh tiếp theo<MSelect
            v-model="scene.transition"
            :options="transitions"
        /></label>
        <label class="studio-field"
          >Chuyển động hình ảnh<MSelect
            v-model="scene.motion"
            :options="motions"
        /></label>
        <label class="studio-field"
          >Thời gian giữ cảnh tối thiểu (giây)<MInput
            type="number"
            min="2"
            max="30"
            :model-value="
              scene.durationInFrames ? String(scene.durationInFrames / 30) : ''
            "
            placeholder="Tự khớp theo lời đọc"
            @update:model-value="
              scene.durationInFrames = $event
                ? Math.round(Number($event) * 30)
                : undefined
            "
          /><small
            >Cảnh tự kéo dài nếu lời đọc dài hơn thời gian này.</small
          ></label
        >
        <label class="studio-field"
          >Phong cách toàn video<MSelect
            v-model="plan.preset"
            :options="[
              { value: 'paper', label: 'Paper · biên tập tối giản' },
              { value: 'midnight', label: 'Midnight · công nghệ' },
              { value: 'noir', label: 'Noir · tin tức' },
              { value: 'aurora', label: 'Aurora · sáng tạo' },
            ]"
        /></label>
        <label class="studio-field"
          >Màu nhấn toàn video<MInput
            :model-value="plan.studio.accent || ''"
            @update:model-value="plan.studio.accent = $event || undefined"
            placeholder="#E75B32"
          /><small>Để trống để dùng màu của phong cách.</small></label
        >
      </template>
      <template v-else-if="tab === 'audio'">
        <MotionAudio
          v-if="scene.type === 'motion'"
          :document="scene.document"
          :disabled="disabled"
        />
        <label class="studio-field"
          >Hiệu ứng cảnh này<MSelect
            v-model="scene.soundDesign"
            :options="sounds"
        /></label>
        <label class="switch-row"
          ><span>Phối hiệu ứng âm thanh</span
          ><MSwitch v-model="plan.studio.autoSfx"
        /></label>
        <label class="studio-field"
          >Âm lượng hiệu ứng ·
          {{ Math.round(plan.studio.sfxVolume * 100) }}%<input
            aria-label="Âm lượng hiệu ứng"
            type="range"
            min="0"
            max="1"
            step=".01"
            v-model.number="plan.studio.sfxVolume"
        /></label>
        <label class="studio-field"
          >Âm lượng nhạc nền ·
          {{ Math.round(plan.studio.musicVolume * 100) }}%<input
            aria-label="Âm lượng nhạc nền"
            type="range"
            min="0"
            max="1"
            step=".01"
            v-model.number="plan.studio.musicVolume"
          /><small
            >Nhạc tự giảm khi có lời đọc. Chọn hoặc đổi bài tại Thiết
            lập.</small
          ></label
        >
        <label class="switch-row"
          ><span>Phụ đề theo lời đọc</span
          ><MSwitch v-model="plan.studio.captions"
        /></label>
      </template>
      <template v-else>
        <h3 class="inspector-heading">Một lời nhắc. Một cảnh tốt hơn.</h3>
        <p class="studio-muted">
          AI đề xuất cách viết mới để bạn duyệt trước khi áp dụng.
        </p>
        <div class="prompt-chips">
          <button
            type="button"
            @click="
              emit(
                'update:instruction',
                'Viết ngắn gọn, dễ hiểu hơn. Giữ nguyên các dữ kiện.',
              )
            "
          >
            Ngắn gọn hơn</button
          ><button
            type="button"
            @click="
              emit(
                'update:instruction',
                'Làm câu mở đầu hấp dẫn, tự nhiên hơn, không giật gân và không thêm dữ kiện.',
              )
            "
          >
            Mở đầu cuốn hút
          </button>
        </div>
        <MTextarea
          :model-value="instruction"
          @update:model-value="emit('update:instruction', $event)"
          :rows="4"
          placeholder="Ví dụ: Viết gần gũi hơn, nhấn mạnh lợi ích thực tế…"
        />
        <MButton
          :disabled="instruction.trim().length < 5"
          :loading="aiBusy"
          @click="emit('revise')"
          >Đề xuất chỉnh sửa</MButton
        >
        <div v-if="suggestion" class="ai-suggestion">
          <b>Đề xuất lời đọc</b>
          <p>{{ suggestion.narration }}</p>
          <MButton @click="emit('dismiss')">Bỏ qua</MButton
          ><MButton @click="emit('apply')">Áp dụng</MButton>
        </div>
      </template>
    </fieldset>
  </div>
</template>
