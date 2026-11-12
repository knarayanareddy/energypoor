/**
 * The English mirror of the dossier prose.
 *
 * WHY THIS IS KEYED BY THE DUTCH STRING AND NOT AN ID.
 *
 * The three case files are not hand-written fixtures: `scripts/gen-households.ts`
 * runs the real extractor over the Dutch visit transcripts, so
 * every action, barrier note and evidence line in `data/households.json` is a
 * sentence a rule in `src/domain/extract.ts` actually produced. Change a regex
 * there and the stored sentence changes with it. An id-keyed table would then
 * keep compiling while the screen silently reverted to Dutch, which is exactly
 * the failure this whole exercise is about.
 *
 * So the key IS the Dutch sentence, and the accessor returns `null` when it
 * does not know the string. Two consequences, both deliberate:
 *
 *   1. `src/test/i18n.test.ts` walks every string in the fixtures and fails the
 *      build if one has no mirror. A new rule cannot ship half-translated.
 *   2. A page renders `null` as the Dutch sentence, marked `lang="nl"` — so the
 *      worst case is one visible Dutch line, never an English label over Dutch
 *      content pretending to be translated.
 *
 * WHAT IS DELIBERATELY ABSENT: household names ("Familie Yılmaz — Korrewegwijk"),
 * the programme title ("Gemeente Groningen — energiearmoede 2026") and the
 * restricted note values. Names and official programme titles are proper nouns;
 * the user asked for those to stay as they are.
 */

/** Action text (`what_nl`) → English. */
export const ACTION_EN: Record<string, string> = {
  "Afspraak over betalingen — zie beperkte velden.": "Agreement about payments — see restricted fields.",
  "De afspraak over de vochtplek in de hoek regelen": "Arrange the appointment about the damp patch in the corner",
  "De afspraak over het onderhoud van de verwarming maken": "Make the appointment about heating maintenance",
  "De afspraak over het vervangen van de voordeur maken": "Make the appointment about replacing the front door",
  "De afspraak over het vocht in de slaapkamer maken": "Make the appointment about the damp in the bedroom",
  "De eerste termijn van de regeling betalen": "Pay the first instalment of the arrangement",
  "De energietoeslag aanvragen": "Apply for the energy allowance",
  "De energietoeslag bellen": "Call about the energy allowance",
  "De nieuwe brief aanvragen": "Request the new letter",
  "De nieuwe cv-ketel regelen": "Arrange the new central-heating boiler",
  "De startdatum van de isolatie bellen": "Call about the insulation start date",
  "De voucher van het energiefonds aanvragen": "Apply for the energy fund voucher",
  "Het aanvraagformulier voor de isolatie invullen": "Fill in the insulation application form",
  "Het aanvraagformulier voor de isolatie opsturen": "Send the insulation application form",
  "Het formulier opsturen": "Send the form",
  "Het formulier voor de energietoeslag invullen": "Fill in the energy allowance form",
  "Het formulier voor de huurtoeslag invullen": "Fill in the rent benefit form",
  "Het formulier voor het energiefonds invullen": "Fill in the energy fund form",
  "Huurverlaging aanvragen": "Apply for a rent reduction",
  "Isolatie van de voorgevel bellen": "Call about insulating the front facade",
  "Kwijtschelding aanvragen": "Apply for debt relief",
  "Turkse tolk voor het volgende gesprek regelen": "Arrange a Turkish interpreter for the next conversation",
};

/** Evidence (`evidence`) → English. */
export const EVIDENCE_EN: Record<string, string> = {
  "Afgewezen: hij heeft een privé-verhuurder en de regeling geldt alleen bij corporaties.":
    "Refused: he has a private landlord and the scheme only applies to housing corporations.",
  "Corporatie bevestigde de aanvraag per brief op 21 mei.":
    "The corporation confirmed the application by letter on 21 May.",
  "Energietoeslag toegekend, brief van de gemeente gezien op 3 juli.":
    "Energy allowance granted; the municipality's letter was seen on 3 July.",
  "Formulier ingeleverd bij de balie, stempel op de kopie.":
    "Form handed in at the desk, stamp on the copy.",
  "Het formulier is tweemaal teruggestuurd: verkeerde bijlage, en de brief was alleen in het Nederlands.":
    "The form was returned twice: wrong attachment, and the letter was in Dutch only.",
  "Kon het formulier niet invullen, wist niet waar ze het naartoe moest sturen.":
    "Could not fill in the form; did not know where to send it.",
  "Kwijtschelding is afgewezen: het formulier vroeg om een DigiD die zij niet heeft.":
    "Debt relief was refused: the form asked for a DigiD she does not have.",
  "Nieuwe ketel geplaatst op 14 augustus, monteur heeft het gemeld.":
    "New boiler installed on 14 August; the fitter reported it.",
  "Toekenning van de gemeente per brief, 12 juni.": "Granted by the municipality by letter, 12 June.",
  "Tolk geregeld via het buurtteam, afspraak op 22 januari.":
    "Interpreter arranged through the neighbourhood team, appointment on 22 January.",
  "Tweede afspraak niet gekomen: de corporatie wilde een intake, mevrouw durfde de deur niet open te doen.":
    "Second appointment did not happen: the corporation wanted an intake, and she did not dare open the door.",
  "Voucher aangevraagd bij het energiefonds, bevestiging per post.":
    "Voucher applied for at the energy fund, confirmation by post.",
};

/** Barrier notes (`note_nl`) → English. */
export const BARRIER_NOTE_EN: Record<string, string> = {
  "Begrijpt het formulier niet.": "Does not understand the form.",
  "Beperkte notitie over betalingen — zie beperkte velden.":
    "Restricted note about payments — see restricted fields.",
  "Beperkte notitie over een instantie — zie beperkte velden.":
    "Restricted note about an agency — see restricted fields.",
  "Beperkte notitie over gezondheid — zie beperkte velden.":
    "Restricted note about health — see restricted fields.",
  "Er staat schimmel.": "There is mould.",
  "Hij begrijpt het formulier niet": "He does not understand the form.",
  "Is bang dat de gemeente dat weet.": "Is afraid the municipality will find out.",
  "Leest de brieven niet.": "Does not read the letters.",
  "Ze begrijpt het formulier niet goed.": "She does not fully understand the form.",
  "Ze is bang voor de corporatie.": "She is afraid of the housing corporation.",
};

/** Visit transcripts → English. The coach's voice, not a translation of a form. */
export const TRANSCRIPT_EN: Record<string, string> = {
  "Ik bel de corporatie deze maand over de isolatie van de voorgevel. Mevrouw vraagt de energietoeslag aan voor eind mei. Wij regelen samen een nieuwe cv-ketel. Ze begrijpt het formulier niet goed.":
    "I am calling the corporation this month about insulating the front facade. She is applying for the energy allowance before the end of May. Together we are arranging a new central-heating boiler. She does not fully understand the form.",
  "Ik bel de corporatie over de betalingsregeling. Mevrouw vult het formulier voor de energietoeslag in. Ze vertrouwt de corporatie niet en begrijpt het formulier niet.":
    "I am calling the corporation about the payment arrangement. She is filling in the energy allowance form. She does not trust the corporation and does not understand the form.",
  "Ik bel de corporatie over de startdatum van de isolatie. Mevrouw vult het formulier voor het energiefonds in. Wij regelen samen een nieuwe cv-ketel. Ze begrijpt het formulier van het energiefonds niet.":
    "I am calling the corporation about the insulation start date. She is filling in the energy fund form. Together we are arranging a new central-heating boiler. She does not understand the energy fund form.",
  "Ik maak een afspraak met de corporatie over het vervangen van de voordeur. Mevrouw vult het formulier voor de huurtoeslag in. Ze heeft COPD en de zuurstofapparatuur vreet stroom.":
    "I am making an appointment with the corporation about replacing the front door. She is filling in the rent benefit form. She has COPD and the oxygen equipment uses a lot of electricity.",
  "Ik maak een afspraak met de woningcorporatie over het onderhoud van de verwarming. Mevrouw belt de gemeente over de energietoeslag. Ze wil geen hulp meer en vertrouwt de corporatie niet.":
    "I am making an appointment with the housing corporation about heating maintenance. She is calling the municipality about the energy allowance. She no longer wants help and does not trust the corporation.",
  "Ik maak een afspraak met de woningcorporatie over het vocht in de slaapkamer. Meneer vult het aanvraagformulier voor de isolatie in. Wij vragen de energietoeslag aan bij de gemeente. De muur blijft koud en er staat schimmel.":
    "I am making an appointment with the housing corporation about the damp in the bedroom. He is filling in the insulation application form. We are applying to the municipality for the energy allowance. The wall stays cold and there is mould.",
  "Ik regel een Turkse tolk voor het volgende gesprek. De woningcorporatie stuurt het formulier op. Ze heeft een verblijfsvergunning op basis van gezinshereniging en is bang dat de gemeente dat weet. Hij begrijpt het formulier niet.":
    "I am arranging a Turkish interpreter for the next conversation. The housing corporation is sending the form. She has a residence permit on family-reunification grounds and is afraid the municipality will find out. He does not understand the form.",
  "Ik regel een betalingsregeling met de corporatie voor de eerste helft van het jaar. Mevrouw vult het formulier voor de energietoeslag in. Wij vragen kwijtschelding van de gemeente aan. Ze is bang voor de corporatie.":
    "I am arranging a payment arrangement with the corporation for the first half of the year. She is filling in the energy allowance form. We are applying to the municipality for debt relief. She is afraid of the corporation.",
  "Ik stuur het aanvraagformulier voor de isolatie op naar de corporatie. Meneer vult het formulier voor de energietoeslag in. Wij vragen huurverlaging aan bij de gemeente. Hij begrijpt het formulier niet en leest de brieven niet.":
    "I am sending the insulation application form to the corporation. He is filling in the energy allowance form. We are applying to the municipality for a rent reduction. He does not understand the form and does not read the letters.",
  "Ik vraag een nieuwe brief aan bij de corporatie. Meneer vult het aanvraagformulier voor de isolatie in. Ze gebruikt de rollator, dus de drempel bij de voordeur is een probleem.":
    "I am requesting a new letter from the corporation. He is filling in the insulation application form. She uses a walker, so the threshold at the front door is a problem.",
  "Mevrouw vraagt de voucher van het energiefonds aan. Ik vraag een nieuwe brief aan bij de corporatie. Ze heeft COPD en de zuurstofapparatuur vreet stroom.":
    "She is applying for the energy fund voucher. I am requesting a new letter from the corporation. She has COPD and the oxygen equipment uses a lot of electricity.",
  "Mevrouw vraagt de voucher van het energiefonds aan. Ze betaalt de eerste termijn van de regeling. Ik regel een afspraak met de woningcorporatie over de vochtplek in de hoek.":
    "She is applying for the energy fund voucher. She is paying the first instalment of the arrangement. I am arranging an appointment with the housing corporation about the damp patch in the corner.",
};

/**
 * Household composition ("2 volwassenen, 2 kinderen").
 *
 * A description, not a name: a reader looking at an English page should not meet
 * "2 volwassenen" and have to work out that it means two adults. The household's
 * *name* ("Familie Yılmaz — Korrewegwijk") and the programme title are proper
 * nouns and stay as they are, by explicit request.
 */
export const COMPOSITION_EN: Record<string, string> = {
  "1 volwassene, 74 jaar": "1 adult, aged 74",
  "2 volwassenen, 1 kind": "2 adults, 1 child",
  "2 volwassenen, 2 kinderen": "2 adults, 2 children",
};

/**
 * The restricted note VALUES — not the field names — which §8.2 keeps out of
 * every shared view. They are in the mirror only so the coach's own page can
 * read them in English; the gate itself is enforced in the domain layer and
 * asserted by T-10, not by this table's absence.
 */
export const RESTRICTED_VALUE_EN: Record<string, string> = {
  "Beperkte notitie over betalingen — zie beperkte velden.":
    "Restricted note about payments — see restricted fields.",
};

/**
 * Look a Dutch sentence up, returning `null` when there is no mirror.
 *
 * `null` is not an error: it means "this string has no translation yet", and
 * every caller must then print the Dutch with `lang="nl"`. Returning the input
 * instead would make an untranslated line indistinguishable from a translated
 * one, which is how the mixed-language screen happened in the first place.
 */
export function mirrorEn(dutch: string | null | undefined): string | null {
  if (!dutch) return null;
  return (
    ACTION_EN[dutch] ??
    COMPOSITION_EN[dutch] ??
    EVIDENCE_EN[dutch] ??
    BARRIER_NOTE_EN[dutch] ??
    TRANSCRIPT_EN[dutch] ??
    RESTRICTED_VALUE_EN[dutch] ??
    null
  );
}
