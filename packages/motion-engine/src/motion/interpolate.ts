import type { MotionNode } from "./schema";
const clamp = (t: number) => Math.max(0, Math.min(1, t));
export function ease(t: number, name: string) {
  t = clamp(t);
  if (name === "step") return t < 1 ? 0 : 1;
  if (name === "linear") return t;
  if (name === "ease-in") return t * t * t;
  if (name === "ease-in-out")
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  if (name === "back") {
    const c = 1.70158;
    return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
  }
  return 1 - Math.pow(1 - t, 3);
}
export function nodeValue(
  node: MotionNode,
  key: string,
  time: number,
  fallback: number | string,
): number | string {
  const frames = node.keyframes.filter((k) => (k as any)[key] !== undefined);
  let prev = { at: 0, value: (node as any)[key] ?? fallback };
  for (const k of frames) {
    const next = (k as any)[key];
    if (time < k.at) {
      const t = ease((time - prev.at) / (k.at - prev.at), k.easing);
      if (typeof next === "number")
        return Number(prev.value) + (next - Number(prev.value)) * t;
      if (
        /^#[0-9a-f]{6}$/i.test(next) &&
        /^#[0-9a-f]{6}$/i.test(String(prev.value))
      ) {
        return (
          "#" +
          [1, 3, 5]
            .map((i) =>
              Math.round(
                parseInt(String(prev.value).slice(i, i + 2), 16) +
                  (parseInt(next.slice(i, i + 2), 16) -
                    parseInt(String(prev.value).slice(i, i + 2), 16)) *
                    clamp(t),
              )
                .toString(16)
                .padStart(2, "0"),
            )
            .join("")
        );
      }
      return prev.value;
    }
    prev = { at: k.at, value: next };
  }
  return prev.value;
}
