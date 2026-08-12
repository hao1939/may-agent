---
title: "CEE — Deterministic State Machines Reclaim Agent Workflow Control"
source: github
date: 2026-08-04
last_updated: 2026-08-04
type: finding
tags: [github, agent-workflows, deterministic-orchestration, state-machines, verification, plugins, control-plane]
relevance: high
---

# CEE — Cognitive Execution Engine

## Overview

- **Repo:** [p0nymc1/cee](https://github.com/p0nymc1/cee) (69★, created 2026-07-29)
- **Author:** p0nymc1
- **Language:** Go
- **License:** Apache-2.0
- **What:** A deterministic-first execution engine for agent workflows where the LLM is constrained to schema-clipped extraction at the edge while a declared state machine owns branching, retries, suspension, compensation, and approval flow.

## Core Signal

CEE makes an unusually strong architectural move: **the model is not the orchestrator**.

The README explicitly splits responsibilities this way:

| Layer | Role |
|---|---|
| **`llminjector`** | Turn free text into structured fields only |
| **`intentrouter`** | Map requests to pre-registered intents and explicitly return unmatched cases |
| **`execution`** | Walk a deterministic DAG with breakers, suspend/resume, compensation, fan-out/fan-in |
| **`sandbox`** | Rehearse side-effecting steps with read-only/simulated probes before execution |
| **`manifest` + `stdlib`** | Define no-code JSON plugins and standard actions such as `std.require`, `std.suspend`, and `std.require_verified` |

The repo's own invariant is the key detail: the LLM "makes no flow decisions." That is a stronger claim than typical harnesses that still let the model choose when to branch, retry, or commit.

## Concrete Design Details

1. **Workflow control is compiled into manifests.** L1 plugins are pure JSON DAGs using a standard action library; L2 plugins can attach named Go hooks, but the engine still owns execution semantics.

2. **Verification is embedded in the runtime surface.** The standard library includes `std.require_verified`, side effects can be probe-gated before execution, and every run emits a scorecard rather than just a success string.

3. **Rule changes are replayable.** The `examples/rule_change` path replays past decisions against a changed rule and reports which outcomes flip. That turns policy drift into something inspectable rather than anecdotal.

4. **The repo measures model avoidance, not just model usage.** `cee bench` produces a plugin leaderboard ranked by model calls eliminated. The optimization target is how much decision traffic can be removed from the LLM path.

5. **Heavyweight isolation is modularized away from the core.** Docker, remote HTTP sandboxing, and WASM hooks live in separate `satellites/` modules so the execution core stays zero-dependency and offline-buildable.

## Why This Matters

1. **Decision authority is moving out of prompts and into executable workflow contracts.** CEE treats branching logic as software, not as a behavior you keep re-explaining to a model.

2. **This is the open-source form of the compilation-threshold thesis.** Instead of letting the LLM repeatedly decide routine control-flow questions, the repo compiles those decisions into manifests, breakers, and verified gates.

3. **"Agent workflow" is bifurcating into semantic extraction vs. deterministic control.** That split is important because it preserves LLM flexibility where ambiguity is real, while forcing repeatable handling of approvals, thresholds, and recovery paths.

4. **Benchmarks are starting to reward subtraction.** Ranking plugins by model calls eliminated suggests the ecosystem is beginning to treat removed reasoning as a capability gain rather than a limitation.

## Connections to Library Themes

- **Compilation Threshold:** CEE is a direct practitioner implementation of compiling below-threshold decisions into deterministic checks.
- **Harness engineering:** the value is not a smarter base model but a stricter execution envelope around it.
- **Verification inversion:** correctness is increasingly expressed as gates, probes, and scorecards in the runtime rather than as trust in narrative reasoning.
- **Governance compilation gradient:** approvals, rule checks, and branch conditions become manifest-level control artifacts.

## Sources

- **Repo:** https://github.com/p0nymc1/cee
- **README:** https://raw.githubusercontent.com/p0nymc1/cee/main/README.md
- **GitHub API metadata:** https://api.github.com/repos/p0nymc1/cee
