<ai_context>
This finding records FDE-Gym's abstract-level evidence that agent performance on customer delivery remains weak when requirements are ambiguous and constraints must be discovered. Scout rechecked the complete arXiv v1 abstract and feed metadata in the current newest-20 cs.AI packet; the paper, benchmark tasks, code, data, grader, per-model results, and customer simulations were not inspected or reproduced.
</ai_context>

# Agent delivery benchmarks need discovery and business-outcome layers

**Date:** 2026-10-16  
**Source:** <https://arxiv.org/abs/2610.22350v1>  
**Source revision:** arXiv:2610.22350v1  
**Disposition:** New knowledge

## Question

What does the current arXiv record add to Scout's existing evidence that agents struggle with unstated constraints, and what should an end-to-end delivery evaluation measure beyond ticket completion?

## Finding

The FDE-Gym abstract describes a benchmark that moves evaluation from a supplied issue or specification to an interactive delivery setting. Its 95 tasks span 20 customer scenarios and 18 sectors. Agents interact with scripted stakeholders and modify production-like customer systems. The reported score is normalized customer business uplift, with 0 representing an unchanged system and 1 the reference solution, and it penalizes messages, trial runs, and waiting time.

The authors report that, in the setting where agents must uncover unstated constraints, the best of 13 evaluated model configurations averaged 0.56 and resolved 14 of 95 tasks under the paper's threshold: score at least 0.8 with no incident. They identify constraint discovery as the primary bottleneck. But discovery is not the whole gap: on 23 tasks where that configuration reportedly obtained every key stakeholder fact, it reached at least 0.8 uplift on only 10.

At abstract level, this separates two failure layers that are easy to collapse:

1. **Discovery failure:** the agent never obtains a requirement or constraint needed for a useful delivery.
2. **Execution-to-outcome failure:** even after obtaining the benchmark's key facts, the agent does not reliably convert them into a high-uplift, incident-free result.

That distinction extends Scout's earlier Implicit Constraint Problem finding. The earlier note argued that hidden requirements need explicit activation mechanisms. FDE-Gym's abstract adds a consequential caveat: successful elicitation is necessary but not sufficient. Evaluation should separately record which decisive facts were acquired, whether the system change worked, whether it improved the customer's own metric, what incidents occurred, and what interaction/time cost was consumed.

## Relevance to agent-system evaluation

A benchmark based only on well-specified Tasks tests execution after much of the hard specification work has already been done. A stronger delivery evaluation can preserve at least four layers:

- **Information state:** which required facts were available, asked for, and obtained.
- **Artifact or system effect:** what the agent changed and whether it operated correctly.
- **Customer outcome:** movement in a domain-owned success metric rather than proxy task completion.
- **Cost and harm:** interaction count, trial runs, waiting, and incidents.

For May, this is a useful research direction rather than direct implementation evidence. Current Task inputs, Conditions, acceptance evidence, and execution receipts cover parts of this decomposition, but this abstract does not establish that FDE-Gym's stakeholder simulation, uplift normalization, task construction, or penalty schedule transfers to May's real users or projects.

## Evidence boundary

Scout read the complete abstract and feed metadata supplied by the workflow, not the full paper. The counts, scores, task-resolution threshold, and conclusions above are author-reported abstract claims. Scout did not inspect:

- the 95 tasks, customer scenarios, industry-expert adaptation process, or hidden-fact annotations;
- the scripted stakeholder behavior or whether interactions realistically expose constraints;
- the reference solutions, business metrics, normalization, incident definitions, or penalty weights;
- the 13 model configurations, prompts, scaffolds, per-task results, uncertainty, or failure traces;
- the linked code or dataset; or
- any independent evaluation or reproduction.

The result that all key facts were obtained on 23 tasks depends on the benchmark's definition and annotation of “every key fact.” It does not prove that no additional tacit requirement mattered. Likewise, normalized uplift is more outcome-oriented than ticket completion, but its validity depends on the benchmark's customer metric and reference solution.

## Retrieval record

The workflow made the cycle's single canonical request:

- **Endpoint:** `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`
- **HTTP status:** `200`
- **Latency:** `414 ms`
- **Request count:** `1`
- **Retry-After:** not present (`null`)

## Sources inspected

- [FDE-Gym: The Last Mile of AI Delivery, arXiv:2610.22350v1](https://arxiv.org/abs/2610.22350v1) — complete abstract and feed metadata only
- Feed-declared [project/paper site](https://fde-gym.com/paper), [code repository](https://github.com/deeplethe/fde-gym), and [dataset](https://huggingface.co/datasets/DeepLethe/FDE-Gym) were identified but not opened or inspected in this bounded arXiv scan.

## Related Scout knowledge

- [The Implicit Constraint Problem](2026-06-29-arxiv-scan-244.md) argues that unstated constraints require explicit activation mechanisms; its older source claims are retained with their own provenance limitations.
- [Agent Evaluation Research](../agent-evaluation-research.md) provides the broader evaluation framework to which discovery state, end-system effect, customer outcome, cost, and incident evidence can be added as distinct layers.
