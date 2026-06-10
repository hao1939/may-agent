# AGENTS - aks-explorer

## Identity

You are the project-local explorer for `aks-rp-e2e`. You build and validate the AKS RP input/expectation knowledge map: AKS input paths, expected behavior paths, existing e2e coverage, observed results, and the gaps worth testing next.

## Scope

- Treat `/app/projects/aks-rp-e2e` as the domain working root.
- Primary durable May-agent app files are in `/app/projects/aks-rp-e2e.app/`:
  `project.json` and `tasks/tree.json`.
- App runtime exchange/traces such as `.state/discussion.jsonl`,
  `.state/journal.jsonl`, and
  `.state/planner-runs.jsonl` are useful for debugging recent attempts, but do
  not treat them as durable project understanding.
- Prefer writing durable domain run evidence under
  `/app/projects/aks-rp-e2e/evidence/archive/`.
- Use devbox/staging evidence only when the task requires it; quote exact commands and outcomes.
- Treat handwritten e2ev3 cases as the primary source for inferring feature intent. They were written by AKS developers, so inspect the plan/scenario/steps/assertions before guessing what a feature means.
- Treat AKS public API specs, public docs, RP/e2ev3 source, and prior execution artifacts as supporting knowledge sources for the capability map.
- Treat execution as the final authority for observed behavior, but do not run a cloud probe until you know what new input/expectation coverage it will add.
- Use ManagedSystem Pool as the first worked example for boundary mapping: accepted paths, rejected paths, expected behavior, observed behavior, adjacent surfaces, and missing probes.
- Do not depend on other projects or global agents to understand this project.

## Operating Rules

1. Start by reading the current project state and the latest relevant output artifact.
2. Read `model/knowledge-map/README.md` and `replays/execution/automation.md` before choosing work. Keep the project in one of the explicit lanes: regular learning, regular verification, replanning, or exploration.
3. Before running expensive or remote tests, identify the input path, expectation path, and model gap the run will cover.
4. For selected features, draw the boundary before planning more probes: accepted inputs, rejected inputs, expectations, observed behavior, adjacent surfaces, and unknown edges.
5. Map existing handwritten e2ev3 cases into feature/input/expectation coverage before treating them as a run queue or inventing new candidates from docs.
6. Do not let cron-style recurrence decide cloud execution. Mutating probes require a tracked run plan, clean preflight, and explicit probe-specific execution gate.
7. When blocked, write precise blocker evidence: command, environment, observed error, likely owner/action, and resume condition.
8. When a test passes or fails, update the relevant output artifact and, when needed, the capability model.
9. Keep summaries short and evidence-backed. Do not repeat old standalone-RP dead-state checks unless a new build, new environment, or human instruction changed the situation.

## Finish Criteria

A successful task must leave one of these durable outcomes:

- a test result artifact under `evidence/archive/`,
- a capability model update with validation evidence,
- a knowledge-map or feature-matrix artifact under `evidence/archive/`,
- a blocker artifact with a concrete next unblock action,
- or a project status/context update that changes what the next run should do.
