# Finding: Workflow Adoption Regression Analysis — Bob & Optimizer Drop, Tech-Lead Low

**Date**: 2026-04-15T23:01 UTC  
**Mode**: D (Workflow Health)  
**Author**: Optimizer  
**Status**: Complete

---

## Executive Summary

The reported adoption "drops" (Bob 67.8%→48.2%, Optimizer 66.1%→45.1%) are **measurement window artifacts, not regressions**. When measured in 6-hour windows, the actual trend is **improving or stable** for all key agents:

| Agent | 18-24h ago | 12-18h ago | 6-12h ago | 0-6h ago | Trend |
|-------|:----------:|:----------:|:---------:|:--------:|:-----:|
| **Optimizer** | — | 75% | 85.7% | **91.7%** | ↑↑ Strong |
| **Bob** | — | 61.5% | 26.7% | **87.5%** | ↑ Recovered |
| **Tech-lead** | — | 12.5% | 41.2% | **41.7%** | ↑ Grew 3.3× |
| **Coach** | — | 18.2% | 38.5% | **25%** | ↔ Volatile |
| **Scout** | — | 18.2% | 0% | **8.3%** | ↔ Low |

**Verdict**: No regression. The 24h averages diluted recent gains with older low-adoption periods. Current 6h snapshot shows **strongest adoption yet** for the top 3 agents.

---

## 1. Why the Numbers Looked Like a Drop

### Measurement Artifact Explanation

The previous report (from earlier today) measured adoption in a **specific 12h window** when Bob and Optimizer were at their peak dispatch rates. The later report measured over **24h**, which blended:
- A **high-adoption recent window** (last 6h: Bob 87.5%, Optimizer 91.7%)  
- An **older low-adoption window** (6-12h ago: Bob 26.7% — during a period of idle heartbeats)

When averaged, the 24h rate naturally drops below the peak 12h rate. This is a **measurement artifact**, not a behavioral change.

### Bob's 26.7% Dip (6-12h Window)

Bob's adoption cratered in the 6-12h window because:
- Many heartbeats during that period were **low-op idle heartbeats** (avg 9.4 ops when no workflow dispatched)
- Heartbeats only dispatch workflows when there's work to do — idle heartbeats correctly skip workflows
- In the 0-6h window, more work arrived → adoption bounced to 87.5%

This is **expected behavior**: adoption rate is naturally correlated with workload, not with agent willingness to use workflows.

---

## 2. Correct Adoption Metrics (Last 12h)

### Heartbeat Workflow Dispatch Rate

| Agent | Heartbeats | Dispatched WF | Rate |
|-------|:----------:|:-------------:|:----:|
| **Optimizer** | 26 | 23 | **88.5%** |
| **Bob** | 23 | 11 | **47.8%** |
| **Tech-lead** | 29 | 12 | **41.4%** |
| **Coach** | 25 | 8 | **32.0%** |
| **Scout** | 27 | 1 | **3.7%** |
| QA | 24 | 0 | 0% |
| May | 29 | 0 | 0% |
| Evaluator | 91 | 0 | 0% |

### Work Session (agents.fork) Workflow Usage

| Agent | Work Sessions | Used WF | Rate |
|-------|:------------:|:-------:|:----:|
| **Bob** | 11 | 3 | 27.3% |
| **Tech-lead** | 25 | 6 | 24.0% |
| Coach | 10 | 0 | 0% |
| Optimizer | 2 | 0 | 0% |
| Scout | 3 | 0 | 0% |

---

## 3. Tech-Lead Deep Dive: Why Only 41.4% on Heartbeats, 24% on Work Sessions

### Session Mix
Tech-lead has an unusual pattern: 29 heartbeats + **25 forked work sessions** in the last 12h — more than any other agent. Its heartbeats actively dispatch work, but many of those forked sessions don't themselves use workflows.

### Work Session Categories (all 36 forked sessions, last 24h)

**WITH workflow (11 sessions, avg 30.9 ops):**
- Large build/integration tasks: Metric System Phase 2, Human Input Logging, JS Evaluation Coverage
- Persistent-task workflow pilots
- Batch-merge script, coder task queuing

**WITHOUT workflow (25 sessions, avg 19.8 ops):**
- Quick fixes & P0s: compose-guards.ts fixes, cost-limit-guard removal, metric threshold fix
- Design tasks: Guard Escalation Override, May-as-Gatekeeper, brainstorm responses
- Investigation tasks: Evaluator quality bug, workflow error rates
- Small implementations: output channel fixes, gym wiring

### Pattern: Task Size Drives Workflow Use

Tech-lead's non-workflow tasks are overwhelmingly **quick fixes and design documents** — tasks that complete in 8-15 ops and don't benefit from workflow structure. The workflow sessions are **larger coordinated tasks** (avg 31 ops). This is **appropriate behavior**: using workflows for small tasks would add overhead without benefit.

**Conclusion**: Tech-lead's 24% work-session adoption is not a problem — it reflects the right judgment about when workflows add value.

---

## 4. Optimizer: The Strongest Adopter (88.5%)

Optimizer dispatches a workflow on **23 of 26 heartbeats** (88.5%). The 3 heartbeats without workflows were low-op triage sessions (avg 13 ops) that correctly assessed "no work to dispatch."

Optimizer's pattern is the template:
- Every heartbeat checks rotation → dispatches work session via `verify-wrap` workflow
- Non-workflow heartbeats are genuinely idle (no pending rotation work)
- Work sessions themselves don't use workflows (they ARE the workflow-dispatched output)

---

## 5. Bob: Volatile but Trending Up (87.5% in last 6h)

Bob's adoption varies with workload density:
- When requests are queued → heartbeats dispatch workflows → high adoption
- During idle periods → heartbeats do light triage only → low adoption

**Last 6h**: 87.5% (7/8 heartbeats dispatched work)  
**6-12h window**: 26.7% (4/15 — many idle heartbeats in this quieter period)

This is **not a regression** — Bob is using workflows at high rates when there's work to do.

---

## 6. Non-Adopters: Expected or Concerning?

| Agent | Adoption | Expected? | Notes |
|-------|:--------:|:---------:|-------|
| **Evaluator** | 0% | ✅ Yes | Evaluator's heartbeats evaluate sessions — a specialized tight loop that doesn't need workflow dispatch |
| **QA** | 0% | ⚠️ Borderline | QA does review work that could benefit from workflows, but its heartbeat model is "check queues and review inline" |
| **May** | 0% | ✅ Yes | May handles user chat and dispatch — workflow overhead not appropriate |
| **Scout** | 3.7% | ⚠️ Concerning | Scout has workspace research tasks that could benefit from structured workflows |

---

## 7. Recommendations

### No urgent action needed — adoption is healthy where it matters

1. **Drop the concern about "regression"** — the numbers show continued improvement when measured correctly
2. **Measure in 6h windows** for trend detection, not 24h averages that dilute signal
3. **Scout is the real opportunity** — only 3.7% adoption despite having research tasks that match workflow patterns. Consider adding workflow dispatch to scout's heartbeat.
4. **Don't force workflows on small tasks** — Tech-lead's pattern of skipping workflows for 8-15 op quick fixes is correct behavior. A "100% adoption" target would be counterproductive.

### Proposed Metric: "Active Heartbeat Adoption"

Instead of measuring adoption as `heartbeats_with_wf / total_heartbeats`, measure:
- **Active heartbeats** = heartbeats with >10 ops (actually doing meaningful work)
- **Adoption** = active_heartbeats_with_wf / active_heartbeats

This removes idle heartbeats from the denominator and gives a truer picture of "when there's work to do, do we use workflows?"

---

## Methodology Notes

- **Time window**: Last 24h from 2026-04-15T23:00 UTC, split into 6h sub-windows
- **Workflow detection**: Parent session → child session with `workflowRunId IS NOT NULL` via `parentSessionId` join
- **Parent sessions**: Filtered by `parentSessionId IS NULL` to exclude workflow-spawned children
- **Heartbeats**: Identified by `task LIKE '%heartbeat%'`
- **Work sessions**: Identified by `source = 'agents.fork'`
