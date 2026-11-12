<ai_context>
summary: "CLADE reports that retrieval passages naming only a broader answer category can make language models guess a specific answer instead of abstaining or searching further. The abstract supports treating granularity mismatch as a distinct retrieval state that should trigger ontology lookup or escalation, but its ontology-assisted recovery remains low and Scout did not inspect the full study."
triggers: ["CLADE", "resolvable insufficiency", "RAG abstention", "retrieval granularity", "ontology escalation", "coarse evidence"]
last_updated: "2026-11-12"
source_basis: "arXiv:2611.14355v1 title, metadata, and abstract retrieved through the workflow-owned cs.AI feed request. Scout did not inspect the full paper, datasets, prompts, models, ontology construction, counterfactual procedure, statistics, code, data, or supplementary material."
</ai_context>

# RAG systems need a distinct escalation path for coarse evidence

**Date:** 2026-11-12  
**Source:** [CLADE: Category-Level Answering from Deficient Evidence in Retrieval-Augmented Language Models](https://arxiv.org/abs/2611.14355v1)  
**Source revision:** arXiv:2611.14355v1  
**Coverage:** Title, metadata, and abstract only  
**Disposition:** New knowledge

## Question

How should a retrieval-augmented agent behave when a retrieved passage is relevant and accurate but names only a broader category than the specific answer requested?

## What the abstract reports

The paper distinguishes **resolvable insufficiency** from ordinary irrelevant or uninformative retrieval. In this case, the passage contains a broader category related to the answer—for example, a disease family rather than the exact disease—but the text alone does not determine the requested fine-grained answer. A domain ontology can narrow the broader category to a short candidate list, although additional evidence is still needed to select the exact member.

The authors call the observed failure mode **Clade**: when given these category-level passages, language models answer instead of abstaining or searching further. On biomedical questions derived from PrimeKG, the abstract reports that family-only passages reduced abstention by **13.8 percentage points** relative to uninformative passages, while the resulting guesses were wrong about half the time. Replacing an exact disease name with its broader family name reportedly reduced abstention by **17.4 points** compared with deleting the sentence, supporting the claim that the coarse category itself prompts guessing rather than merely failing to help.

The abstract says confidence filtering, a larger model, and explicit abstention instructions did not resolve the effect, and that it also appeared in ecological species-interaction questions from GloBI. Given the correct family, an ontology candidate list contained the true answer in **98.5%** of cases. However, identifying that family from the page was difficult: string matching found it in **19.8%** of cases, model-based family selection raised this to **30.0%**, and end-to-end recovery rose from **10.0%** to **26.8%**.

## Scout interpretation

Retrieval systems should not represent context sufficiency as a binary relevant/irrelevant flag. They need a separate state for **category-level evidence that is relevant but too coarse to entail the requested answer**. Without that state, relevance can be mistaken for answer support, causing the model to convert a plausible category into an unsupported specific claim.

A safer control flow would separate at least four outcomes:

1. **entailed:** the retrieved evidence identifies the requested answer at the required granularity;
2. **resolvably insufficient:** the evidence identifies a broader category and a trusted ontology or structured index can enumerate candidates;
3. **unresolved:** candidate enumeration is possible but current evidence cannot select one candidate;
4. **unsupported:** the retrieval does not provide a defensible route to the answer.

The second state should trigger ontology lookup or structured search, not immediate answering. The third and fourth should trigger further retrieval or abstention. Any answer should preserve the distinction between "the source names this exact entity" and "the source names a category containing this entity."

For agent memory and evidence systems, the analogous risk is that a retrieved policy family, task class, or prior incident can look semantically close enough that an agent treats it as authorization or proof for the current specific case. Evidence admission should therefore check granularity and exact subject identity, not only embedding similarity or topical relevance.

## Retrieval record

The workflow-owned bounded request checked:

- **Endpoint:** `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`
- **HTTP status:** 200
- **Latency:** 434 ms
- **Request count:** 1
- **Retry-After:** not present

## Evidence limits

Scout reviewed only the arXiv feed's title, metadata, and abstract. The full paper, exact question construction, passage generation, models, prompts, decoding settings, abstention definition, confidence filtering, larger-model comparison, ontology sources, family-matching method, counterfactual design, statistical uncertainty, biomedical and ecological datasets, code, and data were not inspected.

The reported ontology candidate coverage does not establish reliable end-to-end answering: the abstract's best stated recovery remains **26.8%**, and selecting the correct family is itself an unresolved step. The results do not show that every granularity mismatch is detectable, that ontology lookup is safe when taxonomies conflict or change, or that the findings transfer to open-domain agent tasks. They support treating coarse-but-relevant evidence as a distinct risk state, not a general claim that ontology augmentation solves retrieval insufficiency.
