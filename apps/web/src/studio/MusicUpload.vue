<script setup lang="ts">
import { ref } from "vue";
import MButton from "../components/mds/MButton.vue";
import MIcon from "../components/mds/MIcon.vue";
import { apiForm } from "../lib/api";
import { useToast } from "../components/mds/toast.js";
const emit = defineEmits<{ uploaded: [number] }>();
const picker = ref<HTMLInputElement | null>(null),
  busy = ref(false);
const toast = useToast();
async function upload(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 20 * 1024 * 1024) {
    toast.error("Nhạc nền tối đa 20 MB.");
    input.value = "";
    return;
  }
  busy.value = true;
  try {
    const form = new FormData();
    form.append("file", file);
    form.append("name", file.name.replace(/\.[^.]+$/, "").slice(0, 80));
    const result = await apiForm<{ id: number }>("/v1/music", form);
    emit("uploaded", result.id);
    toast.success("Đã tải lên và chọn nhạc nền.");
  } catch (e) {
    toast.error((e as Error).message);
  } finally {
    busy.value = false;
    input.value = "";
  }
}
</script>
<template>
  <div style="margin-top: 8px">
    <input
      ref="picker"
      type="file"
      accept=".mp3,.wav,.m4a,.aac,.ogg"
      hidden
      @change="upload"
    /><MButton :loading="busy" @click="picker?.click()"
      ><MIcon name="upload" />Tải nhạc của bạn</MButton
    ><small
      style="display: block; margin-top: 4px; color: var(--mds-text-secondary)"
      >MP3, WAV, M4A, OGG · Tối đa 20 MB</small
    >
  </div>
</template>
