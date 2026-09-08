<script setup lang="ts">
import { ref } from "vue";
import MButton from "../components/mds/MButton.vue";
import MSwitch from "../components/mds/MSwitch.vue";
import { useRouter } from "vue-router";
const router = useRouter();
import MInput from "../components/mds/MInput.vue";
import MTextarea from "../components/mds/MTextarea.vue";
import MCheckbox from "../components/mds/MCheckbox.vue";
import MSelect from "../components/mds/MSelect.vue";
const props = defineProps<{ profile: any; templateId: number }>();
const video = ref<HTMLVideoElement | null>(null);
function jump(sec: number) {
  if (video.value) {
    video.value.currentTime = sec;
    void video.value.play();
  }
}
</script>
<template>
  <section class="profile-director">
    <h3>Phong cách học từ video</h3>
    <div v-if="profile.motionBlueprint" class="studio-field">
      <b>Đã học {{ profile.motionBlueprint.nodes.length }} lớp chuyển động</b>
      <MSwitch
        :model-value="profile.motionEnabled !== false"
        @update:model-value="profile.motionEnabled = $event"
        label="Dùng chuyển động tái dựng cho video mới"
      />
      <MButton @click="router.push(`/tai-dung/${templateId}`)"
        >Mở bàn tái dựng</MButton
      >
    </div>
    <p class="studio-muted">
      Đối chiếu kết quả AI với video gốc. Bạn có thể sửa giọng kể, nhịp và âm
      thanh trước khi dùng.
    </p>
    <video
      ref="video"
      controls
      preload="metadata"
      :src="`/v1/templates/${templateId}/video`"
      class="reference-video"
    />
    <div class="profile-edit-grid">
      <label class="studio-field"
        >Tông hình ảnh<MSelect
          v-model="profile.preset"
          :options="[
            { value: 'paper', label: 'Paper' },
            { value: 'midnight', label: 'Midnight' },
            { value: 'noir', label: 'Noir' },
            { value: 'aurora', label: 'Aurora' },
          ]" /></label
      ><label class="studio-field"
        >Màu nhấn<MInput
          :model-value="profile.accent || ''"
          @update:model-value="profile.accent = $event || undefined"
          placeholder="#E75B32"
      /></label>
    </div>
    <label class="studio-field"
      >Tone of voice<MTextarea
        v-model="profile.narrationTone"
        :rows="3"
        :maxlength="240" /></label
    ><label class="studio-field"
      >Cách mở đầu<MTextarea
        v-model="profile.hookStyle"
        :rows="2"
        :maxlength="240"
    /></label>
    <div class="profile-edit-grid">
      <label class="studio-field"
        >Nhịp cảnh (giây)<MInput
          type="number"
          min="1.5"
          max="15"
          :model-value="String(profile.pacing.avgSceneSec)"
          @update:model-value="
            profile.pacing.avgSceneSec = Number($event)
          " /></label
      ><label class="studio-field"
        >Từ / phút<MInput
          type="number"
          min="90"
          max="280"
          :model-value="String(profile.pacing.wordsPerMinute)"
          @update:model-value="profile.pacing.wordsPerMinute = Number($event)"
      /></label>
    </div>
    <label class="studio-field"
      >Dấu ấn hình ảnh · 2–6 dòng<MTextarea
        :model-value="profile.visualSignatures.join('\n')"
        @update:model-value="
          profile.visualSignatures = $event.split('\n').slice(0, 6)
        "
        :rows="4"
    /></label>
    <template v-if="profile.motion"
      ><label class="studio-field"
        >Mức chuyển động<MSelect
          v-model="profile.motion.intensity"
          :options="[
            { value: 'subtle', label: 'Nhẹ nhàng' },
            { value: 'medium', label: 'Vừa phải' },
            { value: 'dynamic', label: 'Mạnh, nhiều nhịp' },
          ]" /></label
      ><label class="studio-field"
        >Hiệu ứng chuyển động · mỗi dòng một ý<MTextarea
          :model-value="profile.motion.signatures.join('\n')"
          @update:model-value="
            profile.motion.signatures = $event.split('\n').slice(0, 6)
          "
          :rows="3" /></label
    ></template>
    <template v-if="profile.soundDesign"
      ><label class="studio-field"
        >Mật độ SFX<MSelect
          v-model="profile.soundDesign.density"
          :options="[
            { value: 'minimal', label: 'Tiết chế' },
            { value: 'balanced', label: 'Cân bằng' },
            { value: 'punchy', label: 'Nhiều điểm nhấn' },
          ]" /></label
      ><label class="studio-field"
        >Âm thanh quan sát được<MTextarea
          v-model="profile.soundDesign.notes"
          :rows="3"
          :maxlength="300" /></label
      ><label class="studio-field"
        >Sắc thái nhạc<MInput
          v-model="profile.soundDesign.musicMood"
          :maxlength="180"
      /></label>
      <div class="profile-cues">
        <MCheckbox
          v-for="c in ['whoosh', 'ding', 'pop', 'impact', 'paper']"
          :key="c"
          v-model="profile.soundDesign.cues"
          :value="c"
          :label="c"
        /></div
    ></template>
    <details v-if="profile.observations?.length" open>
      <summary>Các mốc tham chiếu · {{ profile.observations.length }}</summary>
      <button
        v-for="(o, i) in profile.observations"
        :key="i"
        class="observation"
        @click="jump(o.atSec)"
      >
        <b
          >{{
            Math.floor(o.atSec / 60)
              .toString()
              .padStart(2, "0")
          }}:{{
            Math.floor(o.atSec % 60)
              .toString()
              .padStart(2, "0")
          }}</b
        ><span
          ><small
            >{{ o.kind.toUpperCase() }} · Độ chắc chắn
            {{
              o.confidence === "high"
                ? "cao"
                : o.confidence === "medium"
                  ? "vừa"
                  : "thấp"
            }}</small
          >{{ o.description }}</span
        >
      </button>
    </details>
  </section>
</template>
<style scoped>
.profile-director h3 {
  margin: 0 0 10px;
  font-size: 16px;
}
.reference-video {
  width: 100%;
  height: 220px;
  background: var(--mds-base-neutral-900);
  border-radius: 8px;
  margin: 12px 0 20px;
}
.profile-edit-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.profile-cues {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 18px;
}
.profile-cues span {
  background: var(--mds-brand-50);
  color: var(--mds-brand-600);
  border-radius: 20px;
  font-size: 11px;
  padding: 5px 9px;
}
.profile-director summary {
  cursor: pointer;
  font-weight: 600;
  font-size: 12px;
  margin: 20px 0 10px;
}
.observation {
  display: flex;
  gap: 12px;
  width: 100%;
  border: 0;
  border-bottom: 1px solid var(--mds-neutral-300);
  background: transparent;
  text-align: left;
  padding: 12px 0;
  cursor: pointer;
  font-size: 12px;
  line-height: 1.6;
}
.observation > b {
  font-family: monospace;
  color: var(--mds-brand-600);
}
.observation small {
  display: block;
  font-size: 9px;
  color: var(--mds-text-secondary);
  margin-bottom: 4px;
}
</style>
