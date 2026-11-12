// src/domain/swarm/archetypes.ts — §11.3
// Read these priors as CLAIMS, not data. Nine archetypes, N = 240, exact quotas
// (floor + remainder to the last archetype). They are shown on screen: a juror
// must be able to see the assumptions being made.

export const DIMS = ["voice", "metric", "payer", "adopt", "trust", "queue"] as const;
export type Dim = (typeof DIMS)[number];

export interface Dimension {
  id: Dim;
  label_nl: string;
  left_nl: string;
  right_nl: string;
  blurb_nl: string;
  /** the design needs a majority > 0.5 */
  needs: "majority";
}

export const DIMENSIONS: Dimension[] = [
  {
    id: "voice",
    label_nl: "Het huishouden mag het dossier zien",
    left_nl: "een dossier is van de coach",
    right_nl: "het dossier is van ons",
    blurb_nl: "Het permissiemodel, gevraagd als mening in plaats van als beleid.",
    needs: "majority",
  },
  {
    id: "metric",
    label_nl: "Follow-through is de eerlijke maatstaf",
    left_nl: "kWh-besparing telt",
    right_nl: "afspraken tellen",
    blurb_nl: "Het meetargument waar de hele pitch op rust.",
    needs: "majority",
  },
  {
    id: "payer",
    label_nl: "De gemeente betaalt",
    left_nl: "de corporatie of leverancier betaalt",
    right_nl: "de gemeente betaalt",
    blurb_nl: "Wie het betaalt, gevraagd als mening.",
    needs: "majority",
  },
  {
    id: "adopt",
    label_nl: "De coach neemt spraaknotities op",
    left_nl: "ik typ het later",
    right_nl: "ik spreek het in",
    blurb_nl: "Wrijving bij het vastleggen is waar elke coachtool sterft.",
    needs: "majority",
  },
  {
    id: "trust",
    label_nl: "De gemeente is te vertrouwen",
    left_nl: "de gemeente ziet me als fraudeur",
    right_nl: "de gemeente helpt me",
    blurb_nl: "De voorwaarde voor de hele gemeentelijke route.",
    needs: "majority",
  },
  {
    id: "queue",
    label_nl: "Op dossiers sorteren mag",
    left_nl: "sorteer op datum",
    right_nl: "sorteer op wat blijft liggen",
    blurb_nl: "De enige plek waar het ontwerp eerlijkheid raakt: een caseload sorteren.",
    needs: "majority",
  },
];

export type ArchetypeKey =
  | "hh_nl"
  | "hh_mig"
  | "hh_elderly"
  | "coach"
  | "muni"
  | "corp"
  | "landlord"
  | "supplier"
  | "welfare";

export interface Archetype {
  key: ArchetypeKey;
  label_nl: string;
  n: number;
  who_nl: string;
  priors: Record<Dim, number>;
  behav: { voice: number; susceptibility: number; conviction: number };
  /** household archetypes answer the household blocks */
  household: boolean;
  age: [number, number];
}

export const ARCH: Record<ArchetypeKey, Archetype> = {
  hh_nl: {
    key: "hh_nl",
    label_nl: "Nederlandse huishoudens",
    n: 58,
    who_nl: "Nederlandstalige huishoudens in energiearmoede",
    priors: { voice: 0.62, metric: 0.58, payer: 0.6, adopt: 0.55, trust: 0.42, queue: 0.48 },
    behav: { voice: 0.55, susceptibility: 0.62, conviction: 0.45 },
    household: true,
    age: [24, 78],
  },
  hh_mig: {
    key: "hh_mig",
    label_nl: "Migratieachtergrond",
    n: 34,
    who_nl: "eerste taal niet Nederlands; vaak het moeilijkst te bereiken",
    priors: { voice: 0.48, metric: 0.52, payer: 0.55, adopt: 0.38, trust: 0.3, queue: 0.4 },
    behav: { voice: 0.4, susceptibility: 0.7, conviction: 0.5 },
    household: true,
    age: [22, 74],
  },
  hh_elderly: {
    key: "hh_elderly",
    label_nl: "Oudere huishoudens",
    n: 26,
    who_nl: "70+, vaak eigenaar of langdurige huurder",
    priors: { voice: 0.55, metric: 0.6, payer: 0.58, adopt: 0.3, trust: 0.48, queue: 0.52 },
    behav: { voice: 0.5, susceptibility: 0.45, conviction: 0.7 },
    household: true,
    age: [70, 92],
  },
  coach: {
    key: "coach",
    label_nl: "Energiecoaches",
    n: 38,
    who_nl: "de daadwerkelijke gebruikers van het product",
    priors: { voice: 0.78, metric: 0.7, payer: 0.52, adopt: 0.62, trust: 0.45, queue: 0.58 },
    behav: { voice: 0.8, susceptibility: 0.55, conviction: 0.5 },
    household: false,
    age: [24, 64],
  },
  muni: {
    key: "muni",
    label_nl: "Gemeente",
    n: 22,
    who_nl: "programmamanagers, beleidsmedewerkers",
    priors: { voice: 0.7, metric: 0.62, payer: 0.82, adopt: 0.58, trust: 0.6, queue: 0.72 },
    behav: { voice: 0.72, susceptibility: 0.35, conviction: 0.72 },
    household: false,
    age: [26, 62],
  },
  corp: {
    key: "corp",
    label_nl: "Corporatie",
    n: 20,
    who_nl: "maatschappelijk team, achterstandenroute",
    priors: { voice: 0.66, metric: 0.5, payer: 0.34, adopt: 0.5, trust: 0.55, queue: 0.66 },
    behav: { voice: 0.66, susceptibility: 0.32, conviction: 0.68 },
    household: false,
    age: [26, 61],
  },
  landlord: {
    key: "landlord",
    label_nl: "Private verhuurders",
    n: 16,
    who_nl: "kleine verhuurders, vaak de belemmering",
    priors: { voice: 0.6, metric: 0.34, payer: 0.24, adopt: 0.34, trust: 0.38, queue: 0.44 },
    behav: { voice: 0.62, susceptibility: 0.28, conviction: 0.8 },
    household: false,
    age: [31, 69],
  },
  supplier: {
    key: "supplier",
    label_nl: "Energieleveranciers",
    n: 14,
    who_nl: "schuldroutes, budgetbeheer",
    priors: { voice: 0.58, metric: 0.3, payer: 0.3, adopt: 0.42, trust: 0.34, queue: 0.4 },
    behav: { voice: 0.6, susceptibility: 0.26, conviction: 0.82 },
    household: false,
    age: [27, 58],
  },
  welfare: {
    key: "welfare",
    label_nl: "Welzijnsorganisaties",
    n: 12,
    who_nl: "draaien coaches op subsidie; de snelle koper",
    priors: { voice: 0.64, metric: 0.68, payer: 0.46, adopt: 0.66, trust: 0.5, queue: 0.6 },
    behav: { voice: 0.68, susceptibility: 0.52, conviction: 0.54 },
    household: false,
    age: [23, 60],
  },
};

export const ARCH_ORDER: ArchetypeKey[] = [
  "hh_nl",
  "hh_mig",
  "hh_elderly",
  "coach",
  "muni",
  "corp",
  "landlord",
  "supplier",
  "welfare",
];

export const N_AGENTS = 240;

/** Exact quotas: floor each, remainder to the last archetype (§11.3). */
export function quotas(): Record<ArchetypeKey, number> {
  const out = {} as Record<ArchetypeKey, number>;
  let assigned = 0;
  ARCH_ORDER.forEach((k, i) => {
    if (i === ARCH_ORDER.length - 1) {
      out[k] = N_AGENTS - assigned;
    } else {
      out[k] = Math.floor(ARCH[k].n);
      assigned += out[k];
    }
  });
  return out;
}

export const HOUSEHOLD_ARCHS: ArchetypeKey[] = ["hh_nl", "hh_mig", "hh_elderly"];

export function isHousehold(a: ArchetypeKey): boolean {
  return HOUSEHOLD_ARCHS.includes(a);
}

// --- names, hoods, situations: fixed lists, all synthetic (§11.4) ---

export const NAMES_NL = [
  "de Vries", "Jansen", "van den Berg", "Bakker", "Visser", "Smit", "Meijer", "de Boer", "Mulder", "de Groot",
  "Bos", "Vos", "Peters", "Hendriks", "van Leeuwen", "Dekker", "Brouwer", "de Wit", "Dijkstra", "Smits",
  "de Graaf", "van der Meer", "van der Linden", "Kok", "Jacobs", "de Haan", "Vermeulen", "van den Heuvel",
  "van der Veen", "van den Broek", "de Bruijn", "de Bruin", "van der Heijden", "Schouten", "van Beek",
  "Willems", "van Vliet", "van der Wal", "Hoekstra", "Maas", "Verhoeven", "Koster", "van Dam",
  "van der Burg", "Nagel", "Blom", "Veenstra", "Kuipers", "Post", "Kuiper", "Prins", "Veen",
  "Boersma", "Wolff", "Timmermans", "Willemsen", "Rietveld", "Boer", "Dekkers", "Hofman",
];

export const NAMES_MIG = [
  "Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Aydın", "Öztürk", "Arslan", "Doğan", "Kılıç",
  "El Amrani", "Bouazza", "El Idrissi", "Naciri", "Tahiri", "Ben Ali",
  "Kowalski", "Nowak", "Wiśniewski", "Lewandowska",
  "Al-Ahmad", "Hadad", "Suleiman", "Darwish",
];

export const INITIALS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export const HOODS = [
  "Korrewegwijk",
  "Paddepoel",
  "Vinkhuizen",
  "Oosterparkwijk",
  "Beijum",
  "Lewenborg",
  "Hoogkerk",
  "Selwerd",
];

export const SITUATIONS = [
  "achterstand",
  "mantelzorg",
  "net verhuisd",
  "alleenstaand",
  "gezin met kinderen",
  "huurder van een particuliere verhuurder",
];

/** 62% F/G among household agents, per §11.4. */
export const LABEL_BY_ARCH: Record<ArchetypeKey, string[]> = {
  hh_nl: ["E", "E", "F", "F", "G", "D"],
  hh_mig: ["F", "F", "G", "G", "E"],
  hh_elderly: ["E", "F", "F", "G", "G"],
  coach: ["—"],
  muni: ["—"],
  corp: ["—"],
  landlord: ["—"],
  supplier: ["—"],
  welfare: ["—"],
};

export const TENURE_BY_ARCH: Record<ArchetypeKey, string[]> = {
  hh_nl: ["huur-corporatie", "huur-corporatie", "huur-prive"],
  hh_mig: ["huur-corporatie", "huur-prive", "huur-prive"],
  hh_elderly: ["huur-corporatie", "koop", "huur-corporatie"],
  coach: ["n.v.t."],
  muni: ["n.v.t."],
  corp: ["n.v.t."],
  landlord: ["n.v.t."],
  supplier: ["n.v.t."],
  welfare: ["n.v.t."],
};

export const LANG_BY_ARCH: Record<ArchetypeKey, string[]> = {
  hh_nl: ["Nederlands"],
  hh_mig: ["Turks", "Arabisch", "Pools", "Anders"],
  hh_elderly: ["Nederlands"],
  coach: ["Nederlands"],
  muni: ["Nederlands"],
  corp: ["Nederlands"],
  landlord: ["Nederlands"],
  supplier: ["Nederlands"],
  welfare: ["Nederlands"],
};

export const ARCH_COLORS: Record<ArchetypeKey, string> = {
  hh_nl: "#8E7F63",
  hh_mig: "#A98467",
  hh_elderly: "#7A6E5B",
  coach: "#2F6B5E",
  muni: "#3E5C76",
  corp: "#6B5B95",
  landlord: "#9A6B4F",
  supplier: "#8C5A6B",
  welfare: "#4F7C6B",
};
