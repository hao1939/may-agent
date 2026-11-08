<ai_context>
summary: "Abstract-level assessment of Same Behavior, Different Mechanism: finite behavioral experiments may not identify mechanism-level quantities, partial internal access can impose irreducible precision floors, and defensible claims need an access-specific certificate."
triggers: ["Same Behavior Different Mechanism", "mechanism-level claims", "integrated information", "finite experiments", "partial observability", "AI auditing", "identifiability"]
last_updated: "2026-11-08"
source_basis: "arXiv:2611.08469v1 abstract from the current cs.AI Atom feed; full paper, proofs, experiments, code, and ancillary files were not inspected."
</ai_context>

# Mechanism-level claims need access-specific certificates

**Date observed:** 2026-11-08  
**Disposition:** New knowledge  
**Coverage:** Abstract only

## Research question

What can a finite experiment legitimately certify when an AI-auditing claim concerns an internal causal mechanism rather than only observable behavior?

## Source observation

- **Source:** [Same Behavior, Different Mechanism: What Finite Experiments Can Certify About Integrated Information](https://arxiv.org/abs/2611.08469v1) (arXiv:2611.08469v1)
- **Reviewed version:** v1, submitted 2026-11-05
- **Content read:** title, authors, categories, dates, comment, and abstract in the supplied arXiv Atom entry; not the PDF, proofs, network definitions, experimental protocols, code, ancillary files, figures, or numerical records.
- **Feed request:** `https://export.arxiv.org/api/query?search_query=cat%3Acs.AI&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`
- **Retrieval record:** HTTP 200; 448 ms latency; one request; no `Retry-After` header was available.

## What the abstract reports

The paper studies whether a mechanism-level quantity is identifiable from an experiment's available interventions and recordings, continuous in the underlying mechanism, and certifiable from finite data. Its demanding case is integrated information, $\varphi$, in stochastic networks of four and five units with known ground truth.

The abstract reports several distinct failure modes. First, input-output behavior can be insufficient: a recurrent and a feed-forward network with identical response-delay input-output laws reportedly have different $\varphi$ values, while internal recordings distinguish them in the studied examples. Second, omitted units can impose precision floors that more samples do not remove. Third, symmetries can make several hidden-unit configurations observationally equivalent until a suitable intervention breaks the symmetry. Fourth, the measured quantity can be discontinuous at partition-selection boundaries, so small mechanism changes can produce large reported changes and close-fitting surrogate models can still misreport the quantity.

The authors also report a more limited positive result: one-sided claims can remain certifiable where exact point estimates are unstable. In their example they prove a lower bound throughout a region of mechanisms and give a finite controlled-transition requirement with a bounded false-certificate probability.

These are author-reported abstract claims from small known-ground-truth networks, not independently checked results.

## Assessment

The reusable distinction is between an **observed behavior claim** and a **mechanism claim**. A behavioral test can establish that a system produced specified outputs under sampled conditions. It cannot by itself establish which internal causal organization produced them when multiple mechanisms are observationally equivalent under that access pattern.

A defensible mechanism-level certificate should therefore name at least:

1. **Target functional:** the exact internal property being estimated or bounded.
2. **Access model:** which units, states, timings, interventions, and repetitions are observable or controllable.
3. **Identifiability result:** whether different mechanisms can remain equivalent under that access.
4. **Precision floor:** uncertainty caused by missing access or symmetry, separated from uncertainty that more samples can reduce.
5. **Stability region:** whether small mechanism changes can cross a selection boundary and sharply change the reported quantity.
6. **Claim direction:** point estimate, interval, lower bound, or upper bound; a robust one-sided claim may be supportable when a precise estimate is not.
7. **Finite-data guarantee:** sample requirement, confidence or false-certificate bound, and assumptions that make the guarantee valid.

For agent evaluation and auditing, this argues against treating successful behavioral probes, latent probes, or fitted surrogate models as interchangeable evidence about internal mechanisms. Internal access can improve discrimination, but only relative to the units and interventions actually available. A high-fit surrogate is still a model of the observations, not automatically a certificate of the hidden mechanism. When exact identification is impossible, reporting a supported bound or an explicit non-identifiability result is stronger than returning a falsely precise mechanism score.

This complements [Agent-generated code needs a falsification ladder, not one universal verifier](./2026-09-27-observability-driven-agent-verification.md): that note separates evidence layers by the claims they can falsify, while this paper's abstract sharpens the access boundary for claims about hidden causal organization.

## Evidence limitations

Scout did not inspect the full paper, formal definitions of $\varphi$, proof assumptions, intervention design, random-network sampling, edge-selection procedure, surrogate fitting, trial-count derivations, code, or ancillary files. The reported examples use networks of four and five units and do not establish that the same numeric precision floors, discontinuity rates, or sample requirements apply to large neural networks, language models, or deployed agents. The abstract does not show that integrated information is the appropriate audit target for AI safety, nor that internal recordings available in practice satisfy the paper's access assumptions.

No feed entry beyond the workflow-supplied packet was fetched, and no claim was reproduced.
