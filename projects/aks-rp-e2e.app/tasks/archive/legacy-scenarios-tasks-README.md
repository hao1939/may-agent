# Project task index

Archived from the pre-engine `scenarios/.app/tasks/README.md` location. The active
task tree now lives at `.app/tasks/tree.json`, and the active task index is
`.app/tasks/README.md`.

This folder keeps task breakdowns out of `project.md` while preserving one navigation root.

Reachability rule: every task file, output artifact, script, model, or external source used by this project must be reachable from `project.md` directly or through links from this index.

## Current Task Sources

- `project.md` remains the project control plane: goal, current state, next action, validation rules, and the small parser-compatible task block.
- `.app/tasks/README.md` is the current task index and route map.
- `agents/aks-explorer/cron.json` is the disabled project-local trigger template
  for regular learning, weekly replanning review, and manual verification
  signal wake-ups.
- `tasks/archive/managedsystem-pool/wave-01-feature-standard.yaml` preserves the historical ManagedSystem Pool feature-standard wave.
- `evidence/archive/managedsystem-pool-feature-standard-init-tasks.md` is the narrative draft behind the current ManagedSystem Pool wave.

## Active Waves

| Wave | File | Purpose | Status |
|---|---|---|---|
| ManagedSystem Pool feature standard | `tasks/archive/managedsystem-pool/wave-01-feature-standard.yaml` | Turn ManagedSystem Pool into the first reusable feature packet standard | archived |

## Task Management Rules

- Keep `project.md` readable. It should point to task files instead of embedding every breakdown.
- Use one task file per wave or tightly scoped milestone.
- Use one task per durable output artifact.
- Feature work should collect a reference packet before claiming product
  pass/fail: design docs, API/spec, user docs, Go e2ev3 source, useful
  implementation references, existing evidence, and known contradictions.
- Parallel tasks must write to different output files.
- Integration tasks depend on the parallel outputs and produce the final packet/model update.
- Do not run staging/cloud probes unless a task explicitly says execution is allowed.
- A completed task must link its output artifact and raw evidence.

## Resource Hubs

- Execution strategy: `replays/execution/README.md`
- Automation operating model: `replays/execution/automation.md`
- Project-local trigger template: `agents/aks-explorer/cron.json`
- Feature reference packets: `features/README.md`
- Reviewable run plans: `suites/README.md`
- TypeScript probes: `replays/README.md`
- Probe helper library: `replays/lib/README.md`
- Capability model: `evidence/archive/e2e-capability-model.json`
- Current knowledge map: `evidence/archive/input-expectation-knowledge-map.md`
- Handwritten e2ev3 inventory: `evidence/archive/e2ev3-handwritten-coverage-inventory.md`
- ManagedSystem Pool evidence:
  - `evidence/archive/iteration24-managedsystem-pool-pass.md`
  - `evidence/archive/iteration56-managedsystem-staging-refresh.md`
  - `evidence/archive/20260519T1646Z-managedsystem-priority-staging.md`
  - `evidence/archive/managedsystem-pool-exploration.md`
