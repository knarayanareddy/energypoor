// src/domain/swarm/instrument.ts — §12.2 / §12.3
// The 14-item v2 instrument. Agents answer through a deterministic response
// function, not a model: likert5(o) = clamp(1 + round(o*4)), agreement maps an
// option's `align` against the agent's opinion, and abstention is itself a
// finding (it is counted, never imputed).
import type { ArchetypeKey, Dim } from "./archetypes";
import type { Persona } from "./personas";
import { mulberry32 } from "./rng";

export interface Item {
  id: string;
  no: number;
  block: "A" | "B" | "C" | "D";
  kind: "single" | "scale" | "matrix" | "max3";
  text_nl: string;
  options?: { id: string; label_nl: string; align?: "left" | "right" | "either" }[];
  dim?: Dim | Dim[];
  householdOnly?: boolean;
  /** personal items must offer a "zeg ik liever niet" / "weet niet" path */
  personal?: boolean;
}

export const ABSTAIN = "zeg ik liever niet";
export const DONT_KNOW = "weet niet";

export const ITEMS: Item[] = [
  // A · Over uzelf
  {
    id: "role",
    no: 1,
    block: "A",
    kind: "single",
    text_nl: "Wat is uw rol?",
    options: [
      { id: "huishouden", label_nl: "huishouden" },
      { id: "coach", label_nl: "coach" },
      { id: "gemeente", label_nl: "gemeente" },
      { id: "corporatie", label_nl: "corporatie" },
      { id: "verhuurder", label_nl: "verhuurder" },
      { id: "leverancier", label_nl: "leverancier" },
      { id: "welzijn", label_nl: "welzijn" },
      { id: "anders", label_nl: "anders" },
    ],
  },
  {
    id: "tenure",
    no: 2,
    block: "A",
    kind: "single",
    text_nl: "Woont u in een huurwoning of koopwoning?",
    householdOnly: true,
    personal: true,
    options: [
      { id: "huur-corporatie", label_nl: "huur-corporatie" },
      { id: "huur-prive", label_nl: "huur-prive" },
      { id: "koop", label_nl: "koop" },
      { id: "nvt", label_nl: "n.v.t." },
      { id: "abstain", label_nl: ABSTAIN },
    ],
  },
  {
    id: "label",
    no: 3,
    block: "A",
    kind: "single",
    text_nl: "Weet u het energielabel van uw woning?",
    householdOnly: true,
    personal: true,
    options: [
      ...["A", "B", "C", "D", "E", "F", "G"].map((l) => ({ id: l, label_nl: l })),
      { id: "weetniet", label_nl: DONT_KNOW },
      { id: "abstain", label_nl: ABSTAIN },
    ],
  },
  {
    id: "lang",
    no: 4,
    block: "A",
    kind: "single",
    text_nl: "Welke taal spreekt u thuis het meest?",
    personal: true,
    options: [
      { id: "Nederlands", label_nl: "Nederlands" },
      { id: "Turks", label_nl: "Turks" },
      { id: "Arabisch", label_nl: "Arabisch" },
      { id: "Pools", label_nl: "Pools" },
      { id: "Anders", label_nl: "Anders" },
      { id: "abstain", label_nl: ABSTAIN },
    ],
  },
  {
    id: "situatie",
    no: 5,
    block: "A",
    kind: "single",
    text_nl: "Wat past het beste bij uw situatie?",
    options: [
      { id: "achterstand", label_nl: "achterstand" },
      { id: "net verhuisd", label_nl: "net verhuisd" },
      { id: "mantelzorg", label_nl: "mantelzorg" },
      { id: "alleenstaand", label_nl: "alleenstaand" },
      { id: "gezin", label_nl: "gezin" },
      { id: "anders", label_nl: "anders" },
      { id: "abstain", label_nl: ABSTAIN },
    ],
  },

  // B · Het geheugenprobleem — the block a v1 instrument misses entirely
  {
    id: "q_followthrough",
    no: 6,
    block: "B",
    kind: "max3",
    text_nl: "Wat gebeurt er met een afspraak die een coach met u maakt?",
    options: [
      { id: "wordt gedaan", label_nl: "wordt gedaan", align: "right" },
      { id: "wordt vergeten", label_nl: "wordt vergeten", align: "left" },
      { id: "zelf achteraan", label_nl: "ik moet er zelf achteraan", align: "left" },
      { id: "weet niet meer", label_nl: "ik weet het niet meer", align: "left" },
      { id: "coach komt niet terug", label_nl: "de coach komt niet terug", align: "left" },
    ],
  },
  {
    id: "q_barrier",
    no: 7,
    block: "B",
    kind: "single",
    text_nl: "Wat is bij u het eerste probleem?",
    personal: true,
    options: [
      { id: "geld", label_nl: "geld" },
      { id: "taal", label_nl: "taal" },
      { id: "vertrouwen", label_nl: "vertrouwen" },
      { id: "gezondheid", label_nl: "gezondheid" },
      { id: "papieren", label_nl: "papieren" },
      { id: "de woning zelf", label_nl: "de woning zelf" },
      { id: "niets", label_nl: "niets" },
      { id: "abstain", label_nl: ABSTAIN },
    ],
  },
  {
    id: "q_visit",
    no: 8,
    block: "B",
    kind: "scale",
    text_nl: "Hoe prettig vindt u een huisbezoek van een energiecoach?",
    dim: "trust",
  },
  {
    id: "q_memory",
    no: 9,
    block: "B",
    kind: "scale",
    text_nl: "Hoe belangrijk is het dat de coach zich de vorige afspraak herinnert?",
    dim: "metric",
  },

  // C · De vier ideeën — neutral language, never "AI"
  {
    id: "usefulness",
    no: 10,
    block: "C",
    kind: "matrix",
    text_nl: "Hoe nuttig is dit voor u?",
    options: [
      { id: "dossier_visible", label_nl: "U kunt het dossier van uw bezoeken inzien en corrigeren", align: "right" },
      { id: "one_page", label_nl: "De coach komt met één pagina: wat is afgesproken, wat is gedaan", align: "right" },
      { id: "handover", label_nl: "De coach geeft u een kant-en-klaar overzicht van regelingen en formulieren", align: "right" },
      { id: "no_share", label_nl: "Uw dossier wordt nooit met de corporatie of leverancier gedeeld", align: "right" },
    ],
    dim: "voice",
  },
  {
    id: "q_capture",
    no: 11,
    block: "C",
    kind: "single",
    text_nl: "De coach spreekt na het bezoek 60 seconden in. Wat vindt u daarvan?",
    personal: true,
    options: [
      { id: "prima", label_nl: "prima", align: "right" },
      { id: "maakt me niet uit", label_nl: "maakt me niet uit", align: "either" },
      { id: "onprettig", label_nl: "ik vind het onprettig", align: "left" },
      { id: "geen opname", label_nl: "ik wil niet dat er iets wordt opgenomen", align: "left" },
      { id: "abstain", label_nl: ABSTAIN },
    ],
    dim: "adopt",
  },
  {
    id: "q_sort",
    no: 12,
    block: "C",
    kind: "single",
    text_nl: "De gemeente sorteert de hulp: mensen die lang niet zijn gezien gaan eerst. Wat vindt u daarvan?",
    options: [
      { id: "eerlijk", label_nl: "eerlijk", align: "right" },
      { id: "oneerlijk", label_nl: "oneerlijk — op datum sorteren", align: "left" },
      { id: "maakt me niet uit", label_nl: "maakt me niet uit", align: "either" },
      { id: "abstain", label_nl: ABSTAIN },
    ],
    dim: "queue",
  },

  // D · Zou u het gebruiken
  {
    id: "intent",
    no: 13,
    block: "D",
    kind: "scale",
    text_nl: "Hoe waarschijnlijk is het dat u met deze aanpak te maken krijgt of hem gebruikt?",
    dim: "voice",
  },
  {
    id: "q_stop",
    no: 14,
    block: "D",
    kind: "single",
    text_nl: "Wat zou u ervan weerhouden?",
    personal: true,
    options: [
      { id: "wantrouwen", label_nl: "wantrouwen" },
      { id: "privacy", label_nl: "privacy" },
      { id: "de gemeente", label_nl: "de gemeente" },
      { id: "werkt toch niet", label_nl: "het werkt toch niet" },
      { id: "geen hulp nodig", label_nl: "ik heb geen hulp nodig" },
      { id: "niets", label_nl: "niets" },
      { id: "abstain", label_nl: ABSTAIN },
    ],
  },
];

export interface InstrumentAnswer {
  item: string;
  no: number;
  value: string | number | Record<string, number> | { id: string; label_nl: string; weight: number }[];
  abstained: boolean;
}

export function likert5(o: number): number {
  return Math.min(5, Math.max(1, 1 + Math.round(o * 4)));
}

export function likert10(o: number): number {
  return Math.min(10, Math.max(1, 1 + Math.round(o * 9)));
}

const ROLE_BY_ARCH: Record<ArchetypeKey, string> = {
  hh_nl: "huishouden",
  hh_mig: "huishouden",
  hh_elderly: "huishouden",
  coach: "coach",
  muni: "gemeente",
  corp: "corporatie",
  landlord: "verhuurder",
  supplier: "leverancier",
  welfare: "welzijn",
};

export function answerInstrument(persona: Persona, opinions: Record<Dim, number>, seedIndex: number): InstrumentAnswer[] {
  const rnd = mulberry32((20261111 ^ (seedIndex * 2654435761)) >>> 0);
  const abstainP = 0.08 + 0.35 * (1 - opinions.trust);
  const household = persona.archetype.startsWith("hh_");
  const out: InstrumentAnswer[] = [];

  for (const item of ITEMS) {
    if (item.householdOnly && !household) {
      out.push({ item: item.id, no: item.no, value: "n.v.t.", abstained: false });
      continue;
    }

    if (item.personal && rnd() < abstainP) {
      out.push({ item: item.id, no: item.no, value: ABSTAIN, abstained: true });
      continue;
    }

    switch (item.kind) {
      case "single": {
        const dim = Array.isArray(item.dim) ? item.dim[0] : item.dim;
        if (item.id === "role") {
          out.push({ item: item.id, no: item.no, value: ROLE_BY_ARCH[persona.archetype], abstained: false });
          break;
        }
        if (item.id === "tenure") {
          out.push({ item: item.id, no: item.no, value: persona.tenure, abstained: false });
          break;
        }
        if (item.id === "label") {
          out.push({ item: item.id, no: item.no, value: persona.label === "—" ? DONT_KNOW : persona.label, abstained: false });
          break;
        }
        if (item.id === "lang") {
          out.push({ item: item.id, no: item.no, value: persona.lang, abstained: false });
          break;
        }
        if (item.id === "situatie") {
          out.push({ item: item.id, no: item.no, value: persona.situation, abstained: false });
          break;
        }
        if (item.id === "q_barrier") {
          out.push({ item: item.id, no: item.no, value: firstBarrier(persona, opinions), abstained: false });
          break;
        }
        if (item.id === "q_stop") {
          out.push({ item: item.id, no: item.no, value: stopReason(persona, opinions), abstained: false });
          break;
        }
        if (item.options && dim) {
          const right = opinions[dim] >= 0.5;
          const opts = item.options.filter((o) => o.id !== "abstain");
          const aligned = opts.filter((o) => o.align === (right ? "right" : "left"));
          const either = opts.filter((o) => o.align === "either");
          const pool = aligned.length ? aligned : either.length ? either : opts;
          const chosen = pool[Math.floor(rnd() * pool.length)];
          out.push({ item: item.id, no: item.no, value: chosen.label_nl, abstained: false });
          break;
        }
        out.push({ item: item.id, no: item.no, value: item.options?.[0]?.label_nl ?? "", abstained: false });
        break;
      }
      case "scale": {
        const dim: Dim = Array.isArray(item.dim) ? item.dim[0] : item.dim ?? "trust";
        const v = item.id === "intent" ? likert10(opinions[dim]) : likert5(opinions[dim]);
        out.push({ item: item.id, no: item.no, value: v, abstained: false });
        break;
      }
      case "max3": {
        const ranked = barrierRanking(persona, opinions);
        out.push({ item: item.id, no: item.no, value: ranked.slice(0, 3), abstained: false });
        break;
      }
      case "matrix": {
        const dim: Dim = Array.isArray(item.dim) ? item.dim[0] : item.dim ?? "voice";
        const cells: Record<string, number> = {};
        for (const opt of item.options ?? []) {
          const base = opinions[dim];
          cells[opt.label_nl] = likert5(Math.min(1, Math.max(0, base + (rnd() - 0.5) * 0.2)));
        }
        out.push({ item: item.id, no: item.no, value: cells, abstained: false });
        break;
      }
    }
  }
  return out;
}

function firstBarrier(persona: Persona, opinions: Record<Dim, number>): string {
  const ranked = barrierRanking(persona, opinions);
  return ranked[0].id;
}

function barrierRanking(persona: Persona, opinions: Record<Dim, number>): { id: string; label_nl: string; weight: number }[] {
  const rnd = mulberry32((20261111 ^ ((persona.age * 7919 + persona.hood.length * 31) >>> 0)) >>> 0);
  const candidates: { id: string; label_nl: string; weight: number }[] = [
    { id: "geld", label_nl: "geld", weight: 1 - opinions.payer },
    { id: "taal", label_nl: "taal", weight: persona.lang === "Nederlands" ? 0.15 : 0.85 },
    { id: "vertrouwen", label_nl: "vertrouwen", weight: 1 - opinions.trust },
    { id: "gezondheid", label_nl: "gezondheid", weight: persona.age > 70 ? 0.7 : 0.25 },
    { id: "papieren", label_nl: "papieren", weight: 1 - opinions.metric * 0.5 },
    { id: "de woning zelf", label_nl: "de woning zelf", weight: persona.tenure === "huur-prive" ? 0.66 : 0.34 },
    { id: "niets", label_nl: "niets", weight: 0.12 },
  ];
  return candidates
    .map((c) => ({ ...c, weight: c.weight + rnd() * 0.12 }))
    .sort((a, b) => b.weight - a.weight);
}

function stopReason(persona: Persona, opinions: Record<Dim, number>): string {
  if (opinions.trust < 0.35) return "wantrouwen";
  if (opinions.voice < 0.4) return "privacy";
  if (opinions.payer < 0.4) return "de gemeente";
  if (opinions.metric < 0.4) return "het werkt toch niet";
  if (persona.tenure === "n.v.t.") return "niets";
  return opinions.metric > 0.6 ? "niets" : "werkt toch niet";
}

/** The survey exporter (§9.2 GET /api/survey?version=v1|v2). */
export function toCsv(rows: Record<string, unknown>[], columns?: string[]): string {
  if (rows.length === 0) return "";
  const cols = columns ?? Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export const V1_ITEMS = [
  "Wat is uw grootste moeilijkheid?",
  "Hoe waarschijnlijk is het dat u dit zou gebruiken? (1–5)",
  "Welke functie is het meest waardevol?",
  "Wat zou u overtuigen?",
  "Hoe tevreden bent u met uw energierekening? (1–5)",
  "Wat is uw postcode?",
  "Hoeveel jaar woont u hier?",
  "Heeft u een energielabel?",
  "Wat is uw leeftijd?",
  "Hoe vaak heeft u contact met de gemeente?",
];
