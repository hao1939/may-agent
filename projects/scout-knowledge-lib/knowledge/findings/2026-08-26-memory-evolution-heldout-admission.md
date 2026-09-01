---
title: "Recuris — Compile Experience into a Held-Out-Gated Memory Package"
source: github
date: 2026-08-26
last_updated: 2026-08-26
type: finding
tags: [github, long-horizon-agents, memory, recursive-improvement, evaluation, verification]
relevance: high
---

# Recuris — Compile Experience into a Held-Out-Gated Memory Package

## Source signal

- **Repo:** [Gen-Verse/Recuris](https://github.com/Gen-Verse/Recuris) (18 stars at inspection; created 2026-08-25; Apache-2.0)
- **Paper:** [Recursive Experiential–Working Memory Evolution for Long-Horizon Agent Harnesses](https://arxiv.org/abs/2608.24876v1)
- **Inspected revision:** repository tree `11a48fb5e7886a35e38778820e73ff6dffc544bd`

Recuris keeps the downstream agent frozen and recursively changes a separate **Skill Memory** package. Its useful systems contribution is more specific than “agents learn from experience”: experience is compiled into a small, typed, reviewable policy bundle, and a candidate bundle cannot replace the current one merely because a model says the patch looks better.

## The package is a policy surface, not a transcript

Recuris defines memory as `M = (E, W, ρ, C)`:

| Component | Function |
|---|---|
| `E` — experiential memory | sourced knowledge, procedure, and action-result cards |
| `W` — working memory | a bounded ledger of current task state |
| `ρ` — invocation policy | when and which card reaches the agent |
| `C` — checkers | conditions that must hold before a claim can progress |

This decomposition makes failures localizable. A missing card is different from a correct card whose route never fires; a bad task-state update is different from a missing completion check. The repository includes activation probes so a claimed routing fix must demonstrate that its carrier can actually fire.

The working-memory schema also assigns write authority by field. The model may propose descriptions, tools, parameters, and obsolescence, but only the harness can set `DONE` from a real receipt, while `BLOCKED` requires a harness or policy-oracle ruling. Malformed model updates retain the previous ledger rather than erasing it. This is a concrete separation between **intent memory** and **verified outcome state**.

## Improvement is an admission transition

A fixed meta-agent receives sanitized failure evidence and proposes a disposable package patch. Code then checks its schema, scans for obvious answer leakage, probes the prescribed mechanism, evaluates repair, and compares the candidate with the current package on paired held-out items. The current admission function in `src/recuris/metaagent/gates.py` bootstraps over items rather than treating repeated trials for one item as independent; it accepts only when the improvement interval excludes zero and regressions remain under a configured cap.

Two additional controls matter:

1. **Mechanism fingerprinting:** a score increase does not validate the diagnosis unless the prescribed carrier actually fired.
2. **Champion integrity:** accepted packages are content-locked, and the campaign verifies their per-file and aggregate hashes before another round.

The reusable pattern is therefore:

> trace → localized diagnosis → disposable memory patch → mechanism probe → paired held-out gate → content-addressed champion

This is closer to compiling and releasing a policy artifact than to appending a lesson to an ever-growing prompt.

## Reported evidence and limits

The paper and README report improvement in 35 of 37 completed model–benchmark pairs across τ²-Retail, τ²-Airline, SkillFlow, and Terminal-Bench 2.1. The table includes negative or flat cells as well as gains, and marks only a subset of deltas whose paired task-clustered bootstrap interval excludes zero. The repository ships code, frozen splits, package artifacts, benchmark adapters, integrity anchors, and CI checks, which makes the mechanism substantially inspectable.

The headline benchmark values should still be treated as **author-reported**. The inspected tree does not include raw per-episode result logs sufficient to recalculate every table cell, and τ² scoring depends on a pinned LLM user simulator and assertion judge even when the tested agent is open source. The repository also contains an older standalone `metaagent/gate.py` whose CLI can print `ACCEPT` without individual significance, while the campaign architecture and current `gates.py` describe significance as mandatory; consumers should follow the campaign path and verify the exact configuration rather than infer one universal gate from the repo name.

Leak scanning is explicitly syntactic and cannot catch paraphrased held-out answers. A held-out gate reduces overfitting to diagnosed examples but does not prove transfer beyond the benchmark distributions or eliminate repeated researcher degrees of freedom across campaign rounds.

## Implications

1. **Do not let “memory” collapse three authorities.** A model can propose intent, an execution harness can settle objective state, and an admission gate can decide which reusable policy survives. These are different rights.
2. **Test routing, not just content.** A correct lesson that never activates is operationally absent; a score gain without mechanism contact may support the wrong causal story.
3. **Version the learned substrate.** Reproducible self-improvement needs immutable champions, provenance for each card, and disposable candidates—not in-place mutation of one opaque prompt.
4. **Evaluate patches at the unit of independence.** Repeated trials within one task are not independent evidence; admission statistics should resample the task/item unit.
5. **Preserve the distinction between inspectability and reproduction.** Released code and frozen splits expose the method, while raw run artifacts and evaluator provenance are still needed to independently recover the reported numbers.

## Sources

- **Repo:** https://github.com/Gen-Verse/Recuris
- **README:** https://github.com/Gen-Verse/Recuris/blob/11a48fb5e7886a35e38778820e73ff6dffc544bd/README.md
- **Architecture:** https://github.com/Gen-Verse/Recuris/blob/11a48fb5e7886a35e38778820e73ff6dffc544bd/docs/architecture.md
- **Skill Memory format:** https://github.com/Gen-Verse/Recuris/blob/11a48fb5e7886a35e38778820e73ff6dffc544bd/docs/skill-memory-format.md
- **Current paired gate:** https://github.com/Gen-Verse/Recuris/blob/11a48fb5e7886a35e38778820e73ff6dffc544bd/src/recuris/metaagent/gates.py
- **Working-memory authority schema:** https://github.com/Gen-Verse/Recuris/blob/11a48fb5e7886a35e38778820e73ff6dffc544bd/src/recuris/wm/schema.py
- **Champion integrity:** https://github.com/Gen-Verse/Recuris/blob/11a48fb5e7886a35e38778820e73ff6dffc544bd/src/recuris/metaagent/integrity.py
- **Paper:** https://arxiv.org/abs/2608.24876v1
