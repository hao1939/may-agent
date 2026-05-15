# Finding: Coach 87-89 Op Experiment Sessions — Pattern Analysis

**Date**: 2026-04-11 16:54 UTC  
**Type**: Session Archaeology — High-Op Session Patterns  
**Scope**: Coach sessions with 80+ ops in last 6 hours

## Executive Summary

Two coach sessions used 87-89 ops each (~18-19 min). Both are legitimate experiment work sessions dispatched by coach heartbeats via `agents.fork`. Neither involves gym-run proliferation or gym-batch.sh — one built a workflow + ran gym tests, the other was pure data analysis. The high ops are driven by the inherent complexity of building/testing interventions.

## Session Profiles

### EXP-138: verify-wrap Workflow Prototype (87 ops, 104 turns, 19m19s)

**Session**: `s_1775908476406_1409` — Started 11:54 UTC  
**Dispatched by**: Coach heartbeat → `agents.fork`  
**Task**: Build the verify-wrap workflow from EXP-137's intervention proposal, then gym-test it on scout

**What it did** (3 distinct phases within one session):
1. **Read phase** (~10 ops): Read EXP-137 results, intervention proposal, structural comparison, existing gym scenarios
2. **Build phase** (~25 ops): Wrote 154-line `verify-wrap.ts` workflow, created gym scenario `convention-verify-edit-verify-wrap/`
3. **Gym test phase** (~40 ops): Ran 12 gym scenarios (5 baseline convention-verify-edit, 1 verify-before-finish, 1 skip-verification, 1 compound-edit, 1 verify-wrap variant + environment bug fix/reruns)
4. **Write-up** (~12 ops): Wrote results.md, notified agents

**Gym run evidence**: 12 gym runs logged between 11:57-12:09 UTC, all under `agent_name=scout` (the test subject, not coach). Coach invoked `gym-run.sh` via bash, but the runs are attributed to scout.

**Key finding**: Scout passes gym verification scenarios at 100% baseline — the 67-71% FM-3.3 block rate manifests only in production, not gym scenarios. The gym scenarios are too simple to differentiate.

**Verdict**: ✅ Legitimate. The high ops come from actually building software (workflow code) + running 12 gym trials. This is coach's core job.

### EXP-141: Guard Stack Production Health (89 ops, 86 turns, 18m32s)

**Session**: `s_1775924680987_1516` — Started 16:24 UTC  
**Dispatched by**: Coach heartbeat → `agents.fork`  
**Task**: Test whether the 4-guard production stack shows degradation consistent with EXP-129's hump curve finding

**What it did** (pure analysis, no gym):
1. **Data gathering** (~30 ops): Read guard-breakdown-strict.json, convention check results, session data from may.db across multiple queries
2. **Analysis** (~40 ops): Computed per-session FM-3.3 and FM-3.1 guard fire rates, cross-referenced with EXP-129's hump curve data, analyzed per-agent patterns
3. **Write-up** (~19 ops): Wrote comprehensive analysis documents

**Gym runs**: Zero. No gym scenarios were run during 16:00-17:00 UTC.

**Verdict**: ✅ Legitimate. This is deep data analysis — reading many files, running multiple SQL queries, synthesizing findings. The 89 ops reflect thorough investigation, not waste.

## Comparison: Coach Session Op Distribution (Last 6h)

| Ops Range | Sessions | Pattern |
|-----------|----------|---------|
| 0-6 | 12 | Heartbeats (observe + dispatch) |
| 12-21 | 3 | Small work sessions (design, deploy, retarget) |
| 30-34 | 2 | Medium work sessions (investigation, observational study) |
| 42 | 1 | EXP-137: Guard reliance intervention design |
| 87-89 | 2 | EXP-138/141: Build+test and deep analysis |

**Total coach sessions in 6h**: 22 (12 heartbeats + 10 work sessions)  
**Total coach ops in 6h**: ~371 ops  
**High-op sessions (87+89 = 176 ops)**: 47% of total coach ops

## Is gym-batch.sh Used?

No. Coach runs gym scenarios individually via `bash gym-run.sh <scenario> --agent <name>`. The gym_runs table shows individual runs attributed to the test agent (scout), not coach. There's no evidence of `gym-batch.sh` usage in the last 6 hours.

Coach's last actual gym_runs (under agent_name containing "coach") were from 2026-04-10 ~20:00 UTC — 5 runs of `kb-discovery-hints-126`, all failing.

## Observations

1. **Forking pattern**: Coach heartbeats (3-6 ops) fork work sessions via `agents.fork`. The work session runs independently as a root-level job. This is clean separation — heartbeats stay lean.

2. **No evaluations**: Neither high-op session has an evaluation record. This means evaluator isn't scoring coach's work sessions — worth checking if this is intentional.

3. **Ops/turn ratio**: EXP-138 at 0.84 ops/turn (87/104) and EXP-141 at 1.03 ops/turn (89/86). Both are close to 1 op/turn, meaning the sessions are mostly sequential read-think-act cycles, not parallel multi-tool bursts. This is consistent with careful analysis work.

4. **No proliferation risk**: Both sessions had 0 children — they didn't spawn further sessions. The work stayed contained within a single session boundary.

---
*Optimizer | Session s_1775926467010_1529 | 2026-04-11 ~16:54 UTC*
