// A2 — horizontal overflow, checked without a browser.
//
// A real measurement needs a layout engine. This test instead enforces the two
// mechanisms that cause overflow at 390 px in practice:
//   1. no element may declare a fixed width wider than the narrowest viewport;
//   2. every two-column split must collapse at a breakpoint.
// It is a structural guard, not a measurement — REVIEW.md says so explicitly.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { rel, sourceFiles } from "../domain/invariants";

const NARROW = 390;
const tsx = sourceFiles().filter((f) => f.endsWith(".tsx"));

describe("A2 — nothing can push the document wider than 390 px", () => {
  it("no inline style declares a fixed width above the narrow viewport", () => {
    const offenders: string[] = [];
    for (const f of tsx) {
      const code = readFileSync(f, "utf8");
      // width: 320px  /  minWidth: 420  /  flex: "0 0 380px"
      for (const m of code.matchAll(/\b(?:minWidth|maxWidth|width|flex)\s*[:=]\s*["']?[^"',;)}]*?\b(\d{3,})\s*px/g)) {
        const px = Number(m[2]);
        // a maxWidth is a cap, never a floor — it cannot cause overflow
        if (/maxWidth/.test(m[0])) continue;
        if (px > NARROW - 40) offenders.push(`${rel(f)}: ${m[0].slice(0, 60)}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every grid template that declares two columns collapses at a breakpoint", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    // the collapse rules exist and target the same class names the pages use
    expect(css).toMatch(/@media \(max-width: 820px\)[\s\S]*?\.split-2-1/);
    expect(css).toMatch(/@media \(max-width: 820px\)[\s\S]*?\.split-3-2/);
    expect(css).toMatch(/@media \(max-width: 820px\)[\s\S]*?\.split-capture/);
    expect(css).toMatch(/@media \(max-width: 640px\)[\s\S]*?\.g2/);
    for (const cls of ["split-2-1", "split-3-2", "split-capture"]) {
      expect(css).toContain(`.${cls} {`);
    }
  });

  it("grid children are allowed to shrink below their content width", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/\.grid > \*[\s\S]{0,80}min-width: 0/);
    expect(css).toMatch(/\.row > \*[\s\S]{0,80}min-width: 0/);
  });

  it("wide tables scroll themselves, never the page", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toMatch(/\.scroll-x\s*\{[^}]*overflow-x:\s*auto/);
    const overflow = readFileSync("src/app/globals.css", "utf8");
    expect(overflow).toMatch(/html,\s*\nbody\s*\{[^}]*overflow-x:\s*hidden/);
  });
});

describe("A3 — no nested anchors", () => {
  /**
   * A real nesting check, not a regex on proximity: scan the JSX and track depth
   * as <Link …> / <a …> open and </Link> / </a> close. Two sibling links inside
   * the same parent are fine; one link opened inside another is A3.
   */
  function maxAnchorDepth(code: string): number {
    let depth = 0;
    let max = 0;
    const token = /<(\/?)(Link|a)\b([^>]*)>/g;
    let m: RegExpExecArray | null;
    while ((m = token.exec(code))) {
      const closing = m[1] === "/";
      const selfClosing = /\/>\s*$/.test(m[0]);
      if (closing) depth = Math.max(0, depth - 1);
      else if (!selfClosing) {
        depth++;
        max = Math.max(max, depth);
      }
    }
    return max;
  }

  it("no anchor is rendered inside another anchor in any component", () => {
    const offenders: string[] = [];
    for (const f of tsx) {
      const code = readFileSync(f, "utf8");
      if (maxAnchorDepth(code) > 1) offenders.push(rel(f));
    }
    expect(offenders).toEqual([]);
  });

  it("srcdoc-based nested anchors cannot occur because there is no dangerouslySetInnerHTML", () => {
    for (const f of tsx) {
      expect(readFileSync(f, "utf8"), rel(f)).not.toContain("dangerouslySetInnerHTML");
    }
  });
});

describe("print", () => {
  it("the brief page has a print stylesheet that hides chrome and fixes A4", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const print = css.slice(css.indexOf("@media print"));
    expect(print).toContain("@page");
    expect(print).toContain("size: A4");
    expect(print).toMatch(/\.topbar[\s\S]{0,200}display: none/);
    expect(print).toMatch(/footer\.site[\s\S]{0,200}display: none/);
    expect(print).toContain("break-inside: avoid");
  });

  it("the brief renders all five required blocks in order", () => {
    const page = readFileSync("src/app/household/[id]/brief/page.tsx", "utf8");
    const order = [
      "Bezoekvoorbereiding",
      "Wat is afgesproken",
      "Vandaag vragen",
      "Om over te dragen",
      "Niet opgenomen in dit overzicht",
      "Dit dossier is van het huishouden",
    ];
    let cursor = -1;
    for (const needle of order) {
      const at = page.indexOf(needle);
      expect(at, `${needle} present`).toBeGreaterThan(-1);
      expect(at, `${needle} after the previous block`).toBeGreaterThan(cursor);
      cursor = at;
    }
  });
});
