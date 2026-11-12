// src/domain/swarm/ensemble.ts — §11.7
// 200 seeds → six frequencies, each reported with n and a 95% Wilson interval.
// Never a bare percentage.
import { DIMS, isHousehold, type ArchetypeKey, type Dim } from "./archetypes";
import { runSwarm, type RunOptions, type RunResult } from "./engine";
import type { Persona } from "./personas";
import { histogram, mean, quantile, sd, wilson, type Interval } from "./rng";
import { answerInstrument, type InstrumentAnswer } from "./instrument";

export const BASE_SEED = 20261111;

export interface NamedTest {
  id: "QVOICE" | "QMETRIC" | "QPAYER" | "QADOPT" | "QTRUST" | "QSCANDAL" | "QSORT";
  question_nl: string;
  question_en: string;
  scope: "hh" | "all" | "coach";
  dim: Dim;
  needsRunFired?: string;
}

export const NAMED_TESTS: NamedTest[] = [
  {
    id: "QVOICE",
    question_nl: "Zou een meerderheid van de huishoudens een dossier accepteren dat ze kunnen zien?",
    question_en: "Would a majority of households accept a file they can see?",
    scope: "hh",
    dim: "voice",
  },
  {
    id: "QMETRIC",
    question_nl: "Zou een meerderheid follow-through accepteren als maatstaf?",
    question_en: "Would a majority accept follow-through as the metric?",
    scope: "all",
    dim: "metric",
  },
  {
    id: "QPAYER",
    question_nl: "Zou een meerderheid zeggen dat de gemeente betaalt?",
    question_en: "Would a majority say the municipality pays?",
    scope: "all",
    dim: "payer",
  },
  {
    id: "QADOPT",
    question_nl: "Zou een meerderheid van de coaches met spraak vastleggen?",
    question_en: "Would a majority of coaches capture by voice?",
    scope: "coach",
    dim: "adopt",
  },
  {
    id: "QTRUST",
    question_nl: "Zou een meerderheid van de huishoudens de gemeente met het dossier vertrouwen?",
    question_en: "Would a majority of households trust the municipality with the file?",
    scope: "hh",
    dim: "trust",
  },
  {
    id: "QSCANDAL",
    question_nl: "Verliest het permissiemodel na het lek zijn meerderheid?",
    question_en: "After the leak event, does the permission model lose its majority?",
    scope: "hh",
    dim: "voice",
    needsRunFired: "leak",
  },
  {
    id: "QSORT",
    question_nl: "Accepteert de populatie sorteren op dossiers?",
    question_en: "Does the population accept caseload sorting?",
    scope: "all",
    dim: "queue",
  },
];

function supportForScope(result: RunResult, personas: Persona[], scope: NamedTest["scope"], dim: Dim): number {
  let total = 0;
  let sup = 0;
  for (let i = 0; i < personas.length; i++) {
    const a = personas[i].archetype as ArchetypeKey;
    if (scope === "hh" && !isHousehold(a)) continue;
    if (scope === "coach" && a !== "coach") continue;
    total++;
    if (result.finalOpinions[i][dim] >= 0.5) sup++;
  }
  return total === 0 ? 0 : sup / total;
}

export interface Frequency {
  id: NamedTest["id"];
  question_nl: string;
  question_en: string;
  hits: number;
  n: number;
  p: number;
  ci: Interval;
  /** share of runs in which the condition held */
  testable_n: number;
}

export interface DimStats {
  dim: Dim;
  mean: number;
  sd: number;
  p10: number;
  p50: number;
  p90: number;
  support_mean: number;
  hist: { from: number; to: number; n: number }[];
  support_hist: { from: number; to: number; n: number }[];
}

export interface EnsembleResult {
  seed_base: number;
  runs: number;
  rounds: number;
  mixing: number;
  pressure: number;
  n_agents: number;
  archetypes: { key: ArchetypeKey; label_nl: string; n: number; household: boolean; priors: Record<Dim, number> }[];
  dims: { id: Dim; label_nl: string; left_nl: string; right_nl: string; blurb_nl: string }[];
  dim_stats: DimStats[];
  frequencies: Frequency[];
  events_seen: { id: string; count: number; label_nl: string }[];
  /** what each archetype said on the instrument (mean agreement per dim) */
  by_archetype: { key: ArchetypeKey; label_nl: string; n: number; mean: Record<Dim, number> }[];
  abstention: { key: ArchetypeKey; label_nl: string; rate: number; n: number }[];
  instrument: {
    archetype: ArchetypeKey;
    answers: InstrumentAnswer[];
  }[];
  duration_ms: number;
  fired_any: string[];
}

export function runEnsemble(personas: Persona[], runs = 200, opts: RunOptions = {}, minimal = false): EnsembleResult {
  const t0 = Date.now();
  const seeds = Array.from({ length: runs }, (_, r) => (opts.seed ?? BASE_SEED) + r * 7919);
  const perDim: Record<Dim, { mean: number[]; support: number[] }> = {
    voice: { mean: [], support: [] },
    metric: { mean: [], support: [] },
    payer: { mean: [], support: [] },
    adopt: { mean: [], support: [] },
    trust: { mean: [], support: [] },
    queue: { mean: [], support: [] },
  };
  const hit: Record<string, number> = {};
  const eventCounts: Record<string, number> = {};
  const firedAny = new Set<string>();

  for (const seed of seeds) {
    const res = runSwarm(personas, { ...opts, seed });
    for (const d of DIMS) {
      perDim[d].mean.push(res.final[d]);
      perDim[d].support.push(res.support[d]);
    }
    for (const e of res.fired) {
      eventCounts[e] = (eventCounts[e] ?? 0) + 1;
      firedAny.add(e);
    }
    for (const t of NAMED_TESTS) {
      if (t.needsRunFired && !res.fired.includes(t.needsRunFired)) continue;
      const s = supportForScope(res, personas, t.scope, t.dim);
      const holds = t.id === "QSCANDAL" ? s <= 0.5 : s > 0.5;
      hit[t.id] = (hit[t.id] ?? 0) + (holds ? 1 : 0);
    }
  }

  const dim_stats: DimStats[] = DIMS.map((d) => {
    const means = perDim[d].mean;
    const sups = perDim[d].support;
    return {
      dim: d,
      mean: mean(means),
      sd: sd(means),
      p10: quantile(means, 0.1),
      p50: quantile(means, 0.5),
      p90: quantile(means, 0.9),
      support_mean: mean(sups),
      hist: histogram(means, 0.05),
      support_hist: histogram(sups, 0.05),
    };
  });

  const frequencies: Frequency[] = NAMED_TESTS.map((t) => {
    // the denominator is the runs in which the condition was testable
    const n = t.needsRunFired ? eventCounts[t.needsRunFired] ?? 0 : runs;
    const hits = hit[t.id] ?? 0;
    const p = n === 0 ? 0 : hits / n;
    return {
      id: t.id,
      question_nl: t.question_nl,
      question_en: t.question_en,
      hits,
      n,
      p,
      ci: wilson(p, n),
      testable_n: n,
    };
  });

  // --- per-archetype instrument answers (one representative agent per archetype) ---
  const archetypeKeys = [...new Set(personas.map((p) => p.archetype))] as ArchetypeKey[];
  const firstRun = runSwarm(personas, { ...opts, seed: seeds[0] });
  const by_archetype = archetypeKeys.map((key) => {
    const idx = personas.map((p, i) => ({ p, i })).filter((x) => x.p.archetype === key);
    const m = {} as Record<Dim, number>;
    for (const d of DIMS) {
      m[d] = idx.reduce((acc, x) => acc + firstRun.finalOpinions[x.i][d], 0) / (idx.length || 1);
    }
    return { key, label_nl: idx[0]?.p.archetype_nl ?? key, n: idx.length, mean: m };
  });

  const abstention = archetypeKeys.map((key) => {
    const idx = personas.map((p, i) => ({ p, i })).filter((x) => x.p.archetype === key);
    let abstain = 0;
    for (const { p, i } of idx) {
      const answers = answerInstrument(p, firstRun.finalOpinions[i], i);
      if (answers.some((x) => x.abstained)) abstain++;
    }
    return { key, label_nl: idx[0]?.p.archetype_nl ?? key, rate: idx.length ? abstain / idx.length : 0, n: idx.length };
  });

  const instrument = minimal
    ? []
    : archetypeKeys.map((key) => {
        const i = personas.findIndex((p) => p.archetype === key);
        return { archetype: key, answers: answerInstrument(personas[i], firstRun.finalOpinions[i], i) };
      });

  return {
    seed_base: opts.seed ?? BASE_SEED,
    runs,
    rounds: opts.rounds ?? 24,
    mixing: opts.mixing ?? 0.18,
    pressure: opts.pressure ?? 1,
    n_agents: personas.length,
    archetypes: archetypeKeys.map((key) => ({
      key,
      label_nl: by_archetype.find((b) => b.key === key)!.label_nl,
      n: by_archetype.find((b) => b.key === key)!.n,
      household: isHousehold(key),
      priors: personas.find((p) => p.archetype === key)!.priors,
    })),
    dims: DIMS.map((d) => ({ id: d, ...DIM_META[d] })),
    dim_stats,
    frequencies,
    events_seen: Object.entries(eventCounts)
      .map(([id, count]) => ({ id, count, label_nl: EVENT_LABEL[id] ?? id }))
      .sort((a, b) => b.count - a.count),
    by_archetype,
    abstention,
    instrument,
    duration_ms: Date.now() - t0,
    fired_any: [...firedAny],
  };
}

// kept local to avoid a circular import at module scope
const DIM_META: Record<Dim, { label_nl: string; left_nl: string; right_nl: string; blurb_nl: string }> = {
  voice: {
    label_nl: "Het huishouden mag het dossier zien",
    left_nl: "een dossier is van de coach",
    right_nl: "het dossier is van ons",
    blurb_nl: "Het permissiemodel, gevraagd als mening in plaats van als beleid.",
  },
  metric: {
    label_nl: "Follow-through is de eerlijke maatstaf",
    left_nl: "kWh-besparing telt",
    right_nl: "afspraken tellen",
    blurb_nl: "Het meetargument waar de hele pitch op rust.",
  },
  payer: {
    label_nl: "De gemeente betaalt",
    left_nl: "de corporatie of leverancier betaalt",
    right_nl: "de gemeente betaalt",
    blurb_nl: "Wie het betaalt, gevraagd als mening.",
  },
  adopt: {
    label_nl: "De coach neemt spraaknotities op",
    left_nl: "ik typ het later",
    right_nl: "ik spreek het in",
    blurb_nl: "Wrijving bij het vastleggen is waar elke coachtool sterft.",
  },
  trust: {
    label_nl: "De gemeente is te vertrouwen",
    left_nl: "de gemeente ziet me als fraudeur",
    right_nl: "de gemeente helpt me",
    blurb_nl: "De voorwaarde voor de hele gemeentelijke route.",
  },
  queue: {
    label_nl: "Op dossiers sorteren mag",
    left_nl: "sorteer op datum",
    right_nl: "sorteer op wat blijft liggen",
    blurb_nl: "De enige plek waar het ontwerp eerlijkheid raakt: een caseload sorteren.",
  },
};

const EVENT_LABEL: Record<string, string> = {
  shutoff: "Een gezin wordt afgesloten en het staat op de voorpagina",
  grant: "Het rijk stelt €200 mln extra beschikbaar voor energiearmoede",
  econobis: "Econobis kondigt een spraaknotitie-functie aan",
  leak: "Een coach deelt per ongeluk een dossier met een corporatie",
  success: "Dordrecht publiceert opnieuw een daling: 5,1% → 4,4%",
  waitlist: "De wachtlijst voor de warmtetransitie groeit naar twee jaar",
  fraud: "De gemeente kondigt fraudecontroles aan bij de energietoeslag",
  dutch: "De gemeente zet alle brieven om naar B1-niveau",
  coachcut: "De gemeente schrapt de helft van de coachuren",
};
