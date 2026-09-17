<ai_context>
summary: "EBL-Core separates an agent's ALLOW decision, a verifiable release-condition record, the issuance of action-scoped authority, and single-use redemption at the protected effect. The useful control-plane lesson is that an approval receipt is not authority and authority is not proof of execution: exact candidate identity, policy versions, expiring evidence, and current state must remain bound through redemption."
triggers: ["EBL-Core", "Execution Release Contract", "execution grant", "agent authorization", "high-risk actions", "redemption", "candidate binding", "policy non-weakening"]
last_updated: "2026-09-11"
source_basis: "arXiv 2609.11596v1 API metadata and full HTML paper, including its executable-artifact results and stated limitations."
</ai_context>

# Agent Approval Needs a Separate Execution-Grant Boundary

**Date:** 2026-09-11  
**Status:** Source-grounded finding  
**Source:** https://arxiv.org/abs/2609.11596v1  
**Full text:** https://arxiv.org/html/2609.11596v1

## Signal

*From Intent to Execution Grant* specifies EBL-Core, a conformance profile for
the last transition between an AI-generated candidate action and permission to
cause its external effect. Its useful contribution is not a new general-purpose
policy language or capability system. It makes four states that agent runtimes
often collapse into “approved” observably distinct:

1. **Adjudication** decides whether one canonical, fully materialized candidate
   satisfies trusted intent, Root and Operational Policies, typed evidence
   obligations, context, and time constraints.
2. An **Execution Release Contract (ERC)** binds those inputs, the decision, its
   reason, and a checkable derivation. It is a release-condition record, not an
   authority-bearing token.
3. **Grant issuance** may derive narrowly scoped execution authority only from a
   verified ALLOW ERC.
4. **Redemption** rechecks the exact candidate, policy versions, evidence and
   current conditions at the protected transition, then atomically consumes a
   single-use grant with the effect.

This separation closes two common semantic gaps. First, a decision about an
intent class does not silently authorize a later, mutated concrete action.
Changing a transfer recipient, for example, changes canonical candidate
identity and requires new adjudication. Second, a valid decision at time *t*
does not imply permission at execution time: expired approval evidence, changed
policy versions, revocation, expiry, or changed context must make redemption
deny.

The profile also makes **policy non-weakening** explicit. An Operational Policy
may add conjunctive constraints but cannot delete or reinterpret Root Policy
obligations. This is a useful boundary for delegated agent workflows: a local
worker can narrow authority without inheriting the power to relax the owner's
root constraints.

## Executable evidence, with a narrow claim

The paper's standard-library Python reference artifact instantiates one
financial-transfer profile. In the retained run, 34 static vectors and 15
lifecycle/mutation checks matched expected outcomes. Across 100 trials, 32
concurrent redemption attempts produced exactly one successful redemption and
one protected test effect per trial; 100 revoke–redeem races ended in a valid
terminal state.

Those tests demonstrate that the specified subset is executable. They do **not**
show production security. The adjudicator and verifier share canonicalization
and commitment primitives and were not independently implemented; the grant
store is in-memory; no concrete adapters compare Cedar, Rego, capability, or
agent-runtime integrations; and only one action profile is exercised.

## Design implication: preserve four different receipts

An agent control plane should record, and avoid conflating:

- **Decision receipt:** why the exact candidate was allowed under committed
  inputs.
- **Release-condition receipt:** the verified conditions under which authority
  may be issued.
- **Grant lifecycle receipt:** whether scoped authority was issued, revoked,
  expired, or consumed.
- **Effect/outcome receipt:** what the effector actually attempted, what external
  state changed, and whether the intended outcome occurred.

The first three are prospective authorization evidence; the fourth is execution
lineage and outcome evidence. A verified ALLOW result proves neither that a
grant was issued nor that an effect happened. Conversely, a consumed grant does
not prove that the effector faithfully realized the candidate or that the
external outcome was correct.

For high-risk tool calls, the practical enforcement point is therefore
**redemption**, not planning or approval alone. Candidate validation, mutable
condition checks, grant consumption, and the protected effect need one
authoritative linearization boundary. A nonce by itself is insufficient: two
consumers can accept the same nonce unless they share an authoritative state
transition.

## Boundary of the finding

EBL-Core assumes trusted intent construction, truthful evidence, faithful
effectors, protected components, and complete mediation through the declared
interface. It does not establish human-intent correctness, evidence truth,
global non-bypassability, absence of hidden effect paths, faithful execution, or
correct external outcomes. Its strongest immediate value is as a precise
conformance vocabulary and mutation-test oracle for agent runtimes—not as a
claim that the wider deployment is secure.
