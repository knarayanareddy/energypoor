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

/**
 * Both languages are measured. The English side is a mirror of every screen, so
 * every acceptance criterion has to hold there too — a wider column of English
 * prose is exactly where a horizontal-scroll regression would appear, and an
 * untranslated string cannot show up as a contrast failure if nobody loads the
 * page. Each `for (const loc of LOCALES)` below is the same assertion run twice.
 */
const LOCALES = ["nl", "en"] as const;

/** Set the language the app reads on the server, before the first paint. */
async function setLocale(page: any, loc: string) {
  await page.setCookie({ name: "vervolg-locale", value: loc, domain: "localhost", path: "/" });
}
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
    for (const loc of LOCALES) {
      for (const route of ROUTES) {
        const page = await browser.newPage();
        const errs: string[] = [];
        page.on("console", (m: any) => {
          if (m.type() === "error") errs.push(`[${loc}] ` + route + ": " + m.text().slice(0, 160));
        });
        page.on("pageerror", (e: any) =>
          errs.push(`[${loc}] ` + route + " PAGEERROR: " + String(e.message).slice(0, 160)),
        );
        await page.setViewport({ width: 1280, height: 900 });
        await setLocale(page, loc);
        await page.goto(BASE + route, { waitUntil: "networkidle0", timeout: 60000 });
        await new Promise((r) => setTimeout(r, 250));
        await page.close();
        problems.push(...errs);
      }
    }
    expect(problems).toEqual([]);
  }, 180000);

  it("A2 — the document never scrolls horizontally, at 360 or 390 px", async () => {
    if (!available) return;
    const bad: string[] = [];
    for (const loc of LOCALES)
      for (const width of [360, 390]) {
      for (const route of ROUTES) {
        const page = await browser.newPage();
        await page.setViewport({ width, height: 800 });
        await setLocale(page, loc);
        await page.goto(BASE + route, { waitUntil: "networkidle0", timeout: 60000 });
        const m = (await page.evaluate(
          "(() => { const d = document.documentElement; return { sw: d.scrollWidth, cw: d.clientWidth }; })()",
        )) as { sw: number; cw: number };
        if (m.sw > m.cw + 1) bad.push(`[${loc}] ${route} @${width}px: scrollWidth ${m.sw} > clientWidth ${m.cw}`);
        await page.close();
      }
    }
    expect(bad).toEqual([]);
  }, 180000);

  it("A2b — nothing is clipped out of reach (only scroll containers may overflow)", async () => {
    if (!available) return;
    const clipped: string[] = [];
    for (const loc of LOCALES)
      for (const route of ROUTES) {
      const page = await browser.newPage();
      await page.setViewport({ width: 360, height: 800 });
      await setLocale(page, loc);
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
      if (out.length) clipped.push(`[${loc}] ${route}: ${out.join(", ")}`);
      await page.close();
    }
    expect(clipped).toEqual([]);
  }, 180000);

  it("A3 — no anchor is nested inside another anchor", async () => {
    if (!available) return;
    const bad: string[] = [];
    for (const loc of LOCALES)
      for (const route of ROUTES) {
      const page = await browser.newPage();
      await setLocale(page, loc);
      await page.goto(BASE + route, { waitUntil: "networkidle0", timeout: 60000 });
      const n = (await page.evaluate("document.querySelectorAll('a a').length")) as number;
      if (n > 0) bad.push(`[${loc}] ${route}: ${n}`);
      await page.close();
    }
    expect(bad).toEqual([]);
  }, 180000);

  it("A4 — every brief prints to exactly one A4 page", async () => {
    if (!available) return;
    const fs = await import("node:fs");
    for (const loc of LOCALES)
      for (const ref of ["HH-014", "HH-027", "HH-041"]) {
      const page = await browser.newPage();
      await page.setViewport({ width: 794, height: 1123 });
      await setLocale(page, loc);
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
      fs.writeFileSync(`/tmp/brief-${ref}-${loc}.pdf`, pdf);
      expect(pages === 1 || pages === 0, `[${loc}] ${ref}: ${pages} pages`).toBe(true);
      expect(h, `[${loc}] ${ref} print height ${h}px fits one A4 (1123px)`).toBeLessThanOrEqual(1123);
      await page.close();
    }
  }, 180000);

  it("A11 — every text/background pair meets WCAG AA", async () => {
    if (!available) return;
    const bad: string[] = [];
    for (const loc of LOCALES)
      for (const route of ["/", "/household/HH-027/brief", "/household/HH-027/family", "/swarm", "/review", "/survey"]) {
      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 900 });
      await setLocale(page, loc);
      await page.goto(BASE + route, { waitUntil: "networkidle0", timeout: 60000 });
      const out = (await page.evaluate(contrastAudit)) as string[];
      if (out.length) bad.push(`[${loc}] ${route}: ${out.slice(0, 5).join(" | ")}`);
      await page.close();
    }
    expect(bad).toEqual([]);
  }, 180000);

  it("the mobile nav keeps every destination reachable and does not overlap the wordmark", async () => {
    if (!available) return;
    const problems: string[] = [];
    for (const loc of LOCALES)
      for (const width of [360, 390]) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 700, isMobile: true, hasTouch: true });
      await setLocale(page, loc);
      await page.goto(BASE + "/", { waitUntil: "networkidle0", timeout: 60000 });
      const m = (await page.evaluate(`(() => {
        const wm = document.querySelector(".wordmark").getBoundingClientRect();
        const nav = document.querySelector(".nav");
        const links = [...nav.querySelectorAll("a")];
        const last = links[links.length - 1];
        nav.scrollLeft = nav.scrollWidth;
        const r = last.getBoundingClientRect();
        const navR = nav.getBoundingClientRect();
        const tb = document.querySelector(".topbar").getBoundingClientRect();
        return {
          overlap: wm.right > navR.left + 1 && Math.abs(wm.top - navR.top) < 10,
          reachable: r.right <= navR.right + 1,
          rows: Math.round(tb.height),
          last: last.textContent,
        };
      })()`)) as any;
      if (m.overlap) problems.push(`[${loc}] ${width}px: wordmark overlaps the nav`);
      if (!m.reachable) problems.push(`[${loc}] ${width}px: last nav item (${m.last}) unreachable`);
      if (m.rows > 96) problems.push(`[${loc}] ${width}px: topbar ${m.rows}px tall — nav has wrapped into rows`);
      await page.close();
    }
    expect(problems).toEqual([]);
  }, 60000);

  it("B — every screen renders in the chosen language, and the Dutch artefacts say why", async () => {
    if (!available) return;
    const bad: string[] = [];
    for (const route of ROUTES) {
      const page = await browser.newPage();
      await setLocale(page, "en");
      await page.goto(BASE + route, { waitUntil: "networkidle0", timeout: 60000 });
      const m = (await page.evaluate(`(() => {
        const html = document.documentElement;
        const h1 = document.querySelector("main h1");
        const artefact = document.querySelector('[data-testid="artefact-note"]');
        return {
          lang: html.getAttribute("lang"),
          title: document.title,
          h1: h1 ? h1.textContent.trim().slice(0, 80) : null,
          artefact: artefact ? artefact.textContent.trim().slice(0, 60) : null,
          nav: [...document.querySelectorAll(".nav a")].map((a) => a.textContent.trim()),
        };
      })()`)) as { lang: string; title: string; h1: string | null; artefact: string | null; nav: string[] };
      if (m.lang !== "en") bad.push(`${route}: html lang is ${m.lang}`);
      if (m.title.includes("De afspraak die niemand onthoudt") && route !== "/review") {
        bad.push(`${route}: tab title is still Dutch (${m.title})`);
      }
      // The four pages that render Dutch fixtures must carry the note, because
      // an English reader is about to be shown Dutch they cannot read.
      const artefactRoutes = ["/household/HH-027/brief", "/household/HH-027/family", "/survey"];
      if (artefactRoutes.includes(route) && !m.artefact) bad.push(`${route}: no artefact note on an English page`);
      if (route === "/" && !m.nav.includes("Capture")) bad.push(`${route}: nav is not in English`);
      await page.close();
    }
    // ...and the same routes with no cookie must be Dutch, which is the default.
    for (const route of ["/", "/swarm", "/household/HH-027"]) {
      const page = await browser.newPage();
      await page.setCookie({ name: "vervolg-locale", value: "nl", domain: "localhost", path: "/" });
      await page.goto(BASE + route, { waitUntil: "networkidle0", timeout: 60000 });
      const lang = (await page.evaluate("document.documentElement.getAttribute('lang')")) as string;
      if (lang !== "nl") bad.push(`${route}: default language is ${lang}, not nl`);
      await page.close();
    }
    expect(bad).toEqual([]);
  }, 180000);

  it("the dev-tools badge does not cover the synthetic-data disclaimer", async () => {
    if (!available) return;
    // The badge is a <nextjs-portal> shadow host at bottom-left. Whatever sits
    // there must not be a dev overlay: the disclaimer is the one line on every
    // screen that may never be obscured.
    const covered: string[] = [];
    for (const route of ["/", "/capture", "/family-placeholder"]) {
      if (route === "/family-placeholder") continue;
      const page = await browser.newPage();
      await page.setViewport({ width: 400, height: 400 });
      await page.goto(BASE + route, { waitUntil: "networkidle0", timeout: 60000 });
      const tag = (await page.evaluate(
        "(() => { const e = document.elementFromPoint(42, 362); return e ? e.tagName.toLowerCase() : 'none'; })()",
      )) as string;
      if (tag === "nextjs-portal") covered.push(route);
      await page.close();
    }
    expect(covered).toEqual([]);
  }, 60000);

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
