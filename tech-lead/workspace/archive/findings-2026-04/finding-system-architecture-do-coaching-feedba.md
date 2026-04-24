# Finding: Do coaching-feedback.ts and coaching-report.ts overlap?

**Lens:** A — System Architecture
**Date:** 2026-04-17
**Verdict:** ✗ No meaningful overlap. Keep as two distinct handlers.

## Summary

Despite the shared "coaching" prefix, these two handlers have **disjoint data sources, disjoint outputs, and disjoint purposes**. Merging would combine unrelated concerns and reduce clarity. Close finding — no refactor recommended.

## Evidence

### 1. Data sources are different

- `coaching-feedback.ts` reads the **`convention_checks` SQLite table** (`agents/may/handlers/coaching-feedback.ts:54-65`) — it aggregates per-agent/per-convention pass/fail counts over a rolling window (default 24h, `coaching-feedback.ts:44`).
- `coaching-report.ts` reads **`evaluations/*.json` files off disk** (`agents/may/handlers/coaching-report.ts:59-78`) — filesystem-based EvalRecord entries with `efficiency`/`quality`/`verdict` fields. It only touches the DB for a single `requests` backlog count (`coaching-report.ts:147-152`).

The two handlers do not share a single query, table, or file path.

### 2. Outputs go to different sinks

- `coaching-feedback.ts` builds a **structured coaching brief per agent** and emits a `message_created` event to the **`coach` agent** via `ctx.emit(...)` (`coaching-feedback.ts:135-144`). Purpose: actionable training dispatch.
- `coaching-report.ts` builds a **Slack-style system report string** and writes it to `ctx.log(report)` (`coaching-report.ts:26`). Purpose: human-visible daily summary, no downstream agent action.

No agent messages are emitted by the report handler; no Slack-style formatting exists in the feedback handler.

### 3. Computed quantities are different

- Feedback tracks **convention violation rates** (`coaching-feedback.ts:18-22`: `convention`, `count`, `total`, `rate`, `examples`) — categorical pass/fail per SOUL-convention.
- Report tracks **continuous quality/efficiency averages plus trend direction** (`coaching-report.ts:39-51`: `avgQuality`, `recentAvgEfficiency`, `trend: improving|stable|regressing|new`, `goodCount`, `needsImprovementCount`) — scalar metrics from LLM/heuristic evaluation.

These are orthogonal quality signals: convention adherence vs. holistic evaluation verdict.

### 4. Shared helpers: none

A grep of both files shows no shared utility imports beyond `HandlerContext`/`HandlerModule`/`CronEntry` type imports (`coaching-feedback.ts:13-14`, `coaching-report.ts:11-12`). There is no duplicated formatter, no duplicated SQL, no duplicated grouping logic. The `agents/may/handlers/` directory exposes each handler independently via its own `create` factory — consistent with other cron handlers in this directory.

### 5. Naming is the only overlap

Both files contain the token "coaching" because both feed the coaching feedback loop (one writes to coach via messages, one informs humans who steer coach). This is a package-level theme, not a code-level overlap.

## Severity

**None.** No duplication, no drift risk, no maintenance burden identified.

## Recommended Action

**No action.** Close this finding. The handlers are appropriately factored.

Optional micro-nit (not worth a dispatch): if clarity becomes a concern, the filenames could be disambiguated (e.g. `coaching-dispatch.ts` for the message-emitter and `coaching-summary.ts` for the log report), but current names are acceptable given the JSDoc headers at `coaching-feedback.ts:1-11` and `coaching-report.ts:1-6` that clearly state each handler's role.

## Follow-ups

None.
