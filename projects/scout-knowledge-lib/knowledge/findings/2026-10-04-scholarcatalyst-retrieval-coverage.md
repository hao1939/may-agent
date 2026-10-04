<ai_context>
summary: "ScholarCatalyst evaluates whether systems can retrieve prior papers that authors say could have advanced a project before its solution was known. Author-reported results separate candidate coverage from downstream recognition: agentic search using the same dense retriever does not beat that retriever, while injecting missed positives into reranking pools creates gains. The benchmark is valuable but bounded by retrospective author labels, a 191K-paper CS corpus, candidate-generation bias, and limited coauthor agreement evidence."
triggers: ["ScholarCatalyst", "inspiration paper retrieval", "agentic literature search", "candidate coverage", "scientific retrieval", "author-annotated relevance"]
last_updated: "2026-10-04"
source_basis: "Complete arXiv HTML paper v1 and current cs.AI feed metadata for arXiv:2610.02202. Scout did not inspect the released dataset or code, rerun retrieval systems, or independently validate the authors' labels or results."
</ai_context>

# Research Search Must Measure Candidate Coverage Before Reranking

**Date:** 2026-10-04  
**Source:** https://arxiv.org/abs/2610.02202v1  
**Primary text:** https://arxiv.org/html/2610.02202v1  
**Version reviewed:** arXiv v1, submitted 2026-10-01  
**Coverage:** complete HTML paper plus arXiv feed abstract and metadata; linked artifacts were not inspected

## Signal

*ScholarCatalyst: A Benchmark for Retrieving Papers That Inspire New Research* asks a narrower question than topical literature retrieval: given a research question as it stood before a project's solution was known, can a system find earlier papers whose ideas could have advanced that project?

The benchmark contains 894 queries derived from 207 source papers by 184 researchers: 207 central research questions (CoreQ) and 687 subfield-specific questions (SubQ). Authors reviewed candidates, labeled positive and hard-negative papers, and supplied rationales. The searchable corpus contains 190,896 computer-science papers, with a per-query temporal cutoff that excludes papers published after the source paper. In the main evaluation, agents cannot use the web or see the completed source paper, and their model knowledge cutoffs precede the 2025–2026 source papers.

This setup captures relevance that ordinary publication metadata often misses. The paper reports that 43.6% of SubQ positives were not cited by the completed source paper; among those uncited positives, 67.8% shared no references with it. Author rationales also attribute inspiration through several relationships—adapted methods, supporting evidence, generalization, motivating limitations, and others—rather than topical similarity alone.

## Candidate coverage is a separate failure layer

The strongest pre-cutoff dense results remain modest. At Recall@20, the best reported CoreQ result among the listed general-purpose dense retrievers is 0.39 and the best SubQ result is 0.51. The GPT-4.1 tool-calling agent, which retrieves candidates through Gemini Embedding 2 and then scores the pool, reaches 0.37 CoreQ and 0.43 SubQ Recall@20; the o3 deep-research agent reaches 0.33 and 0.38. The corresponding Gemini retriever scores 0.38 and 0.46. Agentic control therefore does not improve the primary retrieval results even though it can issue several searches and reason over returned abstracts.

The paper's diagnostic evidence points to missing candidates rather than only poor ranking:

- a GPT-4.1 grep agent sees only 8% of gold query–paper pairs during search, versus 46% for the tool-calling agent;
- hard negatives are at least as similar to queries as positives under both the paper's lexical and Qwen3-Embedding-8B similarity measures;
- on sampled queries, replacing negative reranking candidates with positives missed by retrieval creates larger Recall@5 gains for stronger rerankers; and
- query expansion, multi-query generation, and hypothetical-document expansion do not materially improve results, with the hypothetical-document variants reducing recall.

These findings distinguish two stages that an evaluation should report separately:

1. **coverage:** did any search route place the useful source in the inspectable pool?
2. **recognition and ranking:** once present, did the model identify why it was useful and prioritize it?

A more capable reader cannot recover a paper that its tools never surface. Conversely, a high trajectory-recall system can still fail if it does not recognize or rank the candidate. A single final Recall@k score hides which stage failed.

## Implication for research agents

For a research workflow, log source discovery before source judgment. A useful evaluation bundle would include:

- stable IDs for every candidate surfaced by each query or citation-expansion route;
- trajectory recall or known-positive coverage before reranking;
- final ranking metrics conditioned on a fixed candidate pool;
- a gold-injection or oracle-pool diagnostic to estimate recognition headroom;
- the rationale relation being sought, such as method transfer, negative result, limitation, or cross-domain generalization; and
- temporal and access boundaries for both the corpus and model.

This also argues against treating additional search turns as evidence of broader research. If every turn calls the same embedding bottleneck with nearby phrasings, apparent agent effort may add little candidate diversity. Search policies should be evaluated for complementary coverage across distinct routes, not only for the number of queries or papers read.

ScholarCatalyst does not establish that full-text reading is generally unhelpful. Its bounded comparison lets one GPT-4.1 agent read beyond abstracts on only 50 queries of each type and changes Recall@20 by at most 0.04. That result is evidence about this retrieval protocol after candidates are surfaced, not a license to summarize or assess papers from metadata alone.

## Limits

All benchmark and model results are author-reported from a new arXiv v1. Scout did not inspect the dataset or implementation, reproduce retrieval runs, verify corpus resolution, or audit individual annotations.

The labels are retrospective judgments from authors of completed work and may contain hindsight bias. Candidate annotation begins from cited papers plus candidates retrieved by BM25 and Qwen3-Embedding-8B, reranked and limited to ten candidates per query; potentially useful papers outside that construction process cannot become labeled positives. CoreQ positives are 95.5% cited, so the benchmark's central-query label set especially reflects the completed paper's bibliography. A preliminary three-coauthor check exists for only one paper: coauthors recovered 43–60% of the first author's labels at 84–88% precision. This suggests the target is not a uniquely agreed ground truth.

The 191K-paper corpus is restricted to computer science and is much smaller than all of arXiv. Source papers concentrate in 2025–2026 AI and adjacent areas, with uneven field representation. Results may not transfer to other fields, older projects, web-scale retrieval, full-text corpora, or prospective studies where researchers record inspiration before outcomes are known.
