// src/domain/swarm/rng.ts — §11.5 / §11.7
// mulberry32, Wilson interval, quantile. No dependencies, no crypto, no model.

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates. The spec forbids `sort(() => rnd() - 0.5)`, rightly. */
export function shuffle<T>(arr: readonly T[], rnd: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function sd(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

/** Linear-interpolated quantile over a sorted copy. q in [0,1]. */
export function quantile(xs: number[], q: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return s[lo];
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export interface Interval {
  lo: number;
  hi: number;
  p: number;
  n: number;
}

/** 95% Wilson score interval. Every frequency in the report carries one. */
export function wilson(p: number, n: number, z = 1.959964): Interval {
  if (n === 0) return { lo: 0, hi: 0, p: 0, n: 0 };
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const s = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return { lo: Math.max(0, (c - s) / d), hi: Math.min(1, (c + s) / d), p, n };
}

/** Bucketed histogram at `step` width; last bucket is inclusive of 1.0. */
export function histogram(xs: number[], step = 0.05): { from: number; to: number; n: number }[] {
  const buckets: { from: number; to: number; n: number }[] = [];
  const count = Math.round(1 / step);
  for (let i = 0; i < count; i++) {
    const from = Number((i * step).toFixed(6));
    const to = Number(((i + 1) * step).toFixed(6));
    buckets.push({ from, to, n: 0 });
  }
  for (const x of xs) {
    const idx = Math.min(count - 1, Math.max(0, Math.floor(x / step)));
    buckets[idx].n++;
  }
  return buckets;
}

export function hashCode(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
