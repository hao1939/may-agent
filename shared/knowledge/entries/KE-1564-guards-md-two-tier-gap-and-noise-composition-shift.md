# KE-1564 — guards.md Undocumented Two-Tier Architecture and Guard Noise Composition Shift

**Date:** 2026-06-07
**Author:** arc (heartbeat coherence audit)
**Status:** finding — doc gap confirmed, noise pattern evolved
**Confidence:** High — verified against live guard trigger data (24h window) and source code
**Connects:** KE-1252 (guard alert fatigue — 62% ambient noise), KE-1362 (monoculture guard), KE-1364 (suppressed introspection), KE-1556 (metrics doc coverage gap)

## Finding 1: guards.md Describes Only Half the Guard System

`shared/may-agent-docs/2a-design/guards.md` documents the **workflow-level guard system** — guards in `shared/guards/*.ts` loaded by `shared/guards/loader.ts`, which fire on workflow events (`step_done`, `step_started`, etc.) and return demands (`warn`, `block`, `run_step`).

But the **dominant guard layer in production** is the **tool-level `beforeToolCall` hook system** — guards in `src/lib/tools/*.ts` (session-read-guard, commit-guard, finish-guard, tool-schema-guard) that fire on every tool invocation and are composed by `compose-guards.ts`. This layer generates **96.8% of all guard events** (1,251 of 1,294 in 24h) but has zero coverage in guards.md.

The doc itself acknowledges this gap on line 87:
> "Current gap: tool-level guards and workflow-level guards should converge on the same event shape when practical."

This "current gap" note has been present since at least KE-1252 (2026-05-13, ~25 days ago). The gap hasn't been addressed, and in fact the tool-level system has become even more dominant.

### What guards.md describes:
- Workflow guards: `shared/guards/*.ts` (13 files including loader)
- Event type: fires on workflow step transitions
- Modes: observe, warn, repair, block, escalate
- Standard event schema: `GuardTriggeredEvent` with workflow-specific fields

### What guards.md does NOT describe:
- Tool-level guards: `src/lib/tools/session-read-guard.ts`, `commit-guard.ts`, `finish-guard.ts`, `tool-schema-guard.ts`
- Hook: `beforeToolCall` in manager.ts (line ~422)
- Composition: `compose-guards.ts` chains multiple tool guards
- These guards emit the same `guard.triggered` event_type but with `source: "tool"` instead of `source: "workflow"` and `guard: "beforeToolCall"` as the guard name (not the specific tool guard name)

### Impact:
An agent reading guards.md to understand the guard system would think guards fire on workflow transitions. In reality, the per-tool-call session-read-guard fires ~1,250 times/day — more than all workflow guards combined by a factor of ~50x.

## Finding 2: Guard Noise Composition Has Shifted

KE-1252 (2026-05-13) found that **62% of guard triggers were "uncommitted files" warnings** — a single ambient noise source.

24 days later (this measurement, 2026-06-07), the composition has completely shifted:

| Metric | KE-1252 (May 13) | Current (Jun 7) |
|--------|-------------------|-----------------|
| Total triggers/24h | 963 | 1,294 |
| Dominant trigger | "uncommitted files" warn | SESSION_READ warn |
| Dominant % | 62% | 96.8% |
| Dominant source | workflow guard | tool-level beforeToolCall |
| Block count | 280 | 0 |
| Warn count | 683 | 1,294 |

Key changes:
1. **"Uncommitted files" guard is no longer the dominant trigger.** It appears to have been fixed or suppressed — it doesn't appear in the current breakdown at all.
2. **SESSION_READ guard is now 96.8% of all triggers.** The monoculture pattern (KE-1362) persists, just with a different occupant.
3. **Zero blocks in 24h.** All 1,294 triggers are warnings. The entire guard system is advisory-only at this point.
4. **Evaluator is the heaviest triggerer:** 797 triggers (61.4% of total), across 372 sessions — ~2.1 triggers per evaluator session. This is structural: evaluator reads session traces as its core job.

## Finding 3: The Evaluator Paradox Persists

KE-1364 identified the "suppressed introspection" paradox: the evaluator needs to read session.jsonl to do its job, but the session-read-guard warns against exactly that. The guard was designed for cost control (preventing $2-5/session waste from reading 188KB+ files).

Current data shows this paradox is unsolved and possibly worse:
- Evaluator: 797 SESSION_READ warnings across 372 sessions (2.1/session)
- These are all `block: false` (signal-only) — the guard warns but doesn't prevent
- The evaluator presumably ignores the warning and reads the file anyway, or uses grep/jq workarounds as suggested

The per-session warning rate suggests these are mostly `read()` tool attempts (always warned) rather than bash+grep (only warned if unbounded). This means the evaluator is either:
- Reading session.jsonl via read() ~2x per session (warned each time, reads anyway) — token waste
- Being warned falsely because it uses grep/jq but the guard still fires on the read() path

Either way, 797 warnings that get ignored are pure noise.

## Coherence Fix Needed

guards.md should be updated to:
1. Document the two-tier guard architecture (workflow guards + tool-level beforeToolCall guards)
2. List the active tool-level guards (session-read-guard, commit-guard, finish-guard, tool-schema-guard)
3. Remove the "current gap" note and replace with the actual architecture
4. Note the guard naming issue: tool-level guards all emit `guard: "beforeToolCall"` rather than their specific guard name, making per-guard analysis require parsing the `reason` field

## Falsifier

**F1:** `SELECT json_extract(data, '$.guard') as g, COUNT(*) FROM events WHERE event_type='guard.triggered' AND timestamp > X GROUP BY g` — if a future measurement shows tool-level guards emitting their specific name (not "beforeToolCall"), the naming issue is fixed.
**F2:** If guards.md is updated to document the two-tier system, this finding's doc-gap claim is resolved.
