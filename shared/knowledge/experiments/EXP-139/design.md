# EXP-139: verify-wrap Production Pilot on Scout

**Status**: DEPLOYED  
**Date**: 2026-04-11  
**Author**: Coach  
**Depends on**: EXP-136 (guard rate decomposition), EXP-137 (structural comparison), EXP-138 (verify-wrap build + gym test)  
**Deployed**: 2026-04-11T14:55:00Z  
**Post-period ends**: 2026-04-14T14:55:00Z (72h)

---

## Objective

Deploy the `verify-wrap` workflow to scout's production heartbeat and measure whether it reduces scout's genuine FM-3.3 block rate. This is the first production test of the "architectural substitution" hypothesis from EXP-137: that workflow-level verification enforcement can compensate for agents who don't self-verify.

## Background

### The Problem
Scout's genuine FM-3.3 block rate has degraded from 17% (Apr 6) to 71% (Apr 11) — a 4x increase over 5 days. This means 7 out of 10 scout work sessions require the guard to force verification before `finish()` is allowed. Scout has zero git-commit inflation (EXP-136), so this is entirely genuine missing verification.

### Why Previous Approaches Failed
- **Skills don't work**: Scout already has 5 separate "verify after write" reminders in its prompt. May has a dedicated `verify-before-finish` skill and the worst block rate (71%). Text rules don't change generation patterns across sessions (KE-106).
- **Guards don't train**: The FM-3.3 guard catches missing verification but doesn't prevent it. The block→retry→pass cycle repeats every session with no learning (KE-106).
- **Gym can't measure**: EXP-138 showed scout passes verification scenarios at 100% in gym. The gap is in production, not isolated tasks (ceiling effect).

### The Intervention
EXP-137 found that learner agents (bob, coach, tech-lead) all have workflow-level verification phases. Bob's `deliver-or-report` Phase 3b spawns a separate session to read back deliverables — this is the mechanism that produces his improving genuine rate (58% → 24%).

EXP-138 extracted this mechanism into `agents/shared/workflows/verify-wrap.ts` — a minimal 2-phase workflow:
- **Phase 1**: Agent executes task normally
- **Phase 2**: Separate session reads back all written/edited files and confirms contents

---

## Hypotheses

| ID | Hypothesis | Metric | Success Criterion |
|---|---|---|---|
| H-139a | verify-wrap reduces scout's genuine FM-3.3 block rate by ≥20pp | FM-3.3 genuine block rate | Rate drops from ~71% to ≤51% |
| H-139b | verify-wrap-wrapped sessions produce genuine verification evidence | Presence of read-back calls in Phase 2 | ≥90% of verify-wrap sessions have Phase 2 read() calls for every written file |
| H-139c | verify-wrap overhead is acceptable (≤10 additional ops per session) | Phase 2 op count | Avg Phase 2 ops ≤ 10 |
| H-139d | Scout's workflow adoption rate is ≥70% of eligible sessions | % of work sessions dispatched through verify-wrap | ≥70% of `[WORK SESSION]` forks use `workflow.run('verify-wrap', ...)` |
| H-139e | Net session cost change is ≤+20% | Total ops (Phase 1 + Phase 2) vs historical average | Avg total ops ≤ historical avg × 1.2 |

### Why ≥20pp?
Bob's genuine rate improved from 58% → 24% (34pp) after adopting `deliver-or-report`. The 20pp threshold is conservative — about 60% of Bob's improvement. If verify-wrap achieves <20pp improvement, it suggests the mechanism is weaker in a minimal form or scout's usage pattern is fundamentally different.

### Critical Hypothesis: H-139d (Adoption)
EXP-028 showed that workflows with 0 heartbeat mentions get 0 usage. Bob's workflow works because his heartbeat says "use `workflow.run('deliver-or-report', task)` for work sessions." H-139d tests whether adding the same instruction to scout's heartbeat produces similar adoption. This is the highest-risk hypothesis — if adoption is <50%, no amount of workflow quality matters.

---

## Method

### Design: Pre-Post Interrupted Time Series

This is NOT a randomized A/B test (we can't randomly assign sessions to treatment/control within a single agent). Instead, we use an interrupted time series:

1. **Pre-period (baseline)**: The last ~5 days of production data (Apr 6-11), already collected in EXP-136. Scout's genuine FM-3.3 rate: 17% → 71%, most recent stable rate = **71%** (Apr 10-11).
2. **Intervention**: Deploy verify-wrap to scout's heartbeat.
3. **Post-period (treatment)**: Monitor for 72 hours after deployment. Measure genuine FM-3.3 rate.

### Why Not A/B?
- Scout is a single agent — we can't split it into treatment and control.
- Session-level randomization (sometimes use workflow, sometimes don't) would confound the measurement because the agent would see inconsistent dispatch patterns.
- Pre-post with a stable baseline is the appropriate design for a single-subject intervention.

### Confound Controls

| Confound | Risk | Mitigation |
|---|---|---|
| Other prompt changes during post-period | High | **Freeze scout's SOUL.md and skills during the 72h post-period.** Only the heartbeat dispatch instruction changes. |
| Guard calibration changes (e.g., removing git-commit from BASH_WRITE_PATTERNS) | Medium | **Do NOT apply the EXP-136 git-commit fix during EXP-139.** Guard must remain unchanged for measurement consistency. Scout has 0% git inflation anyway, so this fix wouldn't affect scout's rate — but applying it simultaneously would complicate the narrative. Apply it after EXP-139 concludes. |
| Seasonal effects (weekday vs weekend task load) | Low | Ensure post-period spans ≥2 weekdays and ≥1 weekend day. The 72h window handles this. |
| Natural rate fluctuation | Medium | Use the Apr 10-11 rate (71%) as the stable baseline, not the full Apr 6-11 range (which includes the ramp-up). If the pre-period rate was still changing, the baseline is the most recent stable window. |
| verify-wrap changing task outcomes (not just verification) | Low | Phase 2 is read-only. The only effect should be adding verification, not changing task content. Monitor for unexpected Phase 2 failures (escalation rate). |

---

## Deployment Plan

### Step 1: Fix verify-wrap Agent Hardcoding

The current `verify-wrap.ts` hardcodes `"scout"` as the agent for both phases (line 88 and 128):
```typescript
const phase1 = await ctx.runAgent("scout", ctx.task);
// ...
const phase2 = await ctx.runAgent("scout", verifyPrompt);
```

**Required change**: Parameterize the agent name. Options:
- **Option A**: Parse agent name from task prefix (e.g., `[scout] task...`)
- **Option B**: Add agent to workflow context (`ctx.agent`)
- **Option C**: Accept hardcoding for now since this pilot is scout-only

**Recommendation**: Option C for EXP-139 (fastest, no framework changes). File a follow-up to parameterize before extending to other agents.

### Step 2: Modify Scout's Heartbeat

Replace the current dispatch template in `agents/scout/heartbeat.md` Step 3 (DISPATCH).

**Current** (line ~32-43):
```javascript
agents.call({
  action: 'fork',
  agent: 'scout',
  task: `[WORK SESSION] <specific task description>
  ...`
})
```

**New**:
```javascript
workflow.run("verify-wrap", `[WORK SESSION] <specific task description>

Objective: <one sentence — what does "done" look like?>
Read: <specific files to read for context>
Output: <specific file path for deliverable>
...`)
```

**Key changes**:
1. Replace `agents.call({action: 'fork', ...})` with `workflow.run("verify-wrap", ...)`
2. Add a bolded instruction (matching bob's pattern): **"For WORK SESSION tasks, use `workflow.run('verify-wrap', task)` to get structural verification. This catches verification gaps (FM-3.3) — your top error pattern."**
3. Keep all existing work session examples but update their dispatch syntax
4. Remove the redundant "For every write(): read() the file back to verify" constraint lines from examples (verify-wrap handles this structurally)

### Step 3: Record Deployment Timestamp

Log the exact deployment time to enable clean pre/post split:
```
agents/shared/knowledge/experiments/EXP-139/deployment-log.md
```

### Step 4: Monitor (72 hours)

Collect data via:
1. **Guard blocks**: Count FM-3.3 blocks in scout sessions post-deployment (same method as EXP-136 — search for `"blocked [FM-3.3"` in tool results)
2. **Workflow adoption**: Count sessions dispatched through `verify-wrap` workflow (check `workflowRunId` in sessions table, or search for `verify-wrap` in session task text)
3. **Phase 2 quality**: For each verify-wrap session, check whether Phase 2 actually called `read()` on each written file
4. **Escalation rate**: Count Phase 2 failures (verify-wrap returns `escalate` instead of `done`)

### Step 5: Evaluate

Run analysis at 24h, 48h, and 72h marks. Final evaluation at 72h.

---

## Measurement Plan

### Primary Metric: Genuine FM-3.3 Block Rate

**Definition**: Proportion of scout sessions where `finish(status: "success")` was blocked by the FM-3.3 / verification-depth guard, excluding git-commit-only blocks.

**Method**: Same as EXP-136 — census of all scout sessions, search for `"blocked [FM-3.3"` or `"VERIFICATION DEPTH"` in tool result messages. Since scout has 0% git-commit inflation, no exclusions needed.

**Baseline**: 71% (Apr 10-11, from EXP-136 Finding 3)

**Target**: ≤51% (≥20pp reduction)

### Secondary Metrics

| Metric | Definition | Measurement Method | Expected |
|---|---|---|---|
| Workflow adoption rate | % of `[WORK SESSION]` sessions using verify-wrap | Sessions with `workflowRunId` matching verify-wrap / total work sessions | ≥70% |
| Phase 2 verification completeness | % of verify-wrap sessions where Phase 2 read all files | Parse Phase 2 transcript for read() calls vs Phase 1 written files | ≥90% |
| Phase 2 op count | Average tool calls in Phase 2 | Count ops in Phase 2 sub-session | ≤10 |
| Total session cost | Phase 1 + Phase 2 ops combined | Sum ops across both sub-sessions | ≤ historical avg × 1.2 |
| Escalation rate | % of verify-wrap sessions where Phase 2 failed | Count `escalate` results from verify-wrap | ≤10% |
| False verification rate | % of Phase 2 sessions that "pass" files with real issues | Manual review of 5-10 verify-wrap sessions | ≤20% (aspirational) |

### Minimum Sample Size

**Power analysis** (approximate, for proportions test):
- Baseline rate: p₀ = 0.71
- Target rate: p₁ = 0.51
- α = 0.05 (one-sided), β = 0.20 (80% power)
- Required N per group ≈ 45 sessions (using normal approximation for difference in proportions)

**Scout's session rate**: Based on EXP-136, scout produces ~20-30 sessions/day (heartbeats + work sessions). Of these, ~8-12 are work sessions that involve file writes (the sessions where FM-3.3 is relevant).

**Time to reach N=45**: At ~10 relevant sessions/day, we need ~5 days. However, the pre-period already has sufficient data (EXP-136 covers Apr 6-11 with N ≈ 139 blocked sessions across all of scout). The 72h post-period should yield ~30 relevant sessions.

**Contingency**: If 72h yields <30 relevant sessions, extend to 96h. If <20, report as "insufficient power" and extend to 120h.

### Analysis Plan

1. **Primary analysis**: Two-proportion z-test comparing pre-period genuine block rate vs post-period genuine block rate.
2. **Secondary analysis**: Time series plot of daily block rate with intervention line. Visual inspection for level change.
3. **Adoption analysis**: What % of work sessions actually used verify-wrap? Segment block rate by "used verify-wrap" vs "didn't use verify-wrap" sessions.
4. **Per-hypothesis assessment**: Report pass/fail for each H-139a through H-139e with confidence intervals.

---

## Timeline

| Day | Activity |
|---|---|
| **Day 0** | Deploy: modify verify-wrap.ts (if needed) + scout heartbeat. Log deployment timestamp. |
| **Day 1** (T+24h) | Checkpoint 1: Quick count of verify-wrap sessions, adoption rate, any errors. Abort if >30% escalation rate (workflow broken). |
| **Day 2** (T+48h) | Checkpoint 2: Interim analysis of FM-3.3 rate. Check if trend is clearly positive, null, or negative. |
| **Day 3** (T+72h) | Final evaluation: Full analysis, hypothesis assessment, write results.md. |
| **Day 3+** | Decision: Promote (extend to optimizer/may), iterate (fix issues), or revert (no effect). |

### Abort Criteria

Stop the experiment early and revert if:
- **Escalation rate > 30%**: verify-wrap is breaking session completion
- **Scout work session output quality drops** (evaluated by QA, if available)
- **Phase 2 produces false positives** that block legitimate deliverables at >20% rate
- **Framework errors**: verify-wrap causes crashes, hangs, or infinite loops

---

## Pre-Deployment Checklist

Before deploying, verify:

- [ ] `verify-wrap.ts` compiles and runs (test with a simple gym scenario)
- [ ] Scout heartbeat modification is syntactically correct (test with a dry-run heartbeat)
- [ ] Deployment timestamp is logged
- [ ] EXP-136 baseline data is preserved (not overwritten by new analysis)
- [ ] No other scout prompt changes are scheduled during the 72h window
- [ ] Guard code is frozen (no changes to verification-depth-guard.ts or finish-guard patterns)

---

## Decision on Git-Commit Fix (EXP-136 Recommendation)

**Should we remove `\bgit\s+commit` from `BASH_WRITE_PATTERNS` before running EXP-139?**

**Answer: No.** Three reasons:

1. **Scout has 0% git-commit inflation** (EXP-136 Finding 1). The fix would not change scout's measured rate at all. There's no measurement benefit.

2. **Simultaneous changes confound attribution.** If we change both the guard AND the heartbeat, any observed rate change could be attributed to either. Even though logic says the guard change wouldn't affect scout, simultaneous changes make the narrative less clean.

3. **The fix benefits bob and evaluator, not scout.** Apply the git-commit fix as a separate change after EXP-139 concludes, framed as its own quality improvement (or as a follow-up EXP-140 if we want to measure its effect on bob's rate).

**Recommendation**: Apply the git-commit fix AFTER EXP-139's 72h window closes.

---

## Success Criteria (Summary)

| Outcome | Interpretation | Next Step |
|---|---|---|
| **H-139a PASS** (≥20pp drop) + **H-139d PASS** (≥70% adoption) | Strong success. verify-wrap works and agents adopt it. | Promote to optimizer. Design may adaptation. |
| **H-139a PASS** + **H-139d FAIL** (<70% adoption) | Mechanism works but adoption is fragile. | Strengthen heartbeat instruction. Consider framework-level default wrapping. |
| **H-139a FAIL** + **H-139d PASS** | Agents adopt it but it doesn't help. | Investigate why — is Phase 2 too superficial? Are the "genuine" blocks actually a different category? |
| **H-139a FAIL** + **H-139d FAIL** | Neither mechanism nor adoption works. | Reconsider the approach. May need framework-level enforcement (all `agents.fork()` → auto-verify-wrap). |
| **H-139a PASS** but ≤10pp | Modest effect. Statistically borderline. | Run longer (extend to 120h). Consider verify-wrap improvements (e.g., retry on Phase 2 failure). |

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Scout doesn't call `workflow.run()` despite instruction | Medium | High — experiment produces no data | Make verify-wrap the ONLY dispatch template in heartbeat (remove raw fork example). Follow EXP-028 finding. |
| Phase 2 reads files but doesn't actually check content | Low | Medium — false sense of verification | Phase 2 prompt requires "cite specific content." Manual review of 5-10 sessions. |
| verify-wrap doubles session cost, making scout too slow | Low | Medium — resource waste | Monitor Phase 2 ops. Expected: 3-6 ops per session. Cap at 10 via workflow timeout. |
| Pre-period baseline is unstable (rate was climbing) | Medium | Medium — hard to compare | Use most recent stable window (Apr 10-11) as baseline, not full Apr 6-11 range. |
| verify-wrap.ts has runtime bugs not caught in gym | Low | High — experiment abort | Validate with 1-2 manual workflow.run() calls before deploying to heartbeat. |
| EXP-139 runs simultaneously with other agent changes | Medium | Medium — confounds | Coordinate with May/tech-lead to freeze scout-related changes for 72h. |

---

## Relationship to Knowledge Base

- **KE-106**: This experiment directly tests KE-106's implication that structural enforcement > text rules
- **KE-137**: EXP-137 revision predicted that verify-wrap should reduce reliant agents' block rate
- **EXP-028**: Workflow adoption requires explicit heartbeat instruction — this experiment follows that pattern
- **H-100**: If H-139a passes, it provides moderate evidence against H-100 (guards CAN be supplemented by workflows, reducing the skill-guard divergence)

## Tags
`production-pilot`, `verify-wrap`, `scout`, `FM-3.3`, `workflow-verification`, `interrupted-time-series`, `KE-106-test`
