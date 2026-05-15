# Finding: Workflow Health Check — Apr 15

**Date**: 2026-04-15  
**Mode**: D (Workflow Health Check)  
**Focus**: Tech-lead 100-op heartbeat spike + workflow adoption trends + error patterns

---

## 1. Tech-Lead 100-op Heartbeat Analysis

**Session**: `s_1776259835111_5`  
**When**: Apr 15, 13:30–13:54 UTC (23.9 min)  
**OpCount**: 100 (hit budget ceiling)  
**Status**: done (no error)  
**Children**: 0 (all 100 ops spent in the heartbeat itself, no delegation)

### Context
- Tech-lead heartbeat average over 7 days: **11.7 ops** (338 sessions)
- This session is **8.5x the average** — a significant outlier
- No workflowRunId — this was a raw heartbeat, not a workflow-dispatched session

### Diagnosis
The session hit the 100-op budget cap, spending 24 minutes on a single heartbeat with zero child sessions. This is the classic "heartbeat doing work directly instead of dispatching" anti-pattern. The tech-lead heartbeat is designed as a "Dispatcher Mode" (per task text: "Simplification Engine (Dispatcher Mode)"), meaning it should delegate work, not execute it inline.

**Verdict**: This is a genuine inefficiency — the heartbeat did inline work that should have been dispatched to child sessions. Not a restart accumulation issue (session started fresh at 13:30) and not a workflow issue (no workflowRunId). It's the heartbeat exceeding its intended role.

---

## 2. Workflow Adoption Trend

| Time Window | Total Sessions | Workflow Sessions | Rate (excl evaluator) |
|---|---|---|---|
| 36–48h ago | 305 | 6 | **2.1%** |
| 24–36h ago | 371 | 47 | **16.1%** |
| 12–24h ago | 179 | 31 | **24.4%** |
| 0–12h ago | 277 | 57 | **27.7%** |

**Trend**: Workflow adoption has surged from 2% → 28% in 48 hours. This is a dramatic acceleration — the Apr 12 baseline was 27%, meaning adoption held steady in the most recent window rather than being a one-off spike.

### Agent-Level Adoption (last 24h)

| Agent | Sessions | Workflow | Rate | Avg Ops | Max Ops |
|---|---|---|---|---|---|
| coder | 18 | 15 | **83%** | 20.2 | 34 |
| optimizer | 55 | 24 | **44%** | 11.8 | 39 |
| bob | 55 | 21 | **38%** | 10.4 | 38 |
| coach | 57 | 19 | **33%** | 12.4 | 48 |
| tech-lead | 66 | 7 | **11%** | 13.6 | 100 |
| scout | 30 | 2 | **7%** | 8.2 | 28 |
| qa | 30 | 2 | **7%** | 6.1 | 8 |
| evaluator | 123 | 0 | 0% | 0.5 | 8 |
| may | 33 | 0 | 0% | 7.2 | 40 |

**Key observations**:
- **Coder at 83%** — highest adopter, nearly all sessions use workflows
- **Optimizer/bob/coach** in the 33–44% band — solid adoption
- **Tech-lead at 11%** — low for a dispatcher role, consistent with the 100-op heartbeat issue
- **Scout/QA** barely using workflows (7%)
- **May/evaluator** at 0% — evaluator is automated; may is infrastructure

---

## 3. Workflow Efficiency Impact

### Coder: Workflow vs Non-Workflow (48h)
| Metric | With Workflow | Without Workflow | Improvement |
|---|---|---|---|
| Avg Ops | 17.2 | 26.6 | **-35%** (fewer ops = better) |
| Avg Duration | 209s (3.5min) | 337s (5.6min) | **-38%** (faster) |

Workflows save coder sessions ~9 ops and ~2 minutes per session. This is strong evidence of efficiency gains from workflow adoption.

### Workflow Session Status Distribution (48h)
- **done**: 130 (avgOps 20.2)
- **interrupted**: 11 (avgOps 39.3)  
- **running**: 3

**90.3% completion rate** for workflow sessions. Interrupted sessions average nearly 2x the ops of completed ones — likely hitting budget caps.

---

## 4. Error Patterns

All 11 interrupted workflow sessions had `error: Request was aborted.` — this is the standard timeout/budget-exceeded signal, not workflow-specific failures. Affected agents: coder(1), coach(3), optimizer(2), bob(3).

No new workflow-specific error patterns. The interruption pattern is consistent with normal budget enforcement.

### Non-Workflow Concerns
- **QA**: 18 interrupted sessions (60% interrupt rate) — ongoing issue, unrelated to workflows
- **Coach**: 10 interrupted sessions — possibly from coaching-feedback sessions hitting budget caps
- Status is all `done`/`interrupted` — no `success` status used (framework uses `done` for success)

---

## 5. Summary & Recommendations

### What's Working
1. **Workflow adoption climbing rapidly**: 2% → 28% in 48h, sustained at ~28%
2. **Coder efficiency gains are real**: -35% ops, -38% duration with workflows
3. **No workflow-specific errors**: All interruptions are normal budget caps
4. **90% workflow completion rate**: Healthy reliability

### Concerns
1. **Tech-lead 100-op heartbeat**: Dispatcher doing inline work instead of dispatching — should be investigated for heartbeat instruction clarity
2. **Scout/QA low adoption** (7%): May need workflow templates designed for their use cases
3. **QA interrupt rate** remains high (60%) — separate from workflow health but worth tracking

### Actionable
- The 100-op heartbeat is the most interesting signal. The tech-lead heartbeat says "Dispatcher Mode" but spent 100 ops doing work inline. This could indicate the heartbeat instructions aren't clear enough about when to dispatch vs do inline, or the work encountered didn't fit available delegation targets.
- Workflow adoption appears self-sustaining at ~28%. No intervention needed to maintain trajectory.
