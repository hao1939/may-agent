# Task Workspace Convention

**Historical context:** [Task Resource Engine](../../2a-design/task-resource-engine.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Accepted and incorporated; archived decision
**Owner:** May-agent
**Evaluator:** `evaluation.app`
**Decision:** Accepted (2026-07-21) — narrower wording per evaluation report
**Evaluation report:**
[Task workspace convention evaluation study](../../../archive/retired-apps/evaluation/reports/design-studies/task-workspace-convention.md)
**Related:**
[Projects](../../2a-design/projects.md),
[App Root Layout](../../2a-design/app-root-layout.md),
[Task Resource Engine](../../2a-design/task-resource-engine.md),
[Workflows](../../2a-design/workflows.md), and
[Practice Learning Loop](../../2a-design/practice-learning-loop.md)

## Decision

Define where an agent works while handling a task without making workspace
selection another per-task configuration system.

The accepted guidance is:

> The app or domain owns the normal shared workspace. A task owns an isolated
> worktree only when mutation isolation is useful. An agent workspace is
> temporary scratch, not task or project authority.

This is design guidance derived from real work. A narrow runtime contract is
now implemented for workflows that explicitly export `workspace = "task"`;
the default remains shared and no per-task workspace configuration exists.

`evaluation.app` completed the bounded cross-app study on 2026-07-21. The
report supports the core hypothesis with narrower wording: shared workspace
for canonical app/domain work, task isolation only for independent file
mutation, and agent workspace as scratch except for outputs explicitly made
durable by an app or workflow contract. The later AKS topology audit supplied
the missing causal evidence: 577 registered worktrees, 96 dirty when untracked
files were counted, and a shared root on a divergent task branch. That bounded
follow-up justified the AKS pilot, not a universal worktree default.

## Why this was evaluated

Current apps expose different needs:

- Scout maintenance tasks integrate into one shared knowledge library.
- AKS observation and planning tasks need the same current specs, evidence,
  task state, and repository head.
- Evaluation tasks share runtime evidence and retained reports.
- Independent May-agent and AKS patch work can conflict in a shared dirty
  checkout and may benefit from task isolation.
- Some existing tasks create worktrees inside their workflow or agent session,
  but the task runtime normally resolves `workspaceDir` to the shared domain
  project directory.

The evidence supports mutation isolation, rather than task or agent identity,
as the useful boundary. It does not yet prove that runtime enforcement would
improve outcomes.

## Accepted convention

The convention is:

```text
canonical app or domain work -> shared workspace
independent patch or commit  -> task worktree
temporary reasoning          -> session or agent scratch
```

Workflows and agents consume the resolved workspace and avoid depending on
agent-private files for recovery. The implemented task-worktree pilot resolves
topology before execution and reuses an unfinished task-generation worktree
across retries or replacement agents.

## Evaluation questions used

The study must answer:

1. Which observed task characteristics reliably predict whether shared or
   isolated work is safer and more productive?
2. Which failures are caused by workspace choice rather than unrelated task,
   workflow, or repository problems?
3. Does a task worktree improve retry and agent-handoff recovery?
4. What freshness or integration costs do isolated worktrees introduce?
5. Which shared-workspace tasks suffer from unrelated dirt, overlapping edits,
   or unclear artifact ownership?
6. Can one convention cover the apps without arbitrary per-task workspace
   fields?
7. What is the minimum runtime evidence needed to locate the effective
   workspace during recovery and audit?

## Completed evaluation campaign

`evaluation.app` completed one bounded cross-app study. It observed and judged;
it did not implement May-agent design.

The sample covered current or recent work from:

- `scout-knowledge-lib.app`: shared knowledge exploration and integration;
- `aks-rp-e2e.app`: observation, mutation, publication, retry, and wait work;
- `may-agent.app`: code patch and review work;
- `evaluation.app`: evidence collection and report production; and
- `gym.app` when its isolated experiment workspace provides a useful contrast.

It included retry, handoff, dirty-worktree, and isolated-scenario evidence. It
started from task resources, attempts, workflow runs, session metadata, Git
state, and produced artifacts; transcript slices were unnecessary for the
representative cases.

For each representative case, the evaluator recorded:

- app, task, generation, workflow, and session identity when available;
- requested outcome and whether the work was observational or mutating;
- effective working path and whether it was shared or isolated;
- files, branch, commit, or shared artifacts produced;
- whether later attempts could find and reuse unfinished work;
- collision, ambient-dirt, stale-state, integration, and cleanup evidence; and
- outcome plus the workspace choice's demonstrated contribution.

The retained report belongs under:

```text
projects/evaluation.app/reports/design-studies/task-workspace-convention.md
```

It keeps raw examples separate from judgment and recommends the smallest rule
supported by the sample. Unknowns and contradictory cases remain visible.

## Decision process

May-agent's owner reviewed the evaluation report and selected **accept** from
the original decision set:

- **accept**: move the proven rule into current design and create ordinary
  implementation work;
- **revise**: narrow or change the hypothesis and request one bounded follow-up
  sample; or
- **reject**: retain the evidence and do not add a workspace mechanism.

The evaluation task completed with representative cross-app evidence, a
recommendation, remaining uncertainty, and a concrete verification plan.
The later AKS audit and owner instruction authorized the bounded pilot recorded
below.

## Guardrails

- Do not create a permanent workspace-evaluation loop for this first study.
- Do not create a workspace registry or second task-state authority.
- Do not infer causation from a dirty checkout alone.
- Do not treat session logs as the normal recovery interface.
- Do not make agent-private files necessary for task handoff.
- Do not automatically change workflows or runtime behavior from the
  evaluator's recommendation.
- If the collection method proves reusable, the evaluator may later propose an
  agent-owned workflow through the normal learning process.

## Owner decision (2026-07-21)

**Accepted as design guidance.** The evaluation report's narrower wording is adopted:

> Use the app/domain shared workspace for canonical observation, app state, task
> state, evidence archives, and retained reports. Use a task-owned isolated
> worktree only for independent source/file mutation where collision,
> attribution, unfinished retry/handoff, or merge safety matters. Use agent
> workspace only for temporary scratch, except when an app/workflow explicitly
> declares a durable output path there. Always record the effective workspaceDir
> plus authoritative ref/commit or artifact ids needed for recovery.

**What this means:**

- This convention is now design guidance for May-agent workflows and apps.
- No registry, universal task worktree, or per-task workspace configuration is
  implemented.
- A workflow may export `workspace = "task"`. Infrastructure prepares/reuses
  the deterministic Git worktree, records attempt/receipt lineage, supplies it
  as the real tool root, and finalizes it before task transition.
- AKS uses this only for independent scenario-adapter mutation through
  `domain-task-execution`; observation, app-ledger work, and exact waits remain
  shared.

**What is deferred:**

- Generalizing the pilot to other apps or every mutating workflow.
- Automatic cleanup judgment for legacy dirty workspaces.
- Any task-tree workspace configuration field or workspace registry.

**Uncertainty preserved:**

- Ambient dirty checkouts show risk but not demonstrated causation in the sample.
- Existing session/workflow metadata may already carry enough workspace lineage
  without new infrastructure.
- The follow-up sample should confirm or deny causation before implementation.
