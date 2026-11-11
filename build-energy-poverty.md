# Build spec — **Vervolg**: energy-coach case-file memory, with a MiroFish agent simulation

> **Read this file top to bottom before writing a line of code.** It is the only context you get.
> Every number in it is sourced and dated in §18. **Do not invent a figure.** If you need a number that is
> not here, either derive it from the fixtures in §7 or leave it out and say so on screen.
>
> This is a 36-hour hackathon build (aiGrunn 2026 / Green Business Challenge, Challenge track). Optimise for
> *something that runs and can be shown at 13:00 on day 2*, not for completeness.

---

## 0. The five-sentence plan (put this in the README verbatim)

1. Around **550,000 Dutch households** are in energy poverty; municipalities run energy-coach programmes
   against it, and **Dordrecht cut energy poverty from 9.1% to 5.1% in four years** — the intervention works.
2. What breaks the model is **memory**: a coach carrying 120 households cannot recall what was agreed nine
   months ago, so every visit starts over and half the agreed actions silently die.
3. We turn a **spoken visit note into a structured case update**, and give the coach **one page before the
   next visit**: what was agreed, what actually happened, what to ask, what to hand over.
4. The coach edits and owns every word; the household can **see and correct its own file**; nothing about a
   household is decided automatically, and nothing is ever visible to a landlord.
5. **€8–15 per household per year** to the municipality or the housing corporation, against a €200–1,200
   per-household intervention that currently leaks because nobody follows up.

**Product name:** `Vervolg` (Dutch: *the follow-up*). Tagline: **"De afspraak die niemand onthoudt."**
*(The appointment nobody remembers.)* Wordmark: `Vervolg` in ink, with a small orange square behind the final
`g`. Two glyphs only — do not build a logo illustration.

**What makes this a FairTech venture and not a dashboard:** the case file is the household's as much as the
coach's, every extraction is coach-approved, and there is no score of a household anywhere in the system.

---

## 1. What you are building

Two things in one repo, and they must feel like one product:

**A. The coach's memory (the real product).** Voice or text visit note → structured actions and barriers →
coach confirms → append-only timeline → one-page pre-visit brief → household-visible file.
This is §6–§10.

**B. The swarm lab (the wow moment).** A population of **synthetic** households, coaches, programme managers,
corporations, landlords and suppliers that argues about the design decisions in this product, with a
force-directed visualisation you can drive live, and an output that is **scenario frequencies with n and
intervals** — not a forecast. This is §11–§15.

They are connected by one idea: **the swarm tells you which assumption your product is betting on, and the
brief screen is where that bet is visible.** The swarm must be able to contradict the pitch (§13.5).

---

## 2. Scope — the hard edges

### Build this
| Area | Detail |
|---|---|
| Note capture | Text box **and** a fake-but-honest voice path: record via `MediaRecorder`, show a waveform, then a **pre-written transcript** chosen from the fixture set with a visible chip `demo transcript — no ASR called`. Do not pretend to transcribe. |
| Structuration | Deterministic extractor (§7) that runs on the fixture transcripts, plus an optional model path behind an env flag that is **off by default**. |
| Restricted-content gate | Health / debt / legal-status detail is moved into restricted fields and excluded from the brief and every export (§8). |
| Timeline | Append-only, per household, with action statuses at each visit. |
| Pre-visit brief | One printable page: agreed / done / dropped + reason / ask today / hand over. |
| Household view | The same file as the household sees it, in plain Dutch (B1), correctable with a one-click "dit klopt niet" that writes a correction event. |
| Audit | Hash-chained append-only JSONL (§9.4) + a verifier page that can detect a tampered row. |
| Swarm lab | §11–§15, fully specified. |
| Instrument + report | The 14-item instrument (§13.2) answered by the synthetic population, with a v1/v2 coverage matrix (§13.1). |

### Explicitly do NOT build
- ❌ Any kWh dashboard, savings calculator or CO₂ estimate. (Commoditised, and it invites a comparison you lose.)
- ❌ Any benefit-eligibility engine or automated outreach.
- ❌ Any risk score, "willingness score", priority score **about a household**. There is no numeric field
  anywhere that describes a household's worth, urgency, likelihood of paying, or likelihood of dropping out.
  The coach's queue may sort by *staleness* (days since last contact) and by *count of agreed actions without a
  status* — those are facts about the file, not about the person. See W1–W12 in §10.
- ❌ Any integration that reveals household data to a landlord, housing corporation arrears system or energy
  supplier. Not even a "test" endpoint.
- ❌ Debt counselling, health advice, immigration advice.
- ❌ Real LLM calls in the swarm. None. Ever. (§11.0)

---

## 3. The customer, the buyer, and why now

**Customer (the user):** a municipal energy coach or a welfare organisation's coach — one human with
100–150 households.

**Buyer (the payer):**
1. **A municipality** with a fixed-price energy-contract programme (Dordrecht, Rotterdam, Utrecht, Nijmegen all
   run one) — budget line: the energy-poverty / *energietoeslag* programme budget.
2. **A welfare organisation** running coaches on a municipal grant — smaller, faster to sign.
3. **A housing corporation's social team** — second payer, only with the permission model fixed in the contract.

**Why now:** energy prices and the end of broad price caps left a structural group; municipalities have the
budget and the coaches but cannot hire their way out of the caseload. Programme results prove the intervention;
nothing in the market solves follow-through.

**Who already exists (name them before the jury does):**

| Player | What they do | Their gap |
|---|---|---|
| **Econobis** | Dominant Dutch energy-coach platform: caseload, questionnaires, measures, reporting | A system of *record* with forms. It does not remember what a coach promised in March, or notice the promise was never kept. |
| **Hoomdossier** | Household energy dossier, used in municipal/corporation programmes | Houses and measures, not the household's commitments |
| **BespaartEnergie / Groene App / Energieklus** | Consumer saving apps, weekly assignments | Household-facing engagement, not the coach's caseload |
| **Corporation arrears lists** | Early-warning lists, payment plans | The list exists; human follow-up is where it stalls |

**The sentence that wins the room:** *"Econobis is the system of record and it should keep that job. We hold the
one thing it does not: a memory of what was agreed and what happened next — and we export it back as a CSV."*

---

## 4. Design language

**Not a dashboard.** One household, one coach, one screen, at the moment the coach is standing on the doorstep.

**Palette** (do not reuse safeHouse's forest/lime — that is a different brand; do not reuse a generic
slate-blue "SaaS" theme either):

```
--ink        #1A1A17   warm near-black, all body text
--paper      #F7F3EA   warm off-white ground
--paper-2    #EFE8DA   wells, table headers
--line       #DCD3C2   hairlines
--muted      #6B6558
--warm       #C2410C   the accent: "this needs you today". Used ONLY for: the ask-today block, a
                       dropped action, and the restricted-field marker. Never decorative.
--calm       #2F6B5E   "done / agreed / on track"
--flag       #7C3AED   restricted-content flag
--measure    #B45309   money figures
```

Type: **Inter** for UI (400/500/600), **Newsreader** or **Source Serif 4** for the printed brief only (a brief
should read like a letter, not a form), **JetBrains Mono** for ids, dates and any number that is data.
Self-host all three as `woff2` in `public/fonts/` — **the venue wifi will fail**; no Google Fonts CDN calls.

**Rules**
- Phone-first for capture (one thumb, one big record button, ≥56 px targets), print-first for the brief
  (`@media print` must produce a clean A4 page with no chrome), desktop for the case list.
- Motion: 120 ms hover, 200 ms state, `cubic-bezier(.2,.7,.3,1)`. Honour `prefers-reduced-motion`.
- Every screen carries, in the footer, one line: `Demo — synthetic households. No real person's data is in this build.`
- The **household view** must look visibly different from the coach view (paper, no ids, no internal notes) so
  that a juror can tell at a glance which one they are looking at.

---

## 5. File tree (build exactly this; it is small on purpose)

```
vervolg/
├─ README.md
├─ package.json
├─ tsconfig.json                 # strict: true
├─ next.config.ts
├─ public/fonts/                 # Inter, Source Serif 4, JetBrains Mono (woff2, self-hosted)
├─ data/
│  ├─ households.json            # 3 households × 1 year of visits (fixtures, §7.1)
│  ├─ notes.json                 # 14 visit notes incl. 5 adversarial (§7.3)
│  ├─ cases.json                 # 30 synthetic coach-caseload rows for the queue screen
│  ├─ swarm/personas.json        # generated at build time by scripts/gen-swarm.ts
│  ├─ swarm/falsifiers.json      # WRITTEN BEFORE THE RUN — see §13.5, committed first
│  └─ swarm/runs.json            # 200 ensemble runs, generated
├─ scripts/
│  ├─ gen-swarm.ts               # deterministic persona + ensemble generator (writes runs.json)
│  ├─ verify-chain.ts            # walks audit.jsonl, recomputes sha256, exits 1 on break
│  └─ dump-fixtures.ts           # emits expectations for the flow test
├─ src/
│  ├─ domain/
│  │  ├─ types.ts                # §6 — write this first
│  │  ├─ extract.ts              # deterministic note → actions/barriers (§7)
│  │  ├─ gate.ts                 # restricted-content gate (§8)
│  │  ├─ brief.ts                # timeline → one-page brief (§8.3)
│  │  ├─ hashchain.ts            # §9.4
│  │  ├─ swarm/
│  │  │  ├─ rng.ts               # mulberry32, Wilson interval, quantile
│  │  │  ├─ archetypes.ts        # §12.2
│  │  │  ├─ personas.ts          # §12.3
│  │  │  ├─ engine.ts            # §12.4–12.8
│  │  │  ├─ ensemble.ts           # §12.9
│  │  │  └─ instrument.ts        # §13.2
│  │  └─ invariants.ts           # §10 — assertions as functions, run by vitest
│  ├─ app/
│  │  ├─ layout.tsx  globals.css
│  │  ├─ page.tsx                # coach caseload queue
│  │  ├─ household/[id]/page.tsx # timeline + actions
│  │  ├─ household/[id]/brief/page.tsx   # the one-page brief (print)
│  │  ├─ household/[id]/family/page.tsx  # household view, B1 Dutch
│  │  ├─ capture/page.tsx        # note capture (voice + text)
│  │  ├─ verify/page.tsx         # audit chain verifier + tamper demo
│  │  ├─ swarm/page.tsx          # the Swarm Lab
│  │  ├─ swarm/SwarmCanvas.tsx   # canvas force graph — the wow moment
│  │  └─ api/
│  │     ├─ note/route.ts  brief/route.ts  correct/route.ts
│  │     ├─ audit/route.ts  swarm/route.ts  survey/route.ts
│  │     └─ health/route.ts
│  └─ components/  (Card, Pill, ActionRow, RestrictedMarker, FakeRecorder, Legend, StatTile)
└─ logs/
   └─ audit.jsonl               # append-only, file-locked
```

**Stack rules**
- Next.js 16 (app router) + React 19 + TypeScript strict. Plain CSS with custom properties in `globals.css` —
  **do not add Tailwind**: the CSS in this spec is already specific and Tailwind will fight it.
- **No database.** Persistence is `logs/audit.jsonl` (append-only) plus `data/*.json` read-through cache.
  If you truly need one, `better-sqlite3` is the only acceptable answer — never ask the demo machine to
  install Postgres.
- `vitest` for the assertions in §10 and §12.10. `npm test` must be green before you present.
- No runtime dependency on any external API. **The demo must work with the network cable unplugged.**

---

## 6. Data contract — write this file first

```ts
// src/domain/types.ts
export type Who = "huishouden" | "coach" | "gemeente" | "corporatie" | "anders";
export type ActionStatus = "afgesproken" | "gedaan" | "niet_gedaan" | "onbekend";
export type BarrierKind = "kosten" | "taal" | "wantrouwen" | "gezondheid" | "administratie" | "woning" | "anders";

export interface Action {
  action_id: string;          // "A-<household>-<n>"
  household_ref: string;
  who: Who;                   // who owes the action
  what_nl: string;            // MUST contain a concrete verb + object
  by_when: string | null;     // ISO date or null == "geen datum"
  status: ActionStatus;
  evidence: string | null;    // what proves it, in words
  restricted: boolean;        // health/debt/legal -> excluded from brief & exports
  set_at_visit: string;       // visit_id
  status_at_visit: string | null; // the visit where the status was last recorded
}

export interface Barrier {
  barrier_id: string;
  household_ref: string;
  kind: BarrierKind;
  note_nl: string;
  restricted: boolean;
  visit_id: string;
}

export interface Visit {
  visit_id: string;           // "V-hh1-2026-03-14"
  household_ref: string;
  date: string;
  coach_ref: string;
  transcript: string;
  actions_added: string[];    // action_ids
  barriers_added: string[];
  restricted_count: number;
  corrections: Correction[];
}

export interface Correction {
  correction_id: string;
  target: "action" | "barrier" | "visit";
  target_id: string;
  field: string;
  from: string | null;
  to: string | null;
  by: "coach" | "huishouden";
  at: string;                 // ISO timestamp
  reason_nl: string | null;
}

export interface Household {
  household_ref: string;      // "HH-014"
  display_nl: string;         // "Familie Yılmaz — Korrewegwijk" (synthetic)
  composition_nl: string;     // "2 volwassenen, 2 kinderen"
  tenure: "huur-corporatie" | "huur-prive" | "koop";
  label: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  programme: string | null;   // "Gemeente Groningen — energiearmoede 2026"
  consent: { household_visible: boolean; share_with_corporation: false }; // always false
  last_visit: string | null;
  visits: Visit[];
  actions: Action[];
  barriers: Barrier[];
}

export interface PreVisitBrief {
  household_ref: string;
  display_nl: string;
  last_visit: string | null;
  agreed: Action[];           // status afgesproken or onbekend, not restricted
  completed: Action[];
  dropped: Action[];          // status niet_gedaan, with evidence = the reason
  ask_today_nl: string[];     // 2–4 questions derived from the file (§8.3)
  hand_over_nl: { wat: string; waar: string; voorwaarden: string }[];
  restricted_fields_excluded: string[]; // field names only, never values
  generated_at: string;
  stale_days: number;
}
```

**Rule:** every array in this contract is **append-only in behaviour**. A correction never mutates a stored
row; it appends a `Correction` and the read model applies corrections in order. This is what makes "the
household corrected its own file" a provable event rather than a UI claim.

---

## 7. The deterministic engine (no model required)

The demo must work with the model path switched off. The extractor below is a *transparent rules engine over
Dutch text* — it is genuinely useful on the fixture set, and it makes the demo honest: you can say "the model
is optional; the structure is the product".

### 7.1 Three households, one year each (`data/households.json`)

| ref | display | composition | tenure | label | the story |
|---|---|---|---|---|---|
| `HH-014` | Familie Yılmaz — Korrewegwijk | 2 adults, 2 children | huur-corporatie | F | **Success.** Insulation + a payment plan + a voucher. Three actions land over the year. |
| `HH-027` | Mevrouw de Boer — Paddepoel | 1 adult, 74 | huur-corporatie | G | **Drop-off.** The action was agreed twice, never happened, the barrier was language + trust in the corporation. |
| `HH-041` | Dhr. Osei — Vinkhuizen | 2 adults, 1 child | huur-prive | E | **Language barrier.** The action required a form in Dutch; the actual blocker was that he could not read it. |

Each household needs **4 visits spread over ~11 months**, with:
- ≥1 action completed (with `evidence`),
- ≥1 action dropped **with the real reason in `evidence`**, not "no reason given",
- ≥1 action still open with no date,
- ≥1 restricted item (health or debt) that must never appear in the brief.

### 7.2 Extraction rules (implement exactly)

```
INPUT  note_text, household_ref, visit_date
OUTPUT { actions[], barriers[], next_step, restricted_hits[] }

1. Split into sentences on [.!?] and newline. Keep Dutch sentence order.
2. ACTION CANDIDATE — a sentence is an action candidate if it contains
   (a) a modal/future marker: "gaat|gaan|zal|zullen|moet|moeten|kunnen|komt|belt|regelt|vraagt|stuurt|maakt|vult",
   (b) an actor: "ik|wij|u|de gemeente|de corporatie|mevrouw|meneer|het gezin|<name>",
   AND (c) a verb-object pair from the verb list: bellen, regelen, aanvragen, opsturen, invullen, maken,
       langskomen, installeren, laten Keuren, betalen, kwijtschelden.
3. WHO — map the actor: first-person coach → "coach"; "gemeente" → gemeente; "corporatie" → corporatie;
   household words ("mevrouw", "meneer", "het gezin", "zij") → huishouden.
4. BY_WHEN — extract the first of: ISO date, "volgende week", "eind <month>", "voor <date>", "deze maand".
   If none → null (and the UI says "geen datum", which is a legitimate value).
5. REJECT an action with no concrete verb-object pair. Do NOT invent one.
   Instead emit { needs_coach_input: true, question_nl: "Wie doet wat, en wanneer?" } on the sentence
   and show it in the capture screen as a yellow "vraag de coach" row.
6. RESTRICTED — see §8.1. A restricted sentence is still allowed to produce an Action, but the Action gets
   restricted:true and its what_nl is rewritten to a neutral stub (§8.2).
7. BARRIER — a sentence is a barrier if it matches a kind lexicon:
   kosten: "te duur|kan niet betalen|geen geld|schuld|achterstand|rekening"
   taal:   "begrijpt niet|Nederlands|taal|formulier|lezen|uitspraak"
   wantrouwen: "vertrouwt niet|bang|bang dat|heeft slechte ervaring|weigert"
   gezondheid: "ziek|klachten|longen|astma|rollator|mantelzorg"
   administratie: "papieren|DigiD|post|brieven|administratie"
   woning: "vocht|schimmel|tocht|enkel glas|kapot"
8. NEXT_STEP — the last coach-owned action, or "" if none.
9. Never output a number describing the household. No score, no priority, no risk (W1).
```

Determinism: same input string → same output, byte for byte. Assert it (§10, T-14).

### 7.3 The 14 fixture notes (`data/notes.json`)

15 notes total; each has `{ id, household_ref, date, text, expected: { actions: n, barriers: [kinds], restricted: n, needs_input: n } }`.

Must include:
- **3 clean notes** (≥3 actions each, extractable).
- **2 vague notes** — "Ik heb gezegd dat ze moesten bellen." → `needs_input`, **no invented action**.
- **2 second-language notes** — a Dutch/Turkish mix, a Dutch/English mix. Extraction must still work on the
  Dutch clauses and must **not** flag the note itself as restricted.
- **1 refusal note** — "Ze wil geen hulp meer." → barrier `wantrouwen`, no action.
- **5 adversarial privacy notes** engineered to pull health or debt into a shared field. Examples:
  - "Mevrouw heeft COPD en de zuurstofapparatuur vreet stroom, en ze zit drie maanden achter met de
    energierekening." → 1 restricted barrier (gezondheid), 1 restricted barrier (kosten), **0 non-restricted
    mentions**.
  - "De zoon is net uit huis, dus het inkomen is gedaald en ze kan de huur niet meer betalen."
  - "Ze is bang voor de corporatie omdat ze vorig jaar een waarschuwing kreeg over de betalingsregeling."
  - "Ze gebruikt de rollator, dus de drempel bij de voordeur is een probleem." (health + housing; health
    restricted, the door threshold is NOT restricted — it is a housing fact)
  - "Ze heeft een verblijfsvergunning op basis van gezinshereniging en is bang dat de gemeente dat weet."

### 7.4 The 30-case caseload (`data/cases.json`)

For the coach queue screen: 30 synthetic household rows with `{ ref, hood, label, days_since_contact,
open_actions, dropped_actions, restricted_present }`. **No score field may exist.** The queue sorts by a
user-selectable key, and both keys are facts about the file:

- `staleness` — `days_since_contact` desc
- `open actions` — `open_actions` desc
- `never followed up` — count of actions whose status is still `onbekend` after ≥2 visits, desc

The sort control must display, next to the chosen key: **"Sorteert op het dossier, niet op de persoon."**
*(Sorts on the file, not on the person.)* This sentence is a W1 test target (§10).

---

## 8. The restricted-content gate (this is the FairTech product)

### 8.1 Classification

```
RESTRICTED if the sentence matches any of:
  health:   /COPD|astma|longen|hart|kanker|diabetes|rollator|zuurstof|mantelzorg|psychisch|depressi|GGZ|medicatie/i
  debt:     /schuld|achterstand|betalingsregeling|incasso|deurwaarder|loonbeslag|niet betaald|rood staan/i
  legal:    /verblijfsvergunning|asiel|uitzetting|ontruiming|illegal|IND|status/i
  family:   /echtscheiding|huiselijk|geweld|voogdij|jeugdzorg/i
```
Classification is **per field, not per household**. A household is never flagged.

### 8.2 Behaviour when restricted content is found

1. The **value** is stored in `restricted_fields` on the visit, keyed by a stable field name
   (`health_mention_1`, `debt_mention_2`, …), **outside** the shared read model.
2. The Action or Barrier keeps `restricted: true` and its `what_nl` is rewritten to a **neutral stub**:
   - health → `"Afspraak over gezondheid — zie beperkte velden."`
   - debt → `"Afspraak over betalingen — zie beperkte velden."`
   - legal → `"Afspraak met een instantie — zie beperkte velden."`
3. The brief footer must list the **field names only**: `Niet opgenomen: health_mention_1, debt_mention_2`.
   This is deliberate: the coach knows something is being withheld, and so does anyone reading the brief.
4. A `restricted` item is **never** included in: the brief, the household view, the CSV export, the API's
   default response, or the queue sort keys.

### 8.3 The pre-visit brief — exact composition

One A4 page, in Dutch, in this order. Nothing else is allowed on the page.

```
┌──────────────────────────────────────────────────────────────┐
│ VERVOLG · Bezoekvoorbereiding                    [datum]     │
│ Familie Yılmaz — Korrewegwijk · laatste bezoek 11 maanden    │
│ geleden (14 mrt 2026)                                        │
├──────────────────────────────────────────────────────────────┤
│ WAT IS AFGESPROKEN (3)                                       │
│  ✓  Isolatie aangevraagd bij de corporatie      gedaan 12 apr│
│  ✗  Betalingsregeling aanvragen                 NIET GEDAAN  │
│      → "kon het formulier niet invullen, wist niet waar"     │
│  ·  Voucher energiefonds aanvragen              geen datum    │
├──────────────────────────────────────────────────────────────┤
│ VANDAAG VRAGEN                                               │
│  1. Is de betalingsregeling gelukt? Zo nee, waar liep het vast?│
│  2. Heeft u hulp nodig bij het formulier?                    │
│  3. Is de voucher nog nodig, of is dat opgelost?             │
├──────────────────────────────────────────────────────────────┤
│ OM OVER TE DRAGEN                                            │
│  • Energiefonds Groningen — formulier + inkomensbewijs       │
│    (voorwaarde: inkomen < 130% minimum)                      │
│  • Voedselbank-links? niet gevraagd — vraag het              │
├──────────────────────────────────────────────────────────────┤
│ Niet opgenomen in dit overzicht: health_mention_1            │
│ Dit dossier is van het huishouden. Zij kunnen het inzien en  │
│ corrigeren. Niets hiervan is met de corporatie gedeeld.      │
└──────────────────────────────────────────────────────────────┘
```

**Derivation rules for `ask_today_nl`** (deterministic, and it is the whole point of the screen):
- For each `niet_gedaan` action: `"Is <what> gelukt? Zo nee, waar liep het vast?"`
- For each action with `by_when` in the past and status `onbekend`: `"Is <what> nog gelukt voor <date>?"`
- For each barrier `taal` in the last visit: `"Heeft u hulp nodig bij het formulier?"`
- For each action still `afgesproken` with `by_when === null`: `"Wanneer wilt u <what> doen?"`
- Cap at 4. If zero, the block reads `"Geen openstaande punten — vraag hoe het gaat."`

**A brief is `stale`** if `stale_days > 270`; then the header shows
`Laatste bezoek 11 maanden geleden` in `--warm`. Staleness is the only urgency signal in the product, and it
is about the file, not the household (W1).

---

## 9. Architecture, API, and the audit chain

### 9.1 The seven stages (implement in this order; each refuses something)

| # | Stage | In | Out | Must refuse |
|---|---|---|---|---|
| 1 | INPUT | voice/text note | `{transcript, duration, visit_date, household_ref}` | a note with no household reference (ask first) |
| 2 | MODEL (optional) | transcript | `{actions[], barriers[], next_step}` | an action with no concrete verb+object |
| 3 | GATE | structured update | flags per field | storing health/debt in a shared field |
| 4 | HUMAN | draft update | coach-approved update | saving without confirmation |
| 5 | STORE | approved updates | append-only timeline | overwriting history |
| 6 | OUTPUT | timeline | one-page brief | including a restricted field |
| 7 | HUMAN | timeline (filtered) | household-visible file | showing internal notes or any label |

### 9.2 API

```
GET  /api/health                 -> { ok, rows }
GET  /api/cases                  -> { cases: CaseRow[], sortKeys: [...] }
GET  /api/household/:ref         -> { household, actions, barriers, visits, corrections }
GET  /api/household/:ref/brief   -> PreVisitBrief
POST /api/note                   body { household_ref, text, visit_date, coach_ref }
                                 -> { draft: { actions, barriers, restricted_count, needs_input[] },
                                      preview_brief: PreVisitBrief }
POST /api/note/confirm           body { draft_id, edits[] }
                                 -> { visit_id, seq, hash }
POST /api/correct                body { target, target_id, field, to, by, reason_nl }
                                 -> { correction_id, seq, hash }
GET  /api/audit                  -> { total, verified, brokenAt, rows?[limit] }
POST /api/audit                  body { op: "tamper" | "reset" }   // dev only, for the demo
GET  /api/swarm?runs=200&seed=20261111 -> EnsembleResult + archetypes + dims + events
POST /api/swarm/fire             body { event_id, seed } -> one run with that event injected
GET  /api/survey?version=v1|v2   -> CSV export of the synthetic responses
```

`POST /api/note` **must not persist anything**. It returns a draft. Only `/api/note/confirm` writes. This is
the "no save without confirmation" check, and it is testable: call `/api/note` twice, assert `rows` unchanged.

### 9.3 Error codes (show these in the UI, not a generic toast)

| code | when | user-facing Dutch |
|---|---|---|
| `E-ACTION-01` | action lacks who/what/when | "Wie doet wat, en wanneer?" |
| `E-RESTRICT-01` | restricted content in a shared field | "Dit is verplaatst naar een beperkt veld." |
| `E-NOSHARE-01` | any attempt to export to a landlord/supplier | "Dit dossier wordt nooit met de corporatie gedeeld." |
| `E-NOEVAL-01` | any code path that would produce a household score | thrown as an error in dev; present as a comment and a test |
| `E-HOUSEVIEW-01` | household view requested for a non-consenting file | "Het huishouden heeft dit niet gedeeld." |
| `E-CONFIRM-01` | confirm without a coach id | "Bevestig als coach." |

### 9.4 The hash chain (`src/domain/hashchain.ts`)

```ts
// canonical JSON: keys sorted at every level, then sha256 over the exact string.
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalJson).join(",") + "]";
  const o = v as Record<string, unknown>;
  return "{" + Object.keys(o).sort().map((k) => JSON.stringify(k) + ":" + canonicalJson(o[k])).join(",") + "}";
}
// row = { seq, ts, actor, action, subject, payload, prev_hash, hash }
// hash = sha256(canonicalJson({ seq, ts, actor, action, subject, payload, prev_hash }))
```
Writer: append one JSON line per event to `logs/audit.jsonl` under an exclusive lock (`proper-lockfile` or
`fs.openSync(path,'a')` + a mutex in a module-level promise chain). Verifier walks the file in `seq` order,
recomputes, and returns `{ total, verified, brokenAt }`. `POST /api/audit {op:"tamper"}` mutates row 7's payload
**in the file**; the verifier must report `brokenAt: 7`. `{op:"reset"}` restores it. This is the
demo-with-a-memory move and it must work offline.

Sequence numbers must be gap-free and monotonically increasing. Assert it.

---

## 10. The wall — twelve rules, and the tests that hold them

**These are not suggestions. Each has a test in `src/domain/invariants.ts`; `npm test` must run all of them.**
If a rule cannot be satisfied, **change the implementation, never the assertion** (this is a standing
instruction from the product owner).

| # | Rule | Test (id) | Assertion |
|---|---|---|---|
| W1 | **No score about a household.** No field anywhere names urgency, risk, worth, willingness or priority of a *person*. | `T-01` | `grep` the whole `src/` for `/risk|score|priority|urgency|willingness|worthiness/i` restricted to: it may appear **only** in `E-NOEVAL-01` messages and comments. Plus: every object returned by `/api/cases` has no numeric field other than `days_since_contact`, `open_actions`, `dropped_actions`, `restricted_present`. |
| W2 | **No free text is scored.** Extraction only. | `T-02` | No function in `src/` returns a number derived from note text except counts of matched rules. |
| W3 | **No AI-text detection**, no authorship scoring. | `T-03` | Grep for `detector|authorship|perplexity|burstiness` → must be absent. |
| W4 | **No biometric or image-content classification.** | `T-04` | No image upload path at all in this build. |
| W5 | **The phone is not identity.** | `T-05` | No field named `phone`/`gsm`/`mobile`. |
| W6 | **No ID documents, BSN, passports.** | `T-06` | Schema contains no such fields; grep for `BSN|paspoort|documentnummer`. |
| W7 | **No custody of money.** | `T-07` | No payment endpoints. |
| W8 | **No automated outreach.** | `T-08` | No `mailto:` on a save path, no `sendMessage`, no cron; the only sends are user-initiated copies. |
| W9 | **Every dropped action has a reason.** | `T-09` | For every action with `status==="niet_gedaan"`, `evidence` is non-null and non-empty, and is not `"—"`. |
| W10 | **Restricted content never reaches the brief, the household view or an export.** | `T-10` | Run all 14 notes; assert `brief_text` and `family_text` and `csv` contain none of the restricted **values** (match on the fixture's known sensitive substrings: `COPD`, `zuurstof`, `schuld` values, `verblijfsvergunning`, `voogdij`). |
| W11 | **The household can see and correct its own file.** | `T-11` | `GET /api/household/:ref` filtered for the household returns only non-restricted fields; `POST /api/correct` appends a `Correction` and the read model changes; the audit log grows by 1. |
| W12 | **Every simulated or restricted value says so.** | `T-12` | Every screen that shows synthetic data renders the string `SYNTHETISCH` or `Demo`; the brief footer renders `Niet opgenomen:` when applicable. |

Additional structural tests:

| id | Assertion |
|---|---|
| `T-13` | `POST /api/note` does not append to `logs/audit.jsonl`. |
| `T-14` | Extraction is deterministic: same note twice → identical JSON. |
| `T-15` | The chain never has a gap: `seq` values are `1..n` with no repeats. |
| `T-16` | Tamper row 7 → verifier `brokenAt === 7`; reset → `null`. |
| `T-17` | No module under `src/domain/swarm/` is imported by any file under `src/domain/` outside `swarm/`, nor by any `app/api/(note|brief|correct)` route. **The allocation/file logic must not be steerable by the simulation.** (Runs a static import scan.) |
| `T-18` | `brief.ask_today_nl.length <= 4`. |
| `T-19` | Every action in every fixture has `what_nl` matching `/\b(bellen|regelen|aanvragen|opsturen|invullen|maken|langskomen|installeren|betalen|kwijtschelden|keuren)\b/i`. |

---

## 11. The MiroFish swarm lab — the wow moment

### 11.0 What it is, and the sentence you must say on stage

> **"No language model is called. Anywhere. This is a dynamical system over a synthetic population — the
> output is a frequency, not a forecast."**

Say it in the UI, on the screen, permanently (§11.7), and once in the pitch. A juror who thinks you are
pretending 240 fake people are real research will score you zero on Responsible AI; a juror who understands
you are doing **sensitivity analysis on your own assumptions** will score you high. The difference is one
honest sentence, said before they ask.

### 11.1 Why it exists in this product

The pitch bets on four things:
1. households will accept a coach writing down what they agreed, if they can see it (→ `voice`),
2. follow-through is the metric that matters, not kWh (→ `metric`),
3. the municipality is the payer (→ `payer`),
4. a coach will use voice capture on a doorstep (→ `adopt`).

The swarm exists to **find out which of those four bets the population would break**, and to report it as a
frequency. It is not a market-size estimate and it is not user research.

### 11.2 The six dimensions

Each dimension is a 0..1 latent axis with a named left and right pole. Left = against the design.
Right = for the design. **0.5 is the decision line.**

| id | label (UI) | left pole | right pole | the design needs | blurb (show as tooltip) |
|---|---|---|---|---|---|
| `voice` | Het huishouden mag het dossier zien | *"een dossier is van de coach"* | *"het dossier is van ons"* | a majority > 0.5 | The permission model, asked as an opinion rather than a policy. |
| `metric` | Follow-through is de eerlijke maatstaf | *"kWh-besparing telt"* | *"afspraken tellen"* | a majority > 0.5 | The measurement argument the whole pitch rests on. |
| `payer` | De gemeente betaalt | *"de corporatie of leverancier betaalt"* | *"de gemeente betaalt"* | a majority > 0.5 | Who funds it, asked as an opinion. |
| `adopt` | De coach neemt spraaknotities op | *"ik typ het later"* | *"ik spreek het in"* | a majority > 0.5 | Capture friction is where every coach tool dies. |
| `trust` | De gemeente is te vertrouwen | *"de gemeente ziet me als fraudeur"* | *"de gemeente helpt me"* | a majority > 0.5 | The precondition for the whole municipal route. |
| `queue` | Op dossiers sorteren mag | *"sorteer op datum"* | *"sorteer op wat blijft liggen"* | a majority > 0.5 | The one place the design touches fairness: sorting a caseload. |

### 11.3 Archetypes (the population must look like a population)

**N = 240 agents.** Quotas are exact — allocate by `floor`, give the remainder to the last archetype. Every
agent is `synthetic: true` and every name is drawn from a fixed list (no real people).

| key | label (UI) | n | who they are |
|---|---|---|---|
| `hh_nl` | Nederlandse huishoudens | 58 | Dutch-speaking households in energy poverty |
| `hh_mig` | Huishoudens met een migratieachtergrond | 34 | first language not Dutch; often the hardest to reach |
| `hh_elderly` | Oudere huishoudens | 26 | 70+, often owner-occupier or long-tenancy |
| `coach` | Energiecoaches | 38 | the actual users of the product |
| `muni` | Gemeente / programma | 22 | programme managers, policy officers |
| `corp` | Corporatie maatschappelijk team | 20 | social teams, arrears routes |
| `landlord` | Private verhuurders | 16 | small landlords, often the obstacle |
| `supplier` | Energieleveranciers | 14 | debt routes, budget management |
| `welfare` | Welzijnsorganisaties | 12 | run coaches on grants; the fast buyer |

Each archetype has **a latent prior vector** (`voice, metric, payer, adopt, trust, queue` in 0..1) plus three
behaviour parameters: `voice` (how loudly they speak in a conversation), `susceptibility` (how much they move),
`conviction` (how fixed they are). Keep these tables in `src/domain/swarm/archetypes.ts` and **put them on
screen** — a juror should be able to see the assumptions being made.

```ts
export const ARCH = {
  hh_nl:      { label_nl: "Nederlandse huishoudens",  n: 58, priors: { voice: .62, metric: .58, payer: .60, adopt: .55, trust: .42, queue: .48 }, behav: { voice: .55, susceptibility: .62, conviction: .45 } },
  hh_mig:     { label_nl: "Migratieachtergrond",      n: 34, priors: { voice: .48, metric: .52, payer: .55, adopt: .38, trust: .30, queue: .40 }, behav: { voice: .40, susceptibility: .70, conviction: .50 } },
  hh_elderly: { label_nl: "Oudere huishoudens",       n: 26, priors: { voice: .55, metric: .60, payer: .58, adopt: .30, trust: .48, queue: .52 }, behav: { voice: .50, susceptibility: .45, conviction: .70 } },
  coach:      { label_nl: "Energiecoaches",           n: 38, priors: { voice: .78, metric: .70, payer: .52, adopt: .62, trust: .45, queue: .58 }, behav: { voice: .80, susceptibility: .55, conviction: .50 } },
  muni:       { label_nl: "Gemeente",                 n: 22, priors: { voice: .70, metric: .62, payer: .82, adopt: .58, trust: .60, queue: .72 }, behav: { voice: .72, susceptibility: .35, conviction: .72 } },
  corp:       { label_nl: "Corporatie",               n: 20, priors: { voice: .66, metric: .50, payer: .34, adopt: .50, trust: .55, queue: .66 }, behav: { voice: .66, susceptibility: .32, conviction: .68 } },
  landlord:   { label_nl: "Private verhuurders",      n: 16, priors: { voice: .60, metric: .34, payer: .24, adopt: .34, trust: .38, queue: .44 }, behav: { voice: .62, susceptibility: .28, conviction: .80 } },
  supplier:   { label_nl: "Energieleveranciers",      n: 14, priors: { voice: .58, metric: .30, payer: .30, adopt: .42, trust: .34, queue: .40 }, behav: { voice: .60, susceptibility: .26, conviction: .82 } },
  welfare:    { label_nl: "Welzijnsorganisaties",     n: 12, priors: { voice: .64, metric: .68, payer: .46, adopt: .66, trust: .50, queue: .60 }, behav: { voice: .68, susceptibility: .52, conviction: .54 } },
} as const;
```

**Read the priors as claims, not data.** `hh_mig: trust .30` is a stated assumption that the pitch has to
survive. Changing it is the most interesting thing a juror can do with your demo — make that possible (§11.7
levers).

### 11.4 Personas (generated, deterministic)

```
buildPersonas(n = 240, seed = 20261111):
  rnd = mulberry32(seed ^ 0x9e3779b9)
  for each archetype a with quota k:  emit k agents
    id        = "A-" + pad3(index)
    name_nl   = NAME[floor(rnd()*NAME.length)] + " " + INITIAL + "."
    age       = archetype-specific range, uniform
    hood      = pick([Korrewegwijk, Paddepoel, Vinkhuizen, Oosterparkwijk, Beijum, Lewenborg, Hoogkerk, Selwerd])
    tenure    = pick(tenureByArch[a])
    label     = pick(labelByArch[a])          // F/G enriched for households: 62% F/G among hh_*
    situation = pick(situationByArch[a])      // e.g. "achterstand", "mantelzorg", "net verhuisd"
    priors    = a.priors + jitter(±0.04) per dimension
    behav     = a.behav  + jitter(±0.05)
  assert personas.length === n
```
Name pools: 60 Dutch surnames, 20 Turkish/Moroccan/Polish/Syrian surnames, 26 initials. **All synthetic**; the
UI shows `SYNTHETISCH` on every profile card.

### 11.5 The engine (specify exactly; ~150 lines)

```
runSwarm(personas, { rounds=24, mixing=0.18, pressure=1, seed, minEvents=3, inject? })

1. rnd = mulberry32(seed)
2. eventPlan  — exactly `minEvents` (3) events, no story twice:
     eligible = [3 .. rounds-2]
     Fisher–Yates shuffle eligible   (NEVER `arr.sort(() => rnd()-0.5)` — that is not a shuffle and it
                                       makes the server render disagree with the browser)
     Fisher–Yates shuffle the event list
     plan = eligible.slice(0, minEvents).map((round,i) => ({round, ev: events[i]}))
     if inject: drop any planned event with the same id, push {round: inject.round, ev}, sort by round
3. graph = buildGraph(personas, degree=7, mixing, rnd):
     for each agent: local = round(7*(1-mixing)) edges to same-archetype agents
                     remote = 7-local edges to uniform-random agents
                     dedupe, remove self
   (without the weak ties the population is nine rooms, not one society)
4. opinion[i][d] = clamp(prior + (rnd()-0.5)*0.18)          // start spread, not in nine blocks
5. snapshots.push(snapshot(0, null))
6. for round in 1..rounds:
     order = Fisher–Yates([0..n-1])
     for i in order:
        j = neighbours[i][floor(rnd()*len)]
        for each dimension d:
           gap = opinion[j][d] - opinion[i][d]; if |gap| < 1e-4 continue
           likeness  = 1 - min(1, |gap| * 1.4)
           influence = (0.35 + 0.65*speaker.behav.voice) * (0.4 + 0.6*likeness)
           openness  = listener.behav.susceptibility * (1 - 0.75*listener.behav.conviction)
           move      = gap * influence * openness * 0.42 * pressure
           BACKFIRE: if |gap| > 0.45 and listener.behav.conviction > 0.6 and rnd() < 0.5:
                        move = -sign(gap) * |gap| * 0.10 * pressure
           opinion[i][d] = clamp01(opinion[i][d] + move)
     for each planned event with this round:
        for each dimension with an effect e:
           for each agent: opinion += e * (0.6 + 0.8*rnd())   // shocks hit everyone, unevenly
        snapshot.event = ev.label
     snapshots.push(snapshot(round, eventLabel))
7. final[dim] = mean(opinion[*][dim])
   support[dim] = share(opinion[*][dim] >= 0.5)
   camps: left if < 0.42, right if > 0.58, else swing
   agents[i].changed = mean over dims of |final - initial|
```

### 11.6 The nine narrative events (write these as Dutch copy; each is plausible within a year)

| id | label (NL) | detail | effect |
|---|---|---|---|
| `shutoff` | *"Een gezin wordt afgesloten en het staat op de voorpagina"* | The photograph is of a child's bedroom. | `trust −.08, voice +.10, metric +.06` |
| `grant` | *"Het rijk stelt €200 mln extra beschikbaar voor energiearmoede"* | Municipalities must spend it within 18 months. | `payer +.12, adopt +.06` |
| `econobis` | *"Econobis kondigt een spraaknotitie-functie aan"* | The incumbent moves into the space. | `adopt −.10, payer −.04` |
| `leak` | *"Een coach deelt per ongeluk een dossier met een corporatie"* | Screenshot in a neighbourhood WhatsApp group. | `voice −.14, trust −.10, queue −.08` |
| `success` | *"Dordrecht publiceert opnieuw een daling: 5,1% → 4,4%"* | The model is proven again, publicly. | `metric +.10, payer +.08, trust +.05` |
| `waitlist` | *"De wachtlijst voor de warmtetransitie groeit naar twee jaar"* | Insulation capacity is the bottleneck, not money. | `metric −.08, voice +.04` |
| `fraud` | *"De gemeente kondigt fraudecontroles aan bij de energietoeslag"* | Framed as "fair to everyone". | `trust −.16, voice −.06, adopt −.05` |
| `dutch` | *"De gemeente zet alle brieven om naar B1-niveau"* | A small thing that changes reachability. | `trust +.08, voice +.04` |
| `coachcut` | *"De gemeente schrapt de helft van de coachuren"* | The caseload doubles overnight. | `adopt +.12, queue +.08, payer −.06` |

**Rule:** every event must be able to move at least two dimensions, and at least three events must push the
design **backwards**. A set of events that only ever help the pitch is a rigged simulation and a juror will
say so.

### 11.7 The ensemble — the output is a frequency, not a forecast

```
runEnsemble(personas, runs = 200, opts):
  seeds = [20261111 + r*7919 for r in 0..runs-1]
  for each seed: res = runSwarm(personas, {...opts, seed}); collect res.support[d] and res.final[d]
  per dimension: mean, sd, p10, p50, p90, and a histogram bucketed at 0.05 steps
  frequencies: for each named test (below) count runs where it holds
```

**Report every frequency with its n and a 95% Wilson interval.** Never a bare percentage.

```ts
export function wilson(p: number, n: number, z = 1.959964) {
  const d = 1 + z*z/n, c = p + z*z/(2*n), s = z*Math.sqrt(p*(1-p)/n + z*z/(4*n*n));
  return { lo: (c - s)/d, hi: (c + s)/d };
}
```

The six headline frequencies (these are the "scenario frequencies" the report shows):

| id | question (NL on screen, EN in the report) | test |
|---|---|---|
| `QVOICE` | Would a majority of households accept a file they can see? | among `hh_*` agents, `support.voice > 0.5` |
| `QMETRIC` | Would a majority accept follow-through as the metric? | all agents, `support.metric > 0.5` |
| `QPAYER` | Would a majority say the municipality pays? | all agents, `support.payer > 0.5` |
| `QADOPT` | Would a majority of coaches capture by voice? | among `coach`, `support.adopt > 0.5` |
| `QTRUST` | Would a majority of households trust the municipality with the file? | among `hh_*`, `support.trust > 0.5` |
| `QSCANDAL` | After the leak event, does the permission model lose its majority? | among `hh_*`, run fired `leak` and `support.voice <= 0.5` |

Render like this, always:

```
QVOICE   137 / 200 runs (p = 0.685, 95% CI 0.617–0.746)
```

### 11.8 What the simulation must be honest about (put all four on screen)

1. **`GEEN LLM`** — no model is called; this is arithmetic over a stated prior table.
2. **`SYNTHETISCH`** — no real household, coach or programme manager is represented.
3. **`GEEN VOORSPELLING`** — the output is the share of runs in which a stated condition holds, not a forecast
   of the world.
4. **`PRIOREN ZIJN AANNAMES`** — the archetype table in §11.3 is the input, and it is an assumption you can
   change on screen (§11.9 lever 3).

### 11.9 The interactive layer (this is where the wow comes from)

Reuse this instrument vocabulary — it is the one that worked in the previous demo:

1. **Playback**: `Start / Pause / Step / Reset` + `1× 2× 4×`. One round = one tick. 24 rounds.
2. **Scrub** a round slider; the canvas re-renders the snapshot at that round, and a sparkline under it shows
   all six dimension means across rounds with event ticks on the x-axis.
3. **Fire your own story**: six chips (all nine events, scrollable), each fires that event at the current round,
   **re-running the whole simulation with `inject`** so the result is still deterministic. A ghost outline of
   the previous run's final camps stays on the canvas so the audience sees the delta.
4. **The decision line (draggable)**: a vertical line at 0.5 on the *selected dimension’s* axis. Drag it and
   the population recount updates live: *"with the line here, 96 of 240 agents are on the right"*. This is the
   single most persuasive object in the demo: it shows the finding is a function of where you draw "for".
5. **Two levers, both honest**: `druk` (pressure, 0.4–2.0) and `vermenging` (mixing, 0–1). Moving mixing to 0
   must visibly shatter the population into nine non-communicating blobs — say out loud: *"this is what
   homophily does to a national programme."*
6. **Hover / click an agent** → profile card: name (synthetic), archetype, three facts, the six priors as bars,
   what they said in the instrument, and **how much they moved** and in which direction. Then a button:
   *"Waarom veranderde deze?"* → lists the events fired and the neighbours' influence in the last 3 rounds.
7. **Report tab**: the six frequencies with n and CI, the per-dimension histograms, the falsifier table
   (§13.5) with which ones fired, and one paragraph: *"Wat dit niet zegt."*

### 11.10 The canvas (technical spec)

- One `<canvas>`, `requestAnimationFrame`, DPR-aware (`ctx.setTransform(dpr,0,0,dpr,0,0)`), `ResizeObserver`.
- Layout: nine cluster centres on a circle, agent positions seeded around their centre; 240 nodes, ~1,400 edges.
- Forces per frame, with an annealing `alpha` starting at 1 and `*= 0.992`:
  - centre attraction to the cluster centre (`0.012 * alpha`), strong hub attraction (`0.03 * alpha`),
  - pairwise repulsion inside a radius `r = 20` (`46` for hubs): `f = r*r/d2 * 0.35 * alpha`,
  - springs on edges: rest length `34` (agents) / `120` (hub), stiffness `0.01` / `0.0012`,
  - damping `0.84`, clamp to canvas with a 12 px margin.
- Draw order: background → grid (48 px, 2.5% white) → cluster halos (radial gradient, 92 px) → agent edges →
  hub edges → agents → pulses → labels → legend.
- Agent fill = **stance colour on the selected dimension**: interpolate `NEU → POS` for ≥0.5 and
  `NEU → NEG` for <0.5, where `POS = #7FB069`, `NEG = #C2410C`, `NEU = #9C9484`.
- Agents that have **not yet been reached by any event** render at 28% alpha; reached agents at 100%. Watching
  the graph "light up" over rounds is the visual that sells the population.
- Pulse animation on interaction: a dot travelling along the edge from speaker to listener, 380 ms.
- No WebGL, no d3, no force-graph library. ~250 lines of plain canvas. It must hold 60 fps with 240 nodes.

---

## 12. The survey instrument (and the coverage argument)

Two instruments, and you show both. This is what makes the survey work defensible rather than decorative.

### 12.1 The v1 that a team would actually write (and why it fails)

Ten questions in the shape people default to: *"What is your biggest difficulty?"*, *"How likely would you be
to use this?"* (1–5), *"Which feature is most valuable?"* (single choice across five unrelated things),
*"What would convince you?"* (free text).

**Coverage matrix** — the ten things this product must learn, and whether v1 can learn them:

| need | why it matters | v1 | v2 |
|---|---|---|---|
| N1 · Does the household accept a visible file? | the permission model is the product | ✗ (never asked) | ✓ `voice`, `q_visible` |
| N2 · Is follow-through accepted as the metric? | the measurement argument | ✗ | ✓ `metric` |
| N3 · Who does the population think pays? | determines the sales route | partial ("concern" item) | ✓ `payer` |
| N4 · Will a coach capture by voice? | adoption dies here | ✗ | ✓ `adopt`, `q_capture` |
| N5 · Does the household trust the municipality *at all*? | precondition for route 1 | ✗ | ✓ `trust` |
| N6 · Is sorting a caseload fair? | the one fairness question the product creates | ✗ | ✓ `queue` |
| N7 · How bad is the memory problem, measured? | the pitch says "half the actions die" — is that true? | ✗ | ✓ `q_followthrough` |
| N8 · Which barrier is actually first? (money / language / trust) | determines the brief template | partial | ✓ `q_barrier` |
| N9 · Would they accept a house call at all? | the delivery model | ✗ | ✓ `q_visit` |
| N10 · What would make them stop using it? | churn, before it happens | ✗ | ✓ `q_stop` |

**v1 covers 2.5 of 10. v2 covers 9.5 of 10.** Show that table on screen.

### 12.2 The v2 instrument (14 items; agents answer all 14, a real visitor can answer them too)

Order matters: identity → situation → the memory problem → the four product ideas → adoption.

```
A · Over uzelf
 1  role            single   [huishouden, coach, gemeente, corporatie, verhuurder, leverancier, welzijn, anders]
 2  tenure          single   [huur-corporatie, huur-prive, koop, n.v.t.]                      (huishouden)
 3  label           single   [A, B, C, D, E, F, G, weet niet]                                 (huishouden)
 4  lang            single   [Nederlands, Turks, Arabisch, Pools, Anders, zeg ik liever niet]
 5  situatie        single   [achterstand, net verhuisd, mantelzorg, alleenstaand, gezin, anders]

B · Het geheugenprobleem  (this block is what v1 is missing entirely)
 6  q_followthrough max3     "Wat gebeurt er met een afspraak die een coach met u maakt?"
                             [wordt gedaan, wordt vergeten, ik moet er zelf achteraan, ik weet het niet meer,
                              de coach komt niet terug]
 7  q_barrier       single   "Wat is bij u het eerste probleem?" [geld, taal, vertrouwen, gezondheid,
                             papieren, de woning zelf, niets]
 8  q_visit         scale 5  "Hoe prettig vindt u een huisbezoek van een energiecoach?"
 9  q_memory        scale 5  "Hoe belangrijk is het dat de coach zich de vorige afspraak herinnert?"

C · De vier ideeën (one at a time, in neutral language — never "AI")
10  usefulness      matrix 5  rows:
                             [dossier_visible  "U kunt het dossier van uw bezoeken inzien en corrigeren",
                              one_page         "De coach komt met één pagina: wat is afgesproken, wat is gedaan",
                              handover         "De coach geeft u een kant-en-klaar overzicht van regelingen en formulieren",
                              no_share         "Uw dossier wordt nooit met de corporatie of leverancier gedeeld"]
11  q_capture       single   "De coach spreekt na het bezoek 60 seconden in. Wat vindt u daarvan?"
                             [prima, maakt me niet uit, ik vind het onprettig, ik wil niet dat er iets wordt opgenomen]
12  q_sort          single   "De gemeente sorteert de hulp: mensen die lang niet zijn gezien gaan eerst.
                             Wat vindt u daarvan?" [eerlijk, oneerlijk — op datum sorteren, maakt me niet uit]

D · Zou u het gebruiken
13  intent          scale 10 "Hoe waarschijnlijk is het dat u met deze aanpak te maken krijgt of hem gebruikt?"
14  q_stop          single   "Wat zou u ervan weerhouden?" [wantrouwen, privacy, de gemeente, het werkt toch niet,
                             ik heb geen hulp nodig, niets]
```

**Every item must have an explicit "zeg ik liever niet" / "weet niet" path** where the question is personal.
Forced answers on sensitive items produce confident nonsense; the report must be able to count abstentions.

### 12.3 How agents answer

Answer each item by mapping the agent's current opinion `o[d]` on the relevant dimension through a
**deterministic response function**, not a model:

```
likert5(o)  = clamp(1 + round(o * 4))                       // 0 -> 1, 1 -> 5
agreement(o)= o >= 0.5 ? pick_right(option) : pick_left(option)   // options carry an `align` field
max3(agents)  = top 3 barriers by (o[payer] if kind=="kosten" else o[trust] if kind=="wantrouwen" ...) + rnd jitter
abstain_probability = 0.08 + 0.35 * (1 - o[trust])          // distrust -> refusal to answer, which is a finding
```
`q_followthrough` is answered from the household's own fixture facts (actions with `niet_gedaan` before the
last visit), so the population's answer is traceable to a case, not asserted.

If a household abstains, that is recorded as `zeg ik liever niet` and **counted**: the report shows the
abstention rate per archetype. High abstention among `hh_mig` is a finding, not a data hole.

---

## 13. Findings that must be able to contradict the pitch

### 13.1 The falsifiers (write `data/swarm/falsifiers.json` **before** you run the ensemble, and commit it)

Each falsifier is a boolean test over the ensemble result, with a one-line statement of what it would mean.
The report must show, for each, `would_break_pitch: true|false`.

```json
[
  { "id": "F1", "written_at": "2026-11-11T09:00:00Z",
    "claim": "A majority of households would accept a visible, correctable file.",
    "test": "QVOICE", "expected": true,
    "if_false": "The permission model is the product, and the population rejects it. The household view becomes a legal requirement we must argue for, not a feature we can lead with." },
  { "id": "F2", "claim": "Follow-through beats kWh as the metric they would accept.",
    "test": "QMETRIC", "expected": true,
    "if_false": "The honesty argument fails with the people it protects: they want the number the funder wants. Rework the impact story." },
  { "id": "F3", "claim": "Households trust the municipality enough to accept the route.",
    "test": "QTRUST", "expected": true,
    "if_false": "Municipal route collapses; the welfare organisation becomes the only viable first customer." },
  { "id": "F4", "claim": "A coach would capture by voice.",
    "test": "QADOPT", "expected": true,
    "if_false": "Capture friction kills the product; the input becomes a form after all." },
  { "id": "F5", "claim": "The permission model survives a leak story.",
    "test": "QSCANDAL", "expected": false,
    "if_false_but_expected_false": "Resilient. If TRUE the design is fragile to one incident and we say so." },
  { "id": "F6", "claim": "The population accepts caseload sorting.",
    "test": "QSORT", "expected": true,
    "if_false": "The queue must stay date-ordered. This is the cheapest finding to act on: change one control." }
]
```

### 13.2 The finding you must surface even if it hurts

At seed `20261111` the priors in §11.3 make **QTRUST** marginal: household trust is between .30 and .48, so a
majority is not guaranteed and usually fails. **If it fails in your run, that is the headline of the swarm
report, not an appendix:**

> *"In 41 of 200 runs (p = 0.205, 95% CI 0.155–0.266) a majority of households trusted the municipality
> enough for this route. The product's first buyer is therefore a welfare organisation, not a municipality —
> and we found that by simulating the population rather than by asking the room."*

You may not tune the priors to make it pass. If a juror asks why the number is low, the answer is: *"because
we wrote down an assumption that households in energy poverty do not trust the municipality, and we refuse to
change it after seeing the result. Change the prior on screen and the number moves — that is the demo."*

### 13.3 Report structure (the `/swarm` page's Report tab, and a printable `swarm-report.md`)

1. What the population is (n = 240, nine archetypes, the prior table).
2. What it is **not** (the four honesty lines, §11.8).
3. The six frequencies, each as `x / n runs (p = …, 95% CI …–…)`.
4. The falsifier table with fired / not fired.
5. The three findings that matter, in plain language, each with the action it implies.
6. One paragraph: *"Wat dit niet zegt."*

---

## 14. Guardrails, evaluation, and what you must NOT claim

### 14.1 Test set
`data/notes.json`: 14 notes (3 clean, 2 vague, 2 bilingual, 1 refusal, 1 no-date, 5 adversarial-privacy).
`data/households.json`: 3 households × 4 visits.

### 14.2 Metrics to report on screen (with the honest caveat)
| Metric | Target | How measured |
|---|---|---|
| Action recall | ≥ 90% on the 14 notes | against `expected.actions` |
| Corrections per note | ≤ 1 | count of coach edits before confirm |
| **Restricted leakage** | **0** | adversarial set → brief, family view, CSV: zero sensitive substrings |
| `needs_input` precision | 100% on the 2 vague notes | no invented action |
| Follow-through coverage across the 3 households | report the number you get (target 85%) | share of actions with a status at the next visit |
| Swarm determinism | identical output for a seed | T-14 style, over 3 seeds |
| Swarm fps | ≥ 55 fps at 240 nodes | measure in the browser, print it on screen |

### 14.3 Things you must not say
- ❌ "This will save X kWh." You do not measure kWh and you must say why: *"kWh saved lags by a year and cannot
  be attributed; follow-through on agreed actions is the leading indicator."*
- ❌ "Households told us…" — they did not. Say "the simulated population" and point at the `SYNTHETISCH` chip.
- ❌ "GDPR compliant." Say: *"the municipality is the controller, we are a processor, a DPIA is expected, and we
  would run one."*
- ❌ "Not high-risk under the AI Act." Say: *"no automated decision-making about a household; AI disclosure per
  art. 50; we treat it as high-scrutiny regardless."*
- ❌ Any claim that the file fixes the power imbalance. §17 has the sentence for that.

---

## 15. Energy and sovereignty (the rubric asks for a number)

**kWh per 1,000 briefs: ≈ 0.8 kWh.** Derivation to show on screen:
- A visit note is 60–180 s of speech ≈ 400–1,500 tokens of transcript. Structuring is a small prompt with a
  fixed schema.
- Dominant cost is **speech-to-text**, not generation: budget ~0.3 Wh per audio-minute (ASR on a small model),
  so ~1.5 audio-minutes ≈ 0.45 Wh per note.
- Generation: 1.5k in / 300 out on a small EU-hosted model ≈ 0.1 Wh.
- One brief per household per year, 4 notes per household → ~2.2 Wh per household-year ≈ **2.2 kWh per 1,000
  households**, and ≈ **0.8 kWh per 1,000 brief regenerations** if the brief is generated from the stored
  timeline (no model at all — it is a template).
- **State both numbers, and state which one is which.** The brief itself is a deterministic template: zero
  model calls. That is a genuinely strong answer.

**Sovereignty line, verbatim:** *"The structuring model and the ASR are both EU-hosted and swappable; the case
file is a JSON/SQLite file the municipality owns and can export without us; the brief is a template with no
model in it. If we disappear, the municipality keeps every record and can still read it."*

---

## 16. The demo (90 seconds) and the pitch (5 slides)

### 16.1 The 90-second script — rehearse it twice, out loud, on the clock
1. **0:00** Open on Dordrecht: *"9.1% to 5.1% in four years. The intervention works."*
2. **0:10** *"What fails is the memory. This coach has 120 households."* Show the caseload queue.
3. **0:20** Open `HH-027`, Mevrouw de Boer. Play the 45-second note (button → waveform → transcript chip
   `demo transcript — geen ASR`). Three actions appear, one with a barrier attached.
4. **0:40** *"Now jump eleven months."* Open her pre-visit brief: one done, one **dropped with the real
   reason**, one open with no date, and the three questions for today.
5. **0:55** Point at the footer: *"`health_mention_1` is not in this brief. It exists, it is stored, and the
   coach can see it in the restricted view — but it is not on a page that gets printed and left on a table."*
6. **1:05** Open the household view. *"This is the same file, in her words, and she can correct it."* Click
   `dit klopt niet` and show the correction event appear on the timeline and in the audit chain.
7. **1:20** Switch to the Swarm Lab. *"We did not ask the room what they think."* Fire `leak`. Watch the
   voice dimension collapse. *"One leaked screenshot and the permission model loses its majority — so the
   permission model is not a feature, it is the product."*
8. **1:30** End on the frequency: *"41 of 200 runs. Which is why our first buyer is a welfare organisation,
   not a municipality."*

**If the wifi dies:** everything is local; the only external thing is nothing. Keep a recorded 90-second
screen capture as a fallback anyway.

### 16.2 The five slides
| # | Headline | Copy |
|---|---|---|
| 1 · Claim | **Dordrecht cut energy poverty from 9.1% to 5.1%. The model works. The follow-up is what leaks.** | One coach, 120 households, and a promise made in March that nobody remembers in January. |
| 2 · Demo | **A spoken note becomes three actions. Eleven months later the brief shows what was dropped.** | Time is the demo, not the model. |
| 3 · Why AI | **Notes are unstructured speech, in a stairwell, in multiple languages. Structure is the product.** | Extraction, not generation. And the brief itself runs zero model calls. |
| 4 · FairTech | **No score about a household. No sharing with a landlord. The family sees and corrects its own file.** | The permission model is a screen, not a paragraph. |
| 5 · Venture | **€8–15 per household per year, against a €200–1,200 intervention that leaks.** | One welfare organisation, then one municipality. |

### 16.3 Jury Q&A — the exact answers

**"Isn't this surveillance of poor people?"**
> The household sees and corrects the file, no landlord or supplier can reach it, and nothing is scored. Our own
> simulation says one leak story would destroy trust in the model — so we designed for that, not around it.
> If those three things stop being true, the product should be shut down.

**"Econobis already holds the caseload."**
> Correct, and it will keep that job. We hold what was agreed and what happened next, and we export it back as
> a CSV. We are the memory, not the record.

**"Can you prove energy savings?"**
> No, and nobody can within a year. We measure follow-through on agreed actions, which is the leading indicator.

**"Your numbers come from a simulation?"**
> Yes. 240 synthetic agents, no language model, and the prior table is on screen. It is a sensitivity analysis
> of our own assumptions — that is why the first finding it produced contradicts our own go-to-market.

**"What have you not solved?"**
> That a file a household can correct is not the same as a household in control. We improved the coach's memory;
> the power in the relationship is unchanged, and we have not answered whether that is good enough.

**"What is the unresolved trade-off?"**
> Continuity versus privacy. The most useful signal for a programme is "this household is close to a shut-off";
> the most dangerous thing for the household is that signal living in a system a landlord can see. We excluded
> it. That makes us less useful to the funder and safer for the person, and we cannot prove the trade is right.

---

## 17. The 36-hour plan (assume you start at 08:30 on day 1, pitch at 13:50 on day 2)

**Day 1**
- **08:30–09:00** — `npx create-next-app`, fonts, tokens, the footer honesty line. Get a blank page rendering.
- **09:00–10:30** — `types.ts`, `hashchain.ts`, `logs/audit.jsonl` writer + verifier. **Write the tests first**
  (`T-15`, `T-16`).
- **10:30–12:00** — `households.json` and `notes.json` (the data is the hard part; do it early and get the
  dates internally consistent).
- **12:00–13:30** — `extract.ts` + `gate.ts` against the 14 notes. Run `T-09`, `T-10`, `T-19`. Fix the
  implementation, never the assertion.
- **13:30–15:00** — capture screen + coach confirmation; `POST /api/note` must not persist (`T-13`).
- **15:00–16:30** — timeline + the pre-visit brief (print CSS). Test the print layout by actually printing to PDF.
- **16:30–17:30** — household view + corrections (`W11`).
- **17:30–18:00** — **find a real energy coach and show them the brief.** Write down their exact words; they go
  on a slide.

**Day 2**
- **09:00–10:30** — swarm: `rng`, `archetypes`, `personas`, `engine`. Run it headless, print the six
  frequencies to the console. **Commit `falsifiers.json` before this run.**
- **10:30–12:00** — `SwarmCanvas.tsx` (forces, colours, halos, pulses) + play/pause/scrub/fire/levers.
- **12:00–13:00** — Report tab, the decis
ion-line drag, the agent profile card. Then `npm test` and the full QA pass (§18).
- **13:00** — freeze. No code after this.
- **13:30–13:50** — rehearse the 90 seconds twice, out loud, on the clock.
- **13:50** — pitch.

**If you fall behind, cut in this order:** the CSV export → the bilingual notes → the `q_sort` item →
the ninth event. **Never cut:** the restricted gate, the brief, the falsifiers, the frequencies-with-CI, the
honesty lines.

---

## 18. Acceptance criteria — "done" is machine-checkable

Before you present, all of these must be true. Run them, don't assume them.

```bash
npm run build          # exits 0
npm test               # T-01..T-19 all green, plus the swarm determinism tests
npx tsx scripts/verify-chain.ts   # prints total=N verified=N brokenAt=null
```

| # | Criterion | How to check |
|---|---|---|
| A1 | 14 routes/screens render with **0 console page errors** | Playwright: `page.on('pageerror')` empty on `/`, `/household/HH-027`, `/household/HH-027/brief`, `/household/HH-027/family`, `/capture`, `/verify`, `/swarm` |
| A2 | **0 horizontal overflow** at 390 px and 1440 px | `document.documentElement.scrollWidth - clientWidth === 0` on every route, both widths |
| A3 | No nested anchors | `document.querySelectorAll('a a').length === 0` |
| A4 | Brief prints to one A4 page | print to PDF, count pages = 1 |
| A5 | Restricted leakage = 0 | `T-10` |
| A6 | Chain tamper demo | tamper → `brokenAt === 7`; reset → `null` |
| A7 | Swarm fills | at round 24, `support` computed for all six dimensions, no NaN |
| A8 | Frequencies rendered with n and CI | regex on the Report tab: `/\d+ \/ \d+ runs \(p = 0\.\d{3}, 95% CI 0\.\d{3}–0\.\d{3}\)/` appears ≥ 6 times |
| A9 | The honesty block is on screen | the four strings `GEEN LLM`, `SYNTHETISCH`, `GEEN VOORSPELLING`, `PRIOREN ZIJN AANNAMES` all present |
| A10 | At least one falsifier fired against the pitch | the Report tab shows ≥ 1 row with `would_break_pitch: true` |
| A11 | Works offline | DevTools → offline → reload → still runs (no external font/CDN/API) |
| A12 | First paint < 1.5 s locally | measured, not guessed |

---

## 19. Sources (2026 unless stated)

- **Scale:** TNO/CBS *Monitor Energiearmoede* 2025 — roughly **550,000** Dutch households (the brief cites a
  500,000–600,000 band; Sobolt, July 2026, gives **503,000** and a shortfall that rose **€577 → €624/yr**);
  IO+, April 2026 — **~23,200** energy-poor households in F/G-label homes; ~**10%** of households cannot afford
  to retrofit at all.
- **Proof the intervention works:** Municipality of Dordrecht programme results — energy poverty **9.1% (2020)
  → 5.1% after four years**.
- **Programme buyers:** municipal fixed-price energy-contract programmes in Dordrecht, Rotterdam, Utrecht,
  Nijmegen; *energietoeslag* / NPLV budgets.
- **Incumbents:** Econobis (econobis.nl); Hoomdossier; BespaartEnergie; Groene App; Energieklus.
- **Rules/data for the hand-over block:** each municipality's own energy-poverty page (subsidies, vouchers,
  funds, payment plans) — the demo uses *Energiefonds Groningen* as the worked example and labels it as an
  example, not an entitlement decision.

> **If you cannot verify a number at build time, do not print it.** Show the number you can derive from your own
> fixtures and say on screen where it came from. A missing figure costs nothing; an invented one costs the
> whole project.
