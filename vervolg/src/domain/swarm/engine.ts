// src/domain/swarm/engine.ts — §11.5
// ~150 lines of arithmetic. No language model is called anywhere: this is a
// dynamical system over a synthetic population, and the output is a
// frequency, not a forecast.
import { DIMS, type Dim } from "./archetypes";
import type { Persona } from "./personas";
import { clamp01, mulberry32, shuffle } from "./rng";

export interface EventEffect {
  [dim: string]: number;
}

export interface SwarmEvent {
  id: string;
  label_nl: string;
  detail_nl: string;
  effect: EventEffect;
}

/** §11.6 — nine plausible stories within a year. Three push the design back. */
export const EVENTS: SwarmEvent[] = [
  {
    id: "shutoff",
    label_nl: "Een gezin wordt afgesloten en het staat op de voorpagina",
    detail_nl: "De foto is van de slaapkamer van een kind.",
    effect: { trust: -0.08, voice: 0.1, metric: 0.06 },
  },
  {
    id: "grant",
    label_nl: "Het rijk stelt €200 mln extra beschikbaar voor energiearmoede",
    detail_nl: "Gemeenten moeten het binnen 18 maanden uitgeven.",
    effect: { payer: 0.12, adopt: 0.06 },
  },
  {
    id: "econobis",
    label_nl: "Econobis kondigt een spraaknotitie-functie aan",
    detail_nl: "De gevestigde partij beweegt naar dit terrein.",
    effect: { adopt: -0.1, payer: -0.04 },
  },
  {
    id: "leak",
    label_nl: "Een coach deelt per ongeluk een dossier met een corporatie",
    detail_nl: "Screenshot in een WhatsApp-groep van de buurt.",
    effect: { voice: -0.14, trust: -0.1, queue: -0.08 },
  },
  {
    id: "success",
    label_nl: "Dordrecht publiceert opnieuw een daling: 5,1% → 4,4%",
    detail_nl: "Het model wordt opnieuw publiek bewezen.",
    effect: { metric: 0.1, payer: 0.08, trust: 0.05 },
  },
  {
    id: "waitlist",
    label_nl: "De wachtlijst voor de warmtetransitie groeit naar twee jaar",
    detail_nl: "Isolatiecapaciteit is de bottleneck, niet geld.",
    effect: { metric: -0.08, voice: 0.04 },
  },
  {
    id: "fraud",
    label_nl: "De gemeente kondigt fraudecontroles aan bij de energietoeslag",
    detail_nl: 'Gebracht als "eerlijk voor iedereen".',
    effect: { trust: -0.16, voice: -0.06, adopt: -0.05 },
  },
  {
    id: "dutch",
    label_nl: "De gemeente zet alle brieven om naar B1-niveau",
    detail_nl: "Een klein ding dat de bereikbaarheid verandert.",
    effect: { trust: 0.08, voice: 0.04 },
  },
  {
    id: "coachcut",
    label_nl: "De gemeente schrapt de helft van de coachuren",
    detail_nl: "De caseload verdubbelt van de ene dag op de andere.",
    effect: { adopt: 0.12, queue: 0.08, payer: -0.06 },
  },
];

export type Opinions = Record<Dim, number>[];

export interface Snapshot {
  round: number;
  event: string | null;
  eventId: string | null;
  means: Record<Dim, number>;
  support: Record<Dim, number>;
  camps: Record<Dim, { left: number; right: number; swing: number }>;
  seen: number[]; // per-agent: rounds of exposure to at least one event
}

export interface RunResult {
  seed: number;
  rounds: number;
  dims: Dim[];
  archetypes: string[];
  /** [round][agent] → stance on the selected dimension is derived by the UI */
  snapshots: Snapshot[];
  final: Record<Dim, number>;
  support: Record<Dim, number>;
  initial: Opinions;
  finalOpinions: Opinions;
  changed: number[];
  events: { round: number; id: string; label_nl: string }[];
  /** QSCANDAL needs to know whether `leak` was fired */
  fired: string[];
  degrees: number[];
  /** neighbour ids per agent, for the "why did this agent change" card */
  neighbours: number[][];
}

export interface RunOptions {
  rounds?: number;
  mixing?: number;
  pressure?: number;
  seed?: number;
  minEvents?: number;
  inject?: { round: number; id: string } | null;
  /** skip event planning entirely (used by the report's control runs) */
  noEvents?: boolean;
}

function neighboursOf(personas: Persona[], degree: number, mixing: number, rnd: () => number): number[][] {
  const n = personas.length;
  const byArch = new Map<string, number[]>();
  personas.forEach((p, i) => {
    const list = byArch.get(p.archetype) ?? [];
    list.push(i);
    byArch.set(p.archetype, list);
  });

  const local = Math.round(degree * (1 - mixing));
  const remote = degree - local;
  const sets: Set<number>[] = Array.from({ length: n }, () => new Set<number>());

  for (let i = 0; i < n; i++) {
    const peers = (byArch.get(personas[i].archetype) ?? []).filter((j) => j !== i);
    const picked = shuffle(peers, rnd).slice(0, Math.max(0, local));
    for (const j of picked) sets[i].add(j);
    for (let r = 0; r < remote; r++) {
      const j = Math.floor(rnd() * n);
      if (j !== i) sets[i].add(j);
    }
  }
  return sets.map((s) => [...s]);
}

export function runSwarm(personas: Persona[], opts: RunOptions = {}): RunResult {
  const rounds = opts.rounds ?? 24;
  const mixing = opts.mixing ?? 0.18;
  const pressure = opts.pressure ?? 1;
  const seed = opts.seed ?? 20261111;
  const minEvents = opts.minEvents ?? 3;
  const rnd = mulberry32(seed);
  const n = personas.length;

  // --- event plan: exactly minEvents, no story twice, Fisher–Yates only ---
  const eligible: number[] = [];
  for (let r = 3; r <= rounds - 2; r++) eligible.push(r);
  const planned: { round: number; ev: SwarmEvent }[] = [];
  if (!opts.noEvents) {
    const shuffledRounds = shuffle(eligible, rnd);
    const shuffledEvents = shuffle(EVENTS, rnd);
    for (let i = 0; i < Math.min(minEvents, shuffledEvents.length, shuffledRounds.length); i++) {
      planned.push({ round: shuffledRounds[i], ev: shuffledEvents[i] });
    }
  }
  if (opts.inject) {
    const ev = EVENTS.find((e) => e.id === opts.inject!.id);
    if (ev) {
      const filtered = planned.filter((p) => p.ev.id !== ev.id);
      filtered.push({ round: opts.inject.round, ev });
      // the plan never grows past minEvents: an injected story REPLACES one
      const trimmed = filtered.sort((a, b) => a.round - b.round).slice(0, Math.max(1, minEvents));
      planned.length = 0;
      planned.push(...trimmed);
    }
  }

  // --- graph: without weak ties this is nine rooms, not one society ---
  const neighbours = neighboursOf(personas, 7, mixing, rnd);

  // --- start spread, not in nine blocks ---
  const opinion: Opinions = personas.map((p) => {
    const o = {} as Record<Dim, number>;
    for (const d of DIMS) o[d] = clamp01(p.priors[d] + (rnd() - 0.5) * 0.18);
    return o;
  });
  const initial: Opinions = opinion.map((o) => ({ ...o }));
  const seen = new Array<number>(n).fill(-1); // round of first exposure, -1 = never

  const snapshot = (round: number, event: string | null, eventId: string | null): Snapshot => {
    const means = {} as Record<Dim, number>;
    const support = {} as Record<Dim, number>;
    const camps = {} as Record<Dim, { left: number; right: number; swing: number }>;
    for (const d of DIMS) {
      let sum = 0;
      let sup = 0;
      let left = 0;
      let right = 0;
      for (let i = 0; i < n; i++) {
        const v = opinion[i][d];
        sum += v;
        if (v >= 0.5) sup++;
        if (v < 0.42) left++;
        else if (v > 0.58) right++;
      }
      means[d] = sum / n;
      support[d] = sup / n;
      camps[d] = { left, right, swing: n - left - right };
    }
    return {
      round,
      event,
      eventId,
      means,
      support,
      camps,
      seen: seen.map((s) => (s < 0 ? 0 : round - s + 1)),
    };
  };

  const snapshots: Snapshot[] = [snapshot(0, null, null)];
  const fired: string[] = [];

  for (let round = 1; round <= rounds; round++) {
    const order = shuffle(
      Array.from({ length: n }, (_, i) => i),
      rnd,
    );
    for (const i of order) {
      const nbrs = neighbours[i];
      if (nbrs.length === 0) continue;
      const j = nbrs[Math.floor(rnd() * nbrs.length)];
      const speaker = personas[j];
      const listener = personas[i];
      for (const d of DIMS) {
        const gap = opinion[j][d] - opinion[i][d];
        if (Math.abs(gap) < 1e-4) continue;
        const likeness = 1 - Math.min(1, Math.abs(gap) * 1.4);
        const influence = (0.35 + 0.65 * speaker.behav.voice) * (0.4 + 0.6 * likeness);
        const openness = listener.behav.susceptibility * (1 - 0.75 * listener.behav.conviction);
        let move = gap * influence * openness * 0.42 * pressure;
        // backfire: a fixed listener pushed far away moves the wrong way
        if (Math.abs(gap) > 0.45 && listener.behav.conviction > 0.6 && rnd() < 0.5) {
          move = -Math.sign(gap) * Math.abs(gap) * 0.1 * pressure;
        }
        opinion[i][d] = clamp01(opinion[i][d] + move);
      }
    }

    let eventLabel: string | null = null;
    let eventId: string | null = null;
    for (const p of planned) {
      if (p.round !== round) continue;
      eventLabel = p.ev.label_nl;
      eventId = p.ev.id;
      fired.push(p.ev.id);
      for (const [dim, effect] of Object.entries(p.ev.effect)) {
        for (let i = 0; i < n; i++) {
          opinion[i][dim as Dim] = clamp01(opinion[i][dim as Dim] + effect * (0.6 + 0.8 * rnd()));
        }
      }
      for (let i = 0; i < n; i++) if (seen[i] < 0) seen[i] = round;
    }
    snapshots.push(snapshot(round, eventLabel, eventId));
  }

  const finalMeans = {} as Record<Dim, number>;
  const support = {} as Record<Dim, number>;
  for (const d of DIMS) {
    let sum = 0;
    let sup = 0;
    for (let i = 0; i < n; i++) {
      sum += opinion[i][d];
      if (opinion[i][d] >= 0.5) sup++;
    }
    finalMeans[d] = sum / n;
    support[d] = sup / n;
  }

  const changed = opinion.map((o, i) => {
    let acc = 0;
    for (const d of DIMS) acc += Math.abs(o[d] - initial[i][d]);
    return acc / DIMS.length;
  });

  return {
    seed,
    rounds,
    dims: [...DIMS],
    archetypes: personas.map((p) => p.archetype),
    snapshots,
    final: finalMeans,
    support,
    initial,
    finalOpinions: opinion,
    changed,
    events: planned.map((p) => ({ round: p.round, id: p.ev.id, label_nl: p.ev.label_nl })),
    fired,
    degrees: neighbours.map((x) => x.length),
    neighbours,
  };
}
