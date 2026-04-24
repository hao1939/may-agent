# EXP-216: Structural Guard for C1.1/C1.3 — beforeToolCall Enforcement for Bob

**Date**: 2026-07-30
**Status**: DESIGNED
**Predecessor**: EXP-213 (schema reorg — NULL RESULT for Bob), EXP-132 (C7.1 structural guard — SUCCESS), EXP-110 (FM-3.3 commit guard — +51pp)
**Hypothesis**: H-098 (Ch2 > Ch1), H-095 (agent-specific interventions)

---

## Research Question

Can a `beforeToolCall` structural guard that checks for recent `read()` calls before allowing `edit()` reduce Bob's C1.1 violations below 5% (from current ~11%)?

## Background

EXP-213 proved that schema-organized context (Ch1 optimization) has zero effect on Bob's C1.1/C1.3 at ~10% baseline. KE-374 identifies this as a ceiling effect — violations below ~10% are execution failures, not access failures. Per H-098, only Ch2 (structural/environmental) interventions can address execution-level failures.

Prior Ch2 successes:
- EXP-132: `beforeToolCall` path hallucination guard → production deployment, C7.1 structural enforcement
- EXP-110: FM-3.3 commit guard → 73.5% recovery rate
- EXP-123: Verification-depth guard → 100% C1.3 for 5/7 agents

## Hypothesis

- **H-216a**: A `beforeToolCall` hook that (1) checks if the target file was `read()` in the current session before allowing `edit()`, and (2) checks if a `read()` follows every `write()` before allowing `finish()`, will reduce Bob's C1.1 to <5% and C1.3 to <5%.
- **H-216b**: The guard will NOT reduce task completion rate — edit attempts on unread files will be blocked with a helpful message ("read this file first"), and the agent will comply.
- **H-216-null**: The guard produces workarounds (agents switch to bash sed, or waste turns reading files they don't need) without improving real quality.

## Design

### Phase 1: Implementation Review (no gym needed)
1. Audit existing `beforeToolCall` guards in codebase to understand hook API
2. Design guard logic: maintain session state of read() paths → check edit() target against state
3. Determine if C1.3 (verify-after-write) can use same mechanism (track write() → require read() before finish())

### Phase 2: Production Deployment (Bob only)
Deploy guard for Bob agent only (agent-specific, per H-095). Measure:
- C1.1 rate pre vs post (baseline: ~11%)
- C1.3 rate pre vs post (baseline: ~13%)
- Task completion rate (safety metric)
- Guard trigger rate (how often it fires)

### Metrics

- Primary: C1.1 and C1.3 violation rate (7-day rolling)
- Secondary: Task completion rate, session duration
- Tertiary: Guard bypass rate (sed/workaround usage)

### Decision Rule

- Confirmed if: C1.1 < 5% AND C1.3 < 5% at N≥100 post-deploy, with no task completion degradation
- Falsified if: C1.1/C1.3 unchanged or workaround rate >20%
- Inconclusive if: sample too small at 2-week checkpoint

## Implementation Notes

The guard should:
1. Track `read(path)` calls in a session-level Set
2. Before `edit(path, ...)`: check if `path` is in the read-set. If not, return error: "C1.1: You must read() this file before editing it. Call read('{path}') first."
3. Before `finish()`: check if every `write(path)` has a subsequent `read(path)`. If not, return warning.
4. IMPORTANT: Guard must handle path normalization (relative vs absolute, trailing slashes)

This follows the exact pattern of EXP-132's path hallucination guard — same hook, same mechanism, same expected outcome.
