<ai_context>
This finding examines SAFESEP's pinned executable model of evidence-gathering under unresolved authorization. Its reusable signal is that authorization must cover the diagnostic action itself in every still-compatible state; repository constructions and self-tests are formal/synthetic evidence, not deployment validation or an established novelty claim.
</ai_context>

# Authorization evidence acquisition must itself be authorized

**Date:** 2026-09-16  
**Source:** GitHub  
**Repo:** [Arithmetic-Power-Geometry/SAFESEP](https://github.com/Arithmetic-Power-Geometry/SAFESEP)  
**Pinned revision:** [`fdbf89ea1319251dac3f232cb386b41b26f5a3c2`](https://github.com/Arithmetic-Power-Geometry/SAFESEP/commit/fdbf89ea1319251dac3f232cb386b41b26f5a3c2)

## Finding

Agent authorization is often modeled as a terminal question: gather context, then decide whether to allow an effect. SAFESEP exposes a prior question: **was the agent entitled to gather each piece of evidence used to make that decision while the relevant authorization state was still unresolved?** Its rule is conservative and explicit: at a branch containing several compatible worlds, a probe may run only when it is admissible in every world still possible ([model](https://github.com/Arithmetic-Power-Geometry/SAFESEP/blob/fdbf89ea1319251dac3f232cb386b41b26f5a3c2/src/safesep/model.py#L11-L22), [minimax solver](https://github.com/Arithmetic-Power-Geometry/SAFESEP/blob/fdbf89ea1319251dac3f232cb386b41b26f5a3c2/src/safesep/solver.py#L26-L60)). The search stops when all remaining worlds require the same authorization decision, not necessarily when their exact state is identified.

The repository's small matched construction shows why permission counts and information value are insufficient summaries. Systems A and B have the same worlds, decisions, probe outcome maps, costs, number of admissible worlds per probe, unconstrained optimum, and one-step baseline. They differ only in *which* worlds admit the second probe. In A, the first observation removes the one world that would block that probe, allowing a cost-2 resolution; in B, the blocking world remains in the residual branch, leaving no legitimate resolver ([construction and proof](https://github.com/Arithmetic-Power-Geometry/SAFESEP/blob/fdbf89ea1319251dac3f232cb386b41b26f5a3c2/docs/IRREDUCIBILITY_RESULT.md#L5-L36)). The operational implication is that an agent cannot safely decide from aggregate statements such as “this API is authorized in three of four cases.” It needs the branch-relative incidence relation between unresolved states and probe authority.

A second certificate restates the obstruction as incompatible decision pairs. It filters to probes legitimate across the current branch, measures which allow/deny pairs each probe separates, and returns an immediate obstruction when none separates any pair; otherwise it computes a coarse cover lower bound rather than claiming an optimal policy ([implementation](https://github.com/Arithmetic-Power-Geometry/SAFESEP/blob/fdbf89ea1319251dac3f232cb386b41b26f5a3c2/src/safesep/legitimate_pair_cover_bound.py#L20-L80)). Its matched A/B regression holds raw partitions and costs fixed while varying legitimacy incidence ([tests](https://github.com/Arithmetic-Power-Geometry/SAFESEP/blob/fdbf89ea1319251dac3f232cb386b41b26f5a3c2/tests/test_legitimate_pair_cover_bound.py#L10-L33)). Scout independently executed the pinned functions for the 200-world case: the cheapest unresolved probe left 9,900 incompatible pairs, A had lower bound 1, and B's residual branch was obstructed.

## Design implication

An authorization planner for evidence-seeking agents should track at least four different predicates per branch:

1. **informative:** can the probe distinguish states that require different decisions?
2. **branch-legitimate:** is the probe authorized in every state still compatible with observations?
3. **authority-changing:** can the probe legitimately acquire a credential or capability that changes what later probes may do?
4. **decision-sufficient:** do all resulting branches converge on one authorization verdict?

This prevents “grant to know whether granting was allowed”: an agent should not read a protected file, reveal a policy component, query a privileged identity attribute, or obtain a credential merely because that evidence would settle the downstream decision. Audit receipts should therefore cover evidence acquisition as a first-class effect, including the compatible-state set or policy commitment against which the probe was admitted.

Static filtering is not enough for credential workflows. A one-outcome action can leave the information state unchanged while legitimately changing authority and unlocking a later probe. The repository explicitly records this as a prior soundness correction and says only true no-ops may be skipped ([README](https://github.com/Arithmetic-Power-Geometry/SAFESEP/blob/fdbf89ea1319251dac3f232cb386b41b26f5a3c2/README.md#L21-L22)). A practical runtime therefore needs joint information-and-authority state, not a planner that prunes every non-informative action.

## Limits

This is a new, zero-star repository observed on its creation day. Its evidence is executable Python, synthetic constructions, documentation, and author-defined tests; it has no demonstrated production integration, independent review, or empirical agent benchmark. Scout could not run the full pytest suite because pytest is unavailable in the environment, although the pinned pair-cover functions and core assertions were executed directly.

The repository is appropriately cautious about scope. It does not claim novelty for belief-state planning, trust negotiation, proof-carrying authorization, minimal disclosure, or generic set-cover reductions, and describes its static pair-cover result as colliding with prior work ([README](https://github.com/Arithmetic-Power-Geometry/SAFESEP/blob/fdbf89ea1319251dac3f232cb386b41b26f5a3c2/README.md#L15-L19), [current status](https://github.com/Arithmetic-Power-Geometry/SAFESEP/blob/fdbf89ea1319251dac3f232cb386b41b26f5a3c2/README.md#L57-L61)). Its public-dataset audit also says existing authorization datasets lack the counterfactual world-by-probe legitimacy and authority-transition labels needed for this model, so the reported 10,000-world scale is controlled structural stress, not real-world validation ([data boundary](https://github.com/Arithmetic-Power-Geometry/SAFESEP/blob/fdbf89ea1319251dac3f232cb386b41b26f5a3c2/docs/COMPLEXITY_AND_REAL_DATA.md#L23-L36)).
