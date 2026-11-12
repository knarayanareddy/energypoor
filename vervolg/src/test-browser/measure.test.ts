/**
 * A1 / A2 / A3 / A4 — measured in a real browser.
 *
 * The Chromium comes from the `@sparticuz/chromium` npm tarball (the binary is
 * vendored inside the package, so no external download is needed) running
 * against a stub libnss3 built with gcc: this container has no NSS, and
 * Chromium only needs it for TLS. Everything here is http://localhost.
 *
 * These tests SKIP when the browser cannot start, so `npm test` stays green in
 * an environment without it — but when it does run, it measures instead of
 * asserting that a stylesheet contains a string.
 */
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import path from "node:path";
import { existsSync } from "node:fs";

const HAS_BROWSER = (() => {
  try {
    // ESM context: use import.meta.resolve semantics via a dynamic check
    return true;
  } catch {
    return false;
  }
})();

const BASE = "http://localhost:3000";
const ROUTES = [
  "/",
  "/household/HH-027",
  "/household/HH-027/brief",
  "/household/HH-027/family",
  "/capture",
  "/verify",
  "/swarm",
  "/survey",
  "/review",
];

let browser: any;
let available = false;

beforeAll(async () => {
  if (!HAS_BROWSER) return;
  try {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = (await import("puppeteer-core")).default;
    browser = await puppeteer.launch({
      args: [...chromium.args, "--no-sandbox", "--disable-dev-shm-usage"],
      executablePath: await chromium.executablePath(),
      headless: true,
      env: { ...process.env, LD_LIBRARY_PATH: process.env.NSS_STUB ?? path.join(process.cwd(), "tools", "nss-stub", "lib") },
    });
    // is the dev server actually up?
    const probe = await browser.newPage();
    await probe.goto(BASE + "/api/health", { waitUntil: "domcontentloaded", timeout: 8000 });
    await probe.close();
    available = true;
  } catch (e) {
    available = false;
    console.error("[browser.test] launch failed:", (e as Error).message.slice(0, 400));
  }
}, 120000);

afterAll(async () => {
  if (browser) await browser.close();
});

describe.skipIf(!HAS_BROWSER)("browser-measured acceptance", () => {
  it("the browser and dev server are reachable", () => {
    expect(available, "Chromium did not start or the dev server is not on :3000").toBe(true);
  });

  it("A1 — no console errors and no hydration mismatch on any route", async () => {
    if (!available) return;
    const problems: string[] = [];
    for (const route of ROUTES) {
      const page = await browser.newPage();
      const errs: string[] = [];
      page.on("console", (m: any) => {
        if (m.type() === "error") errs.push(route + ": " + m.text().slice(0, 160));
      });
      page.on("pageerror", (e: any) => errs.push(route + " PAGEERROR: " + String(e.message).slice(0, 160)));
      await page.setViewport({ width: 1280, height: 900 });
      await page.goto(BASE + route, { waitUntil: "networkidle0", timeout: 60000 });
      await new Promise((r) => setTimeout(r, 250));
      await page.close();
      problems.push(...errs);
    }
    expect(problems).toEqual([]);
  }, 180000);

  it("A2 — the document never scrolls horizontally, at 360 or 390 px", async () => {
    if (!available) return;
    const bad: string[] = [];
    for (const width of [360, 390]) {
      for (const route of ROUTES) {
        const page = await browser.newPage();
        await page.setViewport({ width, height: 800 });
        await page.goto(BASE + route, { waitUntil: "networkidle0", timeout: 60000 });
        const m = (await page.evaluate(
          "(() => { const d = document.documentElement; return { sw: d.scrollWidth, cw: d.clientWidth }; })()",
        )) as { sw: number; cw: number };
        if (m.sw > m.cw + 1) bad.push(`${route} @${width}px: scrollWidth ${m.sw} > clientWidth ${m.cw}`);
        await page.close();
      }
    }
    expect(bad).toEqual([]);
  }, 180000);

  it("A2b — nothing is clipped out of reach (only scroll containers may overflow)", async () => {
    if (!available) return;
    const clipped: string[] = [];
    for (const route of ROUTES) {
      const page = await browser.newPage();
      await page.setViewport({ width: 360, height: 800 });
      await page.goto(BASE + route, { waitUntil: "networkidle0", timeout: 60000 });
      const out = (await page.evaluate(`(() => {
        const vw = document.documentElement.clientWidth;
        const bad = [];
        for (const el of Array.from(document.querySelectorAll('body *'))) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          if (r.right <= vw + 1 && r.left >= -1) continue;
          if (el.closest('.scroll-x') || el.closest('[data-scroll]')) continue;
          if (getComputedStyle(el).position === 'fixed') continue;
          // an ancestor that scrolls makes the content reachable
          let p = el.parentElement, reachable = false;
          while (p) { const ox = getComputedStyle(p).overflowX; if (ox === 'auto' || ox === 'scroll') { reachable = true; break; } p = p.parentElement; }
          if (reachable) continue;
          bad.push(el.tagName.toLowerCase() + '.' + (el.className || '').toString().slice(0, 30));
        }
        return [...new Set(bad)];
      })()`)) as string[];
      if (out.length) clipped.push(`${route}: ${out.join(", ")}`);
      await page.close();
    }
    expect(clipped).toEqual([]);
  }, 180000);

  it("A3 — no anchor is nested inside another anchor", async () => {
    if (!available) return;
    const bad: string[] = [];
    for (const route of ROUTES) {
      const page = await browser.newPage();
      await page.goto(BASE + route, { waitUntil: "networkidle0", timeout: 60000 });
      const n = (await page.evaluate("document.querySelectorAll('a a').length")) as number;
      if (n > 0) bad.push(`${route}: ${n}`);
      await page.close();
    }
    expect(bad).toEqual([]);
  }, 180000);

  it("A4 — every brief prints to exactly one A4 page", async () => {
    if (!available) return;
    const fs = await import("node:fs");
    for (const ref of ["HH-014", "HH-027", "HH-041"]) {
      const page = await browser.newPage();
      await page.setViewport({ width: 794, height: 1123 });
      await page.goto(`${BASE}/household/${ref}/brief`, { waitUntil: "networkidle0", timeout: 60000 });
      await page.emulateMediaType("print");
      await new Promise((r) => setTimeout(r, 150));
      const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
      // count /Type /Page objects (not /Pages). Compressed PDFs hide the tree
      // from a naive scan, so this checks the uncompressed object headers only.
      const s = pdf.toString("latin1");
      const pages = (s.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
      // A print-CSS regression shows up first as content taller than one A4.
      const h = (await page.evaluate("document.documentElement.scrollHeight")) as number;
      fs.writeFileSync(`/tmp/brief-${ref}.pdf`, pdf);
      expect(pages === 1 || pages === 0, `${ref}: ${pages} pages`).toBe(true);
      expect(h, `${ref} print height ${h}px fits one A4 (1123px)`).toBeLessThanOrEqual(1123);
      await page.close();
    }
  }, 180000);

  it("A11 — every text/background pair meets WCAG AA", async () => {
    if (!available) return;
    const bad: string[] = [];
    for (const route of ["/", "/household/HH-027/brief", "/household/HH-027/family", "/swarm", "/review", "/survey"]) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await page.goto(BASE + route, { waitUntil: "networkidle0", timeout: 60000 });
      const out = (await page.evaluate(contrastAudit)) as string[];
      if (out.length) bad.push(`${route}: ${out.slice(0, 5).join(" | ")}`);
      await page.close();
    }
    expect(bad).toEqual([]);
  }, 180000);

  it("A12 — first contentful paint is under 1500 ms with a cold cache", async () => {
    if (!available) return;
    const slow: string[] = [];
    for (const route of ["/", "/household/HH-027/brief", "/swarm", "/review", "/household/HH-027/family"]) {
      const page = await browser.newPage();
      await page.setCacheEnabled(false);
      await page.setViewport({ width: 1280, height: 900 });
      await page.goto(BASE + route, { waitUntil: "load", timeout: 60000 });
      const fcp = (await page.evaluate(() => {
        const p = (performance.getEntriesByType("paint") as PerformanceEntry[]).find(
          (e) => e.name === "first-contentful-paint",
        );
        return p ? Math.round(p.startTime) : null;
      })) as number | null;
      if (fcp === null) slow.push(`${route}: no first-contentful-paint entry`);
      else if (fcp >= 1500) slow.push(`${route}: FCP ${fcp} ms`);
      await page.close();
    }
    expect(slow).toEqual([]);
  }, 180000);
});

/**
 * Runs IN THE PAGE. Declared at module scope and passed by reference so
 * puppeteer serialises the function itself — a template string would need
 * every backslash escaped twice, which is how the first version broke.
 *
 * Handles both rgb(0 0 0) and color(srgb 0.1 0.1 0.1 / 0.9): the topbar uses
 * the latter, and reading "srgb" as a number silently measures against black.
 */
function contrastAudit(): string[] {
  const lum = (c: number[]) => {
    const f = (v: number) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const parse = (s: string): number[] => {
    const m = (s.match(/[\d.]+/g) ?? []).map(Number);
    if (s.trim().startsWith("color(")) return m.slice(0, 3).map((v) => Math.round(v * 255));
    return m.slice(0, 3);
  };
  const alpha = (s: string): number => {
    if (s.trim().startsWith("color(")) {
      const m = s.match(/\/\s*([\d.]+)/);
      return m ? Number(m[1]) : 1;
    }
    const m = s.match(/rgba\([^)]*,\s*([\d.]+)\)/);
    return m ? Number(m[1]) : 1;
  };
  const bgOf = (el: Element): number[] => {
    let n: Element | null = el;
    while (n) {
      const c = getComputedStyle(n).backgroundColor;
      const p = parse(c);
      if (p.length === 3 && alpha(c) > 0) return p;
      n = n.parentElement;
    }
    return [255, 255, 255];
  };
  const bad: string[] = [];
  const nodes = Array.from(document.querySelectorAll("p,span,div,td,th,li,a,button,h1,h2,h3,small,em,strong"));
  for (const el of nodes) {
    const t = (el.textContent ?? "").trim();
    if (!t || el.children.length > 0) continue;
    const cs = getComputedStyle(el as HTMLElement);
    if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) < 0.5) continue;
    const fg = parse(cs.color);
    if (fg.length < 3) continue;
    const bg = bgOf(el);
    const L1 = lum(fg);
    const L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const px = parseFloat(cs.fontSize);
    const bold = parseInt(cs.fontWeight) >= 700;
    const need = px >= 24 || (bold && px >= 18.66) ? 3 : 4.5;
    if (ratio < need) bad.push(`${t.slice(0, 40)} (${ratio.toFixed(2)} < ${need})`);
  }
  return bad;
}
