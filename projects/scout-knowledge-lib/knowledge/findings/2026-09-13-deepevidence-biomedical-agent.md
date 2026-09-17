<ai_context>
summary: "A current XHS post by DeepEvidence researcher Qiao Jin presents the biomedical system as an agent harness plus skills, combining heterogeneous information tools with depth-first and breadth-first search. A primary-source follow-up identified the Nature Machine Intelligence paper, public test dataset, and implementation; performance claims still require protocol-level review or reproduction."
triggers: ["XHS", "DeepEvidence", "biomedical agent", "agent harness", "skills", "deep research", "medical evidence"]
last_updated: "2026-09-14"
source_basis: "Direct XHS detail read of stable item 6a8b8a10000000000f03a000 on 2026-09-13; Nature Machine Intelligence article 10.1038/s42256-026-01266-0 and its linked code and data availability statements checked on 2026-09-14."
</ai_context>

# DeepEvidence frames a biomedical research agent as search policy plus tools

**Date:** 2026-09-13  
**Source:** https://www.xiaohongshu.com/search_result/6a8b8a10000000000f03a000  
**Author:** Qiao Jin  
**Source type:** Researcher-authored XHS project summary  
**Primary paper:** [*Empowering biomedical evidence exploration and synthesis with deep knowledge graph research*](https://doi.org/10.1038/s42256-026-01266-0)  
**Public artifacts:** [implementation](https://github.com/RyanWangZf/BioDSA/tree/main/biodsa/agents/deepevidence), [test datasets](https://huggingface.co/datasets/zifeng-ai/DeepEvidence)

## Observation

Qiao Jin describes **DeepEvidence**, recently published in *Nature Machine Intelligence*, as a deep-research agent that combines multiple biomedical information tools and can traverse them with both depth-first and breadth-first search. The post's own shorthand is especially useful: a biomedical-domain **“agent harness + skills.”** A primary-source follow-up identified the exact paper (DOI `10.1038/s42256-026-01266-0`); its abstract independently confirms coordinated breadth-first and depth-first research over heterogeneous biomedical sources and adds an incrementally constructed evidence graph for attribution and validation.

The body reports that DeepEvidence outperforms Biomni, ToolUniverse, and GPT-5 on HLE, LitQA 2, SuperGPQA, and TrialPanorama, and says it also performs well on target identification, mechanistic reasoning, clinical-trial development, and evidence-based medicine tasks. A reply from the author says the article contains a GitHub link.

## Why this is a useful agent signal

The durable design signal is not the ranking claim by itself. It is the decomposition of a domain research agent into:

1. **heterogeneous evidence tools** for biomedical data,
2. **skills** that encode domain operations, and
3. **an explicit search policy** that can deepen one evidence path or broaden across alternatives.

That framing makes “medical intelligence” less monolithic. It suggests that a domain agent should be evaluated not only on final answers, but also on tool coverage, branch-selection quality, evidence provenance, and stopping behavior. In clinical or scientific work, the harness must preserve which branch and source support each conclusion; a high aggregate benchmark score cannot substitute for inspectable evidence paths.

## Primary-source follow-up (2026-09-14)

The *Nature Machine Intelligence* article identifies the system under the title *Empowering biomedical evidence exploration and synthesis with deep knowledge graph research*. Its data-availability statement links a public Hugging Face test dataset, and its code-availability statement links the DeepEvidence implementation within BioDSA. This resolves the artifact identity and availability gap in the XHS observation.

## Evidence boundary

The XHS post still does not itself provide a result table, model settings, statistical analysis, or enough benchmark protocol detail to verify its comparisons. The journal abstract supports the high-level architecture and reports improvements, while the linked code and data make deeper review possible. Scout did not inspect a pinned repository revision, audit the benchmark protocol, or reproduce any result in this maintenance pass. Accordingly:

- the system decomposition is supported by both the researcher post and the paper abstract;
- the paper, implementation path, and test-dataset path are now directly identified;
- the performance comparisons remain publication claims, not independently reproduced results;
- no clinical-validity, production-readiness, or patient-safety conclusion follows from this observation.
