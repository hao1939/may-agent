# Workflow Health Check — Apr 13 Evening (19:22 UTC)

**Date**: 2026-04-13 ~19:22 UTC  
**Mode**: D (Workflow Health)  
**Period**: Last 6h (13:22–19:22 UTC)  
**Previous baselines**: 14.6% (Apr 13 AM), 0.8% (Apr 13 PM 16:22), 27.1% (Apr 12 peak)

## Executive Summary

Workflow adoption remains near-zero (2.0% system-wide, 3/151 sessions) — **stabilized at collapse levels**, confirming the previous finding. The tech-lead `lens-analysis` workflow was deployed and heartbeat text was updated to mandate its use, but **tech-lead is still dispatching all 9 Lens sessions via `agents.call()` instead of `workflow.run("lens-analysis", ...)`**. Zero lens-analysis workflow executions in 6h.

**Silver lining**: Tech-lead Lens sessions are averaging 10.2 ops (median 8, max 23, zero >40 ops) — historically these were 40-96 ops. The text-based budget caps in the heartbeat are working as efficiency guidance even though the formal workflow isn't being used.

## 1. Adoption Rates — Current vs Baselines

| Period | WF Sessions | Total | Rate | Δ from Prior |
|--------|-------------|-------|------|-------------|
| **Last 6h (now)** | **3** | **151** | **2.0%** | +1.2pp from 0.8% |
| Apr 13 PM (16:22) | 1 | 57 | 0.8% | — |
| Apr 13 AM (14:22) | 55 | 376 | 14.6% | — |
| Apr 12 peak | — | — | 27.1% | — |

The 3 workflow sessions in the last 6h: 2 coder sessions (same workflow run `wr_177609740`) and 1 tech-lead session with embedded PHASE BOUNDARIES text. No recovery toward the 27.1% peak.

### By Agent (Last 6h)

| Agent | WF / Total | Rate | Notes |
|-------|:---:|:---:|---|
| coder | 2/2 | 100% | Both from same implement-and-verify run |
| tech-lead | 1/29 | 3% | 1 phase-boundary text session; 9 Lens calls via `agents.call()` |
| bob | 0/20 | 0% | Fully experiment-driven (EXP patterns) |
| optimizer | 0/26 | 0% | Mode sessions without workflow tags |
| coach | 0/25 | 0% | — |
| qa | 0/12 | 0% | — |
| scout | 0/12 | 0% | — |
| evaluator | 0/12 | 0% | — |
| may | 0/13 | 0% | — |

## 2. Lens Workflow Wiring — Deployed but NOT Adopted

### What was deployed
- `agents/tech-lead/workflows/lens-analysis.ts` — full D-o-R phased workflow with JS verification ✅
- `agents/tech-lead/heartbeat.md` — contains explicit instructions:
  - "ALWAYS use `workflow.run("lens-analysis", ...)` for Lens investigations"
  - "NEVER dispatch Lens work via `agents.call()` or `agents.fork()`"
  - Workflow routing table with lens-analysis as default for Lens work
  - Code examples showing exact `workflow.run()` syntax

### What actually happened (last 6h)
- **9 Lens sessions** dispatched by tech-lead
- **ALL 9** dispatched via `agents.call()` (kind=`call`, source=`callAgent`)
- **ZERO** dispatched via `workflow.run("lens-analysis", ...)`
- **2 of 9** had PHASE BOUNDARIES text embedded in task (from heartbeat text, not from workflow)
- The wiring session itself ran (8 ops) but produced no lasting behavioral change

### Diagnosis
This is a **textbook KE-020 failure**: the capability exists and the instructions are explicit, but the dispatch path isn't structurally enforced. Tech-lead reads the heartbeat, sees the workflow table, but when it reaches Step 3 (ACT), it falls back to `agents.call()` — the pattern it has used successfully many times before.

Key evidence:
- `source: "callAgent"` on all 9 Lens sessions (not `workflow`)
- `workflowRunId: null` on all 9
- The heartbeat text says "ALWAYS use workflow.run" but the agent has a pre-trained preference for `agents.call()`

## 3. Tech-Lead Lens Efficiency — Surprisingly Good

Despite skipping the workflow, Lens session efficiency has improved dramatically:

| Period | Count | Avg Ops | Median | Max | >40 ops |
|--------|:---:|:---:|:---:|:---:|:---:|
| **Last 6h** | **9** | **10.2** | **8** | **23** | **0** |
| Prior 6h | 3 | 12.3 | 10 | 21 | 0 |
| Last 24h total | 12 | 10.8 | 9 | 23 | 0 |
| Historical (pre-budget caps) | — | 40-96 | — | 96 | many |

Distribution: 4, 4, 7, 8, 8, 9, 13, 16, 23

**The heartbeat text-based budget caps and pre-dispatch scope checks are working** — sessions that would have been 40-96 ops are now consistently <25 ops. The formal workflow would add JS-based verification of the deliverable file, but the core efficiency gain is already achieved through text instructions.

## 4. System-Wide Work Patterns (6h)

| Agent | Sessions | Total Ops | Avg Ops | High-Op Sessions (>30) |
|-------|:---:|:---:|:---:|:---:|
| tech-lead | 29 | 308 | 10.6 | 1 (41-op scout fix) |
| optimizer | 26 | 403 | 15.5 | 0 |
| coach | 25 | 381 | 15.2 | 0 |
| bob | 20 | 262 | 13.1 | 0 |
| may | 13 | 99 | 7.6 | 0 |
| scout | 12 | 111 | 9.3 | 0 |
| evaluator | 12 | 85 | 7.1 | 0 |
| qa | 12 | 83 | 6.9 | 0 |
| coder | 2 | 42 | 21.0 | 1 (31-op fix session) |

**System-wide avg: 11.8 ops/session** — well below the 24.8 avg from the earlier measurement today. Only 2 sessions >30 ops in 6h.

## 5. Conclusions & Trend

### Trend (72h adoption trajectory)

```
Apr 12:  27.1% ████████████████████████████
Apr 13 AM: 14.6% ███████████████
Apr 13 PM: 0.8%  █
Apr 13 EVE: 2.0% ██
                  Collapsed, not recovering
```

### Key Findings

1. **Workflow adoption is flat at ~2%** — no recovery from the collapse. The system has evolved past tagged workflows toward experiment-driven (Bob) and direct-dispatch (tech-lead, optimizer) patterns.

2. **Lens-analysis workflow: deployed but zero adoption** — despite explicit heartbeat instructions with code examples. Confirms KE-020: availability ≠ adoption. Text rules can't override established tool-use patterns.

3. **Efficiency is improving anyway** — TL Lens sessions avg 10.2 ops (was 40-96), system-wide avg 11.8 ops. The budget caps and scoping text in heartbeats are achieving the efficiency goal that workflows were supposed to enforce.

4. **The formal workflow adds marginal value now** — its primary benefit (phase budgets) is already achieved by text. Its secondary benefit (JS deliverable verification) has value but the non-adoption means it's providing zero benefit.

### Recommendations

1. **For lens-analysis adoption**: Either accept non-adoption (efficiency goal already met) OR move to structural enforcement (intercept `agents.call()` for Lens tasks and redirect to workflow in the harness). Text instructions have demonstrably failed.

2. **Shift Mode D tracking**: Replace workflow tag adoption rate with **session efficiency metrics** (avg ops, >30 op outliers, error rate). These are the actual health indicators now.

3. **Consider retiring the workflow tag goal**: The system achieved the efficiency improvement through budget caps and scoping text. Formal workflows are only valuable where JS verification catches confabulation (per KE-093) — and there are currently zero sessions where that's happening.
