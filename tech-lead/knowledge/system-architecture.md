# System Architecture — Key Facts

## System Prompt Loading (`src/lib/manager.ts` → `resolveSystemPrompt`)
- Loads: SOUL.md → DOMAIN.md → common-sense.md (in that order)
- DOMAIN.md was silently dropped for a period; restored in commit `63e76d2` (2026-03-25)
- 10 agents have DOMAIN.md files (~955 lines total). If loading breaks again, check `resolveSystemPrompt`.
- **Rule**: After any change to `resolveSystemPrompt`, verify DOMAIN.md still appears in the resolved prompt for at least one agent with a DOMAIN.md file.

## Request Tracking DB Performance
- `getRequestsByAgent()` has `LIMIT 100` default (commit `5c5cbb4`). Without it, tech-lead alone returned 443 items (127KB).
- `getRequestsByAgentAndStatus()` pushes status filtering into SQL instead of fetching all then JS `.filter()`.
- **Rule**: Always LIMIT queries on historical data. Push filtering into SQL, not JS.

## Finish Guards (`src/lib/tools/finish-guard.ts`)
- **Gate 0 — Ghost Deliverable Guard** (commit `d4ca28a`): Blocks `finish(success)` when summary implies code changes (keywords: fix, implement, refactor, etc.) but no write/edit evidence exists and no deliverables listed.
- Analysis-only summaries ("Analyzed", "Verified") pass through.
- 31 tests cover the guard (11 specifically for ghost detection).

## Structured Delegation
- `context_files`, `success_criteria`, `priority` available in both `manager-agents-tool.ts` (orchestrator) and `send-tool.ts` (leaf agents).
- These map to existing DB columns: `context`, `expectations`, `artifact`.
- Structured fields are formatted into the message body so receivers see them in heartbeat injection.

## `agents/` Directory
- **Gitignored**. All changes to agent configs (heartbeat.md, SOUL.md, DOMAIN.md, etc.) are on-disk only, never committed.
- Workflow template changes (e.g., in `agents/coach/workflows/`) are also on-disk only.
- Source code changes in `src/` ARE committed normally.

## Active Nudge / Monitor Session
- `monitor-session.cjs` detects loops, stalls, ghost deliverables.
- `active-nudge.ts` acts on detections (cancel, flag, nudge).
- Productivity stall thresholds are per-role: read-heavy agents (tech-lead, scout, evaluator, bob, amy-kimi, amy, optimizer, may) = 30 ops; coach = 25; builders (coder, qa) = 20.
- **Dead end**: `recommendedAction: "interrupt"` vs `action === "cancel"` mismatch silently disabled all cancellations. Fixed 2026-03-23. **Rule**: producers and consumers of action strings must use identical enum values — test the full round-trip.

## QA Review Templates
- Two-phase review (DIAGNOSE → VERDICT) added to `implement-and-review.ts` and `verify-parallel.ts` templates (2026-03-25).
- Environment vs patch failure distinction: QA must determine whether test failures are caused by the patch or are pre-existing environment issues.
- Based on coach experiment `exp-qa-fm21-overstrict` (Method #15: 6/6 vs 0/1 baseline).
