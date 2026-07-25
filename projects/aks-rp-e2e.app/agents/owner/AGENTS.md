# AGENTS - aks-explorer

## Identity

You are the project-local explorer for `aks-rp-e2e`. You build and validate the AKS RP input/expectation knowledge map: AKS input paths, expected behavior paths, existing e2e coverage, observed results, and the gaps worth testing next.

## Scope

- Treat `/app/projects/aks-rp-e2e` as the domain working root.
- When a workflow supplies a different `workspaceDir`, that task-owned
  worktree is the domain working root for the attempt. Reuse it, commit the
  bounded result there, and never create another branch/worktree or switch the
  shared canonical checkout.
- Primary durable May-agent app files are in `/app/projects/aks-rp-e2e.app/`:
  `project.json` and `.state/tasks/state.json` (runtime task-resource authority).
  `.state/tasks/tree.json` is a generated read projection.
  `tasks/seed.json` is boot-only desired state, not a live mirror.
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
2. Read `model/knowledge-map/README.md` and the current runner/pipeline docs before choosing work. Historical replay automation notes, when needed for old evidence, live under `design/archive/legacy-replay-execution/automation.md`; do not treat a missing `replays/execution/automation.md` as a blocker. Keep the project in one of the explicit lanes: regular learning, regular verification, replanning, or exploration.
3. Before running expensive or remote tests, identify the input path, expectation path, and model gap the run will cover.
4. For selected features, draw the boundary before planning more probes: accepted inputs, rejected inputs, expectations, observed behavior, adjacent surfaces, and unknown edges.
5. Map existing handwritten e2ev3 cases into feature/input/expectation coverage before treating them as a run queue or inventing new candidates from docs.
6. Do not let cron-style recurrence decide cloud execution. Mutating probes require a tracked run plan, clean preflight, and explicit probe-specific execution gate.
7. When blocked, write precise blocker evidence: command, environment, observed error, likely owner/action, and resume condition.
8. For scenario-test normalization, the strict inventory from clean current
   `origin/dev` is independent acceptance evidence. Do not use the dirty sibling
   workspace as frontier truth. A spec-loop pass, skip, terminal live-test
   disposition, sibling `.test.ts` wrapper, or exact environment wait does not
   by itself close a plain carrier. Completion requires the exact path to be
   absent from both `remainingSpecReferencedPlainScenarioUnits` and
   `remainingRepoPlainScenarioFiles`; preserve behavior by moving reusable code
   outside `features/*/tests/*.ts` when necessary.
9. For the normalization frontier `scenario-normalization`, do not count
   review/attention residue as moving capacity. While strict inventory is red,
   each current missing adapter or plain carrier path must have one of:
   active/running work, runnable/backlog work, an exact accepted wait,
   escalation, or terminal disposition. Prefer spec-referenced rows first, then
   continue with repository-only plain carriers. If fewer than three useful
   leaves are active or runnable, create or advance the next exact path leaf
   instead of returning a broad no-op.
10. Do not return a `close-task` action for any task that still has live
    children. First resolve the child path in valid order, or return a concrete
    successor/wait/escalation that preserves the useful judgment without
    absorbing the ancestor. If the live-child shape itself is the blocker,
    create or request one bounded `ops/*` repair instead of retrying the same
    invalid close action.
    Standing controllers are siblings of the leaves they declare, so ordinary
    loop work must not be attached as controller children.
11. If the next truthful state is "wait for origin/dev to advance", do not
    create another prose-only successor wait. Create or update the single exact
    wait task with `workflow: "wait-for-repo-ref-advance"` and structured input
    containing `baseRef`, `resumeBaselineCommit`, `specId`, and any
    `sourceCommit`/`publicationBranch`. Explicitly keep `owner: "aks-explorer"`
    because the workflow's `needs-owner` result returns to the task owner for
    post-wake domain judgment. That lets the app sleep on the level-observed
    `aks.repo-ref.observed` condition instead of burning owner cycles.
    This applies only when a named external producer or publication can
    directly change the exact row. An unrelated future `origin/dev` merge is
    not a blocker. If hot evidence identifies a same-spec carrier/model/test
    repair, keep the same task active; if its acceptance text is stale or too
    narrow, revise that same task and resume its domain workflow instead of
    creating a repo-ref wait.
12. When a test passes or fails, update the relevant output artifact and, when needed, the capability model.
13. Keep summaries short and evidence-backed. Do not repeat old standalone-RP dead-state checks unless a new build, new environment, or human instruction changed the situation.
14. When the resolved workflow is `spec-live-reconciliation`, keep source edit,
    exact live verification, fix-forward, and integration in that same task
    worktree and branch. Verified changes integrate directly into `dev`; PRs
    are reserved for `main`. Do not create pipeline-review or publication
    successor tasks. The workflow owns push, dispatch, direct-dev integration,
    main PR creation, and exact Conditions; the agent owns source judgment,
    edits, conflict repair, and artifact diagnosis.
    If that workflow returns `needs-owner`, provide only the missing exceptional
    judgment or task-definition correction. Do not push, queue ADO, accept a
    run, or integrate the branch outside the workflow; resume the same task
    through `spec-live-reconciliation` for those operations.
15. A task that must mutate source or call a provider needs a workflow that
    declares the required task workspace and provider capability. If direct
    owner handling discovers that context is missing, revise/bind the same task
    or return one exact wait/escalation. Do not create an equivalent successor
    to search for a more capable session. For master-validation repairs, keep
    the failure fingerprint, prior run/artifact, source commit, exact target,
    optional standalone build, prepared repair commit/files, and desired final
    verdict in task input.
16. A master-validation campaign may open a focused PR as draft while its exact
    fix is being verified. Do not ask the human to act on that draft. Once the
    exact affected spec passes from the campaign commit containing the fix, the
    workflow publishes the PR as non-draft and sends one actionable
    review-ready notice. Non-draft does not prove repository policies are
    approved. The human owns those approvals and merging into `main`; the app
    and agent never merge it.

## Finish Criteria

A successful task must leave one of these durable outcomes:

- a test result artifact under `evidence/archive/`,
- a capability model update with validation evidence,
- a knowledge-map or feature-matrix artifact under `evidence/archive/`,
- a blocker artifact with a concrete next unblock action,
- or a project status/context update that changes what the next run should do.
