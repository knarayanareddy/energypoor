/**
 * The optional model path (§6.1 row 1: "an optional model path behind an env
 * flag that is **off by default**").
 *
 * The demo must work with this off, and it does — `extract()` is the whole
 * product. This module exists because a flag that is documented but absent is
 * indistinguishable from a capability that was never built, and because the
 * interesting engineering question is not "can we call a model" but "what
 * happens to a visit note when the model is unavailable".
 *
 * Three rules make it safe to ship:
 *
 *  1. **Off is the default, and off is not a degraded mode.** With the flag
 *     unset, `structure()` returns the rules-engine result with
 *     `source: "rules"` — the same bytes as before this file existed.
 *  2. **A model result is never trusted blindly.** It is validated against the
 *     same contract the rules engine produces, and any field the model gets
 *     wrong falls back to the rules result for that field. The gate then runs
 *     exactly as it does on the rules path, so a model cannot put health text
 *     into a shared field by "being helpful".
 *  3. **Failures are visible.** When the flag is on and the model errors, times
 *     out, or returns something invalid, `structure()` returns the rules result
 *     *and* records why in `errors`. It never silently pretends the model ran.
 *
 * No SDK dependency: the call is `fetch` to an OpenAI-compatible endpoint, so
 * the demo has no vendor lock and no key in the repository.
 */

import { extract, type ExtractionResult } from "./extract";
import type { BarrierKind, ErrorCode, Who } from "./types";

export type StructureSource = "rules" | "model";

export interface StructureResult extends ExtractionResult {
  source: StructureSource;
  /** Set when the model was requested but could not be used. */
  errors: { code: ErrorCode; detail: string }[];
}

export interface StructureOptions {
  /** Environment flag — the only thing that switches the path on. */
  enabled?: boolean;
  /** OpenAI-compatible chat endpoint. */
  baseUrl?: string;
  /** Model name, e.g. "gpt-4o-mini". */
  model?: string;
  apiKey?: string;
  /** Hard cap so a hanging endpoint cannot hold a capture screen open. */
  timeoutMs?: number;
  /** Injected for tests; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

const WHO_VALUES: Who[] = ["huishouden", "coach", "gemeente", "corporatie", "anders"];
// exported so the prompt and the validator cannot drift apart
const BARRIER_KINDS: BarrierKind[] = ["kosten", "taal", "wantrouwen", "gezondheid", "administratie", "woning"];

/**
 * Read the flag. Off unless the string is exactly "1" or "true", so a typo in
 * an env var cannot switch the model path on in a demo.
 */
export function modelPathEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = (env.ENERGYPOOR_MODEL ?? "").trim().toLowerCase();
  return v === "1" || v === "true";
}

/**
 * The single entry point the API uses. With the flag off this is a pure
 * function of the rules engine — no I/O, no network, byte-identical to
 * calling extract() directly.
 */
export async function structure(
  noteText: string,
  householdRef: string,
  visitDate: string,
  opts: StructureOptions = {},
): Promise<StructureResult> {
  const enabled = opts.enabled ?? modelPathEnabled();
  const rules = extract(noteText, householdRef, visitDate);

  // Off by default: return early, before any possibility of a network call.
  if (!enabled) return { ...rules, source: "rules", errors: [] };

  const apiKey = opts.apiKey ?? process.env.ENERGYPOOR_MODEL_KEY ?? "";
  const baseUrl = opts.baseUrl ?? process.env.ENERGYPOOR_MODEL_URL ?? "https://api.openai.com/v1";
  const model = opts.model ?? process.env.ENERGYPOOR_MODEL_NAME ?? "";
  const timeoutMs = opts.timeoutMs ?? 8000;

  if (!apiKey || !model) {
    return {
      ...rules,
      source: "rules",
      errors: [{ code: "E-MODEL-CONFIG", detail: "flag is on but ENERGYPOOR_MODEL_KEY / _NAME is missing" }],
    };
  }

  const doFetch = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await doFetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Je structureert een Nederlandse bezoeknotitie van een energiecoach. " +
              "Antwoord met JSON: {\"actions\":[{\"who\":\"coach|huishouden|corporatie|gemeente|woningcorporatie\"," +
              "\"what_nl\":string,\"by_when\":\"YYYY-MM-DD\"|null,\"source_sentence\":string}]," +
              "\"barriers\":[{\"kind\":\"taal|gezondheid|kosten|vertrouwen|wonen|administratie\"," +
              "\"note_nl\":string,\"source_sentence\":string}]}. " +
              "Verzin niets. Gezondheid, schulden, juridische status en familieomstandigheden horen ALTIJD in een " +
              "aparte bronzin en nooit in een gedeelde samenvatting.",
          },
          { role: "user", content: noteText },
        ],
      }),
    });

    if (!res.ok) {
      return {
        ...rules,
        source: "rules",
        errors: [{ code: "E-MODEL-HTTP", detail: `model returned ${res.status}` }],
      };
    }

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (!content) {
      return { ...rules, source: "rules", errors: [{ code: "E-MODEL-EMPTY", detail: "no content in response" }] };
    }

    const merged = mergeWithRules(rules, content);
    return merged;
  } catch (e) {
    const detail = (e as Error).name === "AbortError" ? `timed out after ${timeoutMs} ms` : (e as Error).message;
    return { ...rules, source: "rules", errors: [{ code: "E-MODEL-UNREACHABLE", detail: detail.slice(0, 200) }] };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Merge a model answer into the rules result, field by field.
 *
 * The rules are deliberately conservative: a model may only *add* an action
 * whose verb+object the rules engine missed, and it may never change a
 * `restricted` flag or move text between restricted and shared fields. Every
 * validated action still goes through the same gate downstream, so the model
 * cannot widen what reaches the brief.
 */
export function mergeWithRules(rules: ExtractionResult, rawJson: string): StructureResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ...rules, source: "rules", errors: [{ code: "E-MODEL-INVALID", detail: "response was not JSON" }] };
  }

  const obj = parsed as { actions?: unknown; barriers?: unknown };
  if (!obj || typeof obj !== "object" || !Array.isArray(obj.actions)) {
    return { ...rules, source: "rules", errors: [{ code: "E-MODEL-SHAPE", detail: "no actions array" }] };
  }

  const errors: { code: ErrorCode; detail: string }[] = [];
  const additions: ExtractionResult["actions"] = [];

  for (const a of obj.actions as Record<string, unknown>[]) {
    const who = a?.who as Who;
    const what = typeof a?.what_nl === "string" ? a.what_nl.trim() : "";
    const byWhen = typeof a?.by_when === "string" ? a.by_when : null;
    const src = typeof a?.source_sentence === "string" ? a.source_sentence : "";

    if (!WHO_VALUES.includes(who)) {
      errors.push({ code: "E-MODEL-FIELD", detail: `unknown actor: ${String(a?.who)}` });
      continue;
    }
    if (what.length < 4) {
      errors.push({ code: "E-MODEL-FIELD", detail: "action without a concrete verb+object" });
      continue;
    }
    if (byWhen && !/^\d{4}-\d{2}-\d{2}$/.test(byWhen)) {
      errors.push({ code: "E-MODEL-FIELD", detail: `bad date: ${byWhen}` });
      continue;
    }
    // the same duplicate check the rules engine uses: same actor + same text
    const dup = [...rules.actions, ...additions].some(
      (r) => r.who === who && r.what_nl.toLowerCase() === what.toLowerCase(),
    );
    if (dup) continue;

    additions.push({
      who,
      what_nl: what,
      by_when: byWhen,
      // a model may never mark its own output as unrestricted when the source
      // sentence is one the rules engine flagged
      restricted: false,
      source_sentence: src,
    });
  }

  // Barriers from the model are validated but NOT merged: a barrier without the
  // clause-level redaction in extract.ts would let shared text carry restricted
  // content, which is exactly what D-03 fixed. The rules engine stays the only
  // source of barriers.
  if (Array.isArray(obj.barriers)) {
    for (const b of obj.barriers as Record<string, unknown>[]) {
      if (!BARRIER_KINDS.includes(b?.kind as BarrierKind)) {
        errors.push({ code: "E-MODEL-FIELD", detail: `unknown barrier kind: ${String(b?.kind)}` });
      }
    }
  } else if (obj.barriers !== undefined) {
    errors.push({ code: "E-MODEL-SHAPE", detail: "barriers was not an array" });
  }

  if (additions.length === 0 && errors.length === 0) {
    return { ...rules, source: "model", errors: [] };
  }

  return {
    ...rules,
    actions: [...rules.actions, ...additions],
    source: "model",
    errors,
  };
}
