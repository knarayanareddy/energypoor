// src/domain/types.ts
// The data contract. Write this first (spec §6). Every array is append-only in
// behaviour: a correction never mutates a stored row, it appends a Correction
// and the read model applies corrections in order.

export type Who = "huishouden" | "coach" | "gemeente" | "corporatie" | "anders";
export type ActionStatus = "afgesproken" | "gedaan" | "niet_gedaan" | "onbekend";
export type BarrierKind =
  | "kosten"
  | "taal"
  | "wantrouwen"
  | "gezondheid"
  | "administratie"
  | "woning"
  | "anders";

export interface Action {
  action_id: string; // "A-<household>-<n>"
  household_ref: string;
  who: Who; // who owes the action
  what_nl: string; // MUST contain a concrete verb + object
  by_when: string | null; // ISO date or null == "geen datum"
  status: ActionStatus;
  evidence: string | null; // what proves it, in words
  restricted: boolean; // health/debt/legal -> excluded from brief & exports
  set_at_visit: string; // visit_id
  status_at_visit: string | null; // the visit where the status was last recorded
}

export interface Barrier {
  barrier_id: string;
  household_ref: string;
  kind: BarrierKind;
  note_nl: string;
  restricted: boolean;
  visit_id: string;
}

export interface Correction {
  correction_id: string;
  target: "action" | "barrier" | "visit";
  target_id: string;
  field: string;
  from: string | null;
  to: string | null;
  by: "coach" | "huishouden";
  at: string; // ISO timestamp
  reason_nl: string | null;
}

export interface Visit {
  visit_id: string; // "V-hh1-2026-03-14"
  household_ref: string;
  date: string;
  coach_ref: string;
  transcript: string;
  actions_added: string[]; // action_ids
  barriers_added: string[];
  restricted_count: number;
  corrections: Correction[];
  // §8.2 (1): restricted values live here, keyed by a stable field name,
  // OUTSIDE the shared read model. Never rendered in brief / household view / CSV.
  restricted_fields: Record<string, string>;
}

export interface Household {
  household_ref: string; // "HH-014"
  display_nl: string;
  composition_nl: string;
  tenure: "huur-corporatie" | "huur-prive" | "koop";
  label: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  programme: string | null;
  consent: { household_visible: boolean; share_with_corporation: false }; // always false
  last_visit: string | null;
  visits: Visit[];
  actions: Action[];
  barriers: Barrier[];
}

export interface PreVisitBrief {
  household_ref: string;
  display_nl: string;
  last_visit: string | null;
  agreed: Action[];
  completed: Action[];
  dropped: Action[]; // status niet_gedaan, with evidence = the reason
  ask_today_nl: string[];
  hand_over_nl: { wat: string; waar: string; voorwaarden: string }[];
  restricted_fields_excluded: string[]; // field names only, never values
  generated_at: string;
  stale_days: number;
}

// --- capture / draft (POST /api/note returns this, persists nothing) ---

export interface NeedsInput {
  sentence: string;
  question_nl: string;
  code: "E-ACTION-01";
}

export interface RestrictedHit {
  field: string; // health_mention_1 …
  kind: "health" | "debt" | "legal" | "family";
  value: string; // the raw sentence — restricted storage only
}

export interface DraftAction extends Omit<Action, "action_id" | "set_at_visit" | "status_at_visit"> {
  action_id: string;
  set_at_visit: string;
  status_at_visit: string | null;
  source_sentence: string;
  keep: boolean; // coach may drop an extracted action before confirming
}

export interface DraftBarrier extends Barrier {
  source_sentence: string;
  keep: boolean;
}

export interface Draft {
  draft_id: string;
  household_ref: string;
  visit_date: string;
  coach_ref: string;
  transcript: string;
  actions: DraftAction[];
  barriers: DraftBarrier[];
  needs_input: NeedsInput[];
  restricted_hits: RestrictedHit[];
  restricted_count: number;
  next_step: string;
  errors: { code: ErrorCode; message_nl: string }[];
  created_at: string;
  seq_hint: number;
}

export type ErrorCode =
  | "E-ACTION-01"
  | "E-RESTRICT-01"
  | "E-NOSHARE-01"
  | "E-NOEVAL-01"
  | "E-HOUSEVIEW-01"
  | "E-CONFIRM-01";

export interface CaseRow {
  ref: string;
  display_nl: string;
  hood: string;
  label: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  days_since_contact: number;
  open_actions: number;
  dropped_actions: number;
  restricted_present: boolean;
  // facts about the file, never about the person
  never_followed_up: number;
  visits: number;
}

export type SortKey = "staleness" | "open_actions" | "never_followed_up";

export interface AuditRow {
  seq: number;
  ts: string;
  actor: string;
  action: string;
  subject: string;
  payload: Record<string, unknown> | null;
  prev_hash: string;
  hash: string;
}

export interface ChainVerification {
  total: number;
  verified: number;
  brokenAt: number | null;
  reason?: string;
}
