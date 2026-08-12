---
title: "LongHorizon-Harness — Fresh Context, Durable Verified State"
source: github
date: 2026-08-04
last_updated: 2026-08-10
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
