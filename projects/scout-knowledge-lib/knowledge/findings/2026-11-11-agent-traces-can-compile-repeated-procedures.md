<ai_context>
summary: "ReTrace reports compiling an SOP plus a few logged agent runs into planner-free executable workflows by extracting decision conditions from the agent's tool-call explanations. Across three evaluation sets, the compiled workflows trade a small initial success gap for much lower latency and cost, while labeled-failure repair can close or reverse that gap; the evidence supports compilation for repeated stable procedures, not removing agents from novel or changing work."
triggers: ["agent workflow compilation", "ReTrace", "planner-free workflows", "SOP automation", "agent trace distillation", "repeated procedures"]
last_updated: "2026-11-11"
source_basis: "arXiv:2611.14492v1 title, metadata, and abstract retrieved through the workflow-owned cs.AI feed request. Scout did not inspect the full paper, platform, procedures, logged runs, rule documents, generated code, repair process, benchmark configuration, trajectories, cost model, or artifacts."
</ai_context>

# Agent traces can compile repeated procedures

**Date:** 2026-11-11  
**Source:** [ReTrace: Distilling Tool-Using Agents into Planner-Free Workflows](https://arxiv.org/abs/2611.14492v1)  
**Source revision:** arXiv:2611.14492v1  
**Coverage:** Title, metadata, and abstract only  
**Disposition:** New knowledge

## Question

When a tool-using agent repeatedly executes the same standard operating procedure, can its successful traces be converted into a cheaper deterministic workflow without losing too much task performance?

## What the abstract reports

ReTrace takes a natural-language SOP and a small number of logged agent runs and produces a reusable workflow where code, rather than an LLM planner, chooses the next step. The reported method relies on the explanations attached to tool calls: those explanations often state the condition that caused an action, while the tool-call sequence alone does not. ReTrace extracts these conditions, merges them across runs into a compact rule document, and compiles that document into a platform-specific executable workflow.

The abstract reports results on three sets of procedures:

- On **79 procedures** from the authors' production platform, ReTrace workflows reached **93.8% completion**, versus **96.8%** for the agent, at **24% lower cost per task**.
- On **tau-squared-Bench**, ReTrace reached **75.8% task success**, versus **80.6%** for the agent, and ran in **1.3 seconds rather than 170 seconds**. Three repair rounds using labeled training failures raised the reported success of workflows generated from two examples from **66.7% to 81.2%**.
- On **eight SOP-Bench procedures**, unrepaired ReTrace reached **80.6%**, versus **83.6%** for few-shot workflow generation. Repair from labeled training failures raised it to **87.8% at 0.40 seconds per task**, compared with **85.5% in 46.6 seconds** for the agent.

The abstract therefore presents workflow compilation as an optimization for repeated procedures, with observed quality depending materially on failure-driven repair rather than on one-shot trace extraction alone.

## Scout interpretation

The useful architectural pattern is **progressive specialization**. An agent is valuable while a procedure is being interpreted, explored, or repaired. Once repeated executions expose stable decision conditions, those conditions can become an inspectable intermediate rule document and then executable code. This moves routine branch selection out of the model loop while retaining traces as evidence for how the workflow was derived.

The intermediate rule document matters as much as the speedup. It creates a review boundary between model-authored explanations and generated executable behavior. A robust implementation should bind that document to:

1. the exact SOP revision;
2. the source trace identities and outcomes;
3. the tool schemas and effect contracts used by those traces;
4. labeled failures used during repair; and
5. the compiler and target orchestration platform version.

Without those bindings, a fast compiled workflow may faithfully automate stale assumptions. The abstract's repair gains also imply that success traces alone are not a sufficient specification: failure examples reveal missing conditions and unsafe branch boundaries.

For May-like agent infrastructure, the promising application is not to replace general Task judgment with generated code. It is to identify **high-volume, stable, low-ambiguity procedure segments**—for example deterministic validation, evidence packaging, or known recovery checks—and evaluate whether accepted traces can compile those segments into versioned workflows. The agent should remain the fallback for unknown states, changed contracts, and repair. Admission should compare the compiled workflow with the agent on task success, incorrect effects, refusal behavior, latency, cost, and recovery under held-out failures.

This complements [Procedure fidelity needs runtime state enforcement](./2026-11-10-procedure-fidelity-needs-runtime-state-enforcement.md). That finding concerns enforcing an already specified procedure at runtime; ReTrace instead concerns deriving an executable procedure from an SOP and observed agent behavior. Compilation and enforcement are separate evidence boundaries: the runtime can perfectly enforce a wrongly inferred rule set.

## Retrieval record

The workflow-owned bounded request checked:

- **Endpoint:** `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`
- **HTTP status:** 200
- **Latency:** 290 ms
- **Request count:** 1
- **Retry-After:** not present

## Evidence limits

Scout reviewed only the arXiv feed's title, metadata, and abstract. The full paper, production platform, SOP selection, procedure complexity, source-trace count and quality, explanation prompts, condition extraction, rule merging, generated workflow code, repair algorithm, train/test boundaries, benchmark setup, baselines, graders, statistical uncertainty, tool effects, failure severity, latency environment, cost accounting, and released artifacts were not inspected.

Completion or task-success rates do not show whether failures were harmless, recoverable, or effectful. The abstract does not establish how the system detects an out-of-distribution state, invalidates a workflow after an SOP or tool change, prevents unsafe rules from compiling, or routes uncertain cases back to an agent or human. Results from 79 platform procedures and two benchmarks do not prove that arbitrary agent traces are compilable or that the reported savings survive workflow authoring, review, monitoring, repair, and lifecycle costs.
