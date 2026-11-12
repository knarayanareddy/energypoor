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
| Tests | **93 green** in 6 files, plus **8 browser-measured** checks in a separate suite |
| `next build` | exits 0 |
| Browser | real Chromium; A1/A2/A3/A4/A11/A12 measured, not inferred |
| `scripts/verify-chain.ts` | `total=9 verified=9 brokenAt=null` |
| Restricted leakage | **0** across brief, family view, CSV, API and extractor output |
| Falsifiers breaking the pitch | **2 of 6** (F3 trust, F5 leak) |
| Deviations | 13, all listed in §3 |

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

### D-13 · Two of §8.3's own question templates are ungrammatical

§8.3 gives the derivation rules as literal templates:

```
- For each `niet_gedaan` action: "Is <what> gelukt? Zo nee, waar liep het vast?"
- For each action still `afgesproken` with `by_when === null`: "Wanneer wilt u <what> doen?"
```

`<what>` is `<object> <infinitive>` — "de energietoeslag bellen". Substituting gives *"Is
kwijtschelding aanvragen gelukt?"* and *"Wanneer wilt u de nieuwe brief aanvragen doen?"* Both are
doubled infinitives; the second is plainly wrong Dutch and the first is barely parseable. A brief
handed to a coach who then cannot read the question aloud on a doorstep is a failure of the artefact,
not a stylistic nit.

The two templates are rewritten to keep the same question and the same determinism:

| spec | build |
|---|---|
| `Is <what> gelukt? Zo nee, waar liep het vast?` | `<What> — is dat gelukt? Zo nee, waar liep het vast?` |
| `Wanneer wilt u <what> doen?` | `Wanneer gaat u <what>?` |

`<What> — is dat gelukt?` is grammatical for every phrase the extractor produces, because the
anaphor "dat" does the work instead of trying to conjugate a separable verb the rules engine cannot
parse. The `capFirst`/`lowerFirst` helpers exist only to make the substitution read naturally.

This is a deviation from a verbatim spec string, which is why it is here rather than in a commit
message.

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

Fewer things than in the previous revision of this document. Three items that were listed here as
"needs a browser" or "deliberately unbuilt" are now measured or built, and the way they were
obtained is part of the record.

### 6.1 A browser was found, and A1/A2/A3/A4/A11/A12 are measured

The claim "no Chromium in this sandbox" was true of the system, and wrong as a conclusion. The
binary can be obtained without violating the network policy:

1. `@sparticuz/chromium` vendors a Brotli-compressed Chromium **inside its npm tarball**, so
   `npm install` from `registry.npmjs.org` is enough. No CDN download.
2. The extracted binary linked against three NSS libraries that Debian does not ship here.
   `gcc` was available, so `scratch/nssstub/stub.c` provides the 44 NSS/NSPR symbols Chromium
   imports, each returning NULL. Chromium then sees "no certificate database" — which is
   sufficient for `http://localhost` and **only** for that. TLS does not work against these
   stubs and the file says so.
3. `src/test-browser/measure.test.ts` drives it with `puppeteer-core`.

Results, from `npm run test:browser` (8 checks, ~90 s):

| | Measured |
|---|---|
| A1 console errors + hydration warnings | **0** across 9 routes × 4 viewports |
| Dev badge vs the disclaimer | not covering it (asserted) |
| A2 horizontal page scroll at 360/390 px | **0** on all 9 routes |
| A2b elements clipped out of reach | **0** (wide tables and the swarm chip row scroll inside their own container) |
| A3 nested anchors | **0** |
| A4 brief prints to one A4 | **1 page, 209.9 × 297.0 mm**, all three households, verified with a PDF parser |
| A11 WCAG AA contrast | **0 failures** across 6 routes |
| A12 first contentful paint, cold cache | **160–328 ms** against a 1,500 ms budget |
| Mobile nav at 360/390 px | two rows, no overlap, every link reachable |

Three real defects were found this way and fixed, which is the argument for measuring:

- **`/survey` at 360 px:** `.card-head` was a non-wrapping flex row, so the score pill was
  clipped by the card's border radius (`scrollWidth` 361 > `clientWidth` 330). Fixed with
  `flex-wrap: wrap` and `min-width: 0`.
- **`/household/HH-027/family` and `FamilyCorrections`:** three text nodes used a hard-coded
  `#8b8477`, which is 3.71:1 on the family view's cream background — below AA. Replaced with
  `var(--muted)` (5.14:1 worst case).
- **The brief's excluded-fields line printed in `#7c3aed`** at 10.5 px, which reads as a
  hyperlink on paper and survives a mono laser printer badly. Forced to black in `@media print`.
- **The household view showed "nog geen datum" on actions that were already done.** The brief
  had been fixed to report an action at the visit where its status was observed; `buildFamilyView`
  had its own copy of the old logic, so the coach's A4 said "gedaan 17 jun 2025" while the
  household's own file said "nog geen datum" about the same action. The two now share one
  `stampVisitDate` helper, which is the only way they can be guaranteed not to drift again.
- **The Next.js dev badge covered the synthetic-data disclaimer.** It is a `<nextjs-portal>`
  shadow host pinned bottom-left; `devIndicators: false` does not remove it in Next 16, and it
  sits outside the React tree so it cannot be fixed in JSX. A CSS rule hides it, and a browser
  test asserts that the element at that point is not the portal. A demo whose whole premise is
  "synthetic households" must not have that line obscured by a dev affordance.
- **The topbar was unusable at 390 px.** The nav wrapped into four rows and the wordmark
  collided with it. It now wraps as two rows (wordmark + badge, then the nav on one scrolling
  line) with a mask-based fade at the right edge, because a hidden scrollbar hides the fact that
  "Review" is 45 px off-screen. A browser test asserts no overlap, every destination reachable,
  and a topbar under 96 px at both 360 and 390 px.
- **`/survey` cut questionnaire items mid-word** with `slice(0, 60)`, producing rows ending in
  "…de vorige afspraak h". In a table of verbatim items that reads as a typo. Now clamped at a
  word boundary with the full text in `title`.

Two measurement mistakes worth recording, because both produced *plausible* output:

- **My own contrast harness lied first.** It parsed `color(srgb 0.96 0.95 0.91)` by taking the
  first three numbers, so `srgb` became `[0,0,0]` and the topbar measured as white-on-black
  (ratio 3.61). Every "failure" it reported was the parser's fault. The fix is in the test.
- **`/Type /Page` regex found 0 pages** because Chromium writes compressed object streams, so
  a naive scan sees no page tree. Counting was replaced with a real PDF parser (`pypdf`).

### 6.2 The optional model path is built

The previous revision argued that a flag which is documented but absent is worse than no flag.
That reasoning still holds — which is why the flag now exists rather than being described.
`src/domain/structure.ts` implements §6.1 row 1:

- **Off is the default and off is not a degraded mode.** Unset means the rules engine, with no
  code path that can reach the network. A test asserts `fetch` is never called when the flag is
  off, and that the result is byte-identical to `extract()`.
- **A model answer cannot widen the gate.** Model output is merged field by field: it may only
  *append* an action whose actor, verb+object and date all validate, never a barrier (a barrier
  without the clause-level redaction of D-03 would reintroduce the leak), and never a change to
  a `restricted` flag or a `restricted_hits` entry. Asserted against N-010, the note that
  carries both a health and a debt hit.
- **Failure is visible.** Timeout, HTTP error, non-JSON, wrong shape, bad date, unknown actor —
  each returns the rules result **and** an `E-MODEL-*` code that is surfaced on the draft and
  shown to the coach as "the model route was not used; the rules were applied".

16 tests in `src/test/model.test.ts`. The demo is unchanged with the flag off, which is how it
ships.

### 6.3 What is still genuinely not done

1. **A model call against a real endpoint was never made.** There is no API key in this
   environment and none will be added. Everything above is exercised against injected `fetch`
   doubles: a 503, a throw, a timeout, malformed JSON, a wrong actor, a bad date. The merge and
   fallback logic is tested; the vendor's actual JSON was not observed.
2. **No energy coach was interviewed.** That is day 1, 17:30 in the spec's own plan, and it
   cannot happen in a sandbox. The brief is unvalidated by its primary user.
3. **No recorded 90-second screencast** as the wifi fallback.
4. **The browser measurements are of `next dev`, not a production build.** A dev build is
   slower, so A12 is a pessimistic bound rather than an optimistic one — but it is a dev build.
5. **The NSS stubs mean the browser cannot browse HTTPS.** Anything the test suite asserts is
   http://localhost only.
6. **`/api/swarm` recomputes live only for non-default `runs`/`seed`.** The default path serves
   the committed `report.json`.

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
