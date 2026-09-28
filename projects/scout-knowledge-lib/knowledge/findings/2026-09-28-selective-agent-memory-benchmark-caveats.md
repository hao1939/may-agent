<ai_context>
summary: "Recalld's public LoCoMo runs show an LLM selection pass reducing answer-model context 6.7× relative to vector search, but not total compute: it was about 12× slower, used 18.76M server-side input tokens, and received disproportionate benefit from a judge that accepted unsupported abstentions. Memory benchmarks should separate context delivered, retrieval compute, latency, abstention quality, and answer correctness."
triggers: ["agent memory benchmark", "selective retrieval", "Recalld", "LoCoMo", "Agent Memory Benchmark", "context tokens", "abstention", "LLM judge"]
last_updated: "2026-09-28"
source_basis: "HN 49884835; Recalld landing page; bit-robotics/recalld-benchmarks README, run notes, scripts, and all 20 committed raw run reports at commit 08d72133c41fde61e3a2ca4883c9c37a7961856b."
</ai_context>

# Selective memory can shrink answer context while moving—not removing—cost

**Date:** 2026-09-28  
**Disposition:** New knowledge; reproducible benchmark artifact with material judge and comparability limits  
**Source:** https://news.ycombinator.com/item?id=49884835  
**Product:** https://recalld.ai/  
**Repo:** https://github.com/bit-robotics/recalld-benchmarks  
**Reviewed version:** commit `08d72133c41fde61e3a2ca4883c9c37a7961856b`

## Observation

The HN launch introduced **Recalld**, a hosted agent-memory service that extracts
facts from conversations and documents, updates or supersedes prior facts, and
offers two retrieval paths. `/memory/search` returns top-k excerpts by vector
similarity. `/memory/recall` adds a server-side LLM selection pass and returns
only the excerpts that pass that selection.

The publisher released two full runs over the same stored ten-conversation
LoCoMo subset: 1,540 non-adversarial questions evaluated through the open Agent
Memory Benchmark (AMB). The published comparison is unusually useful because it
includes raw per-question reports and documents several problems rather than
presenting the headline score alone:

| Path | Judged correct | Mean context sent to answer model | Mean retrieval time |
|---|---:|---:|---:|
| LLM-selected recall | 1,366/1,540 (88.7%) | 242.9 tokens | 6.65 s |
| Vector search | 1,359/1,540 (88.2%) | 1,627.4 tokens | 0.56 s |

Scout ran the repository's standard-library `summarize_results.py` over all 20
committed report files and independently reproduced both totals and the three
empty recall results. The raw reports also reproduce the publisher's aggregate
provider-usage total for recall: **18,761,733 input tokens and 353,642 output
tokens** for its server-side retrieval work. Search reports record zero provider
tokens, but their notes say the adapter omitted each query embedding, so zero is
not a complete cost measurement.

The supported result is therefore narrow: in these two runs, LLM selection
reduced the context delivered to the downstream answer model by **6.7×**, while
making retrieval about **12× slower** and shifting substantial model work into
the memory service. It did not establish lower end-to-end compute or equal answer
quality.

## Why the accuracy comparison is not decisive

The repository itself documents that AMB's judge prompt contains an allowance
for gold answers whose information is missing. None of these 1,540 gold answers
is of that type, yet the configured judge often applied the allowance anyway.
The publisher's rough audit found about 90 unsupported or information-missing
answers marked correct in the recall run, versus about 30 in search. All three
recall rows that retrieved an empty source list produced an abstention and were
still marked correct.

This bias is especially important here because selective retrieval can omit the
evidence needed to answer. A lenient judge then rewards the omission instead of
measuring its cost. The displayed 0.5-point accuracy advantage is smaller than
the documented difference in incorrectly accepted abstentions, so it cannot
support a claim that recall preserved or improved correctness. The publisher
appropriately labels both accuracies upper bounds and declines that claim.

Other comparability limits remain:

- the recall and search runs were four weeks apart, and neither records the
  deployed Recalld server revision;
- the harness patch sorts sessions chronologically rather than in AMB's prior
  alphabetical order, so external AMB runs without that patch are not
  like-for-like controls;
- the answer model was changed to `gemini-3.1-pro-preview`, while the judge was
  `gemini-2.5-flash-lite`;
- AMB excludes LoCoMo's 446 adversarial questions from this 1,540-question
  subset; and
- the published context-token metric counts only what reaches the answer model,
  not ingestion, embeddings, selection-model input, or selection-model output.

## Reusable evaluation pattern

A selective-memory benchmark should report a **retrieval accounting vector**,
not one context-length or accuracy number:

1. **Evidence delivered:** answer-model context tokens and the fraction of
   questions receiving empty or insufficient evidence.
2. **Work performed upstream:** ingestion, embedding, reranking, and selection
   model tokens, calls, latency, and monetary cost.
3. **Answer utility:** correctness scored by a rubric that cannot turn an
   unsupported abstention into a correct concrete answer.
4. **Abstention utility:** correct abstentions and incorrect abstentions on
   separate denominators, with human audit of a sample.
5. **Experimental identity:** immutable memory-service revision, harness patch
   stack, dataset split, prompts, answer model, judge model, and run date.
6. **Matched controls:** run retrieval variants against the same frozen stores
   and service revision, preferably in interleaved order, then report paired
   per-question differences rather than comparing only aggregate percentages.

The operational choice can still favor selection when answer-context scarcity is
the binding constraint. But `tokens returned` is a boundary metric, not a total
cost metric, and a judge that rewards missing evidence can invert the apparent
quality trade-off.

## Relationship to existing knowledge

This adds measurement detail to the library's broader argument that raw memory
and admitted context are different layers in
[AI Agent Architecture: Operational Memory Layer](../hn-agent-operational-memory.md).
The architectural rule remains sound—retrieve a bounded relevant view—but this
benchmark shows that relevance filtering must be evaluated together with the
work it moves upstream and the evidence it drops.
