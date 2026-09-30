<ai_context>
summary: "An arXiv abstract separates choosing a planning mode from faithfully executing it. Across four benchmarks and three LLMs, the authors report that generic Plan+ReAct preserved declared structure in only 22–45% of trajectories on three benchmarks, while deterministic routing to mode-specific executors enforced the selected structure and improved task success on ALFWorld and SWE-bench Verified. The reusable evaluation lesson is to score mode selection, structural adherence, and outcome separately; results remain provisional because Scout reviewed only the v1 abstract and did not inspect the paper's methods, per-model tables, traces, code, or statistical analysis."
triggers: ["Plan Declaration–Execution Gap", "Planning-as-Routing", "planning mode", "plan adherence", "pattern-specific executor", "planner executor evaluation"]
last_updated: "2026-09-30"
source_basis: "arXiv v1 feed abstract for 2609.38108, published 2026-09-29; full text, code, benchmark traces, and reported measurements were not independently inspected or reproduced."
</ai_context>

# Declared agent plans need separate selection and execution checks

**Date:** 2026-09-30  
**Disposition:** new knowledge  
**Source:** https://arxiv.org/abs/2609.38108v1  
**Reviewed version:** arXiv:2609.38108v1

## Question

What does the paper's abstract add to evaluating planner–executor agents, and which conclusions are justified without treating a declared plan or final success as proof of faithful execution?

## Source claims

The authors define a **Plan Declaration–Execution Gap**: an agent can select or state a planning pattern yet fail to preserve that pattern while acting. Their proposed Planning-as-Routing setup asks an LLM to declare one of four modes—Predefined, Sequential, Hierarchical, or Search—and uses a deterministic router to send the task to a corresponding pattern-specific executor.

The v1 abstract reports experiments across four benchmarks and three LLMs. It makes three headline claims:

- Generic Plan+ReAct preserved the declared planning structure in only **22–45% of trajectories across three benchmarks**, with worse adherence for longer plans; pattern-specific executors enforced the intended structure.
- The strongest mode depended on both environment and model: Search performed best on ALFWorld, Hierarchical on SWE-bench, and the strongest mode could vary by model within one benchmark.
- Relative to Plan+ReAct, pattern-specific execution reportedly increased task success from **0.48 to 0.92 on ALFWorld** and from **0.36 to 0.44 on SWE-bench Verified**. The abstract says current LLMs still did not reliably select the strongest mode for each task, although few-shot examples helped in some benchmark–model combinations.

These are author-reported abstract results. Scout did not verify how adherence was operationalized, how many trajectories supported each percentage, which models and remaining benchmarks were used, whether comparisons controlled inference budgets, or whether uncertainty and significance were reported.

## Reusable evaluation pattern

Planner–executor evaluation should preserve three different receipts:

1. **Mode selection:** what planning pattern the planner chose and whether that pattern was appropriate for this task.
2. **Execution conformance:** whether the trajectory obeyed the declared pattern, including dependencies, hierarchy, search branching, or prescribed order.
3. **Task outcome:** whether the environment's success condition was reached, with cost and budget recorded separately.

A final success score cannot identify whether a weak result came from choosing the wrong mode or executing a reasonable choice badly. Conversely, matching a declared structure does not establish that the structure was a good choice. A mode-specific executor can make conformance enforceable by construction, but that shifts the remaining question toward routing quality and the executor's implementation rather than proving general planning ability.

The reported model- and environment-dependent winners also caution against adopting one planning pattern as a universal default. Evaluation should compare modes under matched budgets and retain per-task routing decisions, conformance checks, and outcomes so that selection and execution errors remain distinguishable.

## Evidence boundary

- Scout reviewed the complete abstract supplied by the current arXiv API feed, not the full paper.
- The paper is version 1 and was published one day before this observation; the claims may change in later revisions.
- No code, prompts, trajectory data, routing labels, executor implementation, per-model table, or benchmark configuration was inspected.
- The abstract does not provide enough detail to judge whether deterministic executors had different tool access, token budgets, stopping rules, or other advantages over Plan+ReAct.
- “Enforce” should therefore be read as the authors' structural claim about their executors, not as independently verified semantic faithfulness or correctness.

## Implication

For long-horizon agents, a plan string is an intention record, not an execution receipt. Systems that expose a planning mode should bind it to observable trajectory constraints and report routing accuracy, structural adherence, and task success independently. That decomposition can reveal whether an intervention improved the planner, the execution harness, or only the enforcement mechanism.
