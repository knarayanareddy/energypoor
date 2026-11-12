import type { Locale } from "@/i18n/dict";

/**
 * v1 — the ten questions a team writes by default.
 *
 * This is not a fixture: it is the strawman the coverage matrix argues against,
 * written by us to show what standard practice asks. So it is translatable, and
 * the Dutch is the original. The fourteen v2 items are the opposite: they are the
 * instrument the population was actually run against, and their Dutch wording is
 * part of the measurement (§12) — translating them would mean measuring a
 * different questionnaire.
 */
const nl = [
  "Wat is uw grootste moeilijkheid?",
  "Hoe waarschijnlijk is het dat u dit zou gebruiken? (1–5)",
  "Welke functie is het meest waardevol?",
  "Wat zou u overtuigen?",
  "Hoe tevreden bent u met uw energierekening? (1–5)",
  "Wat is uw postcode?",
  "Hoeveel jaar woont u hier?",
  "Heeft u een energielabel?",
  "Wat is uw leeftijd?",
  "Hoe vaak heeft u contact met de gemeente?",
];

const en = [
  "What is your biggest difficulty?",
  "How likely would you be to use this? (1–5)",
  "Which feature is the most valuable?",
  "What would convince you?",
  "How satisfied are you with your energy bill? (1–5)",
  "What is your postcode?",
  "How many years have you lived here?",
  "Does your home have an energy label?",
  "What is your age?",
  "How often do you have contact with the municipality?",
];

export function v1Items(locale: Locale): readonly string[] {
  return locale === "en" ? en : nl;
}
