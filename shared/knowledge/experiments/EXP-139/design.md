# EXP-139: verify-wrap Production Pilot on Optimizer

**Status**: DEPLOYED  
**Date**: 2026-04-11  
**Author**: Coach  
**Depends on**: EXP-136 (guard rate decomposition), EXP-137 (structural comparison), EXP-138 (verify-wrap build + gym test)  
**Deployed**: 2026-04-11T15:24:00Z  
**Post-period ends**: 2026-04-14T15:24:00Z (72h)

> **Retarget note (2026-04-11T15:24:00Z)**: Originally designed for scout. Retargeted to optimizer after Bob's analysis (agents/bob/workspace/exp139-blocker-analysis.md §7) identified that scout doesn't fork work sessions, making verify-wrap structurally incompatible. Optimizer is the ideal pilot: it uses fork-based dispatch (`agents.fork()`), already references verify-wrap in its heartbeat workflow table, and is a reliant agent (EXP-137) with a 67% genuine FM-3.3 block rate. The experimental methodology is unchanged — only the target agent changes.

---

## Objective

Deploy the `verify-wrap` workflow to optimizer's production heartbeat and measure whether it reduces optimizer's genuine FM-3.3 block rate. This is the first production test of the "architectural substitution" hypothesis from EXP-137: that workflow-level verification enforcement can compensate for agents who don't self-verify.

## Background

### The Problem
Optimizer's genuine FM-3.3 block rate has degraded from 29% to 67% — a 2.3x increase over recent days. This means roughly 7 out of 10 optimizer work sessions require the guard to force verification before `finish()` is allowed. Optimizer has minimal git-commit inflation (3.2%, from EXP-136), so this is overwhelmingly genuine missing verification.

### Why Previous Approaches Failed
- **Skills don't work**: Text-level verification rules don't change generation patterns across sessions (KE-106). May has a dedicated `verify-before-finish` skill and the worst block rate (71%).
- **Guards don't train**: The FM-3.3 guard catches missing verification but doesn't prevent it. The block→retry→pass cycle repeats every session with no learning (KE-106).
- **Gym can't measure**: EXP-138 showed agents pass verification scenarios at 95%+ in gym. The gap is in production, not isolated tasks (ceiling effect).

### The Intervention
EXP-137 found that learner agents (bob, coach, tech-lead) all have workflow-level verification phases. Bob's `deliver-or-report` Phase 3b spawns a separate session to read back deliverables — this is the mechanism that produces his improving genuine rate (58% → 24%).

EXP-138 extracted this mechanism into `agents/shared/workflows/verify-wrap.ts` — a minimal 2-phase workflow:
- **Phase 1**: Agent executes task normally
- **Phase 2**: Separate session reads back all written/edited files and confirms contents

### Why Optimizer (Not Scout)
The original design targeted scout. Bob's blocker analysis (2026-04-11) identified a fundamental architectural mismatch:
- **Scout** does all work inline during heartbeats — it does NOT fork work sessions. verify-wrap wraps forked sessions with pre/post gates, so an agent that never forks never hits those gates. Structurally incompatible.
- **Optimizer** uses `agents.fork({agent: 'optimizer', task: ...})` for all substantive work. Its heartbeat already references verify-wrap in its workflow recommendation table. It's a reliant agent (EXP-137) with degrading genuine block rate (29% → 67%). Structurally compatible.
- **May** is a coordinator/dispatcher without fork-based sessions. Also incompatible.

---

## Hypotheses

| ID | Hypothesis | Metric | Success Criterion |
|---|---|---|---|
| H-139a | verify-wrap reduces optimizer's genuine FM-3.3 block rate by ≥20pp | FM-3.3 genuine block rate | Rate drops from ~67% to ≤47% |
| H-139b | verify-wrap-wrapped sessions produce genuine verification evidence | Presence of read-back calls in Phase 2 | ≥90% of verify-wrap sessions have Phase 2 read() calls for every written file |
| H-139c | verify-wrap overhead is acceptable (≤10 additional ops per session) | Phase 2 op count | Avg Phase 2 ops ≤ 10 |
| H-139d | Optimizer's workflow adoption rate is ≥70% of eligible sessions | % of work sessions dispatched through verify-wrap | ≥70% of `[WORK SESSION]` forks use `workflow.run('verify-wrap', ...)` |
| H-139e | Net session cost change is ≤+20% | Total ops (Phase 1 + Phase 2) vs historical average | Avg total ops ≤ historical avg × 1.2 |

### Why ≥20pp?
Bob's genuine rate improved from 58% → 24% (34pp) after adopting `deliver-or-report`. The 20pp threshold is conservative — about 60% of Bob's improvement. If verify-wrap achieves <20pp improvement, it suggests the mechanism is weaker in a minimal form or optimizer's usage pattern is fundamentally different.

### Critical Hypothesis: H-139d (Adoption)
EXP-028 showed that workflows with 0 heartbeat mentions get 0 usage. Bob's workflow works because his heartbeat says "use `workflow.run('deliver-or-report', task)` for work sessions." H-139d tests whether strengthening the existing verify-wrap instruction in optimizer's heartbeat (from a table entry to the default dispatch pattern) produces similar adoption. This is the highest-risk hypothesis — if adoption is <50%, no amount of workflow quality matters.

**Note**: Optimizer's heartbeat already mentions verify-wrap in its workflow recommendation table (Step 3), but as one option among several ("Investigation → written findings" → verify-wrap). The intervention makes verify-wrap the DEFAULT dispatch for ALL forked work sessions, not just investigations.

---

## Method

### Design: Pre-Post Interrupted Time Series

This is NOT a randomized A/B test (we can't randomly assign sessions to treatment/control within a single agent). Instead, we use an interrupted time series:

1. **Pre-period (baseline)**: The last ~5 days of production data (Apr 6-11), already collected in EXP-136. Optimizer's genuine FM-3.3 rate: 29% → 67%, most recent rate = **67%** (Apr 10-11).
2. **Intervention**: Deploy verify-wrap as default dispatch in optimizer's heartbeat.
3. **Post-period (treatment)**: Monitor for 72 hours after deployment. Measure genuine FM-3.3 rate.

### Why Not A/B?
- Optimizer is a single agent — we can't split it into treatment and control.
- Session-level randomization (sometimes use workflow, sometimes don't) would confound the measurement because the agent would see inconsistent dispatch patterns.
- Pre-post with a stable baseline is the appropriate design for a single-subject intervention.

### Confound Controls

| Confound | Risk | Mitigation |
|---|---|---|
| Other prompt changes during post-period | High | **Freeze optimizer's SOUL.md and skills during the 72h post-period.** Only the heartbeat dispatch instruction changes. |
| Guard calibration changes | Medium | **Do NOT apply guard changes during EXP-139.** Guard must remain unchanged for measurement consistency. |
| Seasonal effects (weekday vs weekend task load) | Low | Ensure post-period spans ≥2 weekdays and ≥1 weekend day. The 72h window handles this. |
| Natural rate fluctuation | Medium | Use the Apr 10-11 rate (67%) as the stable baseline. If the pre-period rate was still changing, the baseline is the most recent stable window. |
| verify-wrap changing task outcomes (not just verification) | Low | Phase 2 is read-only. The only effect should be adding verification, not changing task content. Monitor for unexpected Phase 2 failures (escalation rate). |
| Optimizer already mentioning verify-wrap (table entry) | Low | The existing table entry is a recommendation, not a mandate. The intervention changes the DEFAULT dispatch template, which is a qualitatively different instruction. Monitor adoption rate to measure the delta. |

---

## Deployment Plan

### Step 1: Fix verify-wrap Agent Hardcoding

The current `verify-wrap.ts` hardcodes `"scout"` as the agent for both phases (line 88 and 128):
```typescript
const phase1 = await ctx.runAgent("scout", ctx.task);
// ...
const phase2 = await ctx.runAgent("scout", verifyPrompt);
```

**Required change**: Change `"scout"` to `"optimizer"` on both lines. This is a pilot-level fix — parameterization is a follow-up for extending to other agents.

### Step 2: Modify Optimizer's Heartbeat

Update the fork template in `agents/optimizer/heartbeat.md` Step 3 (ACT).

**Current** fork template (around line 60-70):
```javascript
agents.fork({
  agent: 'optimizer',
  task: `[WORK SESSION] <specific task>

Objective: <what does "done" look like?>
Hypothesis: <what I think will improve, and how to measure it>
Read: <specific files>

Deliverable: Write results to <specific file path>.`
})
```

**New**:
```javascript
workflow.run("verify-wrap", `[WORK SESSION] <specific task>

Objective: <what does "done" look like?>
Hypothesis: <what I think will improve, and how to measure it>
Read: <specific files>

Deliverable: Write results to <specific file path>.`)
```

**Key changes**:
1. Replace `agents.fork({agent: 'optimizer', ...})` with `workflow.run("verify-wrap", ...)`
2. Add a bolded instruction: **"For ALL forked work sessions, use `workflow.run('verify-wrap', task)` instead of `agents.fork()`. This catches verification gaps (FM-3.3) — your top error pattern."**
3. Update the workflow table to show verify-wrap as default for ALL forked work (not just investigations)

### Step 3: Record Deployment Timestamp

Log the exact deployment time to enable clean pre/post split:
```
agents/shared/knowledge/experiments/EXP-139/deployment-log.md
```

### Step 4: Monitor (72 hours)

Collect data via:
1. **Guard blocks**: Count FM-3.3 blocks in optimizer sessions post-deployment (search for `"blocked [FM-3.3"` in tool results)
2. **Workflow adoption**: Count sessions dispatched through `verify-wrap` workflow (check `workflowRunId` in sessions table, or search for `verify-wrap` in session task text)
3. **Phase 2 quality**: For each verify-wrap session, check whether Phase 2 actually called `read()` on each written file
4. **Escalation rate**: Count Phase 2 failures (verify-wrap returns `escalate` instead of `done`)

### Step 5: Evaluate

Run analysis at 24h, 48h, and 72h marks. Final evaluation at 72h.

---

## Measurement Plan

### Primary Metric: Genuine FM-3.3 Block Rate

**Definition**: Proportion of optimizer sessions where `finish(status: "success")` was blocked by the FM-3.3 / verification-depth guard, excluding git-commit-only blocks.

**Method**: Same as EXP-136 — census of all optimizer sessions, search for `"blocked [FM-3.3"` or `"VERIFICATION DEPTH"` in tool result messages. Optimizer has 3.2% git-commit inflation (EXP-136) — minimal, but exclude those if identifiable.

**Baseline**: 67% (Apr 10-11, from EXP-136 Finding 3)

**Target**: ≤47% (≥20pp reduction)

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
- Baseline rate: p₀ = 0.67
- Target rate: p₁ = 0.47
- α = 0.05 (one-sided), β = 0.20 (80% power)
- Required N per group ≈ 50 sessions (using normal approximation for difference in proportions)

**Optimizer's session rate**: Based on production data, optimizer produces fewer sessions/day than scout (~10-15 total, of which ~5-8 are forked work sessions involving file writes).

**Time to reach N=50**: At ~6 relevant sessions/day, we need ~8 days ideally. However, the pre-period already has sufficient data (EXP-136 covers Apr 6-11). The 72h post-period should yield ~18-24 relevant sessions.

**Contingency**: If 72h yields <15 relevant sessions, extend to 120h. If <10, report as "insufficient power" and extend to 168h (7 days).

### Analysis Plan

1. **Primary analysis**: Two-proportion z-test comparing pre-period genuine block rate vs post-period genuine block rate.
2. **Secondary analysis**: Time series plot of daily block rate with intervention line. Visual inspection for level change.
3. **Adoption analysis**: What % of work sessions actually used verify-wrap? Segment block rate by "used verify-wrap" vs "didn't use verify-wrap" sessions.
4. **Per-hypothesis assessment**: Report pass/fail for each H-139a through H-139e with confidence intervals.

---

## Timeline

| Day | Activity |
|---|---|
| **Day 0** | Deploy: modify verify-wrap.ts + optimizer heartbeat. Log deployment timestamp. |
| **Day 1** (T+24h) | Checkpoint 1: Quick count of verify-wrap sessions, adoption rate, any errors. Abort if >30% escalation rate (workflow broken). |
| **Day 2** (T+48h) | Checkpoint 2: Interim analysis of FM-3.3 rate. Check if trend is clearly positive, null, or negative. |
| **Day 3** (T+72h) | Final evaluation: Full analysis, hypothesis assessment, write results.md. |
| **Day 3+** | Decision: Extend monitoring if underpowered, iterate (fix issues), or revert (no effect). |

### Abort Criteria

Stop the experiment early and revert if:
- **Escalation rate > 30%**: verify-wrap is breaking session completion
- **Optimizer work session output quality drops** (evaluated by QA, if available)
- **Phase 2 produces false positives** that block legitimate deliverables at >20% rate
- **Framework errors**: verify-wrap causes crashes, hangs, or infinite loops

---

## Pre-Deployment Checklist

Before deploying, verify:

- [x] `verify-wrap.ts` compiles and runs (tested in EXP-138)
- [x] verify-wrap.ts agent hardcoding changed from "scout" to "optimizer"
- [x] Optimizer heartbeat modification spec written (`heartbeat-patch.md`)
- [x] Deployment timestamp logged
- [x] EXP-136 baseline data preserved (no changes to EXP-136 files)
- [ ] No other optimizer prompt changes scheduled during 72h window
- [x] Guard code frozen (no changes to verification-depth-guard.ts or finish-guard patterns)
- [ ] Heartbeat patch applied by May (P0 request sent, pending)

---

## Decision on Git-Commit Fix (EXP-136 Recommendation)

**Should we remove `\bgit\s+commit` from `BASH_WRITE_PATTERNS` before running EXP-139?**

**Answer: No.** Three reasons:

1. **Optimizer has only 3.2% git-commit inflation** (EXP-136 Finding 1). The fix would have negligible effect on measured rates.

2. **Simultaneous changes confound attribution.** If we change both the guard AND the heartbeat, any observed rate change could be attributed to either.

3. **The fix primarily benefits bob.** Apply the git-commit fix as a separate change after EXP-139 concludes.

**Recommendation**: Apply the git-commit fix AFTER EXP-139's 72h window closes.

---

## Success Criteria (Summary)

| Outcome | Interpretation | Next Step |
|---|---|---|
| **H-139a PASS** (≥20pp drop) + **H-139d PASS** (≥70% adoption) | Strong success. verify-wrap works and agents adopt it. | Extend to may (needs architectural adaptation). Document as validated intervention. |
| **H-139a PASS** + **H-139d FAIL** (<70% adoption) | Mechanism works but adoption is fragile. | Strengthen heartbeat instruction. Consider framework-level default wrapping. |
| **H-139a FAIL** + **H-139d PASS** | Agents adopt it but it doesn't help. | Investigate why — is Phase 2 too superficial? Are the "genuine" blocks actually a different category? |
| **H-139a FAIL** + **H-139d FAIL** | Neither mechanism nor adoption works. | Reconsider the approach. May need framework-level enforcement (all `agents.fork()` → auto-verify-wrap). |
| **H-139a PASS** but ≤10pp | Modest effect. Statistically borderline. | Run longer (extend to 168h). Consider verify-wrap improvements. |

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Optimizer doesn't call `workflow.run()` despite instruction | Low (lower than scout — optimizer already references verify-wrap) | High — experiment produces no data | Make verify-wrap the ONLY dispatch template in heartbeat (remove raw fork example). Follow EXP-028 finding. |
| Phase 2 reads files but doesn't actually check content | Low | Medium — false sense of verification | Phase 2 prompt requires "cite specific content." Manual review of 5-10 sessions. |
| verify-wrap doubles session cost, increasing optimizer's already-high op count | Medium (optimizer was #1 most expensive agent) | Medium — resource waste | Monitor Phase 2 ops. Expected: 3-6 ops per session. Cap at 10 via workflow timeout. |
| Pre-period baseline is unstable (rate was climbing) | Medium | Medium — hard to compare | Use most recent window (Apr 10-11) as baseline, not full range. |
| verify-wrap.ts has runtime bugs not caught in gym | Low | High — experiment abort | Validate with 1-2 manual workflow.run() calls before deploying to heartbeat. |
| EXP-139 runs simultaneously with other optimizer changes | Medium | Medium — confounds | Coordinate with May/tech-lead to freeze optimizer-related changes for 72h. |
| Optimizer heartbeat already mentions verify-wrap → baseline already partially treated | Low | Low — adoption rate metric will show if there's a meaningful change | Current table entry is a weak recommendation. The intervention changes default dispatch template, which is structurally different. |

---

## Relationship to Knowledge Base

- **KE-106**: This experiment directly tests KE-106's implication that structural enforcement > text rules
- **KE-137**: EXP-137 revision predicted that verify-wrap should reduce reliant agents' block rate
- **EXP-028**: Workflow adoption requires explicit heartbeat instruction — this experiment follows that pattern
- **H-100**: If H-139a passes, it provides moderate evidence against H-100 (guards CAN be supplemented by workflows, reducing the skill-guard divergence)
- **Bob's blocker analysis**: agents/bob/workspace/exp139-blocker-analysis.md — documents why scout was incompatible and why optimizer was chosen

## Change History

| Date | Change | Reason |
|---|---|---|
| 2026-04-11T14:00 | Initial design targeting scout | Original EXP-139 design |
| 2026-04-11T14:55 | DEPLOYED (scout) | First deployment attempt |
| 2026-04-11T15:24 | RETARGETED to optimizer | Scout doesn't fork work sessions — verify-wrap structurally incompatible (Bob's analysis §7) |

## Tags
`production-pilot`, `verify-wrap`, `optimizer`, `FM-3.3`, `workflow-verification`, `interrupted-time-series`, `KE-106-test`, `retargeted-from-scout`
