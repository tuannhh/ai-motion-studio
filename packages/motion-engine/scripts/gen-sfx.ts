/**
 * Sinh bộ SFX license-free bằng DSP thuần (không sample bên ngoài) — chạy 1 lần:
 *   pnpm --filter @ams/motion-engine exec tsx scripts/gen-sfx.ts
 * Ghi WAV 48kHz mono 16-bit vào assets/sfx/. PRNG seed cố định → tái tạo y hệt.
 * Thiết kế theo remotion-skill: whoosh cho chuyển cảnh, thump cho số liệu lớn,
 * pop cho điểm nhấn, tick cho nhịp phụ.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SR = 48000;
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets/sfx");
fs.mkdirSync(outDir, { recursive: true });

/** PRNG mulberry32 — deterministic, không dùng Math.random */
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const writeWav = (name: string, samples: Float64Array) => {
  // normalize về đỉnh 0.8 rồi đóng gói PCM16 + header RIFF
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const gain = peak > 0 ? 0.8 / peak : 0;
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i] * gain)) * 32767), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(outDir, name), Buffer.concat([h, data]));
  console.log(`✅ ${name} (${(samples.length / SR).toFixed(2)}s)`);
};

/** Whoosh: noise qua lọc one-pole có cutoff quét lên rồi xuống + envelope sin^1.5 */
const whoosh = (seed: number, dur = 0.5): Float64Array => {
  const n = Math.round(SR * dur);
  const out = new Float64Array(n);
  const rand = rng(seed);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const cutoff = 0.03 + 0.4 * Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 2;
    lp += cutoff * ((rand() * 2 - 1) - lp);
    out[i] = lp * Math.sin(Math.PI * t) ** 1.5;
  }
  return out;
};

/** Thump: sine trầm quét 105→42Hz, decay mũ, soft-clip nhẹ cho ấm */
const thump = (): Float64Array => {
  const n = Math.round(SR * 0.35);
  const out = new Float64Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const freq = 105 * Math.exp(-t * 4) + 42;
    phase += (2 * Math.PI * freq) / SR;
    out[i] = Math.tanh(Math.sin(phase) * 1.6) * Math.exp(-t * 11);
  }
  return out;
};

/** Pop: sine 880→440Hz burst rất ngắn, decay nhanh */
const pop = (): Float64Array => {
  const n = Math.round(SR * 0.16);
  const out = new Float64Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    phase += (2 * Math.PI * (880 * Math.exp(-t * 14) + 440)) / SR;
    out[i] = Math.sin(phase) * Math.exp(-t * 34);
  }
  return out;
};

/** Tick: click noise highpass cực ngắn (x - lowpass(x)) */
const tick = (): Float64Array => {
  const n = Math.round(SR * 0.05);
  const out = new Float64Array(n);
  const rand = rng(1234);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const x = rand() * 2 - 1;
    lp += 0.08 * (x - lp);
    out[i] = (x - lp) * Math.exp(-(i / SR) * 180);
  }
  return out;
};

/**
 * Ding ("ting"): chuông sáng — 3 partial phi điều hòa (bell-like) đánh cùng lúc,
 * attack tức thì, decay mượt ~0.6s. Dùng cho khoảnh khắc nhấn/chốt (số liệu,
 * cụm accent) — âm sắc khác hẳn whoosh/thump/pop để bộ SFX đa dạng.
 */
const ding = (): Float64Array => {
  const n = Math.round(SR * 0.6);
  const out = new Float64Array(n);
  const partials = [
    { f: 1244, a: 1.0, d: 5.5 }, // fundamental (~D#6)
    { f: 2489, a: 0.5, d: 7.5 }, // octave
    { f: 3733, a: 0.28, d: 9.5 }, // inharmonic overtone → chất chuông
  ];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let s = 0;
    for (const p of partials) s += p.a * Math.sin(2 * Math.PI * p.f * t) * Math.exp(-t * p.d);
    // attack ngắn 4ms để không click
    out[i] = s * Math.min(1, t / 0.004);
  }
  return out;
};

writeWav("whoosh-a.wav", whoosh(42));
writeWav("whoosh-b.wav", whoosh(777, 0.42));
writeWav("thump.wav", thump());
writeWav("pop.wav", pop());
writeWav("tick.wav", tick());
writeWav("ding.wav", ding());
