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
npm test                                # 93 tests in 6 files; expect all green
npx tsc --noEmit                        # strict, clean
npm run build                           # prebuild regenerates fixtures, personas and the 200-run ensemble
npx tsx scripts/verify-chain.ts         # total=9 verified=9 brokenAt=null
```

Acceptance criteria that need a browser are measured, not inferred. With `npm run dev` already
running:

```bash
npm run test:browser                    # 8 real-browser checks, ~90 s
```

It drives a real Chromium (`@sparticuz/chromium` vendors the binary inside its npm tarball; the
NSS symbols it needs are stubbed with gcc because this container has no libnss3). Results here:
**A1** 0 console errors and 0 hydration warnings, **A2** no horizontal scroll at 360/390 px,
**A3** no nested anchors, **A4** every brief prints to exactly 1 A4 page (209.9 × 297.0 mm),
**A11** WCAG AA clean, **A12** first contentful paint 160–328 ms cold against a 1500 ms budget.
See `REVIEW.md` §6.1 for the three real defects this found and the two ways my own harness lied
first.

Current state, verified in this checkout: `tsc` clean, **93/93 tests** plus **8/8 browser
checks**, `next build` exit 0 over 9 screens and 12 API routes, chain `9/9`, and the committed
ensemble breaking **F3 and F5**.

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
