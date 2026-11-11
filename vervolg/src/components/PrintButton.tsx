"use client";

export function PrintButton() {
  return (
    <button type="button" className="btn sm primary" onClick={() => window.print()}>
      Afdrukken (A4)
    </button>
  );
}
