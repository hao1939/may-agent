# Cross-Agent Delegation Audit

**Date**: 2026-05-21  
**Auditor**: may  
**Scope**: 10 recent non-heartbeat `agents.fork` sessions

## Audited Sessions

| # | Session | Agent | Status | Ops | Duration (s) | Task Summary |
|---|---------|-------|--------|-----|-------------|--------------|
| 1 | s_1778678318230_146 | dev | done | 49 | 3732 | AKS RP iteration 26 |
| 2 | s_1778672946852_109 | arc | done | 78 | 2855 | AKS RP iteration 24 |
| 3 | s_1778656714888_6 | dev | **interrupted** | 23 | 2854 | AKS RP iteration 18 |
| 4 | s_1778547921261_696 | arc | **interrupted** | 6 | 55 | AKS RP iteration 3 |
| 5 | s_1778492279900_51 | may | done | 23 | 188 | Metric alert triage |
| 6 | s_1778440670446_1 | master | **interrupted** | 4 | 107 | Review scout sessions (dup) |
| 7 | s_1778440184860_2 | master | done | 2 | 75 | Review scout sessions (dup) |
| 8 | s_1778439381412_1 | may | **interrupted** | 0 | 11 | CLI send smoke (orphaned) |
| 9 | s_1778367402610_366 | dev | done | 54 | 322 | Scout friction investigation |
| 10 | s_1778234998984_17 | scout | done | 0 | 101 | Ruflo research (0 ops) |

## Findings

### 1. Orphaned Sessions (4/10 = 40%)

Four sessions were interrupted without producing usable output:
- **s_1778439381412_1**: Dispatched with 0 ops executed — immediately orphaned. No context was passed; the forked agent couldn't determine what to do.
- **s_1778547921261_696**: Only 6 ops in 55s before interruption. The aks-rp-e2e iteration 3 task was likely superseded by a newer iteration without canceling this one.
- **s_1778656714888_6**: 23 ops over 47 minutes — substantial work lost with no finish receipt.
- **s_1778440670446_1**: Duplicate of session 7; interrupted after 4 ops.

### 2. Duplicate Dispatch (1 pair)

Sessions 6 and 7 are the same task ("review scout's sessions") dispatched to `master` twice within 5 minutes. One completed with only 2 ops (shallow), the other was interrupted with 4 ops. Total: 6 ops wasted, neither produced substantive output.

### 3. Context Loss

- **s_1778234998984_17** (scout): Completed with 0 ops but status "done" — suggests the agent read context but couldn't act, likely due to missing context_files or unclear goal scope.
- **s_1778439381412_1** (may): The task description is vague ("control path smoke from CLI send") with no file paths, no expected outcome, no success criteria.

### 4. No parentSessionId Tracking

All 10 sessions have `parentSessionId = NULL`, meaning the system cannot trace which caller dispatched them. This makes orphan detection impossible without manual task-text correlation.

## Waste Quantification

| Metric | Total | Wasted | Rate |
|--------|-------|--------|------|
| Sessions | 10 | 4 interrupted + 1 dup | 50% |
| Duration (s) | 10,300 | 3,027 (interrupted) | **29.4%** |
| Operations | 239 | 33 (interrupted) + 2 (dup shallow) | **14.6%** |

**By duration: 29.4% waste. By ops: 14.6% waste.**

Using the more conservative ops metric, waste is borderline at the 15% threshold. Using duration (which includes idle/blocked time and is a better proxy for resource reservation), waste is nearly 2× the threshold.

**Verdict**: Waste ≥ 15% by duration metric. Delegation-memo convention warranted.

## Root Causes

1. **No cancellation on supersede**: When a newer iteration is dispatched, old sessions are not canceled.
2. **Duplicate detection gaps**: Same task forked twice without dedup.
3. **Vague task descriptions**: Missing file paths, success criteria, and expected outcomes lead to 0-op sessions.
4. **No parent linkage**: Cannot trace who forked what, making cleanup impossible.
