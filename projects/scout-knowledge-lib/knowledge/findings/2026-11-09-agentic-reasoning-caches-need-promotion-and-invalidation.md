<ai_context>
summary: "CPU-ARC's abstract proposes compiling LLM reasoning traces into explainable, continually trainable CPU-executable caches for repeated mathematical and scientific tasks. The useful systems boundary is not caching alone: a compiled procedure needs source-trace provenance, independent admission, an applicability contract, and invalidation when tasks, tools, or expected outputs change."
triggers: ["CPU-ARC", "agentic reasoning caching", "reasoning reuse", "compiled agent procedure", "trace compilation", "cache invalidation"]
last_updated: "2026-11-09"
source_basis: "arXiv:2611.09891v1 title, metadata, comment, and abstract retrieved through the workflow-owned cs.AI feed request on 2026-11-09. Scout did not inspect the full paper, ARC construction method, tasks, source traces, cache representation, training loop, perturbation tests, cost accounting, code, or results."
</ai_context>

# Agentic reasoning caches need promotion and invalidation receipts

**Date:** 2026-11-09  
**Source:** [CPU-ARC: Agentic Reasoning Caching for on-CPU Reasoning Reuse](https://arxiv.org/abs/2611.09891v1)  
**Source revision:** arXiv:2611.09891v1  
**Coverage:** Title, metadata, comment, and abstract only  
**Disposition:** New knowledge

## Question

What changes when an agent stops solving every repeated problem with an LLM and instead turns prior reasoning into a reusable executable procedure?

## What the abstract reports

CPU-ARC distinguishes solving a task from repeatedly executing an already discovered solution. It proposes **agentic reasoning caching**: constructing CPU-executable agentic reasoning caches, or ARCs, from LLM reasoning traces.

The authors report that these caches:

- perform on par with frontier LLMs across a range of difficult mathematical and scientific tasks;
- are explainable, continually trainable, and robust to input perturbations; and
- cost 16–291 times less to invoke than the source model.

These are author-reported abstract claims. The abstract does not identify the task suite, define “on-par,” describe the cache language or construction pipeline, quantify construction cost, or establish which input changes remain inside a cache's valid operating region.

## Scout interpretation

The useful architectural move is to treat an expensive model trajectory as a **candidate procedure**, not as the only way to execute the procedure forever. This can move stable work from stochastic inference into cheaper, inspectable computation. But compilation creates a new lifecycle that ordinary semantic caching does not settle:

1. **Provenance:** which source model, prompt, tools, environment, trace, and successful checks produced the candidate?
2. **Promotion:** what independent evidence shows that the extracted procedure is correct beyond the generating example?
3. **Applicability:** which input schema, preconditions, tool versions, and perturbation range may route to the cache?
4. **Execution receipt:** which cache revision ran, with what inputs and deterministic outputs?
5. **Invalidation:** what changes to requirements, dependencies, environment, or contrary results retire or retrain it?
6. **Fallback:** when applicability or execution fails, does the system safely return to fresh reasoning rather than forcing an obsolete procedure?

Without these receipts, lower invocation cost can hide a semantic regression: the system may efficiently repeat a procedure whose assumptions no longer match the task.

This complements [Procedural memory needs promotion and withdrawal gates](./2026-10-16-procedural-memory-needs-promotion-gates.md). That implementation-oriented note treats successful coding-agent traces as proposed skills requiring later checks, approval, contextual matching, and retirement. CPU-ARC adds an abstract-level signal that trace-derived procedures may also become low-cost CPU executables. The shared boundary is that trace extraction is not admission; reusable execution needs a versioned validity contract.

For agent platforms, a conservative first application would be narrow, deterministic, high-frequency subproblems with strong external checks. The abstract does not justify replacing open-ended planning, policy decisions, or state-changing workflows with an ARC without inspecting the method and its failure behavior.

## Retrieval record

The workflow-owned bounded request checked:

- **Endpoint:** `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`
- **HTTP status:** 200
- **Latency:** 468 ms
- **Request count:** 1
- **Retry-After:** not present

## Evidence limits

Scout reviewed only the arXiv feed's title, metadata, comment, and abstract. The 28-page paper, nine figures, eleven tables, ARC representation, extraction algorithm, training process, explainability mechanism, task suite, baselines, perturbation protocol, source models, construction and maintenance costs, code, and detailed results were not inspected.

The abstract supports the research direction and its reported headline outcomes. It does not establish that arbitrary reasoning traces can be compiled safely, that the caches generalize outside tested task families, that total lifecycle cost is lower after construction and invalidation, or that a cache preserves the source model's behavior under distribution shift.
