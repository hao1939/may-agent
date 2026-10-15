<ai_context>
summary: "LAGO evaluates a meta-agent that retrieves or spawns verified agent-options from a persistent library; current results support the architecture as a task-stream hypothesis but do not isolate transferred skill, equalize inference budgets, or establish long-run library health."
triggers: ["reusable agents", "agent options", "agent library", "task decomposition", "LAGO", "SWE-bench"]
last_updated: "2026-10-15"
source_basis: "Full reading of arXiv:2610.19843v1 (16-page preprint) retrieved from arXiv on 2026-10-15; results and limitations are author-reported and were not reproduced by Scout."
</ai_context>

# Reusable agents need admission and retirement, not just retrieval

**Date:** 2026-10-15  
**Disposition:** New knowledge  
**Coverage:** Full 16-page paper, including method, experiments, discussion, limitations, and appendices; no code or experiment reproduction  
**Source:** [LAGO: Language Agents with Reusable Growing Options, arXiv:2610.19843v1](https://arxiv.org/abs/2610.19843v1)  
**Source revision:** 2610.19843v1 (submitted 2026-10-14)

## Question

What does current evidence say about treating specialized language agents as reusable, persistent capabilities across a stream of tasks rather than recreating roles inside every run?

## Source claims and evidence

LAGO models a specialized language agent as an option with four parts: a role and input/output specification, an LLM-tool policy, a termination condition, and a verifier. A meta-agent can use primitive tools, retrieve an existing option, or spawn a new option. Admission requires both task-level verification and novelty; the proposed library also deduplicates similar options, prunes rarely used or regression-failing options, and versions the prompt, tools, model, and verifier.

The authors report:

- **Full SWE-bench Verified:** 293/500 tasks resolved (58.6%) by frozen Qwen3.5-35B-A3B used in both meta-agent and executor roles, with temperature 0, one attempt, and the official Docker evaluator.
- **Controlled 150-task subset:** mini-SWE-agent, Terminus 2, and LAGO resolved 49.3%, 57.3%, and 60.3% using the same model, temperature, task IDs, and evaluator. The paper explicitly says context windows and inference budgets were not equalized, so this compares delivered scaffolds rather than isolating LAGO's mechanism.
- **50-task component ablation:** the full system resolved 30 tasks; disabling decomposition resolved 26, shuffling reused content resolved 28, and disabling the library resolved 24. Approximate 95% binomial intervals are about ±14 percentage points, and unfinished runs count as unresolved.
- **Library activity:** in a separate 150-task rollout seeded with 123 options, the system reports 276 reuses and 51 spawns (84.4% reuse); initial deduplication reduced the library to about 80 options and it ended at 86.

## Interpretation

The reusable unit is stronger than a prompt fragment: it binds an execution contract, tool loop, stopping rule, and verifier. That makes the option library resemble a governed capability registry. The most transferable design signal is therefore not “save successful agents,” but **admit only verified and novel capabilities, pin their execution dependencies, recheck them, and retire them when they stop working**.

The results justify investigating this architecture for recurring task streams. They do not yet show that remembered task-specific skill, rather than generic extra scaffolding or compute, causes the improvement. Retrieval frequency proves that the library is used, not that its retrieved content is valuable. The small shuffled-content effect (two tasks) and larger no-library effect (six tasks) are suggestive but noisy and do not individually isolate spawning, routing, deduplication, or parallel execution.

For systems with durable workers, the paper also sharpens an identity boundary: an agent-option is a reusable implementation of bounded work, not ownership of the parent task. A persistent library should preserve versioned capabilities and evidence without confusing reuse with transfer of task accountability.

## Limitations

- This is a preprint under review; Scout did not reproduce the experiments or inspect an accompanying implementation.
- The 150-task comparison does not equalize context windows or inference budgets, and the full-500 result has no matched comparator reruns.
- The mechanism ablation has only 50 tasks and wide uncertainty; some unfinished rollouts are scored as failures.
- The seed library was built from a disjoint task set, but long-run contamination, distribution shift, verifier generality, and library equilibrium remain unestablished.
- Reported reuse measures retrieval activity. It does not establish causal value, safe specialization, or reliable regression detection.

## Relevance

A practical next experiment for a durable agent platform would compare: (1) dispatch with no reusable capability, (2) retrieval of a version-pinned capability, and (3) retrieval with mismatched or shuffled capability content, while holding model, token budget, tools, verifier, and task set fixed. Measure accepted task outcomes, verification failures, duplicate capability growth, and regressions after dependency changes—not retrieval rate alone.
