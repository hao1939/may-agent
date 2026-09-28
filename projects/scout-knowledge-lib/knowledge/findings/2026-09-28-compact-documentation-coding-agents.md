<ai_context>
summary: "A controlled arXiv study separates documentation fidelity from downstream coding value. Its optimized descriptions could substitute for withheld source (mean test-pass fraction 0.71 versus 0.08 issue-only), but with source available, static descriptions and retrieved past-task context did not beat issue-only across the reported paired comparisons. The practical boundary is informational novelty: document hidden intent, contracts, and unavailable code; do not assume a faithful restatement of readable code improves agents."
triggers: ["coding agent documentation", "repository map", "compact documentation", "context retrieval", "roundtrip benchmark", "source withheld", "redundant context", "documentation fidelity"]
last_updated: "2026-09-28"
source_basis: "Full-text review of arXiv:2609.31587v1 (13-page preprint) plus its Atom metadata; the paper reports 11 roundtrip fixtures and three hand-built codebases, source-withheld tests, and source-present paired comparisons across two model families and ten repositories. Code and data were linked but not inspected or rerun."
</ai_context>

# Coding-agent documentation helps when it supplies missing information, not merely faithful restatement

**Date:** 2026-09-28  
**Source:** https://arxiv.org/abs/2609.31587v1  
**Reviewed version:** arXiv:2609.31587v1, submitted 2026-09-25  
**Coverage:** Full 13-page paper read from the PDF; linked code/data not inspected and experiments not reproduced  
**Disposition:** New knowledge

## Question

Does compact, high-fidelity natural-language documentation improve a coding agent's ability to resolve repository issues, and how should an agent system decide what context to include?

## What the paper reports

Arman and Molybog introduce a roundtrip benchmark for file descriptions: a model regenerates code from a natural-language description alone, and the original tests act as the equivalence oracle. They then optimize the description-writing prompt against that score. In their controlled comprehension tasks, completeness—not raw word count—determined whether required facts survived: a 38-word and a 664-word description containing the same facts both achieved the same reported uplift, including with a 4B model.

High regeneration fidelity did **not** generally transfer to issue resolution when the agent could read the source:

- With source withheld across 11 fixtures, issue-only reached a mean test-pass fraction of **0.08**, a baseline description **0.21**, and the optimized description **0.71**, with three attempts per fixture.
- With source present, a local Qwen 3.6 agent resolved **14/43** paired multi-file fixtures issue-only versus **11/43** with compact descriptions.
- On 15 paired Django fixtures, Gemini 3.1 Pro resolved **9** issue-only, **8** with a compact description, and **4** with the full optimized description.
- On 58 tasks from SWE-ContextBench Lite that produced scorable edits in every compared condition, Gemini 3.8 Flash resolved **33** issue-only, **29** with compact descriptions, and **30** with retrieved past-task context. The paper reports McNemar exact-test values of **p=0.22** and **p=0.25** for issue-only versus compact and retrieved context, respectively.
- A Django positive-control comparison moved from **14/29** issue-only to **15/29** with SWE-ContextBench's retrieved context. That establishes some harness sensitivity but is only a one-task difference; it does not independently validate a broad retrieval benefit.

The authors' explanation is an information boundary rather than a universal anti-documentation result. Documentation helped consistently in three hand-built examples when it stated an intended contract absent from the code. A faithful file summary can substitute for source that cannot fit or is withheld, but restating readable code is redundant and can distract an agent into rewriting rather than patching.

## Scout interpretation

Documentation quality and task utility are separate measurements. Roundtrip regeneration is a useful **fidelity** oracle for whether a description preserves executable behavior, but it cannot show that adding the description to an already sufficient context improves an agent's decision. Context selection should therefore ask what unavailable fact a document contributes—not just whether the document is accurate, concise, or retrievable.

This sharpens two existing Scout themes:

- [The Prompt Mass Problem](../the-prompt-mass-problem.md) argues that repeated context has a real input and attention cost. This paper adds task-outcome evidence that redundant file descriptions can fail to repay that cost even when they are high fidelity.
- [The Cold Start Tax](../the-cold-start-tax.md) calls for bounded context with a completeness witness. The new result suggests that such a witness should track **required facts and hidden contracts**, not demand summaries of every readable file. Completeness is relative to the task's missing information, not to the repository's total content.

A practical context compiler should classify candidate material into at least three buckets:

1. **unavailable source or symbols:** compression may substitute for content that cannot be loaded;
2. **hidden intent and contracts:** documentation can add information not inferable from implementation;
3. **readable implementation restatement:** omit by default unless a task-specific retrieval test shows added value.

## Limitations

The paper's roundtrip side is small: 11 fixtures plus three hand-built codebases, all from one language/project family. The largest downstream run uses one economical model and roughly 80-word descriptions; stronger-model replications are restricted to Django subsets. Paired analyses exclude tasks where either condition produced no scorable edit, while documentation conditions reportedly produced no edit slightly more often, so attrition is not random. Two attempted open-weight regenerators scored zero across all roundtrip fixtures, making the benchmark dependent on a sufficiently capable regeneration model. Training contamination is reduced by the authors' controls but not eliminated.

These results therefore do not establish that repository documentation is broadly useless. They establish a narrower and actionable boundary for the tested settings: **high-fidelity restatement did not improve source-present issue resolution, while missing source or code-invisible contracts created measurable value.** Repository-scale tests where the necessary source genuinely does not fit remain open.

## Sources

- Paper: https://arxiv.org/abs/2609.31587v1
- PDF reviewed: https://arxiv.org/pdf/2609.31587v1
- Authors' linked code and data (not inspected): https://github.com/haw-ai-i/roundtrip
