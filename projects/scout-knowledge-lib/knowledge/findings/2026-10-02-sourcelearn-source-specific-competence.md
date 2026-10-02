<ai_context>
summary: "SourceLearn treats repeated work over one authoritative source as cumulative source-specific competence, not repeated retrieval or storage of task answers. It uses self-directed gap finding plus task-guided representation repair, but reconstructs persistent updates from the source and keeps direct retrieval available. Author-reported gains across document, code, API, and interactive benchmarks are promising; grounding audits also show that task-guided source models can contain partially supported or unsupported units, so the learned representation is an aid rather than authority."
triggers: ["SourceLearn", "source-specific competence", "persistent source model", "authoritative source learning", "task-guided source reconstruction", "agent knowledge curation"]
last_updated: "2026-10-02"
source_basis: "Complete arXiv HTML paper v1 and feed abstract/metadata for arXiv:2610.02150. Scout did not run SourceLearn, inspect its repository implementation, reproduce benchmarks, or independently validate the authors' results."
</ai_context>

# Repeated Source Use Can Build Competence Without Making Memory Authoritative

**Date:** 2026-10-02  
**Source:** https://arxiv.org/abs/2610.02150v1  
**Primary text:** https://arxiv.org/html/2610.02150v1  
**Project:** https://sourcelearn.github.io/  
**Repository:** https://github.com/luchengfu6/SourceLearn  
**Version reviewed:** arXiv v1, submitted 2026-10-01  
**Coverage:** complete HTML paper plus arXiv feed abstract and metadata; repository and project artifacts were not inspected

## Signal

*From Knowledge Access to Source Learning: Developing Source-Specific Competence* distinguishes repeated **access** to a source from cumulative **understanding** of that source. Retrieval can repeatedly surface local evidence without preserving how entities relate, which conditions govern a rule, or which procedures recur. The authors represent that reusable understanding as a persistent, revisable source model that complements rather than replaces direct source access.

SourceLearn builds the model in three stages:

1. **Initial construction** organizes major entities, relations, procedures, conditions, exceptions, and higher-level structure from the source.
2. **Self-directed learning** uses an Inspect–Study–Consolidate cycle. The current model helps identify what remains incomplete; targeted rereading deepens one entity or connects two; one consolidated update is then written.
3. **Task-guided learning** uses failures to identify missing source requirements and repeated tasks to infer representation preferences, such as keeping conditions explicit or related material together.

The most important boundary is about authority. Study observations, task answers, and corrections determine **what to reconsider**, but do not become persistent facts directly. The affected source region is reread, and the persistent model is reconstructed from cited source evidence. At task time, an activated slice of that accumulated model is paired with freshly retrieved source evidence.

This is a useful alternative to two common failure modes: rebuilding the same understanding independently for every task, or promoting a previous agent's interpretation into an unqualified fact. It also implies that a useful knowledge library should preserve both reusable interpretation and the source identity/version needed to recheck it.

## Reported evidence

The authors evaluate five same-source benchmarks: MultiDoc2Dial, NarrativeQA, SWE-QA, APIBench, and AppWorld. These cover document QA, code QA, tool use, and interactive tasks. They test GPT-5.6-Luna, gpt-oss-120b, and DeepSeek-V4.1-Flash against Hybrid RAG, RAPTOR, HippoRAG 2, and the experience-memory method AWM. Guidance and test tasks are disjoint; the same backend performs each method's LLM operations, and task-time SourceLearn receives the same retrieved evidence as Hybrid RAG plus the activated source model.

The paper reports that SourceLearn ranks first in 13 of 15 benchmark/backend settings and second in one more. Its average absolute improvement over Hybrid RAG is 14.3 points for GPT-5.6-Luna, 4.9 for gpt-oss-120b, and 13.4 for DeepSeek-V4.1-Flash. Under matched task-time context budgets, it remains first on three of four tested sources and second on the fourth, so extra context alone does not explain the full result.

Several analyses support—but do not prove—the competence interpretation:

- explicit applicability conditions rise from about 30% of initial-model units to 65–82% after learning;
- coverage of claims required by held-out questions rises from 23.2% to 40.0%;
- SourceLearn improves over Hybrid RAG by 14.9 points in source regions seen by guidance tasks and 12.1 points in unseen regions;
- both self-directed and task-guided stages reduce accuracy when ablated; and
- on a degraded-retrieval MultiDoc2Dial test, removing the gold document lowers Hybrid RAG by about 25 points but SourceLearn by about 8.

Additional self-directed study is not automatically better. On two MultiDoc2Dial sources, extending from one to four cycles expanded the model but did not consistently improve accuracy. That is evidence for a bounded, evidence-triggered maintenance loop rather than perpetual rewriting.

## The grounding audit is the operational warning

The paper's own audit shows why the source model must not become authority. For 120 sampled units per model on one document, code, and API source, direct contradictions were rare, and 93–100% of claims dropped during rewriting remained represented afterward. Yet full support varied materially. After task-guided learning, only 63.3% of sampled StudentAid units and 65.0% of sampled pytest units were fully supported by their cited source elements; 13.3% and 3.3%, respectively, were unsupported, with the remainder partially supported or, rarely, contradicted. The HuggingFace API model reached 84.2% fully supported.

These are author-run, model-judged audits on selected sources, not an external factuality evaluation. Still, they expose a concrete design requirement: source reconstruction and citations reduce drift but do not eliminate it. Consumers need the original source, provenance, and a way to distinguish a curated interpretation from a verified source claim.

## Interpretation for persistent agent knowledge

For an agent system with recurring work over stable specifications, repositories, or policy documents, the paper suggests a disciplined learning loop:

- maintain a source-scoped model keyed to a pinned source revision;
- represent relationships, applicability conditions, procedures, and exceptions rather than accumulating only task transcripts;
- let failures and recurring questions propose gaps, but reread the authority before changing durable knowledge;
- separate temporary observations, proposed updates, admitted knowledge, and direct source evidence;
- activate only task-relevant model regions while retaining fresh retrieval for precise claims;
- audit support, preservation, and contradictions on each rewrite; and
- stop study cycles when measured held-out utility no longer improves.

This maps closely to research-library maintenance, but the evidence does not establish that autonomous rewriting is safe. A low-risk evaluation would use one stable, versioned source; keep candidate updates reviewable; compare retrieval-only against source-model-plus-retrieval on held-out questions; and score citation support, lost constraints, and downstream utility separately.

## Limits

This is a newly posted arXiv v1 and all performance claims are author-reported. Scout did not inspect the linked code, reproduce the benchmarks, assess compute or financial cost, or verify the named model services. QA scoring uses GPT-5.6-Luna as a judge, while APIBench and AppWorld use official evaluators. SourceLearn also receives a persistent model in addition to retrieved evidence; the matched-context analysis helps but does not remove every implementation or prompt confound.

The tested setting assumes persistent, authoritative, relatively stable sources and repeated same-source tasks. The authors explicitly leave evolving, noisy, or conflicting sources to future work. The paper does not establish safe source-version migration, conflict resolution, adversarial-source handling, privacy boundaries, human review policy, or durable rollback. Its grounding audit demonstrates residual unsupported content even under its reconstruction discipline. The result justifies investigating source-scoped, provenance-preserving learning; it does not justify treating generated knowledge as source truth.
