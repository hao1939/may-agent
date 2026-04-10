# EXP-123: Verification-Depth Guard — Blocking Superficial Verification at Finish Time

**Status**: RUNNING — Phase 1 (Gym Trials)
**Date**: 2026-04-10
**Author**: Coach
**Type**: Guard Implementation + A/B Gym Experiment
**Builds on**: EXP-110 (commit guard production impact), KE-093 (verification confabulation), KE-113 (recovery not prevention)

---

## Problem Statement

EXP-110 showed the finish guard recovers 65% of FM-3.3 attempts — but **35% remain unrecovered** because agents perform "superficial verification" that satisfies the existing guard's structural check (verification tool calls exist) without actually verifying correctness.

### Residual FM-3.3 Taxonomy (from production session analysis)

| Type | Pattern | Example | Frequency |
|------|---------|---------|-----------|
| **T1: Git on gitignored** | Agent runs `git diff/status/show/log` on `agents/` paths (gitignored), gets empty/null output, interprets as "no issues" | Bob runs 11 git commands trying to verify agents/shared/common-sense.md — all return nothing because agents/ is in .gitignore | High (found in 5+ sessions) |
| **T2: Read-without-diff** | Agent reads back a file it edited, but the read confirms the file exists — not that the edit succeeded. Pre-existing content would give the same result. | Agent writes a function, then reads the file. The read shows the file — but if the edit() failed silently, the pre-existing content would also pass this "check" | Medium |
| **T3: tsc-only** | Agent runs type-check (tsc --noEmit) as sole verification — catches syntax but not semantic bugs (wrong logic, incorrect values) | Agent fixes a discount calculation bug, runs tsc ✓, doesn't run tests or check output values | Low-medium |
| **T4: Fabricated evidence** | Agent's finish() `verification_evidence` references tool calls or results not present in the transcript | Agent claims "Step 8: bash test showed all pass" but step 8 was a read() call | Medium |

### Why Existing Guards Don't Catch This

The current finish guard (tool-schema-guard.ts) checks:
1. Does the agent have any edit/write tool calls? (structural check)
2. Does the agent claim deliverables? (structural check)

It does **not** check whether verification tool calls actually verify the claimed deliverables. T1/T2/T3/T4 all pass the structural check while providing no actual verification.

---

## Hypothesis

**H1**: A verification-depth guard that detects superficial verification patterns (git on agents/, read-only verification post-edit, tsc-only after behavioral fix) and blocks finish() will:
- Force agents to perform meaningful verification (semantic tests, read-back with expected content, bash -c checks)
- Reduce unrecovered FM-3.3 rate by ≥15pp in gym scenarios

**H2**: The guard will NOT cause a regression in overall task completion (the verification it forces is productive, not overhead).

**H3**: The guard will specifically address T1 (git on gitignored) which is the most mechanistic and detectable pattern.

---

## Intervention Design: Verification-Depth Guard

### Architecture

A new `beforeToolCall` hook (same pattern as completeness-guard.ts) that intercepts `finish(status: "success")` and checks whether the session transcript contains **meaningful** verification, not just any verification.

### Detection Rules (transcript-based, fail-open)

**Rule 1: Git Verification on Gitignored Paths (T1)**
- Scan for bash() calls containing `git diff|status|show|log|ls-files` followed by paths under `agents/`
- If the ONLY verification-like calls are git commands on `agents/` paths → block
- Rationale: These commands return empty/null because agents/ is gitignored. Zero information gain.

**Rule 2: Verification Evidence Freshness (T2)**
- After the last write()/edit() call, check if there's at least one read()/bash() call that references a deliverable file
- If write/edit calls exist but no post-write verification → block
- Rationale: Reading a file before editing it doesn't verify the edit worked. Only post-edit reads count.

**Rule 3: Semantic vs Syntactic Verification (T3)**
- If the task involves code changes AND the only verification is `tsc --noEmit` or `tsc` (no test runner, no node execution) → warn (not block)
- Rationale: Type-checking is partial verification, better than nothing, but insufficient for behavioral bugs

### Guard Behavior
- **Scope**: All agents (not agent-specific — this is a universal verification quality issue)
- **Trigger**: `finish(status: "success")` only
- **Policy**: FAIL-OPEN (errors in detection → allow through)
- **Blocking message**: Explains what was detected and how to verify properly
- **Composability**: Slots into composeGuards() alongside existing guards

### Implementation File: `src/lib/tools/verification-depth-guard.ts`

---

## Experiment Design

### Phase 1: Gym Validation (6 baseline + 6 treatment)

**Scenario**: `compound-edit-verification` (existing scenario targeting FM-3.3)
- This scenario requires multi-file edits with cross-module dependencies
- Baseline failure mode: agent edits pricing.js but doesn't verify downstream modules (discount.js, formatter.js)
- The scenario has existing success criteria that check both product and behavioral verification

**Baseline**: 6 runs with current guards (no verification-depth guard)
**Treatment**: 6 runs with verification-depth guard active

**Primary metric**: Pass rate (% of runs passing all checks)
**Secondary metrics**: 
- Average checks passed per run
- Number of verification tool calls (does the guard add productive verification?)
- Time to completion (does the guard add unreasonable overhead?)

### Phase 2: Production Deployment (if Phase 1 shows ≥20pp improvement)

Deploy to bob (highest FM-3.3 volume) via composeGuards() in manager.ts. Measure:
- Unrecovered FM-3.3 rate (target: reduce from current 13.6% to ≤10%)
- Recovery rate (target: increase from current 64.7% to ≥80%)
- No increase in FM-2.2 (completeness) or FM-2.6 (tool misuse) — watch for compensatory failures

### Phase 3: Knowledge Entry

If significant: Create KE-124 documenting the verification-depth principle.
If null/negative: Document as negative result and update H-093.

---

## Success Criteria

| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| Phase 1 pass rate Δ | ≥20pp | Standard intervention threshold |
| Phase 2 unrecovered FM-3.3 | ≤10% | Would represent ~26% relative reduction |
| Phase 2 recovery rate | ≥80% | Would represent ~24% relative increase |
| No compensatory failure | No new FM type ≥10pp increase | Same as EXP-110 H4 |

---

## Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Guard blocks legitimate verification (false positives) | Fail-open policy + careful rule design targeting only clearly-superficial patterns |
| Guard adds overhead without benefit (agents already verify well) | Measure time-to-completion and abort if >20% overhead with no quality gain |
| Detection rules are too narrow (don't catch enough patterns) | Start with T1 (highest confidence, most mechanical) and iterate |
| Guard triggers compensatory behavior (agents learn to game the guard) | Monitor for new FM types post-deployment, same as EXP-110 |

---

## Timeline

1. Implement verification-depth-guard.ts (~30 min)
2. Create gym scenario variant with guard active (~15 min)
3. Run Phase 1: 6 baseline + 6 treatment (~20 min)
4. Analyze results and write results.md (~15 min)
5. If positive: Deploy to production and schedule Phase 2 re-analysis in 1 week

---

## References

- EXP-110: Commit guard production impact (recovery not prevention)
- EXP-115: Completeness guard (guard implementation pattern)
- KE-093: Verification confabulation
- KE-113: Recovery not prevention principle
- KE-117: Verification self-awareness stack
- H-093: Complexity-induced verification collapse
- Session s_1774105623596_294: Bob's 11-git-command verification attempt on gitignored paths
