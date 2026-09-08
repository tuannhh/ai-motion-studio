<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import CreateView from "../views/CreateView.vue";
import MButton from "../components/mds/MButton.vue";
import MTextarea from "../components/mds/MTextarea.vue";
import MIcon from "../components/mds/MIcon.vue";
import RemotionPreview from "./RemotionPreview.vue";
import { previewOf } from "./preview";
import demoPlan from "./demo-plan.json";
import { api } from "../lib/api";
import { entityPath } from "../lib/slug";
import "./studio.css";
const props = defineProps<{ editProjectId?: number | null }>();
const emit = defineEmits<{ created: [number] }>();
const router = useRouter();
const homeElement = ref<HTMLElement | null>(null);
const resetScroll = () =>
  homeElement.value?.closest("main")?.scrollTo({ top: 0 });
onMounted(resetScroll);
onActivated(resetScroll);
const step = ref(0),
  idea = ref(""),
  preset = ref("paper"),
  source = ref<"user" | "ai" | "combine">("combine"),
  projects = ref<any[]>([]),
  loadError = ref("");
const themes = [
  {
    id: "paper",
    name: "Paper editorial",
    tag: "KIẾN THỨC",
    copy: "Tối giản. Rõ ý. Có chiều sâu.",
    icon: "file-text",
  },
  {
    id: "midnight",
    name: "Midnight tech",
    tag: "CÔNG NGHỆ",
    copy: "Đồ họa sáng trên nền tối.",
    icon: "bolt",
  },
  {
    id: "noir",
    name: "Noir newsroom",
    tag: "TIN TỨC",
    copy: "Tư liệu, số liệu, điểm nhấn.",
    icon: "photo",
  },
  {
    id: "aurora",
    name: "Aurora creative",
    tag: "SÁNG TẠO",
    copy: "Nhịp điệu và màu sắc táo bạo.",
    icon: "sparkles",
  },
];
const demo = computed(
  () =>
    previewOf({
      ...demoPlan,
      preset: preset.value,
      studio: { ...demoPlan.studio, autoSfx: false },
    }).spec,
);
async function recent() {
  try {
    projects.value = (await api<any>("/v1/projects?limit=4")).items;
    loadError.value = "";
  } catch (e) {
    loadError.value = (e as Error).message;
  }
}
onMounted(recent);
onActivated(recent);
watch(
  () => props.editProjectId,
  () => {
    if (props.editProjectId) step.value = 1;
  },
);
</script>
<template>
  <div v-if="step === 1 || editProjectId" class="create-flow">
    <div class="create-flow-top">
      <MButton variant="ghost" @click="step = 0" v-if="!editProjectId"
        ><MIcon name="arrow-left" />Ý tưởng</MButton
      ><span
        >01 · Ý tưởng <i /> 02 · Thiết lập <i /> 03 · Kịch bản <i /> 04 · Bàn
        dựng</span
      >
    </div>
    <CreateView
      :edit-project-id="editProjectId"
      :initial-idea="idea"
      :initial-preset="preset"
      :initial-source-mode="source"
      @created="
        emit('created', $event);
        step = 0;
      "
    />
  </div>
  <div v-else ref="homeElement" class="create-studio">
    <div class="create-topline">
      <span>KHÔNG GIAN SÁNG TẠO</span
      ><span class="create-local"><i />MOTION STUDIO / NEXT</span>
    </div>
    <section class="create-hero">
      <div class="hero-copy">
        <div class="hero-kicker">BẠN KỂ CÂU CHUYỆN. AI TẠO CHUYỂN ĐỘNG.</div>
        <h1>Từ một ý tưởng.<br />Đến một video <em>có dấu ấn.</em></h1>
        <p>
          Viết điều bạn muốn kể. Chọn chất liệu, định hình phong cách.<br />Đạo
          diễn từng cảnh theo cách của bạn.
        </p>
        <div class="idea-composer">
          <MTextarea
            v-model="idea"
            :rows="3"
            :maxlength="2000"
            aria-label="Ý tưởng của bạn"
            placeholder="Bạn muốn kể câu chuyện gì? Ví dụ: Giải thích AI Agent cho người mới bắt đầu…"
          />
          <div class="composer-footer">
            <span
              ><MIcon name="photo" :size="16" />Tiếng Việt · 9:16 · Có thể sửa
              từng cảnh</span
            ><MButton
              variant="primary"
              :disabled="idea.trim().length < 10"
              @click="step = 1"
              >Bắt đầu sáng tạo <MIcon name="arrow-right"
            /></MButton>
          </div>
        </div>
        <div
          class="source-choices"
          role="radiogroup"
          aria-label="Nguồn nội dung"
        >
          <button
            v-for="m in [
              { id: 'user', label: 'Tư liệu của tôi', icon: 'file-text' },
              { id: 'ai', label: 'AI tìm kiếm', icon: 'search' },
              { id: 'combine', label: 'Kết hợp cả hai', icon: 'layers' },
            ]"
            :key="m.id"
            role="radio"
            :aria-checked="source === m.id"
            :class="{ active: source === m.id }"
            @click="source = m.id as any"
          >
            <MIcon :name="m.icon" :size="16" />{{ m.label
            }}<span v-if="source === m.id">✓</span>
          </button>
        </div>
        <div class="idea-examples">
          <span>Thử một ý tưởng</span
          ><button
            @click="
              idea =
                'Giải thích AI Agent cho người mới bắt đầu bằng các ví dụ đời thường, tránh thuật ngữ phức tạp.'
            "
          >
            AI Agent là gì? ↗</button
          ><button
            @click="
              idea =
                'Kể câu chuyện về hành trình từ hạt cà phê đến tách cà phê buổi sáng, giọng kể gần gũi và giàu hình ảnh.'
            "
          >
            Câu chuyện thương hiệu ↗
          </button>
        </div>
      </div>
      <div class="hero-showcase">
        <div class="showcase-note">
          <span>PHONG CÁCH ĐANG CHỌN</span
          ><b>{{ themes.find((t) => t.id === preset)?.name }}</b>
        </div>
        <div class="showcase-player">
          <RemotionPreview :spec="demo" :controls="true" />
        </div>
        <div class="showcase-caption">
          <span class="live-dot" />Xem chuyển động mẫu · sửa được từng cảnh
        </div>
      </div>
    </section>
    <section class="style-section">
      <div class="section-heading">
        <div>
          <span class="studio-eyebrow">01 / CHỌN NGÔN NGỮ HÌNH ẢNH</span>
          <h2>Câu chuyện của bạn, phong cách của bạn.</h2>
        </div>
        <MButton variant="ghost" @click="router.push('/video-template')"
          ><MIcon name="cloud-upload" />Học từ video của bạn
          <MIcon name="arrow-right"
        /></MButton>
      </div>
      <div class="style-grid">
        <button
          v-for="t in themes"
          :key="t.id"
          class="style-card"
          :class="{ active: preset === t.id }"
          @click="preset = t.id"
        >
          <div class="style-art" :data-style="t.id">
            <span>{{ t.tag }}</span
            ><template v-if="t.id === 'paper'"
              ><b>Ý tưởng nhỏ.<br /><em>Câu chuyện lớn.</em></b>
              <div class="paper-orbit"><i /><i /><i /></div></template
            ><template v-else-if="t.id === 'midnight'"
              ><div class="tech-flow">
                <i>Ý TƯỞNG</i><span>→</span><i>KỊCH BẢN</i><span>→</span
                ><i>VIDEO</i>
              </div>
              <b>Biến ý tưởng<br />thành chuyển động.</b></template
            ><template v-else-if="t.id === 'noir'"
              ><b>Phía sau<br /><em>những con số.</em></b>
              <div class="art-bars"><i /><i /><i /><i /><i /></div></template
            ><template v-else
              ><div class="aurora-rings"><i /><i /><i /></div>
              <b>Nghĩ khác.<br /><em>Kể khác.</em></b></template
            >
          </div>
          <div class="style-card-meta">
            <div>
              <b>{{ t.name }}</b>
              <p>{{ t.copy }}</p>
            </div>
            <span class="style-check">{{ preset === t.id ? "✓" : "+" }}</span>
          </div>
        </button>
      </div>
    </section>
    <section class="recent-section">
      <div class="section-heading">
        <div>
          <span class="studio-eyebrow">02 / TIẾP TỤC CÂU CHUYỆN</span>
          <h2>Dự án gần đây</h2>
        </div>
        <MButton variant="ghost" @click="router.push('/video-da-tao')"
          >Xem tất cả <MIcon name="arrow-right"
        /></MButton>
      </div>
      <p v-if="loadError">{{ loadError }}</p>
      <div class="recent-projects">
        <button
          v-for="p in projects"
          :key="p.id"
          @click="router.push(entityPath('video-da-tao', p.idea, p.public_id))"
        >
          <div class="recent-icon"><MIcon name="photo" :size="24" /></div>
          <div>
            <b>{{ p.idea }}</b>
            <p>
              {{ p.script_count }} kịch bản ·
              {{ p.preset_hint || "AI tự chọn" }} ·
              {{ new Date(p.created_at).toLocaleDateString("vi-VN") }}
            </p>
          </div>
          <MIcon name="arrow-right" />
        </button>
        <div v-if="!projects.length && !loadError" class="recent-empty">
          Video đầu tiên bắt đầu từ ý tưởng của bạn ở phía trên.
        </div>
      </div>
    </section>
  </div>
</template>
<style scoped>
.create-studio {
  padding: 26px 40px 40px;
  max-width: 1600px;
  width: 100%;
  margin: 0 auto;
}
.create-topline {
  display: flex;
  justify-content: space-between;
  color: var(--mds-text-secondary);
  font-size: 9px;
  letter-spacing: 1.5px;
}
.create-local {
  display: flex;
  gap: 6px;
  align-items: center;
}
.create-local i {
  width: 5px;
  height: 5px;
  background: var(--mds-success);
  border-radius: 50%;
}
.create-hero {
  display: grid;
  grid-template-columns: minmax(400px, 1fr) 280px;
  gap: 64px;
  margin: 32px 0 38px;
  align-items: center;
}
.hero-kicker {
  font-size: 9px;
  letter-spacing: 1.5px;
  color: var(--mds-brand-600);
  font-weight: 600;
}
.hero-copy h1 {
  font-size: 37px;
  font-weight: 650;
  line-height: 1.2;
  letter-spacing: -1.3px;
  margin: 18px 0;
}
.hero-copy h1 em {
  font-style: normal;
  color: var(--mds-brand-600);
}
.hero-copy > p {
  font-size: 12px;
  line-height: 1.9;
  color: var(--mds-text-secondary);
  margin-bottom: 24px;
}
.idea-composer {
  background: var(--mds-bg);
  box-shadow: var(--mds-shadow-card);
  border-radius: 8px;
  padding: 16px;
}
.idea-composer :deep(textarea) {
  border: 0;
  background: transparent;
  box-shadow: none;
  font-size: 13px;
  padding: 0;
  min-height: 84px;
}
.composer-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--mds-neutral-300);
}
.composer-footer > span {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 9px;
  color: var(--mds-text-secondary);
}
.source-choices {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}
.source-choices button {
  background: var(--mds-bg);
  padding: 9px 12px;
  font-size: 11px;
  border: 1px solid var(--mds-neutral-300);
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--mds-text-secondary);
  cursor: pointer;
}
.source-choices button.active {
  color: var(--mds-brand-600);
  border-color: var(--mds-brand-400);
  background: var(--mds-brand-50);
}
.idea-examples {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
  font-size: 10px;
}
.idea-examples > span {
  color: var(--mds-text-secondary);
}
.idea-examples > button {
  color: var(--mds-text-secondary);
  border: 0;
  background: none;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
.hero-showcase {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.showcase-note {
  align-self: flex-start;
  font-size: 9px;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  width: 100%;
  align-items: center;
}
.showcase-note > span {
  font-size: 8px;
  color: var(--mds-text-secondary);
  letter-spacing: 1px;
}
.showcase-note b {
  font-weight: 500;
}
.showcase-player {
  height: 350px;
  aspect-ratio: 9/16;
  border-radius: 8px;
  box-shadow: 0 15px 32px #0002;
  overflow: hidden;
}
.showcase-caption {
  font-size: 9px;
  color: var(--mds-text-secondary);
  margin-top: 16px;
}
.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
}
.section-heading h2 {
  font-size: 17px;
  letter-spacing: -0.3px;
  margin: 6px 0 0;
  font-weight: 600;
}
.style-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.style-card {
  background: var(--mds-bg);
  padding: 6px;
  border: 0;
  border-radius: 8px;
  text-align: left;
  box-shadow: var(--mds-shadow-card);
  cursor: pointer;
  transition: transform 0.2s;
}
.style-card:hover {
  transform: translateY(-3px);
}
.style-card.active {
  box-shadow: 0 0 0 2px var(--mds-brand-500);
}
.style-art {
  height: 144px;
  position: relative;
  overflow: hidden;
  border-radius: 5px;
  padding: 19px 17px;
}
.style-art > span {
  font: 7px monospace;
  letter-spacing: 1.5px;
  opacity: 0.7;
}
.style-art > b {
  font-size: 19px;
  line-height: 1.15;
  display: block;
  margin-top: 17px;
  letter-spacing: -0.5px;
}
.style-art em {
  font-style: normal;
}
.style-art[data-style="paper"] {
  background: #eeeade;
  color: #1b211d;
}
.style-art[data-style="paper"] em {
  color: #d95732;
}
.style-art[data-style="midnight"] {
  background: #082830;
  color: #e2f9f6;
}
.style-art[data-style="noir"] {
  background: #191719;
  color: #f1eeeb;
}
.style-art[data-style="noir"] em {
  color: #f26163;
}
.style-art[data-style="aurora"] {
  background: #153842;
  color: #c6fff3;
}
.paper-orbit {
  position: absolute;
  bottom: 20px;
  right: 14px;
  display: flex;
  gap: 3px;
  transform: rotate(-30deg);
}
.paper-orbit i {
  width: 19px;
  height: 19px;
  background: #d75d34;
  border-radius: 50%;
}
.paper-orbit i:first-child {
  background: #222;
}
.tech-flow {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 14px;
  color: #7ce8d9;
}
.tech-flow i {
  font: 6px monospace;
  border: 1px solid #7ce8d966;
  padding: 6px;
  font-style: normal;
  border-radius: 3px;
}
.tech-flow ~ b {
  font-size: 17px !important;
  margin-top: 12px !important;
}
.art-bars {
  display: flex;
  position: absolute;
  bottom: 16px;
  right: 14px;
  align-items: flex-end;
  gap: 3px;
}
.art-bars i {
  width: 10px;
  height: 24px;
  background: #f06b6a;
}
.art-bars i:nth-child(2) {
  height: 36px;
  opacity: 0.7;
}
.art-bars i:nth-child(3) {
  height: 49px;
}
.art-bars i:nth-child(4) {
  height: 31px;
  opacity: 0.6;
}
.art-bars i:nth-child(5) {
  height: 58px;
}
.aurora-rings {
  position: absolute;
  right: -10px;
  top: 14px;
  width: 130px;
  height: 130px;
}
.aurora-rings i {
  display: block;
  border: 1px solid #73e5ca88;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  position: absolute;
}
.aurora-rings i:nth-child(2) {
  transform: translateX(25px);
}
.aurora-rings i:nth-child(3) {
  transform: translateX(50px);
}
.style-art[data-style="aurora"] > b {
  position: relative;
}
.style-card-meta {
  padding: 12px 8px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.style-card-meta b {
  font-size: 12px;
  font-weight: 600;
}
.style-card-meta p {
  font-size: 9px;
  color: var(--mds-text-secondary);
  margin: 4px 0;
}
.style-check {
  font-size: 12px;
  width: 20px;
  height: 20px;
  border: 1px solid var(--mds-neutral-300);
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--mds-text-secondary);
}
.active .style-check {
  background: var(--mds-brand-600);
  border-color: var(--mds-brand-600);
  color: var(--mds-bg);
}
.recent-section {
  margin-top: 32px;
}
.recent-projects {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.recent-projects > button {
  background: var(--mds-bg);
  border: 0;
  border-radius: 8px;
  box-shadow: var(--mds-shadow-card);
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  text-align: left;
  cursor: pointer;
  min-width: 0;
}
.recent-projects > button > div:nth-child(2) {
  flex: 1;
  min-width: 0;
}
.recent-projects b {
  font-size: 12px;
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.recent-projects p {
  font-size: 10px;
  color: var(--mds-text-secondary);
  margin: 6px 0 0;
}
.recent-icon {
  background: var(--mds-brand-50);
  color: var(--mds-brand-600);
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 6px;
}
.recent-empty {
  padding: 25px;
  font-size: 12px;
  color: var(--mds-text-secondary);
}
.create-flow {
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}
.create-flow-top {
  height: 48px;
  display: flex;
  align-items: center;
  background: var(--mds-bg);
  padding: 0 24px;
  gap: 24px;
}
.create-flow-top > span {
  font-size: 11px;
  color: var(--mds-text-secondary);
  display: flex;
  align-items: center;
  gap: 12px;
}
.create-flow-top i {
  width: 20px;
  height: 1px;
  background: var(--mds-neutral-300);
}
@media (min-width: 1650px) {
  .create-hero {
    grid-template-columns: minmax(500px, 1fr) 350px;
  }
  .hero-copy h1 {
    font-size: 44px;
  }
  .showcase-player {
    height: 400px;
  }
  .style-art {
    height: 166px;
  }
}
</style>
