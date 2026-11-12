# Vervolg

**De afspraak die niemand onthoudt.**

Around 550,000 Dutch households are in energy poverty; municipalities run energy-coach programmes
against it, and Dordrecht cut energy poverty from 9.1% to 5.1% in four years — the intervention works.
What breaks the model is **memory**: a coach carrying 120 households cannot recall what was agreed nine
months ago, so every visit starts over and half the agreed actions silently die.
We turn a **spoken visit note into a structured case update**, and give the coach **one page before the
next visit**: what was agreed, what actually happened, what to ask, what to hand over.
The coach edits and owns every word; the household can **see and correct its own file**; nothing about a
household is decided automatically, and nothing is ever visible to a landlord.
**€8–15 per household per year** to the municipality or the housing corporation, against a €200–1,200
per-household intervention that currently leaks because nobody follows up.

---

## Run it

```bash
npm install
npx tsx scripts/seed-audit.ts --force   # writes logs/audit.jsonl (9 rows; row 7 is the tamper demo)
npm run dev                             # http://localhost:3000
```

```bash
npm test                                # 110 tests in 7 files; expect all green
npx tsc --noEmit                        # strict, clean
npm run build                           # prebuild regenerates fixtures, personas and the 200-run ensemble
npx tsx scripts/verify-chain.ts         # total=9 verified=9 brokenAt=null
```

Acceptance criteria that need a browser are measured, not inferred. With `npm run dev` already
running:

```bash
npm run test:browser                    # 14 real-browser checks in both languages, ~4 min
```

It drives a real Chromium (`@sparticuz/chromium` vendors the binary inside its npm tarball; the
NSS symbols it needs are stubbed with gcc because this container has no libnss3). Results here:
**A1** 0 console errors and 0 hydration warnings, **A2** no horizontal scroll at 360/390 px,
**A3** no nested anchors, **A4** every brief prints to exactly 1 A4 page (209.9 × 297.0 mm),
**A11** WCAG AA clean, **A12** first contentful paint 143–287 ms cold against a 1500 ms budget.
A1, A2, A2b, A3, A4, A11 and the mobile-nav check each run **twice — once per language** — because
the English mirror is only real if it is measured. **B** asserts that every screen renders in the
language it was asked for, that the tab title follows it, and that the three pages showing Dutch
case content carry the note explaining why. **B3** walks every route in Dutch and fails if the
navigation or a heading still contains a borrowed English word — the check that was missing when
the Dutch interface shipped half English. **B2** is the one that matters most: it opens the app
inside a frame on another site, where a cookie cannot be written at all, and asserts that the
toggle still switches the whole document — `<html lang>`, tab title and top bar, not just the
body — and that the next link click keeps the choice.
See `REVIEW.md` §6.1 for the three real defects this found and the two ways my own harness lied
first.

Current state, verified in this checkout: `tsc` clean, **110/110 tests** plus **14/14 browser
checks**, `next build` exit 0 over 9 screens and 12 API routes, chain `9/9`, and the committed
ensemble breaking **F3 and F5**.

## Two languages, one product

The brief was written in Dutch, the households are in Groningen, and the coach reads Dutch. So
**Dutch is the default and English is a mirror** — every screen, reachable from the toggle in the
top right, and resolved on the server so the first paint is already in the right language, with no
flash and no `[lang]` segment doubling the nine routes.

The choice travels in the **URL** (`?lang=en`), not in a cookie. A cookie was the first design and
it failed in the only environment that mattered: inside the preview's frame the app is a third
party, `document.cookie` writes are silently discarded, and the button looked dead. So the URL is
the mechanism — it works in any frame, survives a refresh and can be sent to someone — and the
cookie (`vervolg-locale`) is a best-effort optimisation for plain link navigation, with the
`Referer` forwarding the language when the cookie could not be stored. Resolution order is
`?lang=` → middleware header → cookie → `nl`. `REVIEW.md` D-15 has the diagnosis, and browser check
`B2` now pins it by opening the app inside a cross-site frame.

What is translated is the **interface** — navigation, headings, labels, empty states, error
sentences, the review, the lab's ten panels — **and the dossier prose**. The Dutch half is genuinely
Dutch (`Dossiers`, `Zwermlab`, `Opvolgdekking`), because a borrowed English word is not a
translation. Dates, tenure, barrier kinds and correction field names follow the language too.

**The dossier prose is translated too.** Every sentence the extractor produces — action text,
evidence, barrier notes, visit transcripts, household composition — has an English mirror in
`src/i18n/dossier.ts`, keyed by the Dutch sentence itself so a changed extractor rule cannot silently
revert a screen to Dutch. What remains untranslated is only what is not prose:

| Stays as-is | Why |
|---|---|
| Household names, the programme title | Proper nouns: `Familie Yılmaz`, `Gemeente Groningen — energiearmoede 2026`. |
| Field names (`by_when`, `what_nl`) | Database columns and the spec's own schema (§6). |
| The pre-visit brief (§8.3) | The spec says one A4 page, in Dutch. It is read aloud on a doorstep. |
| The value inside a capture field | It is written to the case file; the English reading appears above the editor. |
| The 14 v2 instrument items (§12) | The population answered *these*; a translation would be a different measurement. |
| The swarm fixtures (§11) | The text the spec was written about; the lab says so on screen. |

Anything with no mirror falls back to the Dutch, marked `lang="nl"`, so a missing translation is
always *visible* and never silent. The v1 questionnaire *is* translated, because it is a strawman we
wrote to argue against.

The guarantee is enforced, not asserted: the dictionary's English half is typed as
`Record<DictKey, string>`, so a missing key fails `tsc`; `src/test/i18n.test.ts` checks that no
English value is empty, that every `{placeholder}` matches across languages, and that no English
string is a copy of the Dutch one (with a curated list of the words that are genuinely the same —
*Instrument*, *Audit*, *Review*, *Export*).

No network is required at runtime, and there is no Google Fonts CDN call — the three families are
self-hosted woff2 in `public/fonts/`.

## Screens

| Route | What it is |
|---|---|
| `/` | Coach caseload queue (30 rows). Sorts on **staleness**, **open actions**, **never followed up** — facts about the file, never a score about a person. |
| `/household/HH-027` | Timeline + actions + barriers + restricted fields + corrections. |
| `/household/HH-027/brief` | The one-page pre-visit brief. Prints to a single A4 page. |
| `/household/HH-027/family` | The same file as the household sees it, in plain Dutch, correctable with **“dit klopt niet”**. |
| `/capture` | Note capture: text box + a real `MediaRecorder` path. The recording is real; the transcript is a **pre-written fixture**, stated on the screen before you press record and marked `demo transcript — no ASR called` once it is inserted. |
| `/verify` | Hash-chain verifier + the tamper demo (tamper row 7 → `brokenAt: 7`, reset → `null`). |
| `/swarm` | The Swarm Lab: 240 synthetic agents, playback, scrub, fire-your-own-story, a draggable decision line, two levers, the Report tab. |
| `/survey` | The v1/v2 coverage matrix, per-archetype abstention, and the CSV export. |
| `/review` | The end-to-end review of the build against the spec (deviations, decisions, what is not done). |

## The five ideas, in order

1. **Structure is the product.** A deterministic rules engine over Dutch text extracts actions and
   barriers. It is not a model, it runs offline, and it is byte-for-byte reproducible.
2. **The gate is the product.** Health, debt, legal and family detail go into restricted fields keyed as
   `health_mention_1`, and the brief prints *the field names only*. A restricted value never reaches the
   brief, the household view, a CSV or an API default.
3. **The file is the household's.** Every correction is an appended row in a hash chain, so “the household
   corrected its own file” is a provable event, not a claim in a UI.
4. **The brief is a letter.** One A4, set in Source Serif, with the dropped action and *the real reason it
   was dropped* — because that sentence is the whole product.
5. **The swarm is a sensitivity analysis, not research.** 240 synthetic agents, no language model, the
   prior table on screen. Its output is a frequency with n and a 95% Wilson interval.

## The optional model path

`ENERGYPOOR_MODEL=1` switches on an OpenAI-compatible structurer in `src/domain/structure.ts`.
It is **off by default**, and off is not a degraded mode: a test asserts that `fetch` is never
called and that the result is byte-identical to the rules engine. When it is on, a model answer
may only *append* a validated action — never a barrier, never a change to a `restricted` flag —
and any failure (timeout, HTTP error, bad JSON, wrong shape) falls back to the rules and reports
an `E-MODEL-*` code on the draft. The demo ships with it off.

## What this is not

- No kWh dashboard, no savings calculator, no CO₂ estimate.
- No eligibility engine, no automated outreach, no payment custody.
- No score about a household — not urgency, not risk, not willingness. `npm test` holds this with a grep
  and with a schema assertion on `/api/cases`.
- No integration that shows a household's file to a landlord, a corporation's arrears system or a supplier.
  `/api/household/:ref/brief?share=corporation` returns `E-NOSHARE-01`.
- No real LLM call anywhere in the simulation. Ever. (The optional structurer is a separate,
  default-off path for the *note*, not the swarm, and it never runs without an explicit key.)

## The result that matters

The committed falsifiers say **two things break the pitch**:

- **F3 — trust, p = .095.** Households do not trust the municipality enough to accept the route.
  The welfare organisation does. This is the finding the spec predicted, and the priors were not
  moved to hide it.
- **F5 — leak, p = .662.** One leaked screenshot costs the permission model its majority in two
  thirds of the runs where the leak fires. The permission model is the product.

And one number from the fixtures themselves: of the 20 actions that had a later visit,
**10 were followed up and 10 were never touched again** — the spec's own claim that half of
agreed actions die, measured rather than asserted. See §4 of `REVIEW.md` for why two weaker
definitions were rejected.

## Honesty about the numbers

Every figure in this build is either sourced in the spec (§19) or derived from `data/`. Where the
spec's own regex or fixture would not produce the stated result, the deviation is written down in
`/review` and in `REVIEW.md` rather than papered over.

That includes one correction against myself: I read §11.6 as forbidding any all-positive event,
invented three downside figures the spec does not contain, and reported the resulting flip of
falsifier F6 as a finding about the population. It was an artifact of my own edits. Reverted;
with the spec's numbers F6 holds at p = .720. Recorded as D-08 because the mistake is more
instructive than the result.

Demo — synthetic households. No real person's data is in this build.
