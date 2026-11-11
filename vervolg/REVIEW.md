# Build review — `build-energy-poverty.md` → `vervolg/`

An end-to-end review of the spec and of the build, written against it. The same
content is browsable at **`/review`** inside the app.

The spec opens with an instruction that shaped every decision:

> Every number in it is sourced and dated in §18. **Do not invent a figure.** If you
> need a number that is not here, either derive it from the fixtures in §7 or leave
> it out and say so on screen.

Where the spec contradicts itself — and in four places it does — I changed the
implementation and wrote the deviation down here rather than quietly asserting
something the code cannot deliver. No assertion was weakened to make a test pass;
in every case the implementation changed.

---

## 1. Verdict

| | |
|---|---|
| Spec sections implemented | §0 – §19 |
| Routes | 9 screens + 12 API routes, all 200 |
| Tests | **77 green** in 5 files (`T-01` … `T-19`, chain, API, swarm determinism, layout) |
| `next build` | exits 0 |
| `scripts/verify-chain.ts` | `total=9 verified=9 brokenAt=null` |
| Restricted leakage | **0** across brief, family view, CSV, API and extractor output |
| Falsifiers breaking the pitch | **2 of 6** (F3 trust, F5 leak) |
| Deviations | 12, all listed in §3 |

---

## 2. What the spec gets right

Worth saying, because most of the spec is unusually well-constructed:

1. **The gate is the product, not a feature.** §8 makes the restricted field a first-class
   storage concept and then forces its *name* onto the printed brief. That single design
   decision is what made W10 testable instead of aspirational.
2. **"No save without confirmation" is testable.** §9.2 says `POST /api/note` must not
   persist. That is a byte-comparison test (T-13), not a code review.
3. **The falsifiers must be committed before the run.** §13.1's ordering constraint is the
   whole integrity of the simulation section. It is enforced here by git history: see commit
   `swarm: write falsifiers before the ensemble run (§13.1)`, which contains only
   `falsifiers.json`, before `scripts/gen-swarm.ts` had ever executed.
4. **The queue may only sort on facts about the file.** §7.4 names the three keys and the
   sentence that must appear next to them. That is a precise, checkable FairTech constraint.
5. **The brief is a letter, and it must carry the reason.** §8.3's dropped-action block with
   `→ "kon het formulier niet invullen, wist niet waar"` is the most persuasive screen in the
   product, and it is derived, not written.

---

## 3. Deviations, with reasons

### D-01 · Word boundaries in every lexicon

The patterns in §8.1 and §7.2 are unbounded. With `match` semantics:

- `taal` (barrier lexicon) matches **`betaalt`** — every sentence about paying becomes a
  language barrier.
- `IND` (legal) matches **`sinds`** — "sinds vorige week" becomes a legal-status hit.
- `eind` (date extraction) matches `IND` inside `verblijfsvergunning`-adjacent text.

Unbounded patterns would classify ordinary Dutch sentences as restricted — the exact
opposite of the gate's purpose. All lexicons are word-bounded, and the two collisions are
now explicit test cases.

### D-02 · The debt pattern had to cover the spec's own example

§7.3 requires `N-011` ("… ze kan de huur niet meer betalen") to produce a **restricted
kosten** barrier. The literal debt pattern is `niet betaald|rood staan|…` — it does not
match "kan … niet betalen". The pattern was extended with the conjugations the spec itself
uses (`kan … niet betalen`, `achter met`, `betalingsregeling`) rather than editing the
fixture, because the fixture is the requirement.

### D-03 · Clause-level redaction of shared barrier notes

§7.2 rule 6 says a restricted sentence may still produce an Action, which then gets a neutral
stub. It says nothing about **barriers**, and that gap is where content leaks: the
non-restricted `woning` barrier for `N-013` was being stored as the whole sentence, including
"Ze gebruikt de rollator". The extractor now splits on coordinating conjunctions and drops
the restricted clauses, so:

- "Ze gebruikt de rollator, dus de drempel bij de voordeur is een probleem." →
  restricted `gezondheid` barrier **and** a shared `woning` barrier reading
  "De drempel bij de voordeur is een probleem."
- "Mevrouw heeft COPD …, en ze zit drie maanden achter met de energierekening." →
  two restricted barriers, **zero** shared mentions (the §7.3 requirement).

This is the change that makes T-10 pass against the fixtures instead of only in principle.

### D-04 · The family view was leaking transcripts — a real bug

**This is the finding of the review.** The first version of `buildFamilyView` rendered
`visit.transcript.slice(0, 160)`. The transcript is the coach's raw dictation, so the
household-facing screen contained:

> "Ze heeft COPD en de zuurstofapparatuur vreet stroom."

W10 caught it. The fix is not a filter but a change of artefact: the family view shows what
was **agreed at each visit** (the non-restricted actions added there), never the dictation.
A raw note is not a household-facing document. Worth stating plainly because it is exactly
the class of mistake the gate exists to prevent, and it was introduced by the same person
who wrote the gate.

### D-05 · T-19 excludes restricted rows

§8.2 rule 2 replaces a restricted action's text with "Afspraak over betalingen — zie beperkte
velden." There is no verb in that string, by design: the verb would be the disclosure. T-19
therefore asserts the closed verb list on every **non-restricted** row, and the stub is
asserted separately to contain no content verb.

### D-06 · Seven named frequencies, not six

§11.7 names six headline frequencies. §13.1's falsifier F6 tests `QSORT`, which is not among
them. A falsifier that cannot be evaluated is worse than a seventh line, so the report shows
all seven; the six headline rows render first.

### D-07 · Injection replaces, it does not grow

The literal reading of §11.5 (drop any planned event with the same id, then push the new one)
can produce four events when the injected story was not already planned. The plan is now
capped at `minEvents`, so "exactly three events" holds after injection too.

### D-08 · I over-corrected §11.6, caught it, and reverted

§11.6's rule is: *"every event must be able to move at least two dimensions, and at least three
events must push the design **backwards**. A set of events that only ever help the pitch is a
rigged simulation."* The rule is about the **set**. Individual all-positive events are
explicitly allowed, and the spec's own table contains three (`grant`, `success`, `dutch`).

I read it as "no event may be all-positive" and added invented downside figures to all three:

| event | spec | what I added | why it was wrong |
|---|---|---|---|
| `grant` | `payer +.12, adopt +.06` | `queue −.05` | the spec's detail says "spend within 18 months", not "capacity fails" |
| `success` | `metric +.10, payer +.08, trust +.05` | `queue −.03` | I invented "opponents contest harder" |
| `dutch` | `trust +.08, voice +.04` | `adopt −.03` | I invented "whoever doesn't read it notices nothing" |

Three invented numbers, all of which made the product look worse than the spec's own model —
the opposite of the usual bias, but still invention, and §0 forbids inventing a figure. Worse,
the added `queue` and `adopt` pushes changed the ensemble enough to flip **F6 (sorting) from
p = .720 to p = .370**, and I then reported that flip as a finding about the population. It was
an artifact of my own edits.

Reverted to the spec's table exactly. With the spec's numbers, **F6 holds at p = .720** and the
committed falsifiers reproduce the pre-edit run byte for byte. The test now asserts all three
effects are equal to §11.6's table, so this cannot drift again.

The lesson is worth recording because it is the failure mode of this kind of work: a plausible
sounding sentence ("demand outruns supply") is indistinguishable from a sourced one unless
someone checks the source. The check is now a test.

### D-09 · `reset` restores a backup; it does not recompute

A reset that recomputed hashes would prove nothing: the chain would "verify" because the
reset said so. `tamper` writes a byte-for-byte copy to `logs/audit.jsonl.bak` and `reset`
copies it back. The verifier is the only thing that judges.

### D-10 · W1 does not scan the tests, and a negation is not a violation

The tests contain the forbidden tokens because they are the assertion. `sourceFiles()`
excludes `src/test/`. Separately, the product legitimately prints "Geen cijfer over een
huishouden" and "Staleness is het enige signaal van *dit vraagt aandacht*"; a negated
mention is stripped before the scan, because the rule forbids the **field**, not the
promise that there is none.

### D-11 · Scrubbing shows the shape, and says so

The engine stores per-round means and support, not every agent's opinion at every round.
When the slider scrubs, the canvas scales each agent's final stance toward that round's mean.
Means and support are exact; positions are the shape. It is labelled on screen, and the
alternative (≈24 × 240 floats) was a second source of truth next to the engine for no demo
value.

### D-12 · The test suite was silently corrupting the demo fixture

Worth listing because it was invisible for most of the build. `chain.test.ts` and `api.test.ts`
took their audit-log snapshot in `beforeEach`. The log is shared mutable state on disk, so the
second test's snapshot already contained the rows the first test had appended — and the
`afterAll` restore faithfully restored the corrupted version. Effect: every `npm test` left
three extra rows in `logs/audit.jsonl`, so the demo's "row 7" tamper story slowly drifted, and
`verify-chain.ts` reported `total=12` after a test run instead of `total=9`.

CI would not have caught this: the rows are valid and the chain verifies. It was found by
seeding, running the suite, and comparing the byte count — which is now the check. The snapshot
is taken once per file in `beforeAll`, restored once in `afterAll`, and the suite leaves the log
byte-identical (asserted by the cycle in §2).

---

## 4. Numbers this build actually produces

Not from the spec — from `data/`. Reproduce with `npm test` and `npx tsx scripts/gen-swarm.ts`.

| Measure | Value | Where it comes from |
|---|---|---|
| Action recall on the 15 notes | 15/15 | `T-14` compares every note to `expected` |
| Restricted leakage | 0 | `T-10` across 5 surfaces |
| `needs_input` precision on the 2 vague notes | 2/2 | `N-004`, `N-005` — no invented action |
| Restricted fields in the fixtures | 3 | `debt_mention_1`, `health_mention_1`, `legal_mention_1` |
| Dropped actions with a real reason | 5/5 | `T-09`; none is `"—"` |
| Follow-through coverage, 3 households | **50%** (10/20 eligible actions) | derived from `households.json` |
| Ask-today on `HH-027` | 4 (the cap) | §8.3 derivation rules |
| Staleness `HH-027` | 266 days → not stale | threshold is 270 |
| Swarm | 240 agents × 24 rounds × 200 runs in ≈1.2 s | `data/swarm/report.json` |
| Canvas frame rate | printed live on `/swarm` | measured in the browser, not asserted |

The 50% is **below** the spec's 85% target, and it is the single most useful number the
build produces — because it is the spec's own thesis, measured:

> "a coach carrying 120 households cannot recall what was agreed nine months ago, so every
> visit starts over and **half the agreed actions silently die**"

Of the 26 actions across the three households, 6 were agreed at the household's most recent
visit and never had a later visit at which a status could have been observed. The denominator
is therefore 20 eligible actions: **10 were followed up, 10 were never touched again.** Half.
The pitch says "half the actions die"; the fixtures say 50%; the number on screen now carries
its own definition underneath it.

Two weaker definitions were tried and rejected:

- Counting all 26 gives 38%, which measures the fixture calendar (how many visits each
  household happens to have) rather than the product.
- Counting every action that merely *has* a status gives 77%, which flatters the product by
  including actions that were agreed and confirmed in the same visit.

The strictest honest definition — "did anyone come back to this after the visit at which it
was agreed?" — gives 50%. That is the one on screen. Reaching 85% would require inventing
observations, which §7's opening instruction forbids.

---

## 5. The swarm result

Falsifiers committed before the run (§13.1), run once, nothing tuned afterwards:

```
QVOICE    157 / 200 runs (p = 0.785, 95% CI 0.723–0.836)
QMETRIC   170 / 200 runs (p = 0.850, 95% CI 0.794–0.893)
QPAYER    161 / 200 runs (p = 0.805, 95% CI 0.745–0.854)
QADOPT    169 / 200 runs (p = 0.845, 95% CI 0.788–0.889)
QTRUST     19 / 200 runs (p = 0.095, 95% CI 0.061–0.144)
QSCANDAL   43 /  65 runs (p = 0.662, 95% CI 0.540–0.765)
QSORT     144 / 200 runs (p = 0.720, 95% CI 0.654–0.778)
```

**Two falsifiers break the pitch.**

- **F3 — trust (p = .095).** *"Households trust the municipality enough to accept the route"*
  needs a majority; it gets 9.5%. A municipal first buyer is not supported by the priors. The
  welfare organisation is — its route scores higher on every dimension. This is the finding
  §13.2 predicted, and the priors were not moved to avoid it. It is the single most consequential
  result in the build: it says the product should ship through the welfare organisation, not the
  municipality.
- **F5 — leak (p = .662).** *"The permission model survives a leak story"* holds only below 50%.
  Conditional on the leak firing, the pitch loses its majority in two thirds of runs. The
  permission model **is** the product, so this is a statement about fragility, not a detail.

**Four falsifiers hold**, including **F6 — sorting (p = .720)**: the population *does* accept
sorting a caseload on facts about the file, which is the FairTech design constraint working as
intended. Note that F6 is the falsifier I accidentally broke by inventing effect sizes — see
D-08. The committed number is the spec's number.

Two things about this table matter more than the numbers:

1. **Every line carries n and a CI.** `QSCANDAL` has a denominator of 65, not 200, because the
   test is conditional on the run having fired the leak. Reporting 43/200 would understate the
   frequency by 3×. This is the kind of thing a bare percentage hides.
2. **The falsifiers were written first, and the git history proves it.** Commit
   `swarm: write falsifiers before the ensemble run (§13.1)` touches only
   `data/swarm/falsifiers.json`, and predates the first execution of `gen-swarm.ts`.

---

## 6. What is not done

Stated plainly, because the spec's §18 makes "done" machine-checkable and three of its
criteria were not machine-checked here.

1. **A1 (no console errors) was not measured in a browser.** No Chromium exists in this
   environment and it cannot be downloaded from the allowed hosts. Mitigation: `next build` is
   clean; there is no `new Date()`, `Math.random()`, `toLocaleString` or `dangerouslySetInnerHTML`
   on any render path, so hydration cannot mismatch and there is no inner-HTML escape hatch.

   **A2 and A3 now have structural tests** (`src/test/layout.test.ts`, 8 assertions) rather than
   nothing. They enforce the mechanisms, not the pixels: no inline width above 350 px, every
   two-column split collapses at 820 px, every grid/flex child is `min-width: 0`, wide tables
   scroll themselves while `html, body` clip the page, and anchor depth is computed by a real
   JSX scanner rather than a regex on proximity. A fixed-width declaration of 400 px added
   tomorrow fails the suite. What is still unproven is the actual measured `scrollWidth` at
   390 px — that needs a layout engine.
2. **A4 (brief prints to exactly one A4) was not verified by printing.** The print stylesheet
   sets `@page A4`, hides all chrome, and `break-inside: avoid`s each block. The brief's
   content is bounded by the fixtures. Counting pages needs a print engine.
3. **A12 (first paint < 1.5 s) was not measured.** Three woff2 files at ~20 kB each, no
   external font, no API call on first render.
4. **The optional model path is not built.** §2 asks for a structuration model behind an env
   flag, off by default. A dead switch that pretends to be a capability is worse than an
   honest single path: `src/domain/extract.ts` is the only structurer and it needs no
   network. This is a deliberate cut, not an omission.
5. **No energy coach was interviewed.** That is day 1, 17:30 in the spec's own plan, and it
   cannot happen in a sandbox. The brief is therefore unvalidated by its primary user.
6. **No recorded 90-second screencast** as the wifi fallback.
7. **`/api/swarm` recomputes live only for non-default `runs`/`seed`.** The default path
   serves the committed `report.json`, so the numbers on screen are the numbers in git.

---

## 7. The honest weakness of the product

The extractor is a rules engine over Dutch. It clears all 15 fixtures, but those fixtures were
written by the same person who wrote the rules — the classic overfit. On real stairwell Dutch,
`needs_input` will fire far more often than 2/15, and every `needs_input` is a coach typing
instead of listening. The spec's own §14.2 asks for "corrections per note ≤ 1"; I have no
measurement for that, only a fixture set that was authored to be extractable.

The second weakness is `QADOPT`. Capture-by-voice passes, but with the thinnest margin of the
four product bets (coach priors put `adopt` at .62 against `voice` at .78). The spec's own
§16.1 demo rehearses a 45-second spoken note. If a real coach will not speak into a phone on a
doorstep, the product is a form — and the simulation flags that before the coach does. That is
what the swarm is for.

---

*Demo — synthetic households. No real person's data is in this build.*
