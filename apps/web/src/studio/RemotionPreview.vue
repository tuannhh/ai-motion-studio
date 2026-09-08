<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, toRaw } from "vue";
import React from "react";
import { createRoot, type Root } from "react-dom/client";
import { Player, type PlayerRef } from "@remotion/player";
import { Video } from "@ams/motion-engine/src/Video";
import {
  totalDurationInFrames,
  type VideoSpec,
} from "@ams/motion-engine/src/schema/spec";
const props = defineProps<{
  spec: VideoSpec;
  seek?: number;
  autoplay?: boolean;
  controls?: boolean;
}>();
const emit = defineEmits<{ frame: [number]; error: [string] }>();
const host = ref<HTMLElement | null>(null);
let root: Root | null = null;
let player: PlayerRef | null = null;
const onFrame = ({ detail }: any) => emit("frame", detail.frame);
function mountPlayer(p: PlayerRef | null) {
  if (player) player.removeEventListener("frameupdate", onFrame);
  player = p;
  if (player) player.addEventListener("frameupdate", onFrame);
}
function render() {
  if (!root) return;
  const spec = JSON.parse(JSON.stringify(toRaw(props.spec)));
  root.render(
    React.createElement(Player as React.ComponentType<any>, {
      ref: mountPlayer,
      component: Video,
      inputProps: { spec },
      durationInFrames: totalDurationInFrames(spec),
      compositionWidth: 1080,
      compositionHeight: 1920,
      fps: 30,
      controls: props.controls !== false,
      spaceKeyToPlayOrPause: false,
      autoPlay: props.autoplay ?? false,
      loop: true,
      initialFrame: props.seek ?? 30,
      showVolumeControls: true,
      style: { width: "100%", height: "100%" },
      errorFallback: ({ error }: any) =>
        React.createElement(
          "div",
          {
            style: {
              padding: 24,
              color: "white",
              background: "#111",
              height: "100%",
            },
          },
          "Không thể xem trước: " + error.message,
        ),
    }),
  );
}
onMounted(() => {
  if (host.value) root = createRoot(host.value);
  render();
});
watch(() => props.spec, render, { deep: true });
watch(
  () => props.seek,
  (f) => {
    if (f !== undefined)
      player?.seekTo(Math.min(f, totalDurationInFrames(props.spec) - 1));
  },
);
onBeforeUnmount(() => {
  root?.unmount();
  root = null;
});
defineExpose({
  seekTo: (frame: number) => player?.seekTo(frame),
  play: () => player?.play(),
  pause: () => player?.pause(),
  toggle: () => (player?.isPlaying() ? player.pause() : player?.play()),
});
</script>
<template>
  <div ref="host" class="remotion-preview" aria-label="Xem trước video" />
</template>
<style scoped>
.remotion-preview {
  height: 100%;
  width: 100%;
  aspect-ratio: 9/16;
  overflow: hidden;
  border-radius: 8px;
  background: var(--mds-base-neutral-900);
}
</style>
