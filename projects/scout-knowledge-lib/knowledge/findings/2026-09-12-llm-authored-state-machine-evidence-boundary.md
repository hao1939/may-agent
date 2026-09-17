<ai_context>
This finding records a September 2026 HN implementation signal about LLM-authored state machines for coding agents. The durable point is the separation of model claims, runtime measurements, and deterministic derivations—not a claim that the new project is production-proven. Re-check the pinned repository revision before relying on later behavior.
</ai_context>

---
title: "Orcrist — LLM-Authored State Machines Need an Evidence-Authoring Boundary"
source: hn
date: 2026-09-12
last_updated: 2026-09-12
type: finding
tags: [hn, coding-agents, state-machines, verification, evidence, tool-restriction]
relevance: high
---

# Orcrist — LLM-Authored State Machines Need an Evidence-Authoring Boundary

## Source signal

HN item [49673528](https://news.ycombinator.com/item?id=49673528) surfaced [simone20a/Orcrist](https://github.com/simone20a/Orcrist), a desktop coding agent and DSL in which one model authors a task-specific state machine before an execution model runs it. This note inspected repository revision [`8342e26`](https://github.com/simone20a/Orcrist/commit/8342e26cde87bed0f9ccfaeb506f65b37493d0ce). The submission had one point and no comments when checked, so the useful evidence is the repository implementation rather than HN endorsement.

## Concrete implementation signal

Orcrist makes three kinds of state explicit:

| State owner | How it is written | What a guard actually tests |
|---|---|---|
| `agent` | execution model reports through a typed tool | the model's claim |
| `observed` | runtime executes a declared command | the command's result |
| assignable | runtime evaluates a pure `set` expression | a deterministic derivation from current store values |

This is more useful than merely putting control flow in a graph. The validator warns when a guard or invariant reads agent-owned data, rejects ownership/type violations, checks reachability and paths to final states, and requires every detected cycle to have a visit limit. At execution time, a state can receive a narrowed tool set; measurement commands run after the state's model turn; and guards are evaluated over the resulting store. A failed measurement uses its declared fallback rather than leaving a stale value in place.

The repository's self-test encodes the central adversarial case: a mock model always claims that tests pass, while an `observed` value reads the workspace and sends the machine through repair until the measured failure count reaches zero. The same suite includes parser/validator rejection cases, tool restriction, cancellation propagation, and an end-to-end mock-provider run. These are checked-in tests; Scout inspected them but did not execute them.

## New boundary: evidence quality is authored, not automatic

The state machine moves branch execution out of the LLM, but it does **not** automatically move evidence design out of it. The authoring model chooses:

- which values are claims versus measurements;
- the shell command and regex that produce an observation;
- pessimistic fallback values;
- retry limits and escalation outcomes; and
- which tools each execution state receives.

The runtime can prove that a graph is typed, bounded, reachable, and syntactically measurable. It cannot prove that `grep -c '^not ok'` is a sound test oracle for the repository, that a chosen bound is appropriate, or that the measurement command has no misleading blind spot. Orcrist acknowledges this by showing newly authored or revised machines for human approval and exposing each state's prompt, writes, assignments, and guards. The approval can be disabled, however, and unchanged machines are reused without another gate.

The reusable design rule is therefore:

> A deterministic state machine converts an authored evidence policy into repeatable execution; it does not establish that the evidence policy is sound.

For high-consequence workflows, validate the **measurement authoring layer** separately: review command semantics, prove failure-safe fallbacks, test the oracle against known-pass and known-fail fixtures, and version approval with the machine and relevant workspace/tool configuration.

## Scope and limitations

- This is a newly created repository with no stars, forks, released benchmark, or independent deployment evidence at the checked revision.
- The validator's overlap check catches identical guards, not all simultaneously true guards; the project documents this as a heuristic limitation.
- Documentation says shell commands are sandboxed to the workspace, but the inspected shell implementation sets the workspace as `cwd` and applies a configurable substring blocklist. Its filesystem tools perform explicit path confinement; the cited source does not establish equivalent OS-level confinement for arbitrary shell commands. Treat working-directory scoping and shell sandboxing as different claims.
- Human approval mitigates faulty authored evidence only when enabled and when the reviewer can evaluate commands and prompts, not merely the graph shape.

## Relationship to prior library signals

Prior findings such as [CEE](./2026-08-04-github-cee-deterministic-agent-workflows.md) show deterministic runtimes reclaiming retries and branching from models. Orcrist adds a sharper epistemic distinction inside that runtime: claim, observation, and derivation are different data classes. It also exposes the next governance layer—who is trusted to define what an observation proves.

## Sources

- **Source:** https://news.ycombinator.com/item?id=49673528
- **Repo:** https://github.com/simone20a/Orcrist
- **Pinned revision:** https://github.com/simone20a/Orcrist/commit/8342e26cde87bed0f9ccfaeb506f65b37493d0ce
- **Architecture:** https://github.com/simone20a/Orcrist/blob/8342e26cde87bed0f9ccfaeb506f65b37493d0ce/docs/how-it-works.md
- **Authoring guide:** https://github.com/simone20a/Orcrist/blob/8342e26cde87bed0f9ccfaeb506f65b37493d0ce/metamodel/authoring-guide.md
- **Validator:** https://github.com/simone20a/Orcrist/blob/8342e26cde87bed0f9ccfaeb506f65b37493d0ce/src/orcrist/validator.ts
- **Executor:** https://github.com/simone20a/Orcrist/blob/8342e26cde87bed0f9ccfaeb506f65b37493d0ce/src/core/executor.ts
- **Tool implementation:** https://github.com/simone20a/Orcrist/blob/8342e26cde87bed0f9ccfaeb506f65b37493d0ce/src/core/tools/index.ts
- **Self-test:** https://github.com/simone20a/Orcrist/blob/8342e26cde87bed0f9ccfaeb506f65b37493d0ce/scripts/selftest.ts
