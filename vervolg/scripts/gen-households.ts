// scripts/gen-households.ts
// Builds data/households.json by running the REAL extractor over the fixture
// transcripts, so every action in the fixture is one the deterministic engine
// actually produces (T-19 is then true by construction, not by assertion).
//
// Run: npx tsx scripts/gen-households.ts
import { writeFileSync } from "node:fs";
import { extract } from "../src/domain/extract";
import type { Action, ActionStatus, Barrier, Household, Visit, Who } from "../src/domain/types";

interface StatusUpdate {
  /** substring of what_nl; must match exactly one action */
  match: string;
  status: ActionStatus;
  evidence: string;
  /** the visit at which this status was observed (1-based) */
  at_visit: number;
}

interface VisitSpec {
  date: string;
  text: string;
}

interface Spec {
  ref: string;
  display: string;
  comp: string;
  tenure: Household["tenure"];
  label: Household["label"];
  hood: string;
  programme: string;
  coach: string;
  visits: VisitSpec[];
  statuses: StatusUpdate[];
}

const SPECS: Spec[] = [
  {
    ref: "HH-014",
    display: "Familie Yılmaz — Korrewegwijk",
    comp: "2 volwassenen, 2 kinderen",
    tenure: "huur-corporatie",
    label: "F",
    hood: "Korrewegwijk",
    programme: "Gemeente Groningen — energiearmoede 2026",
    coach: "C-07",
    visits: [
      {
        date: "2025-03-14",
        text:
          "Ik bel de corporatie deze maand over de isolatie van de voorgevel. " +
          "Mevrouw vraagt de energietoeslag aan voor eind mei. " +
          "Wij regelen samen een nieuwe cv-ketel. " +
          "Ze begrijpt het formulier niet goed.",
      },
      {
        date: "2025-06-02",
        text:
          "Ik bel de corporatie over de startdatum van de isolatie. " +
          "Mevrouw vult het formulier voor het energiefonds in. " +
          "Wij regelen samen een nieuwe cv-ketel. " +
          "Ze begrijpt het formulier van het energiefonds niet.",
      },
      {
        date: "2025-09-18",
        text:
          "Mevrouw vraagt de voucher van het energiefonds aan. " +
          "Ze betaalt de eerste termijn van de regeling. " +
          "Ik regel een afspraak met de woningcorporatie over de vochtplek in de hoek.",
      },
      {
        date: "2026-02-11",
        text:
          "Ik maak een afspraak met de corporatie over het vervangen van de voordeur. " +
          "Mevrouw vult het formulier voor de huurtoeslag in. " +
          "Ze heeft COPD en de zuurstofapparatuur vreet stroom.",
      },
    ],
    statuses: [
      { match: "cv-ketel", status: "gedaan", evidence: "Nieuwe ketel geplaatst op 14 augustus, monteur heeft het gemeld.", at_visit: 3 },
      { match: "Energietoeslag aanvragen", status: "gedaan", evidence: "Toekenning van de gemeente per brief, 12 juni.", at_visit: 3 },
      {
        match: "energiefonds invullen",
        status: "niet_gedaan",
        evidence: "Kon het formulier niet invullen, wist niet waar ze het naartoe moest sturen.",
        at_visit: 3,
      },
      { match: "isolatie van de voorgevel", status: "gedaan", evidence: "Corporatie bevestigde de aanvraag per brief op 21 mei.", at_visit: 2 },
    ],
  },
  {
    ref: "HH-027",
    display: "Mevrouw de Boer — Paddepoel",
    comp: "1 volwassene, 74 jaar",
    tenure: "huur-corporatie",
    label: "G",
    hood: "Paddepoel",
    programme: "Gemeente Groningen — energiearmoede 2026",
    coach: "C-07",
    visits: [
      {
        date: "2025-03-11",
        text:
          "Ik regel een betalingsregeling met de corporatie voor de eerste helft van het jaar. " +
          "Mevrouw vult het formulier voor de energietoeslag in. " +
          "Wij vragen kwijtschelding van de gemeente aan. " +
          "Ze is bang voor de corporatie.",
      },
      {
        date: "2025-06-17",
        text:
          "Ik bel de corporatie over de betalingsregeling. " +
          "Mevrouw vult het formulier voor de energietoeslag in. " +
          "Ze vertrouwt de corporatie niet en begrijpt het formulier niet.",
      },
      {
        date: "2025-10-09",
        text:
          "Mevrouw vraagt de voucher van het energiefonds aan. " +
          "Ik vraag een nieuwe brief aan bij de corporatie. " +
          "Ze heeft COPD en de zuurstofapparatuur vreet stroom.",
      },
      {
        date: "2026-02-19",
        text:
          "Ik maak een afspraak met de woningcorporatie over het onderhoud van de verwarming. " +
          "Mevrouw belt de gemeente over de energietoeslag. " +
          "Ze wil geen hulp meer en vertrouwt de corporatie niet.",
      },
    ],
    statuses: [
      { match: "formulier voor de energietoeslag", status: "gedaan", evidence: "Formulier ingeleverd bij de balie, stempel op de kopie.", at_visit: 2 },
      {
        match: "kwijtschelding",
        status: "niet_gedaan",
        evidence: "Kwijtschelding is afgewezen: het formulier vroeg om een DigiD die zij niet heeft.",
        at_visit: 2,
      },
      {
        match: "Afspraak over betalingen",
        status: "niet_gedaan",
        evidence:
          "Tweede afspraak niet gekomen: de corporatie wilde een intake, mevrouw durfde de deur niet open te doen.",
        at_visit: 3,
      },
      { match: "voucher", status: "gedaan", evidence: "Voucher aangevraagd bij het energiefonds, bevestiging per post.", at_visit: 4 },
    ],
  },
  {
    ref: "HH-041",
    display: "Dhr. Osei — Vinkhuizen",
    comp: "2 volwassenen, 1 kind",
    tenure: "huur-prive",
    label: "E",
    hood: "Vinkhuizen",
    programme: "Gemeente Groningen — energiearmoede 2026",
    coach: "C-11",
    visits: [
      {
        date: "2025-04-08",
        text:
          "Ik maak een afspraak met de woningcorporatie over het vocht in de slaapkamer. " +
          "Meneer vult het aanvraagformulier voor de isolatie in. " +
          "Wij vragen de energietoeslag aan bij de gemeente. " +
          "De muur blijft koud en er staat schimmel.",
      },
      {
        date: "2025-07-15",
        text:
          "Ik stuur het aanvraagformulier voor de isolatie op naar de corporatie. " +
          "Meneer vult het formulier voor de energietoeslag in. " +
          "Wij vragen huurverlaging aan bij de gemeente. " +
          "Hij begrijpt het formulier niet en leest de brieven niet.",
      },
      {
        date: "2025-10-07",
        text:
          "Ik vraag een nieuwe brief aan bij de corporatie. " +
          "Meneer vult het aanvraagformulier voor de isolatie in. " +
          "Ze gebruikt de rollator, dus de drempel bij de voordeur is een probleem.",
      },
      {
        date: "2026-01-15",
        text:
          "Ik regel een Turkse tolk voor het volgende gesprek. " +
          "De woningcorporatie stuurt het formulier op. " +
          "Ze heeft een verblijfsvergunning op basis van gezinshereniging en is bang dat de gemeente dat weet. " +
          "Hij begrijpt het formulier niet.",
      },
    ],
    statuses: [
      { match: "Formulier voor de energietoeslag", status: "gedaan", evidence: "Energietoeslag toegekend, brief van de gemeente gezien op 3 juli.", at_visit: 2 },
      {
        match: "huurverlaging",
        status: "niet_gedaan",
        evidence: "Afgewezen: hij heeft een privé-verhuurder en de regeling geldt alleen bij corporaties.",
        at_visit: 3,
      },
      {
        match: "isolatie invullen",
        status: "niet_gedaan",
        evidence: "Het formulier is tweemaal teruggestuurd: verkeerde bijlage, en de brief was alleen in het Nederlands.",
        at_visit: 4,
      },
      { match: "tolk", status: "gedaan", evidence: "Tolk geregeld via het buurtteam, afspraak op 22 januari.", at_visit: 4 },
    ],
  },
];

function build(spec: Spec): Household {
  const actions: Action[] = [];
  const barriers: Barrier[] = [];
  const visits: Visit[] = [];

  spec.visits.forEach((v, vi) => {
    const visit_id = `V-${spec.ref.toLowerCase()}-${v.date}`;
    const ex = extract(v.text, spec.ref, v.date);
    const actions_added: string[] = [];
    const barriers_added: string[] = [];

    for (const ea of ex.actions) {
      // append-only: re-mentioning the same promise at a later visit is a status
      // touch on the existing row, never a second row
      const dup = actions.find((a) => a.what_nl.toLowerCase() === ea.what_nl.toLowerCase());
      if (dup) {
        actions_added.push(dup.action_id);
        continue;
      }
      const action_id = `A-${spec.ref}-${actions.length + 1}`;
      actions.push({
        action_id,
        household_ref: spec.ref,
        who: ea.who as Who,
        what_nl: ea.what_nl,
        by_when: ea.by_when,
        status: "afgesproken",
        evidence: null,
        restricted: ea.restricted,
        set_at_visit: visit_id,
        status_at_visit: visit_id,
      });
      actions_added.push(action_id);
    }

    for (const eb of ex.barriers) {
      if (barriers.some((b) => b.kind === eb.kind && b.restricted === eb.restricted)) continue;
      const barrier_id = `B-${spec.ref}-${barriers.length + 1}`;
      barriers.push({
        barrier_id,
        household_ref: spec.ref,
        kind: eb.kind,
        note_nl: eb.note_nl,
        restricted: eb.restricted,
        visit_id,
      });
      barriers_added.push(barrier_id);
    }

    const restricted_fields: Record<string, string> = {};
    for (const hit of ex.restricted_hits) restricted_fields[hit.field] = hit.value;

    visits.push({
      visit_id,
      household_ref: spec.ref,
      date: v.date,
      coach_ref: spec.coach,
      transcript: v.text,
      actions_added,
      barriers_added,
      restricted_count: ex.restricted_hits.length,
      corrections: [],
      restricted_fields,
    });
    void vi;
  });

  // status pass — decoupled from visit order
  for (const st of spec.statuses) {
    const matches = actions.filter((a) => a.what_nl.toLowerCase().includes(st.match.toLowerCase()));
    if (matches.length !== 1) {
      throw new Error(`${spec.ref}: "${st.match}" matched ${matches.length} actions (need exactly 1)`);
    }
    const v = visits[st.at_visit - 1];
    if (!v) throw new Error(`${spec.ref}: no visit ${st.at_visit}`);
    matches[0].status = st.status;
    matches[0].evidence = st.evidence;
    matches[0].status_at_visit = v.visit_id;
  }

  return {
    household_ref: spec.ref,
    display_nl: spec.display,
    composition_nl: spec.comp,
    tenure: spec.tenure,
    label: spec.label,
    programme: spec.programme,
    consent: { household_visible: true, share_with_corporation: false },
    last_visit: spec.visits[spec.visits.length - 1].date,
    visits,
    actions,
    barriers,
  };
}

const out = SPECS.map(build);
writeFileSync("data/households.json", JSON.stringify(out, null, 2) + "\n");

let allOk = true;
for (const h of out) {
  console.log(`\n${h.household_ref} — ${h.display_nl}  (visits ${h.visits.length}, actions ${h.actions.length})`);
  for (const a of h.actions) {
    console.log(
      `  ${a.action_id.padEnd(11)} ${a.status.padEnd(11)} ${a.who.padEnd(11)} ${a.restricted ? "[RESTRICTED] " : ""}${a.what_nl}${a.by_when ? " · " + a.by_when : ""}`,
    );
  }
  for (const b of h.barriers) {
    console.log(`  ${b.barrier_id.padEnd(11)} ${b.kind.padEnd(12)} ${b.restricted ? "[RESTRICTED] " : ""}${b.note_nl}`);
  }
  const done = h.actions.filter((a) => a.status === "gedaan").length;
  const dropped = h.actions.filter((a) => a.status === "niet_gedaan");
  const openNoDate = h.actions.filter((a) => a.status === "afgesproken" && a.by_when === null).length;
  const restricted = h.visits.some((v) => v.restricted_count > 0);
  const reasonsOk = dropped.every((a) => !!a.evidence && a.evidence.trim().length > 0 && a.evidence !== "—");
  const ok = done >= 1 && dropped.length >= 1 && openNoDate >= 1 && restricted && reasonsOk;
  if (!ok) allOk = false;
  console.log(
    `  §7.1 → done=${done} dropped=${dropped.length} open-no-date=${openNoDate} restricted=${restricted} reasons=${reasonsOk} ${ok ? "OK" : "FAIL"}`,
  );
}
if (!allOk) process.exitCode = 1;
