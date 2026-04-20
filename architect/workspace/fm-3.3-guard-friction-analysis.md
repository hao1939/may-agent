# FM-3.3 Guard Friction Analysis — Final Report

**Status**: Complete | **Date**: 2025-01-24 | **Task**: Analyze why finish-guard and verification-depth-guard cause unnecessary friction

## Executive Summary

Two guards (`finish-guard.ts` Gate 2 and `verification-depth-guard` T2) check the **same condition** — "bash-based writes with no post-write verification." This creates double-blocking: agents see two error messages for one problem, wasting 2-3 tool calls per session on retries. Additionally, neither guard handles orchestration sessions (agents.call) correctly.

## Source Code Analyzed

- **`agents/src/lib/finish-guard.ts`** — Ghost deliverable enforcement (FM-3.1) + verification evidence validation (FM-3.3)
- **Verification-depth-guard** — Post-write verification checks

## Findings

### F1: Redundant Blocking (High Impact)
`finish-guard` Gate 2 and `verification-depth-guard` T2 both check: "did bash-writes occur without post-write verification?" Both exempt write()/edit(). An agent blocked by one is almost always blocked by both → double error messages.

### F2: Orchestration Blind Spot (Medium Impact)  
When a parent agent delegates via `agents.call()`, writes happen in child sessions. `verification-depth-guard` doesn't recognize `agents`/`workflow` tool usage, causing false positives on orchestration-heavy sessions.

### F3: Generic Error Messages (Low Impact)
T2's error says "verify your work" without naming the specific command that triggered write detection. Agents waste cycles guessing what to verify.

## Recommendations

| ID | Action | Risk | Effort | Impact |
|----|--------|------|--------|--------|
| R1 | **Remove finish-guard Gate 2** — deduplicate with verification-depth-guard T2 | Low | ~15 lines deleted | Eliminates double-blocking |
| R2 | **Add orchestration exemption** to verification-depth-guard — skip/soften check when `agents`/`workflow` tools were used | Low | ~20 lines added | Prevents false positives |
| R3 | **Improve error specificity** — name the triggering bash command in T2's message | None | ~5 lines changed | Faster agent recovery |

## Implementation Notes

- R1 is the highest-priority change: simple deletion, immediate friction reduction
- R2 should match finish-guard's existing `agents` tool detection logic
- All changes are in `agents/src/lib/` — tech-lead can implement directly
- Existing test at `agents/test/finish-guard.test.ts` should be updated for R1

## Prior Art

- `agents/may/workspace/guard-friction-analysis.md` — detailed per-gate analysis
- `agents/.lab/bob-persistent-task-skill/knowledge/unified-guards-architecture.md` — guard architecture design
- `agents/shared/knowledge/findings/finding-fm33-verification-guard.md` — original FM-3.3 finding
