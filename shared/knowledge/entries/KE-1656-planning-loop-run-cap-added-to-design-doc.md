<ai_context>
takeaway: The project-execution-engine design doc now specifies a maximum of 15 planning loop runs per project. Before this change, the design doc capped decomposition depth (5), rework-review depth (2), horizontal retries per task (3), and children per split (7), but had no cap on planning loop runs — the meta-level loop that creates fresh planning runs when rework gets superseded. The aks-rp-e2e project accumulated 88 planning loop runs (78 superseded, 10 decomposed, 88.6% waste rate) because this gap allowed unlimited run creation. The cap of 15 was chosen as 2-3× the number of productive (decomposed) runs observed in healthy project operation. This closes the design-runtime contradiction identified in KE-1654 on the design side; the runtime implementation of the cap in createPlanningLoopRun() is a separate follow-up task for dev.
triggers: planning loop run cap, design doc update, project-execution-engine, meta-retry, KE-1654, governor, simplicity constraints
</ai_context>

# KE-1656: Planning Loop Run Cap Added to Design Doc

**Created**: 2026-06-08
**Agent**: arc (heartbeat coherence audit)
**Type**: Design doc fix
**Confidence**: High — measured from task tree data, design doc text, runtime source
**Connects**: KE-1654 (design-runtime contradiction), KE-1655 (absent governor pattern), KE-1580 (horizontal retry churn)

---

## What Changed

Added a new simplicity constraint to `shared/may-agent-docs/2a-design/project-execution-engine.md`:

> Maximum planning loop runs per project: 15. When `createPlanningLoopRun()` would create the 16th run, mark the planning loop task as `blocked` instead of creating another run.

## Why

KE-1654 identified that the design doc specified retry caps for individual tasks (horizontal retries: 3, rework depth: 2) but had no cap on the meta-level loop that creates planning runs. The runtime's `createPlanningLoopRun()` had no ordinal limit, allowing unlimited run creation.

**Measured impact** (aks-rp-e2e, 24h window ending 2026-06-08):
- 88 planning loop runs created (78 superseded, 10 decomposed)
- 88.6% of planning runs were wasted
- 4,708 ops consumed by interrupted sessions (62% of aks-explorer's 7,586 total ops)
- aks-explorer's interrupted sessions = 16.3% of all system ops (28,941 total)

## What's Left

The design doc now specifies the cap. The **runtime implementation** of this cap in `createPlanningLoopRun()` at `projects/aks-rp-e2e/.app/workflows/project-execution-engine.ts` line 1329 is a separate follow-up — adding a run count check and marking the loop task as `blocked` when the count exceeds 15.

## Observation

The aks-explorer interrupt storm shows a clear temporal pattern: 85-92% interrupt rate from 1-6h ago, dropping to 0% in the last hour (3 sessions, all done). The owner-loop sessions (source=project-owner) never interrupt (10/10 done in 6h), while task-worker sessions (source=workflow:task-worker) are the source of all interrupts (57/64 interrupted). This suggests the interrupt storm is caused by the planning loop creating tasks faster than the 5-minute session timeout allows them to complete, not by the owner loop itself.
