// src/domain/swarm/personas.ts — §11.4
// Deterministic personas. Every agent is synthetic: true and every name is
// drawn from a fixed list. No real household, coach or programme manager is
// represented — the UI prints SYNTHETISCH on every profile card.
import {
  ARCH,
  ARCH_ORDER,
  HOODS,
  INITIALS,
  LABEL_BY_ARCH,
  LANG_BY_ARCH,
  NAMES_MIG,
  NAMES_NL,
  SITUATIONS,
  TENURE_BY_ARCH,
  quotas,
  type ArchetypeKey,
  type Dim,
} from "./archetypes";
import { mulberry32 } from "./rng";

export interface Persona {
  id: string;
  name_nl: string;
  archetype: ArchetypeKey;
  archetype_nl: string;
  age: number;
  hood: string;
  tenure: string;
  label: string;
  lang: string;
  situation: string;
  synthetic: true;
  priors: Record<Dim, number>;
  behav: { voice: number; susceptibility: number; conviction: number };
}

export const PERSONA_SEED = 20261111;

function pick<T>(arr: T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length) % arr.length];
}

function jitter(rnd: () => number, amount: number): number {
  return (rnd() - 0.5) * 2 * amount;
}

function clamp(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function buildPersonas(n = 240, seed = PERSONA_SEED): Persona[] {
  const rnd = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const q = quotas();
  const out: Persona[] = [];
  let index = 0;

  for (const key of ARCH_ORDER) {
    const a = ARCH[key];
    const k = q[key];
    for (let i = 0; i < k && out.length < n; i++) {
      const pool = key === "hh_mig" ? NAMES_MIG : NAMES_NL;
      const surname = pick(pool, rnd);
      const initial = pick(INITIALS, rnd);
      const [ageLo, ageHi] = a.age;
      const age = ageLo + Math.floor(rnd() * (ageHi - ageLo + 1));
      const priors = {} as Record<Dim, number>;
      for (const d of ["voice", "metric", "payer", "adopt", "trust", "queue"] as Dim[]) {
        priors[d] = clamp(a.priors[d] + jitter(rnd, 0.04));
      }
      out.push({
        id: `A-${String(index + 1).padStart(3, "0")}`,
        name_nl: `${surname} ${initial}.`,
        archetype: key,
        archetype_nl: a.label_nl,
        age,
        hood: pick(HOODS, rnd),
        tenure: pick(TENURE_BY_ARCH[key], rnd),
        label: pick(LABEL_BY_ARCH[key], rnd),
        lang: pick(LANG_BY_ARCH[key], rnd),
        situation: a.household ? pick(SITUATIONS, rnd) : "professional",
        synthetic: true,
        priors,
        behav: {
          voice: clamp(a.behav.voice + jitter(rnd, 0.05)),
          susceptibility: clamp(a.behav.susceptibility + jitter(rnd, 0.05)),
          conviction: clamp(a.behav.conviction + jitter(rnd, 0.05)),
        },
      });
      index++;
    }
  }
  if (out.length !== n) throw new Error(`buildPersonas: expected ${n} agents, built ${out.length}`);
  return out;
}

/** 62% F/G among hh_* — assertable, and printed on the archetype table. */
export function labelShareFG(personas: Persona[]): number {
  const hh = personas.filter((p) => p.archetype.startsWith("hh_"));
  if (hh.length === 0) return 0;
  return hh.filter((p) => p.label === "F" || p.label === "G").length / hh.length;
}
