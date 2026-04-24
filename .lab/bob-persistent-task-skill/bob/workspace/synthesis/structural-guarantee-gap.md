# Synthesis: The "Structural Guarantee Gap" — One Meta-Pattern, Not One Mechanism

**Date**: 2026-04-17
**Author**: Bob (heartbeat synthesis)
**Inputs read**: KE-187, KE-188, KE-195, KE-196, KE-208, KE-211; H-098 (Ch2 sub-taxonomy), H-165 (displacement)
**Scope**: Under 200 lines, one coherent claim, no few-shot template.

---

## TL;DR

The six KEs are **not facets of one underlying mechanism**. They describe failures at **five distinct verification layers**. However, they ARE facets of one *meta*-pattern: a verification guarantee proven at layer N does **not** transfer to layer N+1, and our corpus keeps rediscovering this at each new layer we probe. I call this the **Structural Guarantee Gap (SGG)**. It is a framing, not a mechanism. The candidate hypothesis it generates (H-XXX below) is *falsifiable* because it makes a concrete prediction that distinguishes "one mechanism" from "distinct layers."

---

## The Five Layers (explicit map)

| # | Layer | KE | What a guarantee at this layer looks like | What leaks through |
|---|---|---|---|---|
| L1 | Declarative config | KE-211 | "YAML is well-formed; declared tools exist." | Code binding missing or wrong shape (94.1% of real configs) |
| L2 | Retrieval / access | KE-188 | "P(access) = 1 — the knowledge is in context." | P(applies) ≈ 0 for judgment-declarative rules (EXP-082) |
| L3 | World-state / absent-info | KE-187 | "Context is complete for what the agent reasons about." | Policy-relevant information simply is not present; agent reasons correctly over an incomplete world (PhantomPolicy N=600) |
| L4 | Cognitive capacity | KE-195 + KE-196 | "Expert content is provided (F1)." | Forcing self-production (F2) consumes the budget expert content needed to land; 100% → 7% on hard tasks |
| L5 | Token-level coupling | KE-208 | "Finish block looks like verification." | Bi-predictability collapsed; surface grammar preserved, structural coupling to trace gone (FM-3.3 confabulation) |

KE-211's own summary table (reproduced mentally) already admits this disjointness: "Three layers, disjoint coverage" — types, bi-predictability, runtime world-model. The 6 KEs here are that same observation plus KE-188 (L2) and KE-195/196 (L4). So the layered picture is already latent in our corpus; this synthesis names it.

## Question 1 — One mechanism, or distinct?

**Answer: Distinct.** Five observations forced the split:

1. **Interventions don't generalize across layers.** Typed evidence (L1/L5-prereq, KE-211 P-211b) cannot fix L4 displacement (KE-195). Difficulty-adaptive guards (L4) cannot fix L3 absent-info (KE-187's Sentinel slice). Sentinel-style runtime verification (L3) cannot fix L5 confabulation. If there were one mechanism, an intervention anywhere should help everywhere; we instead see layer-specific efficacy.
2. **The failure modes have different temporal signatures.** L1 is pre-runtime (static). L3 is early-runtime (context-assembly). L4 is mid-runtime (generation-time capacity). L5 is late-runtime (finish-time coupling). They can't collapse to one mechanism because they fire at different times.
3. **KE-188's P(access) vs P(applies) split is the meta-observation already.** KE-188 is not a sibling of the other five; it is *about* the non-transfer between layers. That strongly suggests the right frame is layered, not unified.
4. **H-098's Ch2 sub-taxonomy (Self / Environment / World-Model) maps cleanly into L3–L5** but cannot absorb L1 (that's channel-agnostic structural composition) or L4 (that's capacity, orthogonal to channel). So even the broadest unifying hypothesis we have (H-098) does not swallow all six.
5. **KE-195/196 was produced by actively *falsifying* a unification attempt.** H-165 proposed anchoring as a single mechanism explaining F1→F2 collapse. EXP-166 Arm D killed it. The field has already tested "one mechanism" once; it lost.

## Question 2 — Discriminating prediction (unified vs distinct)

The cleanest single test:

> **If one mechanism**: an intervention that fixes any one KE should reduce failure rates on all six to a similar degree. Concretely, if typed `verification_evidence` (KE-211 P-211b) also reduces L3 absent-info failures and L4 displacement failures by ≥30pp each, unification is alive.
>
> **If distinct layers**: typed evidence will drop L5 (FM-3.3 confabulation) ≥80pp, leave L3 absent-info unchanged (no bearing on context completeness), and leave L4 displacement unchanged or slightly *worse* (the extra structural constraint is an alignment-tax load at exactly the capacity layer that is already overloaded, per KE-091).

This is testable with the finish-guard rollout already sketched in KE-211. Measure three things post-rollout: FM-3.3 rate (L5), policy-invisible leak rate (L3 proxy: unhandled-error finishes), and hard-task completion rate (L4 proxy: EXP-178's cascading-fix-trap-v2 arm). Prediction: only the first drops meaningfully.

## Question 3 — Candidate new hypothesis (H-XXX)

**H-XXX (working title): Layered Verification Insufficiency / Structural Guarantee Gap**

*Thesis*: Agent verification operates at discrete layers (declarative config → access → world-state → capacity → token-coupling). A guarantee proven at layer N is independent evidence about layer N+1 only via an assumption that is empirically false in our stack. As a result, effective verification cost is **additive across layers**, not multiplicative or shared. Any single-layer intervention has a bounded ceiling ≈ (fraction of failures attributable to that layer). Interventions that try to span layers without explicit cross-layer type obligations pay an alignment-tax penalty (KE-091) at the layer already closest to saturation.

*Predicted effect sizes* (priors, not measured):
- Each layer explains roughly 10–40% of total failures; the distribution is skewed toward L3 and L4 in our current regime, L1 in external corpora (DD-767's 94.1%).
- A single-layer intervention's maximum achievable production improvement ≈ its layer's share. So typed-evidence (mostly L5) caps around 15–25pp on aggregate Bob failures.
- Multi-layer stacks without explicit type-bridges degrade per KE-123 (≥12–15pp penalty when stacking two behavioral interventions at the same or adjacent layers).

*Discriminating test*: the one in Question 2. Rolling out typed `verification_evidence` as a finish-guard and measuring the three proxies simultaneously separates "one mechanism" from "distinct layers" within ~50 sessions at essentially zero dollar cost (observational).

*Novelty vs existing H*: H-098 is a channel theory (*where* interventions act); H-165/H-166 are content/capacity theories; H-XXX is a **layer theory** — orthogonal axis. It predicts *ceilings* on single-layer interventions, which no current hypothesis does. Priority: Medium — interesting framing but not urgent; would be auto-tested by the KE-211 rollout anyway.

## Question 4 — Implications for EXP-178 interpretation

EXP-178 (difficulty-adaptive content-first guards, G1/G2/G3/G4) is an **L4 intervention**. Under the SGG framing:

1. **Read it narrowly.** EXP-178 results speak to capacity displacement (L4) and its difficulty moderation. They are **silent** on L3 absent-info failures, L5 FM-3.3, and L1 structural incompleteness. Do not treat an EXP-178 win as evidence that "content-first guards fix verification failures" broadly — that would conflate layers.
2. **Watch for L5 leakage in the results.** If G2/G3 (forced production arms) show lower bi-predictability in their finish blocks than G1/G4, that is a *separate* finding (L5) riding along — tag it distinctly rather than folding it into the capacity story.
3. **Pre-register the ceiling prediction.** Under SGG, G4 (difficulty-adaptive, the "correct" layer-matched intervention) should beat G2/G3 on the hard scenario by ≥50pp AND should **not** differ meaningfully from G1 (plain content-first) on the easy scenario. A result where G4 also beats G1 on easy tasks would suggest the intervention is doing cross-layer work and is evidence *against* strict layer separation — worth watching.
4. **Don't re-run EXP-178 with a typed-evidence finish guard bolted on.** Under SGG, stacking an L4 fix with an L5 fix at the same session risks alignment-tax confounding (KE-091, KE-123). Run them as independent experiments and compose post-hoc.

## Honest null-result check

The most deflationary reading of this synthesis is: "You didn't unify anything; you drew a table." That is half-true. The table *is* the contribution — because our prior discourse was treating these six KEs as independent findings floating in different threads. Naming the five layers and committing to the prediction in Question 2 creates an actual obligation: the next intervention we deploy will either respect the layer structure (and hit its predicted ceiling) or violate it (and force revision). Either way we learn, which is more than we had when the findings were uncatalogued.

## What this does NOT claim

- Does not claim the five layers are exhaustive. A sixth layer (e.g., inter-agent coordination; cross-session continuity) may exist.
- Does not claim the layers are causally ordered (L1 failing → L2 failing). Empirically they co-occur independently; that's *why* guarantees don't transfer.
- Does not claim typed composition (KE-211) is the right response to all five. It's the right response to L1 and part of L5.
- Does not propose promoting this to a priority hypothesis. P(H-XXX) seems moderate (~0.6); the *framing* is valuable even if H-XXX ultimately reduces to "KE-188 applied recursively."

## Actionable next steps (cheap)

1. **If this synthesis survives a review pass**, draft H-XXX as an actual hypothesis file with P-XXX-a/b/c tied to the KE-211 finish-guard rollout, so its discriminating prediction is measured for free.
2. **Tag the five KEs** with a `layer:L1..L5` metadata field in the INDEX so future cross-references don't re-collapse them.
3. **Revise EXP-178's results-interpretation section** to include the narrow-reading caveat in Implication #1 above.

## Pointers

- KE-211's own closing table is the nearest prior art to this synthesis; it stops one step short of naming layer-independence as a framing claim.
- H-098 §"Ch2 Sub-Taxonomy" handles the L3 slice at higher resolution.
- KE-091 is the caution label: every layer-matched intervention has an alignment-tax tail; additive-cost-across-layers means stacking is non-trivially harmful.
- KE-188's access-vs-applies split is the proto-version of this whole document; in hindsight we should have generalized it 10 KEs earlier.
