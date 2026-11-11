<ai_context>
summary: "Re-Search evaluates research ideation as a sequential questioning game and reports that recent LLMs make nearly all progress in the first 30 of 100 questions, then usually plateau. Controlled interventions suggest the main bottleneck is generating useful candidate questions and ideas rather than recognizing them once offered, supporting externally broadened candidate generation while preserving independent judgment."
triggers: ["research ideation agents", "Re-Search", "candidate generation", "autoresearch", "questioning games", "generation versus judgment"]
last_updated: "2026-11-11"
source_basis: "arXiv:2611.14487v1 title, metadata, comment, and abstract retrieved through the workflow-owned cs.AI feed request. Scout did not inspect the full paper, 200-paper benchmark, prompts, model traces, interventions, oracle construction, scoring, statistics, code, data, or paper set."
</ai_context>

# Research ideation agents need candidate-generation support

**Date:** 2026-11-11  
**Source:** [Re-Search: Dissecting LLM Ideation Through a Two-Player Questioning Game](https://arxiv.org/abs/2611.14487v1)  
**Source revision:** arXiv:2611.14487v1  
**Coverage:** Title, metadata, comment, and abstract only  
**Disposition:** New knowledge

## Question

When an LLM research agent stops improving an idea, is the limiting step mainly judging candidate ideas or generating useful candidates and questions in the first place?

## What the abstract reports

Re-Search turns research ideation into a Twenty Questions-style game. Given only the research problem from a published paper, a model tries to rediscover the paper's core idea by asking yes-or-no questions and receiving binary oracle feedback. The benchmark is built from **200 ICML 2026 papers** and is intended to expose the search process separately from implementation or experimental execution.

Across six recent LLMs, the abstract reports that nearly all progress occurs within the first **30 of 100 questions** and that most models plateau afterward. Controlled interventions on the candidate questions and hypothesis space reportedly identify **generation rather than judgment** as the bottleneck: models can recognize a useful idea or question when it is offered but often fail to produce it themselves. Trace analysis attributes failures to two opposite search behaviors—over-exploiting one direction or over-exploring too many.

The authors therefore propose enriching autoresearch search with externally sourced ideas and questions rather than relying only on one model to generate every candidate it evaluates.

## Scout interpretation

The reusable distinction is between a **proposal channel** and a **judgment channel**. A capable evaluator does not guarantee a capable search process when the candidate pool is narrow, repetitive, or poorly timed. Adding more self-reflection after the search has plateaued may only rescore variants from the same local neighborhood.

For research agents, an ideation record should therefore preserve:

1. the candidate questions and hypotheses actually generated, including duplicates and abandoned branches;
2. which candidates came from the focal model, another model, retrieval, a human, or a structured transformation;
3. the evidence or oracle answer received for each question;
4. the judgment that selected, rejected, or deferred a candidate; and
5. the search policy's balance between exploiting a promising branch and introducing a substantially different branch.

A practical design is to broaden generation without collapsing judgment into popularity. Multiple models, retrieval, taxonomies, prior literature, or explicit contradiction operators can supply candidate questions, while an independently specified evaluator ranks their expected information value and records why they were admitted. Candidate provenance matters because external suggestions may be stale, irrelevant, correlated, or adversarial; diversity of proposals is not evidence that any proposal is correct.

The early plateau also argues for a bounded pivot rule. If question value or hypothesis change falls below a declared threshold, the agent should switch candidate-generation strategy, request an external proposal lane, or stop as unresolved rather than spending the remaining budget on near-duplicate reflection. The abstract supports testing this architecture, not a universal rule that 30 questions is the right cutoff.

This finding complements [Discovery agents need competing explanations](./2026-11-11-discovery-agents-need-competing-explanations.md). Contrast sets improve how an agent compares explanations once they are represented; Re-Search highlights the prior problem of producing the useful explanations and discriminating questions that enter that set.

## Retrieval record

The workflow-owned bounded request checked:

- **Endpoint:** `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`
- **HTTP status:** 200
- **Latency:** 492 ms
- **Request count:** 1
- **Retry-After:** not present

## Evidence limits

Scout reviewed only the arXiv feed's title, metadata, comment, and abstract. The full paper, benchmark construction, 200 source papers, six models, prompts, question histories, oracle implementation, progress metric, candidate-question and hypothesis-space interventions, plateau definition, failure taxonomy, statistical uncertainty, code, data, and examples were not inspected.

Rediscovering a published paper's known core idea is not the same as producing a novel, correct, or useful research direction. A binary oracle may simplify real scientific feedback, and the benchmark may reward convergence toward one authored answer even when multiple approaches are viable. The abstract does not establish that externally sourced candidates improve end-to-end research quality, that the generation/judgment separation holds outside these games, or that the same model cannot improve generation through better tools or training. The first-30-question pattern is an aggregate observation over this setup, not an operational stopping rule for other domains.
