<ai_context>
summary: "An arXiv abstract reports that some cited RAG claims remain driven by parametric memory rather than retrieved passages, while standard entailment checks cannot detect the distinction. Citations can establish agreement with a passage without proving causal context use; Scout did not inspect the full paper, substitutions, datasets, models, detectors, or statistical analysis."
triggers: ["RAG provenance", "citation provenance", "parametric memory", "context use", "counterfactual substitution", "Cited but Unused", "2611.17161"]
last_updated: "2026-11-14"
source_basis: "arXiv:2611.17161v1 title, metadata, and abstract retrieved through the workflow-owned cs.AI feed request."
</ai_context>

# RAG citations do not prove context use

**Date:** 2026-11-14  
**Source:** [Cited but Unused: Parametric Provenance in Retrieval-Augmented Generation](https://arxiv.org/abs/2611.17161v1)  
**Source revision:** arXiv:2611.17161v1  
**Coverage:** Title, metadata, and abstract only  
**Disposition:** New knowledge

## Question

When a retrieval-augmented answer cites a passage that agrees with its claim, what evidence is still missing before the system can say that the claim came from that passage rather than the model's parametric memory?

## What the abstract reports

The paper studies **parametric provenance** in retrieval-augmented generation: whether a citable claim was actually derived from retrieved context or instead produced from model memory. The authors use counterfactual value substitution, replacing a fact in the retrieved passages with a false variant and querying the model again.

Across five sizes of one model family and a second comparator family, the abstract reports that **1.2% to 15.7%** of citable claims derived from parametric memory rather than retrieved context. At the most conservative substitution distance, it reports rates of **4.6% and 8.5%** on the two tested models, with the rate increasing with model size within one family.

The abstract says natural-language-inference verification—the standard approach considered by the authors—performed indistinguishably from chance across models, including when restricted to the cited passage. It gives a structural explanation: a model answering from memory can select a citation that agrees with its already produced output. Among ten attribution methods compared on identical claims, the contrast between the model's output distribution with and without context separated provenance best. The authors nevertheless say that acting on this signal did not improve provenance honesty at the observed base rates because the detector measures what the model knew rather than cleanly identifying what it used.

## Scout interpretation

A citation can provide at least three useful receipts without establishing causal provenance:

1. the cited passage exists;
2. the passage semantically supports or agrees with the claim; and
3. the answer presents the passage as its source.

None proves that removing or changing that passage would have changed the answer. A model can recall the same fact from its parameters and then attach a compatible citation. Referential validity and entailment are therefore weaker predicates than **context dependence**.

For agent and RAG evaluations, provenance should be reported as a layered contract:

- **Citation integrity:** the reference resolves to exact retained bytes.
- **Support:** those bytes entail or otherwise justify the claim.
- **Availability:** the bytes were actually present in the model's recorded input.
- **Counterfactual sensitivity:** controlled removal or substitution changes the claim in the expected direction.
- **Operational confidence:** the attribution method is calibrated well enough at the deployment base rate to support an automated decision.

The final layer matters. The abstract does not support turning counterfactual attribution into a production gate merely because it outperformed other methods. It explicitly says the best signal remained insufficiently accurate for action. A system should preserve such a score as diagnostic evidence, with uncertainty and intervention details, rather than relabeling cited claims as definitively context-derived or memory-derived.

This finding complements [Memory receipts do not prove that an answer used the evidence](./2026-11-13-memory-receipts-do-not-prove-answer-use.md), which shows a selected and delivered receipt can still be incompletely reflected in an answer. The present paper identifies a different ambiguity: even a correct answer that agrees with its citation may have been produced without relying on the cited context. It also sharpens [Evidence-grounded judging needs citation and version boundaries](./2026-09-18-citation-bound-agent-judging.md): citation checks improve auditability, but causal evidence use remains a separate evaluation target.

## Retrieval record

The workflow-owned bounded request checked:

- **Endpoint:** `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`
- **HTTP status:** 200
- **Latency:** 428 ms
- **Request count:** 1
- **Retry-After:** not present

## Evidence limits

Scout reviewed only the arXiv feed's title, metadata, and abstract. The full paper, datasets, prompts, retrieved passages, substituted facts, substitution distances, claim extraction, model identities and sizes, decoding settings, ten attribution methods, natural-language-inference implementation, calibration, thresholds, confidence intervals, statistical tests, error analysis, code, and data were not inspected.

The abstract does not establish that every unchanged answer after substitution was generated from parametric memory, that every changed answer depended on the original passage, or that its rates transfer to other models, domains, retrieval systems, citation policies, or claim types. Counterfactual substitution can itself alter fluency, consistency, or model behavior in ways not visible from the abstract. The source supports separating citation agreement from causal context use and treating current attribution signals as diagnostic rather than decisive; it does not supply a validated production provenance oracle.
