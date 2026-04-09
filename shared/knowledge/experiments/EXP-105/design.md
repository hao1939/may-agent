# EXP-105: Few-Shot Production Impact Measurement

**Status**: Blocked — insufficient post-deployment data  
**Date**: 2026-04-09  
**Author**: Coach  
**Type**: Observational (before/after, non-randomized)

## 1. Research Question

Does the few-shot injection pipeline (Phase 1, deployed via `src/lib/fewshot-router.ts`) improve coder and optimizer agent quality, efficiency, and failure rates in production?

## 2. Intervention

**What was deployed**: Static keyword-based few-shot example injection into task messages for `coder` and `optimizer` agents.

- **Code**: `src/lib/fewshot-router.ts` + integration in `src/lib/manager.ts` (line 1037-1049)
- **Merge commit**: `6c1ccfa` — `Merge branch 'review/fewshot-phase1'`
- **Deployment timestamp**: 2026-04-09T07:24:20Z
- **Mechanism**: Regex patterns match task text → up to 2 matched examples prepended to task message
- **Examples**: 5 files in `agents/shared/knowledge/fewshot-examples/`:
  - `binary-file-escalation.md` — binary/compiled file tasks
  - `reproduce-first-debugging.md` — bug/error debugging
  - `escalation-judgment.md` — dependency/multi-module impact
  - `know-when-blocked.md` — unresolvable blockers
  - `evidence-over-narrative.md` — misleading descriptions
- **Logging**: `[few-shot] ${agent}/${sessionId}: injected ${files} (~${tokens} tokens)`
- **Bypass flag**: `skipFewShot?: boolean` in RunOptions (for gym A/B testing)

## 3. Methodology

### 3.1 Design: Interrupted Time Series

This is an observational before/after comparison, NOT a randomized experiment. We compare metrics in a pre-deployment window to a post-deployment window for the two target agents (coder, optimizer).

### 3.2 Control agents

Non-target agents (coach, bob, tech-lead, scout) serve as a **control group** — they should NOT be affected by the intervention. If their metrics change at the same time as coder/optimizer, that signals a **confound**, not a few-shot effect.

### 3.3 Primary Metrics

| Metric | Source | Definition |
|---|---|---|
| Quality score | `evaluations.quality` | 0-5 scale |
| Efficiency score | `evaluations.efficiency` | 0-5 scale |
| Wasted calls | `evaluations.wastedCalls` | Tool calls with no productive output |
| Verdict | `evaluations.verdict` | good / acceptable / needs_improvement |
| Pass rate | Derived | `good` + `acceptable` / total |

### 3.4 Comparison Windows

- **Pre-deployment**: 2026-03-26 to 2026-04-09T07:24:20Z (14 days, to control for weekly patterns)
- **Post-deployment**: 2026-04-09T07:24:20Z onward
- **Minimum required post-deploy N**: 30 work sessions per agent for meaningful comparison

### 3.5 Filter: Work Sessions Only

Heartbeat sessions (`task LIKE '%heartbeat%'`) are excluded from analysis. They are trivially high-quality (q=4, e=4, w=0) and would dilute work session signals.

### 3.6 Few-Shot Match Rate

Not all work sessions will trigger few-shot injection. We estimate the **match rate** by testing actual task text against the 5 trigger patterns:
- Coder: **~80% of work tasks match** (24/30 sampled) — mostly bug/error/fix patterns
- Optimizer: **~20% of work tasks match** (6/30 sampled) — mostly dependency/error patterns

This means the effective treatment rate is much higher for coder than optimizer.

## 4. Data Availability Assessment (CRITICAL BLOCKER)

### 4.1 Post-Deploy Session Counts (as of T+9.6 hours)

| Agent | Total Sessions | Work Sessions | Eval'd Work |
|---|---|---|---|
| coder | **0** | **0** | **0** |
| optimizer | 19 | **0** | **0** |
| bob | 52 | varies | varies |
| coach | 41 | varies | varies |
| tech-lead | 24 | varies | varies |

**The coder agent has had ZERO sessions since deployment.** Its last session was 2026-04-07T12:26:08Z — nearly 2 days before deployment.

**The optimizer has 19 sessions, but ALL are heartbeats** — no work sessions that could trigger few-shot injection.

### 4.2 Pre-Deploy Baseline (Last 14 Days, Work Sessions Only)

| Agent | N | Avg Quality | Avg Efficiency | Avg Wasted | Good% | NI% |
|---|---|---|---|---|---|---|
| Coder | 43 | 1.24 | 1.18 | 0.3 | 65% | 9% |
| Optimizer | 52 | 3.56 | 2.95 | 1.6 | 71% | 2% |

### 4.3 Conclusion

**This experiment CANNOT produce results yet.** We need to wait for real work sessions to accumulate for both target agents. At coder's recent pace (~2-4 sessions/day on work days), we need ~7-15 days minimum to reach N=30.

## 5. Confounds (Must Track)

### 5.1 Same-Day Code Changes (April 9)

Multiple other changes were deployed the same day as few-shot, any of which could affect metrics:

| Time | Change | Impact |
|---|---|---|
| 04:55 | fix: finish-guard false positives for orchestration sessions | Could affect verdict distribution |
| 06:51 | feat: enhance compaction KeyFacts + fix sessionResults memory leak | Memory/context quality |
| **07:24** | **Merge branch 'review/fewshot-phase1'** | **THE INTERVENTION** |
| 08:07 | feat: auto-pause circuit breaker recovery | Error handling |
| 09:55 | fix: session lifecycle bugs (3, 4, 8, 10) | Session reliability |
| 10:02 | fix: pass abort signal through API gate | Session stuck prevention |

### 5.2 Historical Trend

Optimizer quality has been trending UP over weeks (week 9: 0.97 → week 13: 4.81), independent of few-shot. The optimizer improvement pre-dates the intervention and is driven by code/skill improvements over time.

### 5.3 Task Mix Variation

Different weeks have different task distributions. A week with more "easy heartbeat dispatches" will look better than a week with complex multi-step optimization tasks, regardless of few-shot.

### 5.4 Evaluator Calibration

The evaluation heuristic itself has been modified over time (`evaluatedByHeuristic=1` for all records). Changes to the evaluator could shift scores without any real agent improvement.

## 6. Alternative Approaches

Since the observational approach is blocked by insufficient data, we recommend:

### 6.1 Gym A/B Testing (RECOMMENDED — already proven)

The `skipFewShot` bypass flag exists in RunOptions. Design gym scenarios that:
1. Run the same scenario with `skipFewShot: true` (control) and `skipFewShot: false` (treatment)
2. Use scenarios where coder/optimizer would naturally trigger few-shot patterns
3. Measure pass rates, quality, and wasted calls

**Prior evidence**: EXP-084 through EXP-097 already show 18/18 (100%) pass rate for matched few-shot in gym. KE-065 documents comprehensive findings.

### 6.2 Log-Based Injection Identification (when data arrives)

When production work sessions do occur, the `[few-shot]` log line can identify exactly which sessions received injection. This enables a **natural experiment** comparison:
- Sessions where task matched patterns → received injection
- Sessions where task didn't match → natural control
- Compare quality/efficiency/waste between groups

### 6.3 Extended Wait (3+ weeks)

Resume this observational study once N ≥ 30 work sessions per agent have accumulated post-deployment.

## 7. Recommended Data Collection Plan

### Immediate (for when sessions arrive)
- Query: `SELECT * FROM sessions s JOIN evaluations e ON e.sessionId = s.sessionId WHERE s.agent IN ('coder','optimizer') AND s.startedAt >= 1775719460000 AND s.task NOT LIKE '%heartbeat%'`
- Cross-reference with `[few-shot]` log entries to identify injected vs non-injected sessions

### Weekly Check
- Re-run the before/after comparison when N ≥ 15 per agent
- Track control agent metrics (bob, coach, tech-lead) for confound detection

### Final Analysis Trigger
- N ≥ 30 work sessions per target agent post-deployment
- At least 2 weeks of elapsed time (to reduce weekly cycle bias)
- Control agents show stable metrics (no systemic shift)

## 8. References

- KE-065: Comprehensive Few-Shot Findings (gym evidence)
- EXP-084 through EXP-097: Individual few-shot experiments
- `src/lib/fewshot-router.ts`: Implementation
- `src/lib/manager.ts` lines 1037-1049: Integration point
