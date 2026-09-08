<script setup lang="ts">
import { computed } from "vue";
import type { MotionDocument } from "@ams/motion-engine/src/motion/schema";
import MButton from "../components/mds/MButton.vue";
import MInput from "../components/mds/MInput.vue";
import MTextarea from "../components/mds/MTextarea.vue";
import MSelect from "../components/mds/MSelect.vue";
const props = defineProps<{
  document: MotionDocument;
  selected: string;
  frame: number;
  disabled?: boolean;
  canAddKey?: boolean;
}>();
const emit = defineEmits<{ select: [string]; seek: [number]; addKey: [] }>();
const node = computed(() =>
  props.document.nodes.find((n) => n.id === props.selected),
);
const easing = [
  "linear",
  "ease-in",
  "ease-out",
  "ease-in-out",
  "back",
  "step",
].map((value) => ({
  value,
  label: (
    {
      linear: "Đều",
      "ease-in": "Tăng tốc",
      "ease-out": "Giảm tốc",
      "ease-in-out": "Mượt hai đầu",
      back: "Nảy",
      step: "Cắt tức thì",
    } as any
  )[value],
}));
</script>
<template>
  <div class="motion-layers">
    <label>Đối tượng · {{ document.nodes.length }} lớp</label>
    <div class="layer-list" role="list" aria-label="Các lớp chuyển động">
      <button
        v-for="n in document.nodes"
        :key="n.id"
        :class="{ chosen: n.id === selected }"
        @click="emit('select', n.id)"
      >
        <span>{{ n.parent ? "↳ " : "" }}{{ n.name }}</span
        ><small>{{ n.kind }} · {{ n.keyframes.length }} mốc</small>
      </button>
    </div>
    <div v-if="node" class="motion-fields">
      <label>Tên lớp<MInput v-model="node.name" :disabled="disabled" /></label>
      <label v-for="(span, si) in node.spans" :key="si"
        >Đoạn chữ {{ si + 1
        }}<MInput v-model="span.text" :disabled="disabled" /><MInput
          v-model="span.fill"
          :disabled="disabled"
      /></label>
      <label v-if="node.kind === 'text' && !node.spans?.length"
        >Chữ trên hình<MTextarea
          v-model="node.text"
          :disabled="disabled"
          :rows="3"
      /></label>
      <div class="motion-grid">
        <label
          >X<MInput
            v-model="node.x"
            type="number"
            :disabled="disabled" /></label
        ><label
          >Y<MInput
            v-model="node.y"
            type="number"
            :disabled="disabled" /></label
        ><label
          >Màu nền<MInput v-model="node.fill" :disabled="disabled" /></label
        ><label
          >Màu nét<MInput v-model="node.stroke" :disabled="disabled" /></label
        ><label
          >Rộng<MInput
            v-model="node.width"
            type="number"
            :disabled="disabled" /></label
        ><label
          >Cao<MInput
            v-model="node.height"
            type="number"
            :disabled="disabled" /></label
        ><label v-if="node.kind === 'text'"
          >Cỡ chữ<MInput
            v-model="node.fontSize"
            type="number"
            :disabled="disabled" /></label
        ><label
          >Hiện từ (giây)<MInput
            v-model="node.start"
            type="number"
            :disabled="disabled"
        /></label>
      </div>
      <label v-if="node.kind === 'path'"
        >Đường vẽ SVG<MTextarea
          v-model="node.path"
          :disabled="disabled"
          :rows="3"
      /></label>
      <label v-if="node.followPath"
        >Đường di chuyển<MTextarea
          v-model="node.followPath"
          :disabled="disabled"
          :rows="3"
      /></label>
      <div class="motion-inline">
        <b>Mốc chuyển động</b
        ><MButton
          v-if="canAddKey !== false"
          :disabled="disabled"
          @click="emit('addKey')"
          >+ {{ (frame / 30).toFixed(2) }}s</MButton
        >
      </div>
      <details v-for="(k, i) in node.keyframes" :key="i" class="keyframe">
        <summary @click="emit('seek', k.at)">
          {{ k.at.toFixed(2) }}s ·
          {{
            Object.keys(k)
              .filter((v) => !["at", "easing"].includes(v))
              .join(", ")
          }}
        </summary>
        <div class="motion-grid">
          <label
            >Thời điểm<MInput
              v-model="k.at"
              type="number"
              :disabled="disabled" /></label
          ><label
            >Nhịp<MSelect
              v-model="k.easing"
              :options="easing"
              :disabled="disabled" /></label
          ><label
            v-for="key in [
              'x',
              'y',
              'scale',
              'rotation',
              'rotateX',
              'rotateY',
              'opacity',
              'draw',
              'progress',
              'reveal',
              'blur',
            ] as const"
            :key="key"
            >{{ key
            }}<MInput
              :model-value="k[key] ?? ''"
              type="number"
              :disabled="disabled"
              @update:model-value="
                (v) => (v === '' ? delete k[key] : (k[key] = Number(v)))
              "
          /></label>
        </div>
        <MButton :disabled="disabled" @click="node.keyframes.splice(i, 1)"
          >Xoá mốc này</MButton
        >
      </details>
    </div>
  </div>
</template>
