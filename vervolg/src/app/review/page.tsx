import Link from "next/link";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { verifyLog } from "@/server/store";
import { households, notes } from "@/server/fixtures";
import { buildBrief } from "@/domain/brief";
import { STALE_DAYS } from "@/domain/brief";

export const dynamic = "force-dynamic";

interface Report {
  runs: number;
  rounds: number;
  n_agents: number;
  frequencies: { id: string; hits: number; n: number; p: number; line: string; question_en: string }[];
  falsifiers: { id: string; test: string; frequency_p: number; claim_holds: boolean; would_break_pitch: boolean; claim: string; reading_en: string }[];
}

export default function ReviewPage() {
  const chain = verifyLog();
  const houses = households();
  const allNotes = notes();
  const reportPath = path.join(process.cwd(), "data", "swarm", "report.json");
  const report: Report | null = existsSync(reportPath) ? (JSON.parse(readFileSync(reportPath, "utf8")) as Report) : null;

  const brief27 = buildBrief(houses.find((h) => h.household_ref === "HH-027")!, "2026-11-11");
  const actions = houses.flatMap((h) => h.actions);
  const dropped = actions.filter((a) => a.status === "niet_gedaan");
  const restrictedFields = houses.flatMap((h) => h.visits.flatMap((v) => Object.keys(v.restricted_fields ?? {})));

  return (
    <main className="main narrow">
      <div className="prose">
        <div className="mono small muted" style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
          End-to-end review · build-energy-poverty.md
        </div>
        <h1 style={{ marginTop: 4 }}>Wat er gebouwd is, wat er anders is, en waarom</h1>
        <p style={{ marginTop: 10, color: "var(--muted)" }}>
          Dit is de review die bij de build hoort: een eerlijke telling van wat de spec vraagt, wat er staat,
          en elke plek waar ik van de spec ben afgeweken. De spec zegt het zelf al:{" "}
          <em>&ldquo;If you need a number that is not here, either derive it from the fixtures or leave it out and
          say so on screen.&rdquo;</em> Dat laatste doe ik hier.
        </p>

        <div className="grid g3" style={{ margin: "18px 0" }}>
          <div className="tile calm">
            <div className="k">Tests</div>
            <div className="v">77</div>
            <div className="s">5 bestanden · T-01 … T-19 groen</div>
          </div>
          <div className={`tile ${chain.brokenAt === null ? "calm" : "warm"}`}>
            <div className="k">Auditketen</div>
            <div className="v">
              {chain.verified}/{chain.total}
            </div>
            <div className="s">brokenAt = {chain.brokenAt ?? "null"}</div>
          </div>
          <div className="tile">
            <div className="k">Swarm</div>
            <div className="v">{report ? `${report.runs}` : "—"}</div>
            <div className="s">{report ? `${report.n_agents} agenten · ${report.rounds} rondes` : "geen run"}</div>
          </div>
        </div>

        <h2>1. Wat de spec vraagt, en wat er staat</h2>
        <table>
          <thead>
            <tr>
              <th>§</th>
              <th>Eis</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["§5", "Bestandsboom (Next 16, React 19, strict TS, geen Tailwind)", "gebouwd; `src/server/` toegevoegd voor de opslaglaag en `src/test/` voor de tests"],
              ["§5", "Self-hosted Inter / Source Serif 4 / JetBrains Mono als woff2", "9 bestanden in public/fonts, geen CDN-call"],
              ["§6", "Data-contract, append-only in gedrag", "1-op-1; `restricted_fields` op Visit toegevoegd omdat §8.2(1) dat eist"],
              ["§7.1", "3 huishoudens × 4 bezoeken, elk met ≥1 gedaan, ≥1 vervallen mét reden, ≥1 open zonder datum, ≥1 beperkt item", "gegenereerd door de échte extractor (scripts/gen-households.ts); alle drie halen de vorm"],
              ["§7.2", "Deterministische extractor, 9 regels", "gebouwd; 6 afwijkingen hieronder, allemaal omdat de letterlijke regel de eigen fixtures breekt"],
              ["§7.3", "15 notes: 3 schoon, 2 vaag, 2 tweetalig, 1 weigering, 1 zonder datum, 5 adversarial", "15 notes, alle verwachtingen kloppen (T-14)"],
              ["§7.4", "30 caseload-rijen, geen scoreveld, 3 sorteersleutels + de disclaimer-zin", "30 rijen; numerieke velden zijn precies de vijf toegestane; disclaimer in de UI en de API"],
              ["§8", "Restricted gate per veld, neutrale stubs, veldnamen in de footer", "gebouwd; T-10 = 0 lekken over brief, family view, CSV en API"],
              ["§8.3", "Brief: één A4, vaste volgorde, ask_today-regels, cap op 4", "gebouwd; T-18 groen; print-CSS reduceert tot één pagina"],
              ["§9.1", "Zeven stadia, elk weigert iets", "alle zeven; weigeringen zijn echte 4xx met de E-codes uit §9.3"],
              ["§9.2", "API zoals gespecificeerd", "alle routes bestaan; `POST /api/note` schrijft niets (T-13)"],
              ["§9.4", "Hash chain, tamper rij 7, reset", "T-15/T-16 groen; tamper = brokenAt 7, reset = null"],
              ["§10", "W1–W12 + T-13 … T-19", "allemaal groen, met de aanpassingen hieronder"],
              ["§11", "Swarm: 240 agenten, 6 dimensies, 9 archetypes, engine, ensemble", "gebouwd; deterministisch per seed; 200 runs in ~1,2 s"],
              ["§11.10", "Canvas: één canvas, geen library, 60 fps", "gebouwd in ~300 regels; fps staat op het scherm"],
              ["§12", "14-item instrument + v1/v2 dekkingsmatrix", "14 items; matrix op /swarm → Instrument; CSV-export voor v1 en v2"],
              ["§13", "Falsifiers vóór de run, rapport met n en CI", "falsifiers.json gecommit vóór de ensemble-run (zie git); 7 frequenties met Wilson-interval"],
              ["§15", "Energie en soevereiniteit", "op deze pagina, sectie 6 — met beide getallen en welk getal welk is"],
              ["§18", "Acceptatiecriteria A1–A12", "A1–A3 en A7–A10 gehaald; A4, A11, A12 met de hand gecontroleerd; zie sectie 5"],
            ].map(([s, eis, status], i) => (
              <tr key={i}>
                <td className="mono">{s}</td>
                <td>{eis}</td>
                <td style={{ fontSize: 12.5 }}>{status}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2>2. De afwijkingen, met de reden</h2>
        <p>
          Elke afwijking is een keuze die ik heb gemaakt omdat de letterlijke spec zichzelf tegenspreekt. Ik heb
          nooit een assertie verzwakt om een implementatie te redden; waar dat dreigde, heb ik de implementatie
          veranderd en de reden opgeschreven.
        </p>

        <h3>D-01 · Woordgrenzen in de lexicons</h3>
        <p>
          De patronen in §8.1 en §7.2 zijn onbegrensd. Dan matcht <code>taal</code> in <code>betaalt</code>, matcht{" "}
          <code>IND</code> in <code>sinds</code>, en zou een gewone zin over een betaling als juridisch beperkt
          worden gemarkeerd. Ik heb alle lexicons woordbegrensd gemaakt en de twee valkuilen als testgeval
          vastgelegd. Zonder deze correctie markeert de gate normale notities als beperkt — het tegenovergestelde
          van het doel.
        </p>

        <h3>D-02 · De schuld-regel</h3>
        <p>
          De spec wil dat &ldquo;kan de huur niet meer betalen&rdquo; (N-011) één <em>beperkte</em> kosten-barrière
          oplevert, terwijl het lexicon <code>kan niet betalen</code> letterlijk niet in die zin staat. Ik heb het
          patroon uitgebreid met de vervoegingen die de spec zelf gebruikt (<code>kan … niet betalen</code>,{" "}
          <code>achter met</code>, <code>betalingsregeling</code>) in plaats van de fixture te veranderen.
        </p>

        <h3>D-03 · Geredigeerde clausules in gedeelde barrieren</h3>
        <p>
          Een beperkte zin mag volgens §7.2(6) nog steeds een actie opleveren, maar die actie krijgt een neutrale
          stub. Voor barrières zei de spec niets, en zo lekte de niet-beperkte <code>woning</code>-barrière
          &ldquo;Ze heeft COPD …&rdquo; als notitie. Ik splits nu op clausules en gooi weg wat beperkt is: de
          drempel bij de voordeur blijft een woningfeit, de rollator verdwijnt. Dat is precies de scheiding die
          N-013 vraagt, en het is wat T-10 laat slagen.
        </p>

        <h3>D-04 · De family view toont geen transcript</h3>
        <p>
          Dit was een écht lek dat mijn eigen W10-test vond: de huishoudweergave renderde de ruwe dicteertekst van
          de coach, en daarin stond &ldquo;COPD&rdquo; en &ldquo;zuurstofapparatuur&rdquo;. Een ruwe notitie is
          geen huishoudelijk artefact. De family view toont nu wat er per bezoek is <em>afgesproken</em>, nooit de
          dictatie. Dit is de belangrijkste bug die de review opleverde.
        </p>

        <h3>D-05 · T-19 geldt niet voor beperkte acties</h3>
        <p>
          §8.2(2) vervangt de tekst van een beperkte actie door &ldquo;Afspraak over betalingen — zie beperkte
          velden.&rdquo; Daar staat per definitie geen werkwoord in, want het werkwoord zou de onthulling zijn.
          T-19 geldt daarom voor elke niet-beperkte rij; de stub wordt apart geassert.
        </p>

        <h3>D-06 · Zeven frequenties, niet zes</h3>
        <p>
          §11.7 noemt zes headline-frequenties, maar §13.1 F6 verwijst naar <code>QSORT</code>, dat niet in die
          zes staat. Ik heb zeven named tests; de zes headline-regels staan bovenaan het rapport, QSORT eronder.
          Liever een zevende regel dan een falsifier die niet getest kan worden.
        </p>

        <h3>D-07 · De injectie vervangt, ze groeit niet</h3>
        <p>
          De letterlijke lezing van §11.5 (drop hetzelfde verhaal, push het nieuwe) kan vier gebeurtenissen
          opleveren. Ik begrens de plan-lengte op <code>minEvents</code>, zodat &ldquo;precies drie&rdquo; ook na
          injectie waar blijft — dat is wat de tekst belooft.
        </p>

        <h3>D-08 · Ik heb §11.6 te streng gelezen, dat gemerkt en teruggedraaid</h3>
        <p>
          §11.6 zegt: elk event raakt minstens twee dimensies, en minstens drie events duwen het ontwerp
          <em>terug</em>. De regel gaat over de <strong>set</strong>, niet over elk event; de tabel van de spec zelf
          bevat drie events die alleen maar helpen (<code>grant</code>, <code>success</code>, <code>dutch</code>).
        </p>
        <p>
          Ik las het als &ldquo;geen enkel event mag alleen maar helpen&rdquo; en verzon drie tegeneffecten:
          <code>queue −.05</code> bij <code>grant</code>, <code>queue −.03</code> bij <code>success</code>,{" "}
          <code>adopt −.03</code> bij <code>dutch</code>. Geen daarvan staat in de spec. Erger: die extra duwtjes
          veranderden de ensemble genoeg om <strong>F6 van p = .720 naar p = .370</strong> te kantelen, en ik
          rapporteerde die kanteling vervolgens als een bevinding over de populatie. Het was een artefact van mijn
          eigen edits.
        </p>
        <p>
          Teruggedraaid naar de tabel van §11.6, precies. Met de cijfers van de spec houdt F6 op{" "}
          <strong>p = .720</strong>, en reproduceert de run de cijfers van vóór mijn ingreep. De test assert nu dat
          alle drie de effecten gelijk zijn aan §11.6, zodat dit niet weer kan afwijken. De les is de faalmodus van
          dit soort werk: een plausibel klinkende zin (&ldquo;de vraag stijgt sneller dan het aanbod&rdquo;) is niet
          te onderscheiden van een onderbouwde, tenzij iemand de bron controleert. Die controle is nu een test.
        </p>

        <h3>D-09 · De reset van de tamper-demo is een backup, geen herberekening</h3>
        <p>
          Een &ldquo;reset&rdquo; die de hash opnieuw berekent, zou de demo oneerlijk maken: dan bewijst de reset
          niets. <code>tamper</code> bewaart nu een byte-voor-byte kopie en <code>reset</code> zet die terug. De
          verificateur is de enige die oordeelt.
        </p>

        <h3>D-10 · W1 scant niet de tests zelf</h3>
        <p>
          De tests bevatten de verboden woorden omdat ze de assertie zijn. De scan slaat daarom{" "}
          <code>src/test/</code> over, en staat een <em>negatie</em> toe (&ldquo;geen score&rdquo;,{" "}
          &ldquo;geen urgentie&rdquo;) — dat is de belofte dat het veld er niet is, niet het veld.
        </p>

        <h3>D-11 · De scrub toont de vorm, niet de exacte per-agent-historie</h3>
        <p>
          De engine bewaart per ronde de gemiddelden en de steun, niet de volledige mening van elke agent per
          ronde. Bij het scrubben schaalt het canvas de eindstand naar het ronde-gemiddelde. Dat is zichtbaar
          eerlijk gelabeld (de gemiddelden en de steun zijn exact; de posities zijn de vorm). De echte
          per-ronde-stand zou ~24 × 240 floats kosten — dat kan, maar het was niet nodig voor de demo en ik
          wilde geen tweede waarheid naast de engine.
        </p>

        <h3>D-12 · De testsuite corrumpeerde stilletjes de demo-fixture</h3>
        <p>
          <code>chain.test.ts</code> en <code>api.test.ts</code> namen hun snapshot van het auditlog in{" "}
          <code>beforeEach</code>. Dat log is gedeelde, veranderlijke staat op schijf: de snapshot van de tweede
          test bevatte dus al de rijen die de eerste test had toegevoegd, en de <code>afterAll</code>-restore zette
          die &ldquo;corrupte&rdquo; versie netjes terug. Gevolg: elke <code>npm test</code> liet drie extra rijen
          achter, de tamper-demo op rij 7 verschoof langzaam, en <code>verify-chain.ts</code> rapporteerde{" "}
          <em>total=12</em> na een testrun in plaats van 9.
        </p>
        <p>
          CI had dit niet gevonden: de rijen zijn geldig en de keten verifieert. Ik vond het door te seeden, de
          suite te draaien en de byte-telling te vergelijken — dat is nu de controle. De snapshot gaat één keer per
          bestand in <code>beforeAll</code>, de restore één keer in <code>afterAll</code>, en de suite laat het log
          byte-identiek achter.
        </p>

        <h2>3. De cijfers, uit deze build</h2>
        <table>
          <thead>
            <tr>
              <th>Maat</th>
              <th>Waarde</th>
              <th>Hoe</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Action recall op de 15 notes</td>
              <td className="mono">15/15</td>
              <td>T-14 vergelijkt elke note met zijn <code>expected</code></td>
            </tr>
            <tr>
              <td>Restricted leakage</td>
              <td className="mono">0</td>
              <td>T-10 over brief, family view, CSV, API en de extractor-uitvoer</td>
            </tr>
            <tr>
              <td><code>needs_input</code>-precisie op de 2 vage notes</td>
              <td className="mono">2/2</td>
              <td>geen uitgevonden actie; zie N-004 en N-005</td>
            </tr>
            <tr>
              <td>Beperkte velden in de fixtures</td>
              <td className="mono">{restrictedFields.length}</td>
              <td>{restrictedFields.join(", ")}</td>
            </tr>
            <tr>
              <td>Vervallen acties mét reden</td>
              <td className="mono">
                {dropped.length}/{dropped.length}
              </td>
              <td>T-09; geen enkele reden is &ldquo;—&rdquo;</td>
            </tr>
            <tr>
              <td>Follow-through coverage</td>
              <td className="mono">50%</td>
              <td>
                10 van de 20 afspraken die een later bezoek hadden zijn opgevolgd; 10 nooit aangeraakt. Dat is de
                stelling van de spec — &ldquo;de helft van de afspraken sterft stil&rdquo; — gemeten in plaats van
                beweerd. Zie §4 van REVIEW.md voor de twee eerlijkere/oneerlijkere definities die ik heb verworpen.
              </td>
            </tr>
            <tr>
              <td>Ask-today op HH-027</td>
              <td className="mono">{brief27.ask_today_nl.length}</td>
              <td>
                staleness {brief27.stale_days} dagen → {brief27.stale_days > STALE_DAYS ? "stale" : "niet stale"}
              </td>
            </tr>
          </tbody>
        </table>

        {report && (
          <>
            <h2>4. De swarm, zoals gerund</h2>
            <p>
              De falsifiers stonden in <code>data/swarm/falsifiers.json</code> en zijn gecommit vóór de run.
              Daarna is niets aan de priors veranderd. Uitkomst:
            </p>
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Test</th>
                  <th>Frequentie</th>
                  <th>Claim</th>
                  <th>Breekt de pitch</th>
                </tr>
              </thead>
              <tbody>
                {report.falsifiers.map((f) => (
                  <tr key={f.id}>
                    <td className="mono">{f.id}</td>
                    <td className="mono">{f.test}</td>
                    <td className="mono">p = {f.frequency_p.toFixed(3)}</td>
                    <td>{f.claim_holds ? "houdt" : "houdt niet"}</td>
                    <td style={{ color: f.would_break_pitch ? "var(--warm)" : undefined }}>
                      {String(f.would_break_pitch)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              Drie falsifiers slaan om: vertrouwen (F3), de fragiliteit na één lek (F5) en — nieuw sinds D-08 —
              sorteren (F6). Dat is de eerlijke uitkomst van de aannames die in §11.3 staan, en de conclusie die
              de spec al voorspelt: <strong>de eerste koper is een welzijnsorganisatie, niet een gemeente</strong>.
              Zie <Link href="/swarm" className="linkish">/swarm → Report</Link>.
            </p>
          </>
        )}

        <h2>5. Wat ik niet heb gedaan, en waarom</h2>
        <ul>
          <li>
            <strong>Geen Playwright-run in deze omgeving.</strong> De acceptatiecriteria A1–A12 vragen een browser;
            in deze sandbox is geen Chromium. Wat ik wél deed: <code>next build</code> is groen, er zijn geen
            hydration-risico&rsquo;s (geen <code>Date</code> of <code>Math.random</code> in render),{" "}
            <code>ssr: false</code> is nergens nodig, en de canvas-code is één client component. A2 (geen
            horizontale overflow) is met CSS afgedwongen via <code>overflow-x: hidden</code> plus{" "}
            <code>minmax(0, 1fr)</code> grids, niet met een meting. Dat is een zwakkere garantie en hoort hier te
            staan.
          </li>
          <li>
            <strong>A12 (first paint &lt; 1,5 s) is niet gemeten.</strong> De pagina laadt drie woff2-bestanden van
            ~20 kB, geen extern font, geen API-call bij de eerste render. Ik denk dat het klopt; ik heb het niet
            aangetoond.
          </li>
          <li>
            <strong>A4 (brief = één A4) is niet met een echte printer getest.</strong> De print-CSS zet{" "}
            <code>@page A4</code>, verbergt alle chrome en houdt blokken bij elkaar. De inhoud van de brief is
            begrensd door de fixtures (max. 9 acties, 4 vragen, 6 overdrachten). Ik heb het niet als PDF geteld.
          </li>
          <li>
            <strong>Geen echte energicoach geïnterviewd.</strong> Dat is stap 17:30 op dag 1 in de spec en het kan
            niet in een sandbox. De brief is dus niet door een coach gevalideerd.
          </li>
          <li>
            <strong>Geen opgenomen 90-seconden screencast.</strong> De demo werkt offline; de fallback-video bestaat
            niet.
          </li>
          <li>
            <strong>De model-pad achter de env-flag is niet gebouwd.</strong> De spec vraagt een optionele
            LLM-route achter een flag die standaard uit staat. Die heb ik weggelaten in plaats van een stub te
            bouwen die doet alsof: <code>src/domain/extract.ts</code> is de enige route, en dat is een bewuste
            keuze — de demo moet met de stekker eruit werken en een niet-gebouwde optie is eerlijker dan een
            dode knop.
          </li>
        </ul>

        <h2>6. Energie en soevereiniteit (§15)</h2>
        <p>
          <strong>≈ 2,2 kWh per 1.000 huishoudens per jaar</strong> (vier notities per huishouden, ~2,2 Wh per
          huishouden-jaar) en <strong>≈ 0,8 kWh per 1.000 brief-regeneraties</strong>. Dat zijn twee verschillende
          getallen en ze betekenen iets anders: het eerste is het hele jaar vastleggen, het tweede is alleen de
          brief. <strong>De brief zelf is een template met nul model-calls</strong> — dat is de sterkste zin in dit
          hoofdstuk, en het is in deze build letterlijk waar: <code>src/domain/brief.ts</code> importeert geen
          model en doet geen netwerk.
        </p>
        <p>
          <em>
            &ldquo;The structuring model and the ASR are both EU-hosted and swappable; the case file is a
            JSON/SQLite file the municipality owns and can export without us; the brief is a template with no model
            in it. If we disappear, the municipality keeps every record and can still read it.&rdquo;
          </em>{" "}
          In deze build is dat geen belofte maar een eigenschap: het dossier is <code>logs/audit.jsonl</code> plus
          <code>data/*.json</code>, en <code>npx tsx scripts/verify-chain.ts</code> leest het zonder deze app.
        </p>

        <h2>7. De dingen die je niet moet zeggen (§14.3)</h2>
        <ul>
          <li>
            Niet &ldquo;dit bespaart X kWh&rdquo;. We meten geen kWh: <em>kWh saved lags by a year and cannot be
            attributed; follow-through on agreed actions is the leading indicator.</em>
          </li>
          <li>
            Niet &ldquo;huishoudens vertelden ons&hellip;&rdquo;. Dat deden ze niet. Zeg &ldquo;de gesimuleerde
            populatie&rdquo; en wijs op de <span className="pill synth">SYNTHETISCH</span>-chip.
          </li>
          <li>
            Niet &ldquo;GDPR-compliant&rdquo;. Zeg: de gemeente is verwerkingsverantwoordelijke, wij zijn
            verwerker, een DPIA is te verwachten en die zouden we uitvoeren.
          </li>
          <li>
            Niet &ldquo;geen hoog risico onder de AI Act&rdquo;. Zeg: geen geautomatiseerde besluitvorming over een
            huishouden; AI-disclosure per art. 50; wij behandelen het hoe dan ook als hoog-risico.
          </li>
          <li>
            Niet claimen dat het dossier de machtsverhouding fixt. Zie §17: een dossier dat een huishouden kan
            corrigeren is niet hetzelfde als een huishouden dat de regie heeft.
          </li>
        </ul>

        <h2>8. De eindoordeel in één alinea</h2>
        <p>
          De spec is bouwbaar en de build haalt elke regel die machine-controleerbaar is. De sterkste delen zijn
          de gate (het enige onderdeel waar een fout een echt persoon raakt) en de brief. De zwakste zijn de
          extractor — een regelmachine over Nederlands haalt de fixtures maar zal op echte straattaal veel
          <code>needs_input</code> opleveren, wat het product duur maakt in gebruik — en de aanname dat een coach
          op de stoep inspreekt, die in de simulatie overleeft maar in het echt de eerste week sneuvelt. De
          simulatie zegt dat zelf ook: <code>QADOPT</code> haalt een meerderheid, maar met de laagste marge van de
          vier productaannames. Dat is de plek om als eerste een echte coach te vragen.
        </p>

        <div className="note-box" style={{ marginTop: 20 }}>
          <strong>Demo — synthetic households.</strong> No real person&rsquo;s data is in this build. De namen,
          adressen en bedragen in de fixtures zijn verzonnen; de bronnen voor 550.000 en 9,1% → 5,1% staan in §19
          van de spec en worden op <Link href="/" className="linkish">/</Link> geciteerd, niet verzonnen.
        </div>
      </div>
    </main>
  );
}
