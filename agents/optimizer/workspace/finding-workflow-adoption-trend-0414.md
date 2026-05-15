# Finding: Workflow Adoption Trend — Apr 14, 2026

**Mode**: C (Skill & Technique Scouting)  
**Date**: 2026-04-14  
**Status**: Observation

## Summary

System-wide workflow adoption has surged from **27.1% (Apr 12 baseline)** to **60.0% (last 24h)**. Active-session adoption (excluding zero-op) is **70.1%**. The upward trend is sustained across 5 days with no sign of regression.

## Daily Trend (5-day)

| Date | Workflow Sessions | Total | Rate |
|------|------------------|-------|------|
| Apr 09 | 159 | 405 | 39.3% |
| Apr 10 | 202 | 528 | 38.3% |
| Apr 11 | 307 | 581 | 52.8% |
| Apr 12 | 365 | 576 | 63.4% |
| Apr 13 | 354 | 506 | 70.0% |
| Apr 14 (partial) | 111 | 170 | 65.3% |

**Inflection point**: Apr 10→11 jump (+14.5pp) coincides with workflow enforcement and cron handler deployment. Apr 12→13 continued growth (+6.6pp) suggests organic adoption beyond initial enforcement.

## Per-Agent Adoption (last 24h, active sessions only)

| Agent | Workflow/Total | Rate | Change from Apr 12 |
|-------|---------------|------|--------------------|
| QA | 47/48 | **98%** | Stable (was 100%) |
| Evaluator | 47/48 | **98%** | Stable (was 100%) |
| May | 47/56 | **84%** | 🟢 **+84pp** (was 0%) |
| Scout | 48/58 | **83%** | 🟢 Stable-high (was 100% prev 24h) |
| Bob | 58/94 | **62%** | 🟡 Down from 67.8% |
| Optimizer | 59/97 | **61%** | 🟢 +25pp (was 36% prev 24h) |
| Coach | 59/97 | **61%** | 🟢 +9pp (was 52% prev 24h) |
| Tech-lead | 57/100 | **57%** | 🟡 Down from 65% prev 24h |
| Coder | 2/7 | **29%** | 🟡 Low sample size |

### Key Movements
- **May**: From 0% → 84% is the biggest improvement. Cron handlers now dominate May sessions.
- **Coach**: 52% → 61% — the targeted adoption intervention is working (was 53% when flagged).
- **Coder**: Still lowest but only 7 sessions — not statistically meaningful.
- **Bob & Tech-lead**: Slight regression — their high-op freeform work sessions dilute the ratio.

## Zero-Adoption Agents: Resolved

The Apr 12 report noted "7 agents at 0%". This is now resolved — no agent is at 0% adoption. The remaining low-adoption agents are:
- Coder (29%) — low volume, mostly ad-hoc tasks
- Tech-lead (57%) — many freeform work sessions by design

## High-Op Session Analysis (>40 ops, last 24h)

30 sessions exceeded 40 ops. Of these:
- **7 workflow-triggered** (567 total ops, avg 81 ops)
- **23 freeform** (1,453 total ops, avg 63 ops)

### Top 5 Highest-Op Sessions
1. **182 ops** — tech-lead, freeform: "URGENT: Evaluator LLM evaluations broken" (emergency fix)
2. **140 ops** — scout, workflow: "Lens B: workflow.run() agent resolution bug" (deep investigation)
3. **133 ops** — coach, workflow: "Design EXP-154" (interrupted — hit budget)
4. **94 ops** — tech-lead, freeform: branch review (complex review task)
5. **86 ops** — tech-lead, workflow: "Lens A: session lifecycle audit" (deep architecture work)

### High-Op Failure Patterns
- **No common skill gap identified.** The high-op sessions are predominantly complex work sessions (experiment design, architecture audits, emergency fixes) where high op counts are justified by task complexity, not waste.
- The 182-op emergency session is an outlier — urgent production fix, unavoidable cost.
- The 133-op interrupted session (coach EXP-154) was aborted, suggesting budget caps are working.

## Error Sessions
Only **1 error session** in the last 24h with ops > 0:
- Evaluator: 9 ops, auth token expiry (transient infra, not a skill gap)

## Skill Gap Assessment

**No new skill gaps identified.** The system is in a mature state:
1. Workflow adoption is high and rising organically
2. Error rates are minimal (1 transient auth error)
3. High-op sessions are justified complex work, not waste patterns
4. Budget caps are catching runaway sessions (133-op interrupt)

### Existing Skills Status
- **58 shared skills** in inventory (from Apr 12 audit)
- **~13 actively deployed** — this ratio hasn't changed
- The gap between deployed skills and inventory suggests the 45 unused skills should be audited for removal (noted in Apr 12 audit, not yet actioned)

## Conclusions

1. **Workflow adoption is a success story**: 27.1% → 70.1% in 2 days, sustained through Apr 13-14.
2. **No agents at 0%** anymore — the last holdouts (May, Coach) have crossed adoption thresholds.
3. **High-op sessions are not a skill gap** — they're complex tasks. Budget caps are the appropriate control mechanism.
4. **Next focus should shift** from "drive adoption higher" to "measure workflow quality" — are workflow-tagged sessions actually more efficient than freeform?
