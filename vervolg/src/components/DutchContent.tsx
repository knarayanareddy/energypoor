import type { Locale } from "@/i18n/dict";
import { mirrorEn } from "@/i18n/dossier";

/**
 * Dossier prose, in the reader's language.
 *
 * The case files are Dutch at rest: `what_nl`, `note_nl` and `transcript` are
 * the spec's own field names (§6). But a page whose chrome is English and whose
 * middle is Dutch is not "bilingual", it is half-finished — that was the
 * complaint, and it was fair. So each Dutch sentence has an English mirror in
 * `src/i18n/dossier.ts`, keyed by the Dutch sentence itself, and this component
 * is the single place that decides which one to show.
 *
 * The fallback matters as much as the translation. When a string has no mirror
 * (`mirrorEn` returns null) the Dutch is rendered anyway, wrapped in `lang="nl"`
 * so assistive technology switches voice, and the page keeps working. It never
 * silently prints Dutch while claiming to be English.
 *
 * What is NOT translated, because it is not prose:
 *   * household names and the programme title — proper nouns;
 *   * `restricted` values — §8.2 keeps them out of every shared view entirely;
 *   * the printed brief — §8.3 requires one A4 page, in Dutch.
 */

/**
 * One Dutch sentence, rendered in the page's language.
 *
 * `dutch` is the stored string; when the locale is English and a mirror exists,
 * the mirror is returned. Anything unmatched falls through to the Dutch, marked.
 */
export function DossierText({ dutch, locale }: { dutch: string; locale: Locale }) {
  if (locale === "nl") return <>{dutch}</>;
  const en = mirrorEn(dutch);
  if (en) return <>{en}</>;
  return <span lang="nl">{dutch}</span>;
}

export function DutchContent({
  locale,
  note,
  children,
  as: Tag = "div",
  className,
  style,
  testId,
}: {
  locale: Locale;
  /** The sentence explaining why this is Dutch. Ignored when locale is nl. */
  note: string;
  children: React.ReactNode;
  as?: "div" | "span" | "p" | "li" | "dd";
  className?: string;
  style?: React.CSSProperties;
  testId?: string;
}) {
  // A Dutch page is not an English page with Dutch content on it: nothing needs
  // explaining, and the note would be noise.
  if (locale === "nl") {
    return (
      <Tag className={className} style={style} data-testid={testId}>
        {children}
      </Tag>
    );
  }
  return (
    <div className="dutch-content" data-testid={testId}>
      <p className="small muted dutch-note">{note}</p>
      <Tag lang="nl" className={className} style={style}>
        {children}
      </Tag>
    </div>
  );
}

/**
 * The same marking for a single inline value, with no note.
 *
 * Some Dutch strings are one or two words in the middle of an English sentence
 * — a household's name in a table row, an action id, a barrier kind. A note
 * under each of those would be absurd; `lang` is what a screen reader needs,
 * and the surrounding English already explains itself.
 */
export function Nl({
  locale,
  children,
  className,
  style,
}: {
  locale: Locale;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  if (locale === "nl") return <span className={className} style={style}>{children}</span>;
  return (
    <span lang="nl" className={className} style={style}>
      {children}
    </span>
  );
}
