# Task workspace convention evaluation study

Date: 2026-07-21
Evaluator: `evaluation.app`
Proposal under study: `/app/projects/may-agent.app/docs/3-proposals/task-workspace-convention.md`

## Scope and limits

This is a bounded evidence study, not acceptance of the May-agent proposal and not an implementation plan. May-agent remains the owner for accepting, revising, or rejecting the proposal. This report intentionally does **not** create a workspace registry, permanent evaluation loop, target-app remediation task, or runtime/workflow implementation change.

The proposal hypothesis tested here is:

> The app or domain owns the normal shared workspace. A task owns an isolated worktree only when mutation isolation is useful. An agent workspace is temporary scratch, not task or project authority.

## Collection method

Evidence started from runtime task/session/workflow facts and retained artifacts. Transcript slices were not needed for these representative cases because session metadata, workflow receipts, Git state, and produced artifacts were enough to identify workspace choice and outcomes.

Primary sources sampled:

- `query_db` runtime tables: `sessions`, `workflow_runs` schemas and recent rows.
- Session result receipts under `/app/.state/sessions/<sessionId>/result.json`.
- Retained artifacts under project/domain workspaces.
- Git status across app/domain workspaces and known worktrees.
- Current proposal text at `/app/projects/may-agent.app/docs/3-proposals/task-workspace-convention.md`.

## Raw evidence cases

### Case 1 — Scout shared knowledge integration works as normal shared workspace

- App/domain: `scout-knowledge-lib.app` / `/app/projects/scout-knowledge-lib`
- Task/session/workflow: task `explore-github`, session `s_1784610998724_106`, workflow run `wr_1784610996331_n4av`
- Workspace resolved in task packet: `appDir=/app/projects/scout-knowledge-lib.app`, `projectDir=/app/projects/scout-knowledge-lib`, `workspaceDir=/app/projects/scout-knowledge-lib`
- Work type: observational discovery plus durable knowledge-library mutation
- Produced artifacts: `/app/projects/scout-knowledge-lib/knowledge/findings/2026-07-21-github-ai-gateway-omniroute.md`, `/app/projects/scout-knowledge-lib/knowledge/findings/2026-07-21-github-fastmcp-server-framework.md`, and app scratch digest `/app/projects/scout-knowledge-lib.app/agents/scout/workspace/digest/today.md`
- Runtime receipt: `/app/.state/sessions/s_1784610998724_106/result.json` reports success and lists those deliverables.
- Workflow receipt: `workflow_runs` row for `wr_1784610996331_n4av` summarized two new findings from GitHub trending and shows the task packet's shared `workspaceDir`.
- Artifact read-back: `2026-07-21-github-ai-gateway-omniroute.md` contains a durable source-grounded finding under the shared library.

Workspace contribution: shared workspace is appropriate here because the durable product is the shared knowledge library. The app scratch digest is explicitly not authoritative. No evidence in this sample shows a need for per-task isolation; requiring a worktree would add integration overhead for a single shared library artifact set.

Contradictory/limiting evidence: Git status from `/app` shows unrelated Scout dirt (`projects/scout-knowledge-lib/agents/scout/workspace/digest/today.md`, `knowledge/INDEX.md`, and a deleted old finding). This proves the shared tree can contain ambient dirt, but this case does not prove the dirt harmed the task; the task's deliverables still landed in expected shared paths.

### Case 2 — AKS stale-inventory retry/frontier resolved by authoritative shared ref, not a new worktree

- App/domain: `aks-rp-e2e.app` / `/app/projects/aks-rp-e2e`
- Task/session: `domain/normalize-cluster-autoscaler-vm-prerelease-local-storage-runtime-adapter-frontier-20260721`, session `s_1784597935254_58`
- Workspace in task/session packet: shared app/domain workspace, no task-owned worktree in the runtime packet
- Work type: bounded reconciliation of a missing-adapter frontier
- Produced artifact: `/app/projects/aks-rp-e2e/evidence/archive/domain-normalize-cluster-autoscaler-vm-prerelease-local-storage-runtime-adapter-frontier-20260721.md`
- Runtime receipt: `/app/.state/sessions/s_1784597935254_58/result.json` reports the frontier was stale inventory: inventory snapshot at `faecf418a`, authoritative `origin/dev` at `c7db615eab90d868a567ff5d8702cb87a580e974`, carrier already published as `features/cluster-autoscaler/tests/cluster-autoscaler-vm-prerelease-local-storage-runtime.test.ts`.
- Artifact evidence: the memo records the stale inventory snapshot, current `origin/dev` probe refs, landed commit stat, and divergent local checkout state.

Workspace contribution: this case supports shared authoritative workspace/ref for observation and reconciliation. The problem was not lack of isolation; it was stale read-model/inventory. A new worktree would not by itself fix a stale inventory snapshot and could introduce another freshness surface.

Special-case relevance: this is a retry/frontier-recovery case. It shows recovery needs the effective workspace/ref and authoritative source identity, not only a task worktree path.

Contradictory/limiting evidence: the memo records a divergent local checkout branch and recommends treating `origin/dev` as the authoritative normalization holder. That is a freshness warning for shared checkouts: shared local state can diverge from the ref that should be audited.

### Case 3 — AKS dirty shared workspace and owner handoff show why task-level isolation/lineage can matter

- App/domain: `aks-rp-e2e.app` / `/app/projects/aks-rp-e2e`
- Task/session: `ops/repair-rp-master-validation-if-match-owner-handoff-wait-lineage-20260721`, session `s_1784609280355_100`
- Workspace in task/session packet: shared domain workspace `/app/projects/aks-rp-e2e`
- Work type: repair a missing human-owner handoff/wait lineage; mutation of app-visible artifacts and control-plane events
- Produced artifact: `/app/projects/aks-rp-e2e/evidence/archive/ops-repair-rp-master-validation-if-match-owner-handoff-wait-lineage-20260721.md`
- Runtime receipt: `/app/.state/sessions/s_1784609280355_100/result.json` reports event `3674546` (`project.approval.requested`), event `3674550` (`message.created`), notification `45632`, approval-dispatch ledger line `144`, and a proposed in-place wait-task update.
- Artifact evidence: the repair note records the baseline repo-ref-only wait, control-plane emit, durable send proof, and that no matching `project.approval.submitted` existed yet.
- Git state evidence: `git status --short --branch` in `/app/projects/aks-rp-e2e` showed a shared branch ahead by one commit with many modified feature/spec/compact files across unrelated feature areas. It also showed a separate collection of AKS worktrees under `/app/projects/aks-rp-e2e-worktrees/*` plus `/app/projects/aks-rp-e2e-wt-fix-local-storage-runtime`.

Workspace contribution: this case is the strongest evidence for isolation when mutation can overlap. The immediate successful repair used shared control-plane/app artifacts, but the surrounding dirty shared domain checkout makes it hard to attribute unrelated file dirt to one task. The presence of many existing AKS worktrees suggests the domain already reaches for isolation for independent patch/publication work.

Special-case relevance: this is both a handoff case and a dirty-worktree case.

Contradictory/limiting evidence: the owner-handoff fix itself did not require a task worktree because it was mainly control-plane lineage plus a retained evidence note. Worktree isolation would help with file-level patch isolation, but the durable handoff still depended on events/messages/task state, not only files.

### Case 4 — May-agent platform owner review benefits from shared app/domain context, not task isolation

- App/domain: `may-agent.app` / `/app/projects/may-agent`
- Task/session/workflow: platform owner review session `s_1784603420584_78`, workflow run `wr_1784603419023_sxsq`
- Workspace in workflow packet: `appDir=/app/projects/may-agent.app`, `projectDir=/app/projects/may-agent`, `workspaceDir=/app/projects/may-agent`
- Work type: read-heavy platform health judgment; no code patch in this sample
- Runtime receipt: `/app/.state/sessions/s_1784603420584_78/result.json` reports alert `#4215` with `event.pair-orphan-count=32045`, evidence from `review-packet.json`, `tree.json`, and platform source files, and `actions: []` because the root cause was already covered by task `cron-mark-trigger-event-handled-bug`.
- Workflow receipt: `workflow_runs` row for `wr_1784603419023_sxsq` summarizes the same no-op judgment.

Workspace contribution: shared app/domain context is useful for platform owner review because the task needs the live review packet, task tree, source files, and existing task coverage. A task worktree would not add value for this read-heavy owner decision.

Contradictory/limiting evidence: `/app` Git status shows substantial May-agent app dirt across agent docs/skills and tests. The sample did not mutate those files, so this is only ambient-dirt risk, not demonstrated workspace-choice failure.

### Case 5 — Evaluation report/deep-eval work naturally belongs in evaluation.app shared retained-report space

- App/domain: `evaluation.app` / `/app/projects/evaluation.app`
- Task/session/workflow: deep-eval session `s_1784608328603_94`, workflow run `wr_1784608328064_iwjo`
- Workspace in workflow packet: shared `workspaceDir=/app/projects/evaluation.app`
- Work type: evidence review and retained evaluation artifact production
- Produced artifact: `/app/projects/evaluation.app/agents/evaluator/workspace/deep-evals/s_1784605466713_88.json`
- Runtime receipt: `/app/.state/sessions/s_1784608328603_94/result.json` reports the JSON artifact was written, parsed with `python3 -m json.tool`, and read back.
- Artifact evidence: the JSON separates session score, issues, overall evidence, usage, and failure chains.

Workspace contribution: shared evaluation workspace is appropriate for retained reports because the whole app is the evidence and report authority. Agent workspace is scratch/retention area owned by the evaluation app; it should not become task handoff authority unless the workflow declares it as an output.

Contradictory/limiting evidence: this case uses an agent workspace path for retained deep-eval output, which partially conflicts with the proposal's phrasing that agent workspace is temporary scratch. The distinction should be clarified: app-owned workflow outputs may live under an agent workspace only when the app/workflow contract explicitly declares them durable; otherwise agent workspace should be scratch.

### Case 6 — Gym isolated benchmark scenario directories provide a useful contrast

- App/domain: `gym.app` / `/app/projects/gym`
- Sampled facts: runtime sessions for project `gym` include benchmark review and owner-review sessions; `/app/projects/gym/scenarios/truncated-schema-migration/scenario.json` defines a self-contained bug-fixing/recovery scenario with timeout, agent type, tags, and its own scenario environment files.
- Work type: benchmark/experiment execution and review, where repeatability matters more than integration with a single dirty shared product checkout
- File evidence: scenario directories under `/app/projects/gym/scenarios/*` include environment files (`schema.sql`, `package.json`, task instructions, success criteria) and generated run evidence lives under `.state` paths named by run ids.

Workspace contribution: Gym supports the isolated-workspace side of the convention. A scenario environment is intentionally a bounded experiment fixture; reuse of the shared app/domain checkout for arbitrary benchmark mutation would undermine repeatability and truth preservation.

Contradictory/limiting evidence: Gym owner-review workflows are read-only and retain proposals through workflow persistence, so not all Gym work needs isolated mutable worktrees. Isolation is useful for scenario execution, not for every Gym review task.

## Cross-case judgment

### What predicts shared vs isolated work?

Supported predictors from the sample:

1. **Shared workspace is better for canonical app/domain state and retained reports**: Scout findings, evaluation reports, platform owner review packets, and AKS evidence archives all rely on shared app/domain surfaces as authority.
2. **Isolated task worktree is justified when independent file mutation must be attributable and mergeable**: AKS has broad dirty domain state and many existing worktrees; independent patch/publication work is where isolation appears most valuable.
3. **Agent workspace should be scratch unless the app/workflow explicitly declares an artifact durable**: Scout digest and evaluation deep-eval artifacts show agent workspace can be used, but durability comes from app/workflow contract, not agent identity.
4. **Recovery needs effective workspace/ref metadata**: stale-inventory and owner-handoff cases needed exact `workspaceDir`, `origin/dev` commit, event ids, and artifact paths. A worktree path alone is insufficient.

### Which observed failures were workspace-choice failures?

Clear workspace-choice failures are limited in this bounded sample. The strongest negative evidence is ambient dirt in `/app/projects/aks-rp-e2e` and substantial dirt in `/app/projects/may-agent.app`, but dirty checkout alone does not prove causation. The AKS stale-inventory case was not caused by sharing; it was caused by an old inventory snapshot. The AKS handoff case was not caused by file workspace choice; it was missing event/message lineage.

Therefore, the evidence supports a **small convention**, not a broad task-isolation default.

## Smallest supported convention

Recommended minimum rule:

```text
Use the app/domain shared workspace for canonical observation, app state, task state, evidence archives, and retained reports.
Use a task-owned isolated worktree only for independent source/file mutation where collision, attribution, unfinished retry/handoff, or merge safety matters.
Use agent workspace only for temporary scratch, except when an app/workflow explicitly declares a durable output path there.
Always record the effective workspaceDir plus authoritative ref/commit or artifact ids needed for recovery.
```

This is narrower than “every task gets a worktree” and more explicit than “agents choose any workspace.” It preserves convention-over-configuration while allowing mutation isolation where the sample shows value.

## Required runtime/audit evidence if May-agent accepts a convention

Minimum evidence to make recovery/audit reliable:

- `effectiveWorkspaceDir` and whether it is shared or task-isolated.
- If isolated: task id, base ref/commit, branch/worktree path, and reuse policy for retries/replacement agents.
- If shared: authoritative ref/commit when source freshness matters, plus clear distinction between local dirty checkout and audited ref.
- Declared durable outputs and whether any live under an agent workspace by explicit workflow contract.
- Event/message/task ids for non-file handoffs; worktree metadata must not replace control-plane lineage.

## Unknowns and uncertainty retained

- The sample did not include a clean before/after comparison of the same patch performed in both shared and isolated workspaces.
- Dirty May-agent and AKS checkouts show risk but not direct causation for task failure in this sample.
- Existing AKS worktrees indicate local practice, but this report did not audit each worktree's lifecycle, cleanup, or retry reuse.
- Agent-workspace durability needs clearer design language because evaluation deep-eval artifacts currently live under an agent workspace path yet are retained workflow outputs.
- The report does not decide how infrastructure should allocate, clean, or garbage-collect task worktrees.

## Verification plan for a follow-up decision

Before May-agent accepts implementation work, verify with one bounded follow-up sample or targeted instrumentation:

1. Pick one active independent patch/publication task in AKS or May-agent and record whether an isolated worktree avoids dirty-checkout collision compared with current shared state.
2. Pick one retry/replacement-agent task and verify whether unfinished work is discoverable from task/workflow metadata without reading private transcript content.
3. Add no registry yet; instead, inspect whether existing session/workflow packets already carry enough `workspaceDir`, ref, output, and event lineage.
4. Confirm that shared observational tasks continue to complete without unnecessary worktree setup cost.
5. Confirm that durable artifacts under `agents/<agent>/workspace` are either reclassified into app-owned report paths or explicitly declared by workflow outputs.

## Bottom line

The proposal's core hypothesis is supported with a narrower wording: **shared by default for canonical app/domain work, isolated only for independent mutation isolation, scratch for agent-private reasoning, and explicit durable-output contracts for any exception.** The evidence does not support a permanent registry, per-task workspace configuration field, or default task worktree for all tasks.
