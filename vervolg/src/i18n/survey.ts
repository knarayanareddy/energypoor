import type { Locale } from "@/i18n/dict";

/**
 * The coverage matrix rows, one per necessity. This lives outside the flat UI
 * dictionary because the dictionary's contract is `Record<key, string>`, and a
 * table row is four strings: typing it as a flat key would mean building the
 * row with string splitting, which is exactly the bug class we removed from
 * `/swarm`. Two typed arrays, same guarantee: the English array cannot be
 * missing a row without the types complaining.
 */
type Row = { need: string; why: string; v1: string; v2: string };

const nl: Row[] = [
  { need: "N1 · Accepteert het huishouden een zichtbaar dossier?", why: "het permissiemodel is het product", v1: "✗ nooit gevraagd", v2: "✓ voice, q_visible" },
  { need: "N2 · Is follow-through geaccepteerd als maatstaf?", why: "het meetargument", v1: "✗", v2: "✓ metric" },
  { need: "N3 · Wie betaalt volgens de populatie?", why: "bepaalt de verkooproute", v1: 'deels ("zorg")', v2: "✓ payer" },
  { need: "N4 · Neemt een coach op met spraak?", why: "adoptie sterft hier", v1: "✗", v2: "✓ adopt, q_capture" },
  { need: "N5 · Vertrouwt het huishouden de gemeente?", why: "voorwaarde voor route 1", v1: "✗", v2: "✓ trust" },
  { need: "N6 · Is sorteren eerlijk?", why: "de enige eerlijkheidsvraag die het product maakt", v1: "✗", v2: "✓ queue" },
  { need: "N7 · Hoe groot is het geheugenprobleem, gemeten?", why: "de pitch zegt: de helft sterft", v1: "✗", v2: "✓ q_followthrough" },
  { need: "N8 · Welke barrière komt eerst?", why: "bepaalt de brief-template", v1: "deels", v2: "✓ q_barrier" },
  { need: "N9 · Accepteren ze een huisbezoek?", why: "het levermodel", v1: "✗", v2: "✓ q_visit" },
  { need: "N10 · Wat zou ze laten stoppen?", why: "churn, voordat het gebeurt", v1: "✗", v2: "✓ q_stop" },
];

const en: Row[] = [
  { need: "N1 · Does the household accept a visible case file?", why: "the permission model is the product", v1: "✗ never asked", v2: "✓ voice, q_visible" },
  { need: "N2 · Is follow-through accepted as the yardstick?", why: "the measurement argument", v1: "✗", v2: "✓ metric" },
  { need: "N3 · Who pays, according to the population?", why: "decides the sales route", v1: 'partly ("care")', v2: "✓ payer" },
  { need: "N4 · Does a coach record by voice?", why: "adoption dies here", v1: "✗", v2: "✓ adopt, q_capture" },
  { need: "N5 · Does the household trust the municipality?", why: "a precondition for route 1", v1: "✗", v2: "✓ trust" },
  { need: "N6 · Is sorting fair?", why: "the only fairness question the product asks", v1: "✗", v2: "✓ queue" },
  { need: "N7 · How big is the memory problem, measured?", why: "the pitch says: half of it dies", v1: "✗", v2: "✓ q_followthrough" },
  { need: "N8 · Which barrier comes first?", why: "decides the brief template", v1: "partly", v2: "✓ q_barrier" },
  { need: "N9 · Do they accept a home visit?", why: "the delivery model", v1: "✗", v2: "✓ q_visit" },
  { need: "N10 · What would make them stop?", why: "churn, before it happens", v1: "✗", v2: "✓ q_stop" },
];

export function coverageRows(locale: Locale): Row[] {
  return locale === "en" ? en : nl;
}
