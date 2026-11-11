<ai_context>
summary: "An abstract-level comparison of three enterprise analytics-agent evaluation frameworks reports that trace-based judging balanced known-risk precision and recall better than text-only judging, while functional testing and security red-teaming found disjoint novel failures. The result supports preserving execution traces and running separate functional and adversarial evaluation lanes, but does not establish general evaluator superiority."
triggers: ["agent evaluation", "trace-based judging", "security red-teaming", "functional evaluation", "analytics agents", "evaluation harness"]
last_updated: "2026-11-11"
source_basis: "arXiv:2611.14493v1 title, metadata, comment, and abstract retrieved through the workflow-owned cs.AI feed request. Scout did not inspect the full paper, frameworks, agents, traces, test cases, labels, prompts, judges, heuristics, novel-failure adjudication, or artifacts."
</ai_context>

# Agent evaluation needs traces and separate security red-teaming

**Date:** 2026-11-11  
**Source:** [Comparative Analysis of Agent Evaluation Frameworks: Stability, Detection, and Discovery in Enterprise Analytics Agents](https://arxiv.org/abs/2611.14493v1)  
**Source revision:** arXiv:2611.14493v1  
**Coverage:** Title, metadata, comment, and abstract only  
**Disposition:** New knowledge

## Question

What does a direct comparison of evaluation paradigms suggest about the evidence an agent evaluator should receive and the need for distinct functional and security testing?

## What the abstract reports

The study compares three evaluation paradigms on two enterprise analytics agents using frozen execution traces:

1. trace-based LLM judging;
2. text-only LLM judging combined with red-teaming; and
3. deterministic heuristics.

The reported evaluation has three phases. In a repeated-measurement stability phase, **97% of configurations** met the authors' stability threshold, and the reported stability pattern did not depend on which of the two agents was evaluated. On **72 ground-truth known-risk cases**, the trace-based framework had the best reported precision-recall balance at **F1 = 0.90**. The text-only framework reportedly matched its recall but produced **five times more false alarms**. In unknown-risk discovery, the study reports **24 novel failures**, with **zero overlap** between failures found through functional testing and security red-teaming.

The authors recommend trace-based evaluation for functional assessment and adversarial red-teaming for security validation.

## Scout interpretation

The most reusable result is a two-part evaluation architecture rather than a universal ranking of tools.

First, **evaluator evidence access is part of the treatment**. A final response can hide whether an agent selected the wrong data, misused a tool, recovered from an error accidentally, or produced an unsupported result. Trace access can expose those distinctions, although a trace-based judge still needs calibration against authoritative labels and can only assess events the trace actually captured.

Second, **functional evaluation and security red-teaming should remain separate discovery lanes**. Zero overlap among the reported novel failures suggests that passing ordinary task checks does not make adversarial testing redundant, and a red-team finding does not substitute for measuring routine task correctness. The two lanes should retain their own case inventories, sampling methods, labels, severity rules, and coverage denominators before their results are combined into a release decision.

For agent infrastructure, a practical evaluation record should therefore preserve:

- the frozen agent, model, prompt, tool, policy, and environment revisions;
- the exact trace fields visible to each evaluator;
- known-risk labels and their provenance;
- precision, recall, false alarms, and abstentions by failure class;
- separately sourced functional and adversarial cases; and
- deduplicated findings without treating non-overlap as proof of complete coverage.

This extends [Agent Evaluation Research: Diagnostic Layers](../agent-evaluation-research-diagnostic-layers.md), which separates answer correctness from trace integrity. The current abstract adds comparative evidence that withholding trace information can materially change false-alarm behavior, and that functional and security discovery can expose different failures.

## Retrieval record

The workflow-owned bounded request checked:

- **Endpoint:** `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`
- **HTTP status:** 200
- **Latency:** 501 ms
- **Request count:** 1
- **Retry-After:** not present

## Evidence limits

Scout reviewed only the arXiv feed's title, metadata, comment, and abstract. The full nine-page paper, the three frameworks, two analytics agents, frozen traces, repeated trials, stability threshold, 72 ground-truth cases, label construction, prompts, model versions, deterministic rules, red-team procedures, 24 novel failures, overlap analysis, severity, costs, and artifacts were not inspected.

The comparison is limited to two agents in a controlled research setting. The abstract does not establish that trace-based LLM judging is more accurate for other agent classes, that every relevant action was captured in the traces, that the ground-truth labels were independent or complete, or that five times more false alarms translates into worse operational utility at every consequence level. Likewise, zero overlap between two discovery methods shows complementarity in this study, not exhaustive security coverage. The reported stability of repeated measurements does not by itself establish validity: an evaluator can be consistently wrong.
