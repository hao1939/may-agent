---
title: "LongHorizon-Harness — Fresh Context, Durable Verified State"
source: github
date: 2026-08-04
last_updated: 2026-09-26
type: finding
tags: [github, long-horizon-agents, harness, verification, state-management, computer-use, coding-agents]
relevance: high
---

# LongHorizon-Harness

## Overview

- **Repo:** [AMAP-ML/LongHorizon-Harness](https://github.com/AMAP-ML/LongHorizon-Harness) (518★ at the 2026-08-10 check, created 2026-08-04)
- **Author:** AMAP-ML
- **Language:** Python
- **License:** MIT
- **What:** A harness layer for long-horizon computer-use and coding agents that separates management, execution, and auditing while preserving only independently verified progress across rounds.

## Core Pattern

LongHorizon-Harness treats the long-horizon problem as a **state-governance problem**, not just a bigger-context problem.

The repo's central design is a three-role loop:

| Role | Responsibility |
|---|---|
| **Manager** | Keeps the original goal, verified progress, and next step |
| **Executor** | Starts each round with a fresh context and performs one bounded task |
| **Auditor** | Independently checks files, interfaces, logs, and tests in the live environment |

Only results that pass auditing are written into persistent task state. Failed attempts, context resets, or partial work do not overwrite previously verified progress.

## Key Design Signals

1. **Fresh-context execution is deliberate, not a limitation.** The executor is restarted with a narrow task and fresh context each round. The persistent object is not the chat transcript but the verified task state.

2. **Verification is an architectural boundary.** The auditor is a first-class role, not a post-hoc utility. This turns "done" into a state transition backed by environment evidence.

3. **GUI and CLI are treated as one workflow surface.** The same run can move across browser work, desktop applications, terminal commands, and artifact verification while remaining under one state machine.

4. **Runs are preserved as auditable records.** Each run stores task state, event stream, audit reports, role trajectories, workspace artifacts, and final report under an isolated run directory.

5. **The harness claims model-invariant gains.** README benchmark tables hold backbone and execution backend fixed, then attribute performance gains to the harness layer itself: WeaveBench 51.8% → 80.7%, OSWorld 2.0 binary 2.8 → 8.3, Terminal-Bench 2.1 success 69.7% → 77.2% with 24% fewer tokens.

## 2026-08-10 Update — Evaluation Code Is Not the Original Experiment

Commit [`f023e51`](https://github.com/AMAP-ML/LongHorizon-Harness/commit/f023e5141083bdb5571739efc00dc57602630f78) added a checked-in Terminal-Bench 2.1 harness, including the Harbor adapter, orchestrator, verifier, launch script, and a concrete experiment configuration. The config makes important conditions inspectable: three attempts per task, 16 concurrent trials, 25 orchestration rounds, Qwen3.7-Plus for both harness and verifier roles, Claude Code 2.1.176, and explicit execution and role timeouts. The verifier code also detects task-workspace mutations during its nominally read-only window, while the orchestrator refuses completion without a previous clean verifier report.

This materially improves **procedural inspectability**, but it does not reproduce the published result by itself. The repository omits the Terminal-Bench task dataset, and its own evaluation README says that the original experiment's code and prompts were lost and that the checked-in version is a best-effort reconstruction whose performance may differ. Therefore the 69.7% → 77.2% and 24%-token-reduction figures should remain labeled **author-reported**, not independently reproducible from this commit. The useful distinction is: releasing a runnable recipe exposes evaluation conditions, but provenance continuity from the reported run requires the exact original code/prompts plus result artifacts or hashes.

## 2026-08-26 Update — Audit Independence Needs Revision Binding, Not Just a Fresh Context

A second long-running Pi harness, [`DraconDev/pi-goal-list-loop-audit`](https://github.com/DraconDev/pi-goal-list-loop-audit), makes a narrower implementation detail explicit: an independent verdict is valid only for the contract revision it inspected. Its goal state carries a revision counter that advances on contract changes; the detached worker echoes the revision captured at dispatch; and the parent refuses a late verdict when the live goal has moved. Tests also cover the complementary completion gate: a prior approval cannot authorize completion after the contract revision changes.

This sharpens LongHorizon-Harness's verified-state pattern. Separating executor and auditor contexts addresses conversational anchoring, but it does not by itself prevent a correct verdict from being attached to the wrong version of the task. A robust acceptance transition therefore needs at least a three-part binding:

1. **claim identity** — which completion attempt is being judged;
2. **contract revision** — which objective and acceptance criteria were inspected;
3. **evidence** — what checks support the verdict.

GLLA also documents an important boundary that “independent auditor” can otherwise obscure. Its worker starts in a fresh, extension-less Pi process, yet deliberately retains `bash` alongside read/search tools so it can execute tests. The code calls this a power-oriented mode rather than a read-only security boundary. Fresh model context therefore reduces implementer-context leakage; it does **not** provide OS-level isolation or guarantee a non-mutating verifier. Process separation, verdict freshness, and capability containment are three different controls.

This is implementation evidence, not a comparative reliability result. At inspection the repository had 15 stars, and no benchmark establishes that its auditor improves task success. Its value is the concrete revision-bound protocol, tests, and explicit non-sandbox caveat.

## 2026-08-26 Update — Verification Must Be Rebound After Integration and Unblocking

[`forcewake/hermes-conductor`](https://github.com/forcewake/hermes-conductor) adds a temporal dimension to revision-bound auditing: evidence can be correctly bound to a lane commit and still be stale for the state that is about to be promoted. Its controller-managed worktree pattern requires the controller—not the worker—to inspect the lane's Git state, run targeted gates there, integrate the candidate into the canonical branch, and then rerun canonical gates before completing the card. The finalization pattern similarly binds the handoff to the integrated commit, verifies the pushed remote ref by reading it back, and checks that no child remains active before closing the epic.

The most useful failure case is dependency-driven auto-promotion. A downstream card may become runnable when its dependency completes even though its existing worktree still points at an older base. The playbook says to reclaim or block the card, inspect every worktree head and status, treat the old checkout only as an untrusted reference, and recreate the lane from the verified canonical branch. This distinguishes three freshness questions that a single “tests passed” receipt cannot answer:

1. **subject freshness** — did the verifier inspect the exact candidate revision?
2. **base freshness** — was that candidate built against the dependency state now in force?
3. **integration freshness** — did the checks still pass after the candidate entered the canonical composition and remote handoff state?

This extends the claim–contract–evidence binding above into a **claim–contract–candidate–base–integration** binding. Worktree isolation prevents concurrent mutation, but it does not make lane evidence portable across a changed base or prove the integrated branch. Dependency completion should therefore trigger re-admission of the downstream workspace, not merely a scheduler status flip, and promotion receipts should name both the tested lane commit and the canonically tested integration commit.

The evidence is an early, documentation-only practitioner signal. The repository had 65 stars at observation, was created on 2026-08-23, and its tree contains playbooks, skills, examples, and demo assets but no executable test suite that independently enforces these rules. Its README says the patterns arose from 18 boards and production incidents, but the repository does not publish those incident records or comparative failure rates. The value is the explicit recovery contract, not a demonstrated reliability gain.

## 2026-09-26 Update — Completion Is a Recoverable Settlement, Not a Status Label

A later GLLA revision, [`72a848d`](https://github.com/DraconDev/pi-goal-list-loop-audit/tree/72a848d36e5e3fbfac4a193bff99bc7bd1231631), extends revision-bound auditing across the crash window between **approval** and **publication of completion**. Its lifecycle projection distinguishes `starting`, `running`, `settling`, `recovery-needed`, and `retry-waiting`; importantly, `approved` is not a persisted claim phase. It is returned only after the archive has landed and the summary has been queued. Legacy or unknown phases normalize to recovery-needed rather than completion.

The settlement driver enforces a useful write order: persist the approval verdict and a `settling` claim, attempt the archive, then admit terminal rendering. If archiving fails, the approved claim remains durable with a named recovery reason. On restart or explicit resume, the system re-drives the owed archive without asking another auditor to reassess already-approved work. This preserves both sides of the boundary: no success card before the terminal artifact exists, and no needless second verdict after the first one is durably recorded.

Repository tests encode the main failure cases. A cold reload parks an orphaned running claim without archiving it; a settling claim resumes without an `audit_started` event; repeated contacts produce one summary; and a refused archive retains the attempt identity while emitting no terminal success. The retention tests separately refuse to delete lockless unfinished or corrupt job directories because their liveness is ambiguous, while allowing cleanup when death is evidenced. Together these behaviors suggest a broader rule: **terminality should be derived from a re-drivable settlement receipt, not from an in-memory status transition or an evaluator's approval alone**.

This is static implementation evidence from a fast-moving repository (25 stars in the current search result). Scout inspected the pinned lifecycle module, cold-restart and retention tests, package scripts, and the repository's own audit report, but did not run its reported 2,347-test fast suite, slow suite, TypeScript check, packaging checks, or a live auditor. The repository's audit report is therefore supporting author evidence, not an independent reproduction.

## Why This Matters

1. **Long-horizon reliability is moving out of the model and into the harness.** This repo argues that progress persistence, auditability, and recoverability matter more than carrying one swollen context window for hours.

2. **Verified state is becoming the real memory primitive.** The durable object is a compact record of accepted progress, not raw conversational history. That aligns with the broader bounded-memory and externalized-state trend already visible across Scout's library.

3. **Independent auditing is being productized as a default loop component.** The important shift is not merely "add a reviewer" but "separate execution rights from acceptance rights."

4. **Computer-use and coding-use are converging operationally.** The harness does not split GUI agents and coding agents into separate categories; it treats them as different interfaces for the same long-running task.

## Connections to Library Themes

- **Agent evaluation:** the repo sits between benchmark and runtime, because it bakes verification and replayability into the execution loop itself.
- **Externalized state:** reinforces the pattern that durable progress should live outside any single model context.
- **Process discipline:** completion depends on explicit manage → execute → audit rounds rather than a monolithic autonomous session.
- **Harness-first gains:** another signal that large performance deltas can come from scaffolding and state control rather than a new frontier model.

## Sources

- **Repo:** https://github.com/AMAP-ML/LongHorizon-Harness
- **README:** https://raw.githubusercontent.com/AMAP-ML/LongHorizon-Harness/main/README.md
- **GitHub API metadata:** https://api.github.com/repos/AMAP-ML/LongHorizon-Harness
- **Terminal-Bench evaluation README:** https://github.com/AMAP-ML/LongHorizon-Harness/blob/main/eval/TB-harness/README.md
- **Terminal-Bench harness commit:** https://github.com/AMAP-ML/LongHorizon-Harness/commit/f023e5141083bdb5571739efc00dc57602630f78
- **Terminal-Bench experiment config:** https://github.com/AMAP-ML/LongHorizon-Harness/blob/main/eval/TB-harness/Scripts/tbench21_full_cua_harness_claudecode_qwen37_enable_thinking.yaml
- **Repo:** https://github.com/DraconDev/pi-goal-list-loop-audit
- **README at inspected revision:** https://github.com/DraconDev/pi-goal-list-loop-audit/blob/a8777ebbda5ad3a3407d5f2b1a6f52943684e2bb/README.md
- **Detached auditor process:** https://github.com/DraconDev/pi-goal-list-loop-audit/blob/6c4971c0cb0906b2188910c1d9978b372072620c/extensions/goal-loop-auditor-process.ts
- **Revision-bound audit tests:** https://github.com/DraconDev/pi-goal-list-loop-audit/blob/553d28ef31c023d0a42df818a1bdccb86adbbd27/tests/revision-bound-audit.test.ts
- **GLLA follow-up revision:** https://github.com/DraconDev/pi-goal-list-loop-audit/tree/72a848d36e5e3fbfac4a193bff99bc7bd1231631
- **Detached audit lifecycle:** https://github.com/DraconDev/pi-goal-list-loop-audit/blob/72a848d36e5e3fbfac4a193bff99bc7bd1231631/extensions/audit-lifecycle.ts
- **Cold-restart settlement tests:** https://github.com/DraconDev/pi-goal-list-loop-audit/blob/72a848d36e5e3fbfac4a193bff99bc7bd1231631/tests/audit-settlement-restart.test.ts
- **Audit-job retention tests:** https://github.com/DraconDev/pi-goal-list-loop-audit/blob/72a848d36e5e3fbfac4a193bff99bc7bd1231631/tests/audit-job-retention.test.ts
- **Repository audit report:** https://github.com/DraconDev/pi-goal-list-loop-audit/blob/72a848d36e5e3fbfac4a193bff99bc7bd1231631/audit/DETACHED-AUDIT-LIFECYCLE-2026-09-25.md
- **Hermes Conductor repo at inspected revision:** https://github.com/forcewake/hermes-conductor/commit/ab0d8eab0301b3f18e6977416d080d5fa574f169
- **Controller-managed worktree lanes:** https://github.com/forcewake/hermes-conductor/blob/ab0d8eab0301b3f18e6977416d080d5fa574f169/patterns/01-controller-managed-external-worktree-lanes.md
- **Workspace isolation and recovery:** https://github.com/forcewake/hermes-conductor/blob/ab0d8eab0301b3f18e6977416d080d5fa574f169/patterns/02-workspace-isolation.md
- **Controller-sequential finalization:** https://github.com/forcewake/hermes-conductor/blob/ab0d8eab0301b3f18e6977416d080d5fa574f169/patterns/04-controller-sequential-epic-finalization.md
- **GitHub API metadata:** https://api.github.com/repos/forcewake/hermes-conductor
