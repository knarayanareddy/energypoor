import type { Locale } from "@/i18n/dict";

/**
 * Dutch dossier content on an English screen.
 *
 * The case data is Dutch by schema, not by accident: `what_nl`, `note_nl`,
 * `display_nl` and `composition_nl` are the spec's own field names (§6), and
 * `transcript` is what a coach actually said on a doorstep in Groningen.
 * Translating it would be inventing a different case file.
 *
 * So on an English page this content stays Dutch — and must *say* it is Dutch
 * in two ways, because there are two different readers:
 *
 *   * `lang="nl"` on the container, so assistive technology switches voice
 *     instead of reading "Isolatie van de voorgevel bellen" with English
 *     phonetics and producing nonsense.
 *   * a visible line, so a sighted reader who switched to English understands
 *     that the switch worked and the dossier beneath it is deliberately Dutch.
 *
 * Both are needed and neither is optional. The household page shipped with
 * neither: the toggle said "EN", the chrome said English, and the middle of the
 * screen was Dutch with nothing to explain it — which reads as a broken
 * translation rather than a design decision.
 *
 * `as` lets the wrapper be a `<div>`, `<span>` or `<p>` so it can sit inside
 * whatever layout it lands in without a stray block element breaking the flow.
 */
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
