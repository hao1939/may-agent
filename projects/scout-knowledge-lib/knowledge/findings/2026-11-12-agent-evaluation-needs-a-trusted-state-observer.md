<ai_context>
summary: "Pinned GitHub assessment of SafeAgentEval: transactional-agent evaluation separates reply quality from independently observed state, records per-turn snapshots for time-bound claim checking, and makes the state provider an explicit trust root. The implementation is pre-release, banking-only, producer-authored evidence; Scout did not execute it or independently validate its provider, scenarios, artifacts, tests, or benchmark results."
triggers: ["SafeAgentEval", "SafeOrderBench", "state-verified agent evaluation", "transactional agent evaluation", "state observer", "StateProvider", "claim verification", "per-turn snapshots"]
last_updated: "2026-11-12"
source_basis: "Static review of producer-authored GitHub source at pinned revision eba116fc302e87158fced38e21171cc240f0c675."
</ai_context>

# Agent evaluation needs a separately trusted state observer

**Date:** 2026-11-12  
**Disposition:** New source-grounded implementation signal  
**Repo:** https://github.com/rcirigiri/SafeAgentEval  
**Inspected revision:** [`eba116fc302e87158fced38e21171cc240f0c675`](https://github.com/rcirigiri/SafeAgentEval/commit/eba116fc302e87158fced38e21171cc240f0c675)

## Question

What evidence should decide whether a transactional agent acted safely and
reported its actions truthfully when the agent's internal tool calls are not
visible to the evaluator?

## What the source implements

SafeAgentEval drives a black-box session agent with scripted customer turns,
then grades two different surfaces:

1. whether the observed system state equals one of the scenario's authorized
   final states; and
2. whether checkable claims extracted from the agent's replies match state
   recorded from the turn in which each claim was made onward.

The harness does not execute the agent's tools or treat the agent's metadata as
ground truth. A `StateProvider` seeds and reads the sandbox system of record.
The runner records a snapshot after each customer turn plus a final snapshot,
checks domain invariants, and stores the run in a hash-linked trace. Pass/fail
for state is deterministic; language models may extract claims or act as
secondary judges, but the README says they do not decide the state verdict.

The producer-authored trust-control tests cover several useful negative cases:
seed read-back mismatch aborts before the agent receives a turn, a randomized
round-trip probe catches a provider that behaves differently on arbitrary
state, inconsistent banking snapshots fail conservation or reference checks,
and a reply's balance claim is checked against the state associated with its
own turn rather than only the ending balance.

SafeOrderBench currently supplies 16 public banking scenarios across
confirmation, state modification, ambiguity, privacy, prompt injection,
duplicate transaction, and partial-failure categories. Adversarial cases have
benign controls so blanket refusal cannot produce a perfect score.

## Reusable design signal

**A state-aware evaluator is only as independent as the component that observes
state.** SafeAgentEval explicitly calls the provider the trust root and labels
who operated it as `harness`, `auditor`, or `self_reported`. Its trust document
states that an evaluatee-controlled provider can simply return an authorized
state, so downstream scoring and a valid hash chain cannot repair a dishonest
measurement origin.

For effectful-agent evaluation, keep these evidence layers separate:

- **reply evidence:** what the agent said;
- **timeline evidence:** what the system state showed after each turn;
- **outcome evidence:** the final state and domain invariants;
- **observer provenance:** who controlled the reader and its credentials;
- **artifact integrity:** which scenario, snapshots, and trace bytes were later
  verified as unchanged.

Per-turn state is particularly important. A final snapshot may prove an ending,
but it cannot by itself determine whether a claim was true when spoken or
whether a prohibited early action was later repaired. Conversely, a hash-linked
trace can expose later modification of recorded events without proving that the
state observer told the truth when those events were created.

## Limits and open boundaries

- The project describes itself as pre-release research software and says a
  passing benchmark run is not a production safety certification.
- The released scenario set covers one synthetic banking/payments domain. Its
  dataset card says the included audit is an author self-audit; an independent
  domain-expert audit has not occurred.
- The `provider_trust` value is a recorded declaration. The trust document
  explicitly says setting the label does not create operational separation.
- Public scenarios and authorized states permit preparation or canned behavior;
  private randomized variants and a frozen held-out commitment are discussed,
  but the frozen held-out split is planned rather than released here.
- Final-state grading still has timing limits. The dataset card says scenarios
  are written so later confirmation cannot rescue a premature action, rather
  than claiming the final snapshot generally reconstructs action timing.
- The framework recommends two independent read channels for highest assurance;
  Scout did not find evidence in the reviewed files that the published pilot
  used such dual observation.
- Scout inspected static producer-authored documentation, Python source, tests,
  scenarios, and a pilot manifest. Scout did **not** run the harness or tests,
  connect a real agent or state provider, reproduce the pilot, verify artifact
  completeness, assess the claim extractor's accuracy, or independently audit
  security and reliability.

## Relationship to existing Scout knowledge

This provides an implementation-level instance of the library's broader
[output-only evaluation limitation](../agent-evaluation-research-beyond-outputs.md)
and complements [effect-closure evidence](../agent-runtime-effect-integrity.md):
observing the external state is stronger than accepting an agent's success
message, but the observer's control and provenance remain part of the verdict.

## Primary inspected sources

- [README and scoring/trust overview](https://github.com/rcirigiri/SafeAgentEval/blob/eba116fc302e87158fced38e21171cc240f0c675/README.md)
- [State-provider trust model](https://github.com/rcirigiri/SafeAgentEval/blob/eba116fc302e87158fced38e21171cc240f0c675/docs/trust_model.md)
- [Agent contract](https://github.com/rcirigiri/SafeAgentEval/blob/eba116fc302e87158fced38e21171cc240f0c675/docs/agent_contract.md)
- [SafeOrderBench dataset card](https://github.com/rcirigiri/SafeAgentEval/blob/eba116fc302e87158fced38e21171cc240f0c675/safeorderbench/DATASET_CARD.md)
- [Harness-side state invariants](https://github.com/rcirigiri/SafeAgentEval/blob/eba116fc302e87158fced38e21171cc240f0c675/src/safeagenteval/scoring/invariants.py)
- [Typed claim verification](https://github.com/rcirigiri/SafeAgentEval/blob/eba116fc302e87158fced38e21171cc240f0c675/src/safeagenteval/claims/verifier.py)
- [Producer-authored trust-control tests](https://github.com/rcirigiri/SafeAgentEval/blob/eba116fc302e87158fced38e21171cc240f0c675/tests/integration/test_trust_controls.py)
- [Published pilot manifest](https://github.com/rcirigiri/SafeAgentEval/blob/eba116fc302e87158fced38e21171cc240f0c675/artifacts/pilot/blackbox_v1/manifest.json)

## Discovery record

GitHub Repository Search API query: `"AI agent" "audit" in:name,description,readme pushed:>2026-10-01`, sorted by `updated` descending, 20 results. The API returned `incomplete_results: false`. Repository contents were inspected only after pinning the revision above.
