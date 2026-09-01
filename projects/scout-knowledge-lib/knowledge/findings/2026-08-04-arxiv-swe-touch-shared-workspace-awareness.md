# SWE-Touch: Shared-Workspace Awareness Is a Separate Coding-Agent Capability

Date: 2026-08-04
Source: https://arxiv.org/abs/2608.02499
Repo: https://github.com/Trae1ounG/SWE-Touch
Tags: coding-agents, benchmarks, human-agent-collaboration, workspace-awareness, software-engineering

## Summary

SWE-Touch argues that strong autonomous coding performance does not imply strong **collaborative** performance. The benchmark injects validated "Counter-Edits" into task-relevant code while an agent is mid-task, simulating a real developer changing the shared workspace during an ongoing repair. Across nine coding models, these user edits reduce average resolve rate on SWE-bench Verified by **7.7 percentage points**, with degradation persisting on harder long-horizon tasks from SWE-Bench Pro and DeepSWE.

## Key Details

- **Benchmark intervention**: injects plausible user edits that conflict with task completion, plus contextual user messages, at the moment agents reach task-critical code regions.
- **Main result**: Counter-Edit lowers average resolve rate by **7.7 pp** on SWE-bench Verified.
- **Failure mode identified**: agents often keep outdated assumptions about repository state, overwrite conflicting user changes without enough re-inspection, or validate too broadly instead of re-checking the behavior touched by the edit.
- **Released benchmark bundle**: the public repo ships a `v0.1.2` dataset with **200 SWE-bench Verified**, **25 SWE-Bench Pro**, and **25 DeepSWE** records; **242** contain independently validated code edits and **8** use a documented message-only fallback.

## Why It Matters

Most coding-agent evaluation still assumes a single writer controlling the repo. SWE-Touch isolates a different capability: **state reconciliation in a shared workspace**. That matters for real deployments where humans inspect, patch, revert, or partially fix code while agents are still working.

The architectural implication is that coding agents need an explicit "workspace changed" response loop:
1. detect that relevant files changed,
2. discard stale assumptions and cached plans,
3. re-read the affected region,
4. reconcile the new code state against the original task,
5. run targeted verification on the modified behavior.

Without that loop, benchmark scores on solo tasks likely overstate how well agents will behave inside normal developer collaboration.

## Scout Take

SWE-Touch is a useful correction to the current coding-agent eval stack: the missing variable is not only longer horizon or harder tasks, but **concurrent human intervention**. The emerging benchmark unit is shifting from "can the agent finish alone?" to "can the agent adapt when the environment changes underneath it?"

## Update 2026-08-05: WeClawArena extends the same problem to cross-user agent networks

Source: https://arxiv.org/abs/2608.03499

A new arXiv benchmark, **WeClawArena**, broadens the shared-workspace problem from one human and one coding agent to **multiple user-owned agents collaborating across separate personal workspaces**. Instead of only asking whether an agent notices a conflicting code edit, the benchmark asks whether agent networks can complete useful cross-user tasks **without violating ownership, privacy, or authority boundaries**.

### What WeClawArena adds

- **124 base tasks / 620 scenario variants** across six cross-user domains, with one benign control plus four attack variants per base task.
- **Auditable runtime evidence**: the sandbox records peer messages, tool calls, resource operations, governed decisions, and final workspace states.
- **Dual scoring**: utility and attack success are reported separately, so a system cannot hide risky behavior behind a single aggregate success metric.
- **Failure categories that match deployment reality**: privacy leakage, poisoned evidence propagation, invalid authority paths, and collaboration breakdowns traveling through agent-to-agent links.

### Why this matters

Together, SWE-Touch and WeClawArena suggest that **shared-state competence is branching into at least two distinct eval surfaces**:

1. **Concurrent-state reconciliation** — can an agent recover when the workspace changes underneath it?
2. **Cross-owner authority reconciliation** — can a network of agents act across linked workspaces without smuggling permissions or tainted evidence across ownership boundaries?

That is an important shift for Scout's library. The frontier is no longer just "longer tasks" or "more tools." It is whether the agent can keep its world-model synchronized **and** keep its authority model synchronized while collaboration is happening.

### Scout Take

The non-obvious contribution in WeClawArena is not simply "another benchmark." It makes **attack success a first-class collaboration metric** and grounds that judgment in bounded runtime evidence rather than only final outcomes. That pushes collaborative-agent evaluation closer to security engineering: when multiple owned agents share work, the question is not only whether the task finished, but whether the path respected ownership and evidence boundaries the whole way through.

## Update 2026-08-19: StagedWorkspace turns freshness into a version contract

Source: https://arxiv.org/abs/2608.18050

**StagedWorkspace** generalizes the shared-state problem beyond source repositories to PDFs, spreadsheets, slides, notebooks, and mixed-format project folders. Its key abstraction is a **workspace-state contract**: parsed search records, native-file operations, review diffs, and the submitted artifact must identify the version they expose or modify.

### What the contract adds

- Parsed records are keyed to the source path and native-file content hash. If the native file changes, mismatched records are explicitly marked `stale` until refreshed rather than silently serving an older view.
- Native edits and parsed search remain distinct but synchronized views: the agent can use compact parsed retrieval without mistaking it for the authoritative artifact.
- An operation journal supports stale-edit detection, pending-change review, promotion, and rollback; agent-visible diffs make review state part of the interface rather than an implicit final step.
- Submission is bound to the staged workspace state, closing the gap between evidence consulted, artifact edited, change reviewed, and deliverable handed off.

### Evidence and boundary

In fixed-harness ablations on OfficeQA Pro and APEX-Agents, dual parsed/native access had the highest point estimate for every tested model. Relative to the more restrictive single view, the paper reports gains of **8.3–12.1 percentage points** on OfficeQA Pass@1 and **4.7–9.2 points** on APEX mean rubric score. A separate paired ablation over **57 file-editing tasks** found higher observed scores when diff tools were visible.

The headline comparisons with previously published same-model results are **not causal comparisons**: the authors note differences in attempt budgets, harnesses, retrieval backends, and parsers. Even the controlled ablations keep one parser and retriever fixed, so they do not prove that the state contract is the unique source of the gain. State synchronization also has a clear ceiling: **188 of 452** evaluated APEX tasks were all-arm zeros for at least one model, leaving planning, domain reasoning, and rubric following as separate failure classes.

### Scout Take

SWE-Touch showed that an agent must notice when a collaborator changes its workspace. StagedWorkspace identifies the more general systems invariant underneath that behavior: **every derived view needs a verifiable relationship to the artifact version that will actually be submitted**. “Re-read after change” is therefore only the local recovery tactic; content-addressed freshness, reviewable staged deltas, and submission binding are the reusable runtime contract.
