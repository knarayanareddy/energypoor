/** §8 — the restricted-field marker. --flag is used for nothing else. */
export function RestrictedMarker({ label = "beperkt veld" }: { label?: string }) {
  return (
    <span className="restricted-marker" title="Dit veld is niet opgenomen in de brief, de huishoudweergave of een export.">
      <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
        <rect x="2" y="5" width="8" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M4 5V3.6a2 2 0 0 1 4 0V5" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      {label}
    </span>
  );
}
