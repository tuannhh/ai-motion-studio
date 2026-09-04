<script setup lang="ts">
/**
 * Form sửa "chữ trên hình" (khác lời thoại TTS) cho 1 scene — sinh động theo
 * loại scene từ SCENE_FIELD_DESCRIPTORS. Mutate trực tiếp `content` (object
 * lồng bên trong script.scenes[] mà ProjectsView sở hữu) — không emit event
 * riêng, cùng cách ProjectsView đang v-model="sc.narration" ngay trên object
 * của nó.
 */
import MInput from "./mds/MInput.vue";
import MTextarea from "./mds/MTextarea.vue";
import { SCENE_FIELD_DESCRIPTORS, type FieldDescriptor } from "../lib/sceneFields";

const props = defineProps<{
  sceneType: string;
  content: Record<string, unknown>;
  /** dùng khi đệ quy vào group lồng (compare/versus left/right) — bỏ qua tra cứu theo sceneType */
  fieldsOverride?: FieldDescriptor[];
}>();

const fields = props.fieldsOverride ?? SCENE_FIELD_DESCRIPTORS[props.sceneType] ?? [];

function stringAt(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  return typeof v === "string" ? v : "";
}

function ensureList(obj: Record<string, unknown>, key: string): Record<string, unknown>[] {
  if (!Array.isArray(obj[key])) obj[key] = [];
  return obj[key] as Record<string, unknown>[];
}

function ensureStringList(obj: Record<string, unknown>, key: string): string[] {
  if (!Array.isArray(obj[key])) obj[key] = [];
  return obj[key] as string[];
}

function ensureGroup(obj: Record<string, unknown>, key: string): Record<string, unknown> {
  if (!obj[key] || typeof obj[key] !== "object") obj[key] = {};
  return obj[key] as Record<string, unknown>;
}

function setPlain(obj: Record<string, unknown>, key: string, value: string): void {
  obj[key] = value;
}
</script>

<template>
  <div class="space-y-3">
    <template v-for="f in fields" :key="f.key">
      <!-- text / textarea đơn -->
      <label v-if="f.kind === 'text'" class="block text-[13px] font-medium">
        {{ f.label }}
        <MInput
          class="mt-1"
          :model-value="stringAt(content, f.key)"
          @update:model-value="(v: string) => setPlain(content, f.key, v)"
        />
      </label>
      <label v-else-if="f.kind === 'textarea'" class="block text-[13px] font-medium">
        {{ f.label }}
        <MTextarea
          class="mt-1"
          :rows="2"
          :model-value="stringAt(content, f.key)"
          @update:model-value="(v: string) => setPlain(content, f.key, v)"
        />
      </label>

      <!-- mảng chuỗi thuần (vd compare.left.points) -->
      <div v-else-if="f.kind === 'stringlist'">
        <p class="m-0 mb-1 text-[13px] font-medium">{{ f.label }}</p>
        <div class="space-y-1.5">
          <MInput
            v-for="(_, i) in ensureStringList(content, f.key)"
            :key="i"
            :model-value="ensureStringList(content, f.key)[i]"
            :placeholder="f.itemLabel(i)"
            @update:model-value="(v: string) => (ensureStringList(content, f.key)[i] = v)"
          />
        </div>
      </div>

      <!-- mảng object (vd points.items[].text, timeline.steps[].{time,label,desc}) -->
      <div v-else-if="f.kind === 'list'">
        <p class="m-0 mb-1 text-[13px] font-medium">{{ f.label }}</p>
        <div class="space-y-2">
          <div
            v-for="(item, i) in ensureList(content, f.key)"
            :key="i"
            class="rounded-md border border-[var(--mds-border-light)] p-2"
          >
            <p class="m-0 mb-1.5 text-xs font-medium text-[var(--mds-text-secondary)]">{{ f.itemLabel(i) }}</p>
            <div class="space-y-1.5">
              <MInput
                v-for="sub in f.subfields"
                :key="sub.key"
                :model-value="stringAt(item, sub.key)"
                :placeholder="sub.label"
                @update:model-value="(v: string) => setPlain(item, sub.key, v)"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- nhóm object lồng (compare/versus left/right) -->
      <div v-else-if="f.kind === 'group'" class="rounded-md border border-[var(--mds-border-light)] p-2.5">
        <p class="m-0 mb-2 text-[13px] font-semibold">{{ f.label }}</p>
        <SceneContentEditor
          scene-type=""
          :content="ensureGroup(content, f.key)"
          :fields-override="f.fields"
        />
      </div>
    </template>
  </div>
</template>
