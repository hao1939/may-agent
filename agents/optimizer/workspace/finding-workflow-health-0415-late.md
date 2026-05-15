# Finding: Workflow Health — Apr 15 Late-Night Adoption Trends & High-Op Outlier Analysis

**Date**: 2026-04-15 23:30 UTC  
**Mode**: D (Workflow Health)  
**Author**: optimizer

---

## Executive Summary

Workflow adoption has **regressed to 17.2%** (48h) from the 27.1% measured on Apr 12. The 7-day aggregate is 14.9% (602/4042 sessions). The 12h trend shows a volatile pattern with no sustained upward trajectory — adoption peaked at 28.9% on Apr 11 evening but has since settled in the 18–22% range. The May 146-op session ("Guard Escalation — Don't Weaken Guards") was a human-directed chat session with no workflow wrapping and no children — a one-off human interaction, not a systemic agent pattern.

## 1. Adoption Rate: 48h Snapshot

| Agent | WF Sessions | Total | Adoption % | Avg Ops | Max Ops |
|-------|-------------|-------|-----------|---------|---------|
| coder | 30 | 37 | **81.1%** | 21.2 | 74 |
| bob | 71 | 168 | **42.3%** | 17.6 | 187 |
| optimizer | 58 | 150 | **38.7%** | 13.2 | 88 |
| coach | 34 | 165 | 20.6% | 16.3 | 118 |
| tech-lead | 20 | 169 | 11.8% | 19.5 | 272 |
| scout | 4 | 92 | 4.3% | 10.7 | 140 |
| qa | 2 | 78 | 2.6% | 6.9 | 11 |
| evaluator | 0 | 291 | 0.0% | 0.8 | 10 |
| may | 0 | 100 | 0.0% | 24.5 | 687 |
| amy | 0 | 26 | 0.0% | 7.7 | 26 |

**Overall**: 219/1276 = **17.2%**

### Key Observations

- **Three-tier adoption structure**: Coder (81%), Bob+Optimizer (38-42%), everyone else (<21%).
- **Coach regression**: Was expected to be higher given recent experiment work; 20.6% suggests many non-workflow coach sessions (likely heartbeat-dispatched work sessions without workflow wrapping).
- **Tech-lead at 11.8%**: Most tech-lead work is dispatched as jobs, which don't naturally trigger workflow.run(). The 272-op outlier (Guards-v2 Phase 1) was NOT workflow-wrapped.
- **Evaluator 0%**: Expected — evaluator sessions are micro-evaluations (avg 0.8 ops), not the kind of work workflows are designed for.
- **May 0%**: Expected — May is chat-based interaction with humans, not structured task execution.

## 2. 12h Adoption Trend (7 Days)

```
Apr 15 11:00 - 23:00  90/440 = 20.5%  ◆ current
Apr 14 23:00 - 11:00  49/220 = 22.3%
Apr 14 11:00 - 23:00  52/275 = 18.9%
Apr 13 23:00 - 11:00  28/342 =  8.2%  ▼ dip
Apr 13 11:00 - 23:00   7/301 =  2.3%  ▼ trough
Apr 12 23:00 - 11:00  27/192 = 14.1%
Apr 12 11:00 - 23:00  50/205 = 24.4%
Apr 11 23:00 - 11:00 112/387 = 28.9%  ▲ peak
Apr 11 11:00 - 23:00  56/301 = 18.6%
Apr 10 23:00 - 11:00  29/277 = 10.5%
Apr 10 11:00 - 23:00  21/265 =  7.9%
Apr 09 23:00 - 11:00  21/259 =  8.1%
Apr 09 11:00 - 23:00  23/256 =  9.0%
Apr 08 23:00 - 11:00  37/323 = 11.5%
```

### Trend Analysis

- **Apr 8-10**: Baseline ~9% adoption
- **Apr 11**: Spike to 28.9% (likely new workflow wiring deployed)
- **Apr 12-13**: Crash to 2.3% then recovery — suggests deployment or configuration disruption
- **Apr 14-15**: Stabilized at 19-22%

The trend is NOT a steady climb. It looks like a **step-change around Apr 11** (from ~9% to ~20%) with a crash-and-recovery on Apr 13. Current state is stable at ~20%.

**Compared to Apr 12 measurement of 27.1%**: That measurement likely captured the tail of the Apr 11 peak. Current 17-22% is the true post-stabilization rate.

## 3. The May 146-Op Session ("Guard Escalation — Don't Weaken Guards")

- **Session**: s_1776277405256_19
- **Type**: Human-initiated chat (kind=chat, status=idle)
- **Task**: Human correcting May about guard weakening behavior
- **Workflow**: None
- **Children**: None (no forked/called sub-sessions)
- **No evaluation**: Session not evaluated (likely still idle/open)

**Verdict**: This is a **human correction session**, not a runaway agent. The 146 ops come from extended human-AI conversation about guard system design philosophy. This is NOT a systemic agent efficiency problem — it's expected behavior for a complex interactive discussion. No action needed.

## 4. High-Op Outlier Patterns (>80 ops, 48h)

15 sessions exceeded 80 ops in the last 48h:

| Ops | Agent | Workflow? | Pattern |
|-----|-------|-----------|---------|
| 687 | may | No | Human chat — guard system push |
| 338 | may | No | Human chat — rule enforcement |
| 272 | tech-lead | No | Guards-v2 Phase 1 implementation |
| 187 | bob | **Yes** | Scenario gap-fill (workflow-wrapped!) |
| 183 | may | No | Human chat — metrics status |
| 182 | tech-lead | No | Evaluator LLM fix (urgent) |
| 146 | may | No | Human chat — guard escalation |
| 140 | scout | No | Bug trace investigation |
| 118 | coach | No | Scenario design |
| 108 | tech-lead | No | Evaluator quality bug (IT-28) |
| 103 | tech-lead | No | Heartbeat (!) |
| 101 | coach | No | Experiment setup |
| 100 | tech-lead | No | Heartbeat (!) |
| 94 | tech-lead | No | Branch review |
| 93 | bob | **Yes** | Scenario design (workflow-wrapped) |

### Patterns

1. **May's high-op sessions are all human chats** — not actionable for workflow adoption.
2. **Tech-lead has TWO 100+ op heartbeats** — these are concerning. Heartbeats should be bounded. 100-103 ops in a heartbeat suggests runaway investigation cycles.
3. **Only 2 of 15 outliers are workflow-wrapped** (both Bob's). Workflows don't prevent high-op sessions but Bob's max of 187 is lower than non-workflow outliers.
4. **Tech-lead dominates non-chat outliers**: 5 of 15 entries, including the highest non-chat at 272 ops.

## 5. Conclusions & Recommendations

### Adoption Status: Plateaued at ~20%
The adoption rate has stabilized around 20%, down from the 28.9% Apr 11 peak. This is **not a regression** from a sustained higher rate — it's stabilization after an initial spike. The three-tier structure (Coder > Bob/Optimizer > Everyone else) is persistent.

### Bottlenecks to Higher Adoption
1. **Tech-lead**: Highest-volume non-evaluator agent (169 sessions) at only 11.8%. Most work arrives as jobs from May, which bypass workflow.run(). Wiring tech-lead job dispatch through workflows would have the **largest marginal impact**.
2. **Coach**: 20.6% is below potential. Coach handles experiments and work sessions — both suitable for workflow wrapping.
3. **Scout**: 4.3% — most scout work is called by other agents, which don't use workflow dispatch.

### Tech-Lead Heartbeat Bloat
Two 100+ op heartbeats are a red flag. Heartbeats should be bounded to prevent runaway investigation. This is a **process concern**, not a workflow concern — but worth tracking.

### The 146-op Session: No Action Needed
One-off human chat. Not an agent efficiency issue.

---

*Methodology: Direct SQLite queries against .state/may.db sessions table. Adoption = sessions with non-null workflowRunId / total non-heartbeat non-evaluation sessions. Trend uses 12h buckets over 7 days.*
