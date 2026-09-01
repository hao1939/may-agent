# Agentic Context Management: Memory as a Lifecycle Problem

Date: 2026-07-24
Source: https://arxiv.org/abs/2607.21503
Tags: #ai-agents #context-management #memory #production #architecture

## Summary

This paper reframes agent memory/context from a "storage-and-retrieval" problem to a full lifecycle discipline called Agentic Context Management (ACM). It decomposes context management into five primitives and makes an economic argument about token cost scaling.

## Five ACM Primitives

1. **Architecting** — deciding memory structure per data type
2. **Ingesting** — extracting and structuring what to remember
3. **Scoping** — choosing what is relevant now (including organizational hierarchy)
4. **Anticipating** — predicting what will be needed next
5. **Compacting & Consolidation** — reducing context to budget without losing what matters

## Economic Argument

- Naive context accumulation: **quadratic** token cost in conversation length
- Crude summarization: **linear** cost but accuracy cliff
- Validated compaction: **linear** cost with preserved fidelity

## Key Claim

Production agent context operates not over a single user but across an organizational scope hierarchy. The paper describes a reference implementation (Maximem Synap) reporting 92% on LongMemEval and 93.2% on LoCoMo.

## Relevance

Directly applicable to any multi-turn agent system. The five-primitive decomposition provides a useful mental model for designing agent memory architectures. The economic framing (quadratic vs linear) gives concrete justification for investing in context management infrastructure.

## 2026-08-26 update — compact against a tested knowledge contract

HN surfaced GitHub Next's **Knowledge Compressor**, a concrete prototype for the paper's “Compacting & Consolidation” primitive.

Source: https://githubnext.com/posts/knowledge-compressor/
HN: https://news.ycombinator.com/item?id=49436882

The reusable contribution is not the prototype's headline compression ratio; it is the way the prototype defines what a compacted document must preserve:

1. Generate question/answer pairs from the original document, with the count adapted to its length and density.
2. Test each question in a fresh context against the original and discard questions that the source does not actually support.
3. Iteratively shorten the document and rerun those questions.
4. Optionally require at least one question to fail before completion, proving that the compressor crossed a meaningful-information boundary; then restore enough material to make the suite pass again.

This turns compaction from “produce a plausible summary” into **boundary-seeking reduction against an executable knowledge contract**. Fresh contexts reduce answer leakage between tests. Testing on synthetic or post-training-cutoff facts reduces, but does not eliminate, the chance that model priors or guessing conceal an omission.

The economics also imply an admission gate. GitHub Next reports that its illustrated run reduced a synthetic technical article from 996 to 480 tokens but cost about $2; at its stated uncached saving of roughly $0.001 per inclusion, compression breaks even only after about 2,000 reuses. Caching, model prices, document genre, and compression decisions can move that threshold substantially. Compacting should therefore be reserved for stable, repeatedly injected knowledge rather than applied indiscriminately.

### Evidence limits

This is a prototype report, not a broad benchmark. The displayed run uses one synthetic technical article, 24 generated questions, and GPT-5.6 Sol. A self-generated question suite can omit facts that matter to an unseen consumer, and passing source-derived questions does not establish preservation on downstream tasks or across receiver models. The report itself leaves genre sensitivity and compression-process efficiency as open questions. A production contract should therefore add consumer-authored critical questions, held-out questions, and downstream task checks before treating a compressed artifact as a replacement for its source.

## 2026-08-26 update — safety rules need a lossless retention lane

Source: https://arxiv.org/abs/2608.22752  
Primary text: https://arxiv.org/html/2608.22752

**The Compaction Cliff in Long-Running AI Agent Memory** adds evidence that a single semantic-fidelity target is the wrong contract for heterogeneous agent context. On 20 public agent configurations compacted to 50% each round, the paper reports that Claude Code's `/compact` prompt with Sonnet 4.6 retained 53% of identified constraints after one round and 10% after five—even though the prompt explicitly requested that every safety rule and procedural command remain verbatim. At 50% single-round compression, every evaluated single-shot LLM compactor retained only 45–53% of constraints; the paper's typed operator retained all constraints on that sample.

The useful architectural move is **type-specific distortion**, not merely “better summarization”:

- constraints enter a zero-distortion lane and must survive verbatim;
- procedures may change only when execution semantics are preserved;
- beliefs and preferences tolerate bounded semantic compression;
- episodic records may be summarized or discarded;
- a deterministic verifier restores missing hard-lane items, and the operation returns `Unsafe` rather than silently exceeding a budget that cannot fit them.

This extends the tested-knowledge-contract pattern above. Question-based checks help determine whether an ordinary knowledge document still answers what matters, but critical constraints should not first be exposed to lossy rewriting and then reconstructed from tests. They need **pre-compaction classification, lossless carriage, post-operation verification, and an explicit infeasible-budget state**. The same rule applies when splitting or retrieving context: replicate each constraint into every partition where its scope applies, and rank applicable constraints ahead of relevance-only retrieval.

### Evidence and deployment limits

The paper's guarantee is conditional, not end-to-end. Its operator preserves only constraints that the classifier flags; the reported SafetyMargin operating point has 0.93 constraint recall, and nine missed items account for a 4.5-point preservation gap on its SafetyMed evaluation. Its public-GitHub corpus may not match private enterprise policies, the multi-round experiment covers only two of four LLM families, and decomposition overhead reached 219% in the worst sampled case. The storage-layer guarantee also does not prove that a model will obey a retained rule.

A deployable design should therefore separate four receipts: classifier recall on domain-specific held-out rules, byte- or canonical-form preservation of the hard lane, scope coverage after partition/retrieval, and downstream behavioral compliance. When the hard lane itself exceeds budget, the safe result is refusal, decomposition, or a larger context—not a plausible summary.
