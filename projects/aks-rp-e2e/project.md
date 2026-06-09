---
id: aks-rp-e2e
owner: aks-explorer
status: waiting
type: milestone
priority: P1
iteration: 192
---

# AKS RP E2E Project

## Goal

Build a durable map between AKS input space and expected behavior space, then
use that map to generate and run efficient replay tests. The project is valuable
when users can review a feature, understand the expected contract, run or inspect
the replay evidence, and see how the result changes the model.

## Product Chain

```text
source anchor -> feature -> spec -> suite -> replay -> run -> model update
```

The current layout and naming rules are captured in
`decisions/domain-workspace-v3.md`.

## Current Focus

ManagedSystem Pool is the worked example for the full chain:

- source-grounded feature packet,
- atomic test specs,
- combined suites where compatible,
- TypeScript replays,
- durable staging run evidence,
- diagnosed model-impact proposals.

The goal is to make this path solid enough to reuse across App Routing, NAP,
Workload Identity, VirtualMachines, Bootstrap Profile, security profile, and
autoscaler features.

## Entry Points

- `model/knowledge-map/model.json` - canonical capability model.
- `features/` - source-grounded feature packets.
- `specs/` - atomic runnable behavior contracts.
- `suites/` - multi-spec execution compositions.
- `replays/` - executable TypeScript/JavaScript replay tests.
- `runs/` - durable request/run/result/diagnosis records.
- `evidence/archive/` - historical evidence and raw artifacts.
- `reports/current.md` - current user-facing status.
- `.app/project.md` - May-agent runtime state.
- `.app/tasks/tree.json` - agent task tree.

## Boundary

Domain artifacts live at the project root. Runtime control-plane artifacts live
under `.app/`. Do not recreate root `outputs/`, root `tasks/`, or legacy
`scenarios/`/`sources/` folders.
