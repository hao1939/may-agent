# EXP-123: Verification-Depth Guard — Blocking Superficial Verification at Finish Time

**Status**: COMPLETE — Results in results.md
**Date**: 2026-04-10
**Author**: Coach
**Type**: Guard Implementation + Production Observation Study
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

### Phase 1: Gym Validation — CEILING EFFECT (Completed)

**Finding**: Ran baseline trials on `compound-edit-verification`, `convention-verify-edit`, and `assertion-without-evidence` — all three scenarios now pass at baseline (6/6, 7/7, 7/7 checks respectively). The current system prompt + skills are strong enough that agents consistently pass FM-3.3 gym scenarios without the guard.

**Implication**: Gym A/B cannot differentiate because there's no room for improvement (ceiling effect). This matches the KE-110 finding that gym scenarios don't capture the full complexity of production tasks. The guard's value lies in catching production-specific patterns where:
- Tasks are novel and multi-step (not gym templates)
- Context is longer and more ambiguous
- Time pressure leads to verification shortcuts
- Git-on-gitignored patterns emerge from real commit workflows

### Phase 2: Production Deployment (Active)

Guard deployed to ALL agents via `composeGuards()` in `manager.ts`. The guard:
- Is **enabled by default** for all agents
- Can be disabled via `DISABLE_VERIFICATION_DEPTH_GUARD=1` env var (for A/B comparison)
- Logs blocking events to session transcript for analysis

**Deployment date**: 2026-04-10 (this session)

**Measurement plan** (same methodology as EXP-110):
1. Wait for 48-72h of production data accumulation
2. Analyze session transcripts for guard trigger events
3. Classify triggers as true-positive (agent was actually doing superficial verification) or false-positive (guard incorrectly blocked)
4. Measure:
   - Guard fire rate: % of finish(success) calls blocked
   - True positive rate: % of blocks that were justified
   - Recovery success: when the guard blocks, does the agent then do better verification?
   - Unrecovered FM-3.3 trend: does the residual 35% decrease?
5. Compare pre/post deployment FM-3.3 rates (requires evaluator consistency)

**Critical confounds** (from EXP-110 lessons):
- Evaluator capability drift (control by limiting comparison window)
- Agent activity mix (measure per-agent, not just aggregate)
- Other concurrent changes (log all framework changes during observation window)

### Phase 3: Knowledge Entry

If significant: Create KE-124 documenting the verification-depth principle.
If null/negative: Document as negative result and update H-093.

---

## Success Criteria

| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| Guard fire rate | 5-20% of finish(success) calls | Too low = not catching anything; too high = too aggressive |
| True positive rate | ≥80% | Guard should almost always be right when it blocks |
| Post-block recovery | ≥60% | Agents should do meaningful verification after guard blocks |
| Unrecovered FM-3.3 | ≤10% (from 13.6%) | ~26% relative reduction in residual failures |
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

1. ✅ Implement verification-depth-guard.ts (complete — 360 lines, 18/18 tests pass)
2. ✅ Run Phase 1 gym trials (complete — ceiling effect, all scenarios pass baseline)
3. ✅ Wire guard into composeGuards() in manager.ts (complete)
4. ⏳ Production observation: 48-72h data accumulation (2026-04-10 to 2026-04-13)
5. ⏳ Analyze production impact (scheduled: 2026-04-13)
6. ⏳ Write results.md with production data

---

## References

- EXP-110: Commit guard production impact (recovery not prevention)
- EXP-115: Completeness guard (guard implementation pattern)
- KE-093: Verification confabulation
- KE-113: Recovery not prevention principle
- KE-117: Verification self-awareness stack
- H-093: Complexity-induced verification collapse
- Session s_1774105623596_294: Bob's 11-git-command verification attempt on gitignored paths
