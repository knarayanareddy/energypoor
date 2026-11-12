import type { Locale } from "@/i18n/dict";
import type { Dim } from "@/domain/swarm/archetypes";

/**
 * Copy for the Swarm Lab.
 *
 * Why this is not in `src/i18n/dict.ts`: the lab is ten panels of prose, and
 * several of its strings take live figures (`{runs}`, `{n}`, `{p}`). A flat
 * dictionary of 90 numbered keys would be unreadable and impossible to review.
 * Same guarantee, different shape: the two objects below are typed against each
 * other, so a key in `nl` that is missing from `en` is a build error.
 *
 * The *domain* strings — dimension labels, event labels, persona names — stay
 * Dutch because they come from the fixtures and the spec's lexicon (§11). When
 * English is active, a visible note says so.
 */
const nl = {
  eyebrowMeta: "Swarm Lab · {agents} synthetische agenten · {runs} runs",
  eyebrow: "Wat de populatie van onze aannames vindt",
  lede:
    "Geen taalmodel wordt aangeroepen. Dit is een dynamisch systeem over een synthetische populatie — de uitkomst is een frequentie, geen voorspelling.",
  chips: {
    noLlm: "GEEN LLM",
    synth: "SYNTHETISCH",
    noPrediction: "GEEN VOORSPELLING",
    priorsAreAssumptions: "PRIOREN ZIJN AANNAMES",
  },
  note: "Assumpties, dimenties, gebeurtenissen en persoonsnamen komen uit de fixtures en blijven in het Nederlands — dat is de tekst waarop §11 van de spec is geschreven.",
  tabs: { lab: "Lab", report: "Report", priors: "Aannames", instrument: "Instrument" },
  overlay: {
    round: "ronde",
    mean: "gem.",
    right: "rechts van",
    noEvent: "geen gebeurtenis deze ronde",
  },
  controls: {
    start: "Start",
    pause: "Pause",
    step: "Step",
    reset: "Reset",
    speed: "Snelheid",
    scrub: "Ronde scrubben",
  },
  inject: {
    title: "Brand je eigen verhaal",
    lede: "De hele simulatie wordt opnieuw gedraaid met deze gebeurtenis geïnjecteerd — dus deterministisch.",
    injected: "Geïnjecteerd:",
    tail: "in ronde {round}. De gestippelde ringen op het canvas zijn de eindstand van de vorige run.",
  },
  dim: { title: "Dimensie" },
  line: {
    title: "De beslissingslijn",
    lede: "Waar je “voor” legt, bepaalt de uitslag. Sleep hem.",
    aria: "Beslissingslijn op de dimensie-as",
    right: "{n} van {total} agenten rechts",
  },
  levers: {
    title: "Twee knoppen, beide eerlijk",
    pressure: "druk",
    mixing: "vermenging",
    pressureAria: "Druk",
    mixingAria: "Vermenging",
    lede:
      "Zet vermenging op 0 en de populatie valt uiteen in negen niet-communicerende blokken. Dat is wat homofilie met een landelijk programma doet.",
  },
  now: { title: "Zes dimensies nu" },
  spark: { aria: "Gemiddelde van {dim} over {n} rondes" },
  canvas: { decisionLine: "beslissingslijn" },
  profile: {
    close: "Sluiten",
    prior: "prior per dimensie",
    said: "wat ze zeiden (instrument)",
    moved: "hoeveel ze bewogen",
    why: "Waarom veranderde deze?",
    events: "Gebeurtenissen in deze run:",
    round: "ronde {round}",
    neighbours: "Buren in de laatste ronde ({n} getoond):",
    footer: "Geen model, geen verklaring: dit zijn de buren en de schokken die in deze run zijn gevuurd.",
  },
  history: { title: "Geschiedenis van deze sessie" },
  report: {
    frequenciesTitle: "De zes frequenties",
    frequenciesLede: "Elke frequentie met n en een 95%-Wilson-interval. Nooit een kaal percentage.",
    falsifiersTitle: "Falsifiers — geschreven vóór de run",
    breakPitch: "Breekt de pitch: {n}",
    colId: "ID",
    colClaim: "Claim",
    colTest: "Test",
    colOutcome: "Uitkomst",
    colHolds: "Houdt stand?",
    colBreaks: "Breekt de pitch?",
    yes: "ja",
    no: "nee",
    perDim: "Per dimensie",
    dim: "Dimensie",
    mean: "gem.",
    support: "steun",
    histogram: "Histogram — steun per run",
    meanSupport: "gem. steun {pct}%",
    runsUnit: "runs",
    notSays: "Wat het niet zegt",
    notSays1:
      "Dit is geen voorspelling en geen onderzoek. De populatie is een tabel met aannames, en elke agent is een tekenreeks met een prior. De frequenties hierboven zeggen:",
    notSaysAls: "als",
    notSays2:
      "deze negen aannames waar zijn, dan valt in {runs} runs een meerderheid zo uit. Verander een prior en de uitkomst verschuift — dat is het punt, niet de uitkomst. Er is geen echt huishouden, geen echte coach en geen echt programma in deze cijfers, en er is geen taalmodel aan te pas gekomen.",
    findings: "Drie bevindingen",
    f1: "Vertrouwen is de zwakke schakel.",
    f1tail: "De eerste koper is daarom een welzijnsorganisatie, niet een gemeente.",
    f2: "Het permissiemodel is fragiel.",
    f2body:
      "In {hits} van {n} runs met het lek verliest voice zijn meerderheid. Dat maakt het permissiemodel het product en niet een functie.",
    f3: "Vastleggen per spraak is geen probleem.",
    f3tail: "Dat is de aanname die we niet hoeven te verdedigen.",
    runLine: "Run: {runs} × {rounds} rondes, seed {seed}, {ms} ms, geen netwerk.",
  },
  priors: {
    title: "De aannames, op het scherm",
    pill: "PRIOREN ZIJN AANNAMES",
    lede: "Lees deze tabel als claims, niet als data. Verander een prior en het rapport verschuift.",
    archetype: "Archetype",
    voice: "stem",
    susceptibility: "vatbaar",
    conviction: "overtuiging",
    quota1: "N = {n}. Quota exact: floor per archetype, rest naar de laatste. Elke agent is",
    quota2: ".",
    after: "Na de run, per archetype",
    abstains: "onthoudt zich",
    abstainNote:
      "Onthouding is een bevinding, geen datagat: wantrouwen verhoogt de kans dat iemand een persoonlijke vraag weigert, en dat tellen we.",
  },
  instrument: {
    title: "Dekkingsmatrix — v1 dekt 2,5 van 10",
    necessity: "Noodzaak",
    why: "Waarom het telt",
    rows: [
      ["N1 · Accepteert het huishouden een zichtbaar dossier?", "het permissiemodel is het product", "✗ nooit gevraagd", "✓ voice, q_visible"],
      ["N2 · Is follow-through geaccepteerd als maatstaf?", "het meetargument", "✗", "✓ metric"],
      ["N3 · Wie betaalt volgens de populatie?", "bepaalt de verkooproute", "deels", "✓ payer"],
      ["N4 · Neemt een coach op met spraak?", "adoptie sterft hier", "✗", "✓ adopt, q_capture"],
      ["N5 · Vertrouwt het huishouden de gemeente?", "voorwaarde voor route 1", "✗", "✓ trust"],
      ["N6 · Is sorteren eerlijk?", "de enige eerlijkheidsvraag die het product maakt", "✗", "✓ queue"],
      ["N7 · Hoe groot is het geheugenprobleem, gemeten?", "de pitch zegt: de helft sterft", "✗", "✓ q_followthrough"],
      ["N8 · Welke barrière komt eerst?", "bepaalt de brief-template", "deels", "✓ q_barrier"],
      ["N9 · Accepteren ze een huisbezoek?", "het levermodel", "✗", "✓ q_visit"],
      ["N10 · Wat zou ze laten stoppen?", "churn, voordat het gebeurt", "✗", "✓ q_stop"],
    ],
    lede:
      "v1 bestaat uit tien vragen in de vorm die teams standaard schrijven — “wat is uw grootste moeilijkheid”, “hoe waarschijnlijk zou u dit gebruiken (1–5)”. Die tien kunnen N1, N2 en N5 niet leren: ze noemen het onderwerp niet.",
    exportTitle: "Export",
    exportLede: "240 synthetische respondenten, alle 14 items, inclusief onthoudingen.",
    v2: "v2 CSV — 14 items",
    v1: "v1 CSV — 10 items",
    abstention: "Onthouding per archetype",
  },
  dims: {
    voice: {
      label: "Het huishouden mag het dossier zien",
      left: "een dossier is van de coach",
      right: "het dossier is van ons",
      blurb: "Het permissiemodel, gevraagd als mening in plaats van als beleid.",
    },
    metric: {
      label: "Follow-through is de eerlijke maatstaf",
      left: "kWh-besparing telt",
      right: "afspraken tellen",
      blurb: "Het meetargument waar de hele pitch op rust.",
    },
    payer: {
      label: "De gemeente betaalt",
      left: "de corporatie of leverancier betaalt",
      right: "de gemeente betaalt",
      blurb: "Wie het betaalt, gevraagd als mening.",
    },
    adopt: {
      label: "De coach neemt spraaknotities op",
      left: "ik typ het later",
      right: "ik spreek het in",
      blurb: "Wrijving bij het vastleggen is waar elke coachtool sterft.",
    },
    trust: {
      label: "De gemeente is te vertrouwen",
      left: "de gemeente ziet me als fraudeur",
      right: "de gemeente helpt me",
      blurb: "De voorwaarde voor de hele gemeentelijke route.",
    },
    queue: {
      label: "Op dossiers sorteren mag",
      left: "sorteer op datum",
      right: "sorteer op wat blijft liggen",
      blurb: "De enige plek waar het ontwerp eerlijkheid raakt: een caseload sorteren.",
    },
  } as Record<Dim, { label: string; left: string; right: string; blurb: string }>,
  events: {
    shutoff: "Een gezin wordt afgesloten en het staat op de voorpagina",
    grant: "Het rijk stelt €200 mln extra beschikbaar voor energiearmoede",
    econobis: "Econobis kondigt een spraaknotitie-functie aan",
    leak: "Een coach deelt per ongeluk een dossier met een corporatie",
    success: "Dordrecht publiceert opnieuw een daling: 5,1% → 4,4%",
    waitlist: "De wachtlijst voor de warmtetransitie groeit naar twee jaar",
    dutch: "De gemeente zet alle brieven om naar B1-niveau",
    coachcut: "De gemeente schrapt de helft van de coachuren",
  } as Record<string, string>,
} as const;

/** `string` everywhere: the English object must be assignable, not identical. */
type DeepStrings<T> = {
  -readonly [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends readonly (readonly [string, string, string, string])[]
      ? readonly (readonly string[])[]
      : T[K] extends readonly (infer U)[]
        ? DeepStrings<U>[]
        : DeepStrings<T[K]>;
};

export type SwarmCopy = DeepStrings<typeof nl>;

const en: SwarmCopy = {
  eyebrowMeta: "Swarm Lab · {agents} synthetic agents · {runs} runs",
  eyebrow: "What the population thinks of our assumptions",
  lede:
    "No language model is called. This is a dynamical system over a synthetic population — the output is a frequency, not a prediction.",
  chips: {
    noLlm: "NO LLM",
    synth: "SYNTHETIC",
    noPrediction: "NOT A PREDICTION",
    priorsAreAssumptions: "PRIORS ARE ASSUMPTIONS",
  },
  note: "Assumptions, dimensions, events and person names come from the fixtures and stay in Dutch — that is the text §11 of the spec was written about.",
  tabs: { lab: "Lab", report: "Report", priors: "Assumptions", instrument: "Instrument" },
  overlay: {
    round: "round",
    mean: "mean",
    right: "right of",
    noEvent: "no event this round",
  },
  controls: {
    start: "Start",
    pause: "Pause",
    step: "Step",
    reset: "Reset",
    speed: "Speed",
    scrub: "Scrub rounds",
  },
  inject: {
    title: "Set your own story on fire",
    lede: "The whole simulation is re-run with this event injected — so, deterministically.",
    injected: "Injected:",
    tail: "in round {round}. The dotted rings on the canvas are the final state of the previous run.",
  },
  dim: { title: "Dimension" },
  line: {
    title: "The decision line",
    lede: "Where you put “for” decides the outcome. Drag it.",
    aria: "Decision line on the dimension axis",
    right: "{n} of {total} agents to the right",
  },
  levers: {
    title: "Two levers, both honest",
    pressure: "pressure",
    mixing: "mixing",
    pressureAria: "Pressure",
    mixingAria: "Mixing",
    lede:
      "Set mixing to 0 and the population falls apart into nine non-communicating blocks. That is what homophily does to a national programme.",
  },
  now: { title: "Six dimensions now" },
  spark: { aria: "Mean of {dim} over {n} rounds" },
  canvas: { decisionLine: "decision line" },
  profile: {
    close: "Close",
    prior: "prior per dimension",
    said: "what they said (instrument)",
    moved: "how far they moved",
    why: "Why did this one change?",
    events: "Events in this run:",
    round: "round {round}",
    neighbours: "Neighbours in the last round ({n} shown):",
    footer: "No model, no explanation: these are the neighbours and the shocks fired in this run.",
  },
  history: { title: "History of this session" },
  report: {
    frequenciesTitle: "The six frequencies",
    frequenciesLede: "Every frequency with n and a 95% Wilson interval. Never a bare percentage.",
    falsifiersTitle: "Falsifiers — written before the run",
    breakPitch: "Breaks the pitch: {n}",
    colId: "ID",
    colClaim: "Claim",
    colTest: "Test",
    colOutcome: "Outcome",
    colHolds: "Holds?",
    colBreaks: "Breaks the pitch?",
    yes: "yes",
    no: "no",
    perDim: "Per dimension",
    dim: "Dimension",
    mean: "mean",
    support: "support",
    histogram: "Histogram — support per run",
    meanSupport: "mean support {pct}%",
    runsUnit: "runs",
    notSays: "What it does not say",
    notSays1:
      "This is not a prediction and not research. The population is a table of assumptions, and every agent is a string with a prior. The frequencies above say:",
    notSaysAls: "if",
    notSays2:
      "these nine assumptions hold, then in {runs} runs a majority comes out this way. Change a prior and the outcome moves — that is the point, not the outcome. There is no real household, no real coach and no real programme in these figures, and no language model was involved.",
    findings: "Three findings",
    f1: "Trust is the weak link.",
    f1tail: "The first buyer is therefore a welfare organisation, not a municipality.",
    f2: "The permission model is fragile.",
    f2body:
      "In {hits} of {n} runs with the leak, voice loses its majority. That makes the permission model the product rather than a feature.",
    f3: "Recording by voice is not a problem.",
    f3tail: "That is the assumption we do not have to defend.",
    runLine: "Run: {runs} × {rounds} rounds, seed {seed}, {ms} ms, no network.",
  },
  priors: {
    title: "The assumptions, on screen",
    pill: "PRIORS ARE ASSUMPTIONS",
    lede: "Read this table as claims, not as data. Change a prior and the report moves.",
    archetype: "Archetype",
    voice: "voice",
    susceptibility: "susceptibility",
    conviction: "conviction",
    quota1: "N = {n}. Quotas exact: floor per archetype, remainder to the last. Every agent is",
    quota2: ".",
    after: "After the run, per archetype",
    abstains: "abstains",
    abstainNote:
      "Abstention is a finding, not a data gap: distrust raises the chance someone refuses a personal question, and we count that.",
  },
  instrument: {
    title: "Coverage matrix — v1 covers 2.5 of 10",
    necessity: "Necessity",
    why: "Why it counts",
    rows: [
      ["N1 · Does the household accept a visible case file?", "the permission model is the product", "✗ never asked", "✓ voice, q_visible"],
      ["N2 · Is follow-through accepted as the yardstick?", "the measurement argument", "✗", "✓ metric"],
      ["N3 · Who pays, according to the population?", "decides the sales route", "partly", "✓ payer"],
      ["N4 · Does a coach record by voice?", "adoption dies here", "✗", "✓ adopt, q_capture"],
      ["N5 · Does the household trust the municipality?", "a precondition for route 1", "✗", "✓ trust"],
      ["N6 · Is sorting fair?", "the only fairness question the product asks", "✗", "✓ queue"],
      ["N7 · How big is the memory problem, measured?", "the pitch says: half of it dies", "✗", "✓ q_followthrough"],
      ["N8 · Which barrier comes first?", "decides the brief template", "partly", "✓ q_barrier"],
      ["N9 · Do they accept a home visit?", "the delivery model", "✗", "✓ q_visit"],
      ["N10 · What would make them stop?", "churn, before it happens", "✗", "✓ q_stop"],
    ],
    lede:
      "v1 is ten questions in the shape teams write by default — “what is your biggest difficulty”, “how likely would you be to use this (1–5)”. Those ten cannot learn N1, N2 or N5: they never name the subject.",
    exportTitle: "Export",
    exportLede: "240 synthetic respondents, all 14 items, abstentions included.",
    v2: "v2 CSV — 14 items",
    v1: "v1 CSV — 10 items",
    abstention: "Abstention per archetype",
  },
  dims: {
    voice: {
      label: "The household may see the case file",
      left: "a case file belongs to the coach",
      right: "the case file belongs to us",
      blurb: "The permission model, asked as an opinion instead of as policy.",
    },
    metric: {
      label: "Follow-through is the honest yardstick",
      left: "kWh savings count",
      right: "agreements count",
      blurb: "The measurement argument the whole pitch rests on.",
    },
    payer: {
      label: "The municipality pays",
      left: "the housing corporation or supplier pays",
      right: "the municipality pays",
      blurb: "Who pays for it, asked as an opinion.",
    },
    adopt: {
      label: "The coach records voice notes",
      left: "I type it up later",
      right: "I speak it in",
      blurb: "Friction while recording is where every coach tool dies.",
    },
    trust: {
      label: "The municipality can be trusted",
      left: "the municipality sees me as a fraud",
      right: "the municipality helps me",
      blurb: "The precondition for the whole municipal route.",
    },
    queue: {
      label: "Sorting the caseload is allowed",
      left: "sort by date",
      right: "sort by what keeps slipping",
      blurb: "The one place where the design touches fairness: sorting a caseload.",
    },
  },
  events: {
    shutoff: "A family is cut off and it makes the front page",
    grant: "The state makes an extra €200m available for energy poverty",
    econobis: "Econobis announces a voice-note feature",
    leak: "A coach accidentally shares a case file with a housing corporation",
    success: "Dordrecht publishes another drop: 5.1% → 4.4%",
    waitlist: "The waiting list for the heat transition grows to two years",
    dutch: "The municipality rewrites all letters at B1 level",
    coachcut: "The municipality cuts half of the coach hours",
  },
};

export function swarmCopy(locale: Locale): SwarmCopy {
  return locale === "en" ? en : nl;
}

/** The same `{name}` interpolation as the UI dictionary, kept local so this
 *  module has no dependency on `next/headers` and can be imported by a client
 *  component. */
export function fill(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
