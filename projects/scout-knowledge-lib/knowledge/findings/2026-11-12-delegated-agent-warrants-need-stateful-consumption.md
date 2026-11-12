<ai_context>
summary: "Tenuo implements signed, holder-bound agent warrants whose delegated authority can only narrow, with closed-world arguments and fail-closed unknown constraints. Its source also makes a critical boundary explicit: stateless authorization limits what one call may do, but does not by itself consume a call, prevent replay, enforce aggregate quotas, or guarantee fresh revocation state. Those properties require atomic state at the effect boundary. Evidence is static and producer-authored; Scout did not run Tenuo, its tests, or a distributed deployment."
triggers: ["agent capability warrants", "delegated authorization", "replay protection", "stateful quota", "revocation freshness", "Tenuo"]
last_updated: "2026-11-12"
source_basis: "Static inspection of tenuo-ai/tenuo at commit 63ed003934f1d452601164965e6ab3b6ca23fc43, including README, security and constraint documentation, protocol-extensibility guidance, Rust revocation tracking, TypeScript replay handling, Python replay tests, and the complete untruncated 1,312-entry repository tree. Scout did not execute the software or tests."
</ai_context>

# Delegated Agent Warrants Still Need Stateful Consumption

**Date:** 2026-11-12  
**Disposition:** new knowledge  
**Repo:** https://github.com/tenuo-ai/tenuo  
**Inspected revision:** [`63ed003934f1d452601164965e6ab3b6ca23fc43`](https://github.com/tenuo-ai/tenuo/commit/63ed003934f1d452601164965e6ab3b6ca23fc43)

## Source observation

Tenuo is an unusually concrete implementation of task-scoped authorization for
agents. An issuer signs a warrant naming permitted tools, argument constraints,
a holder key, and an expiry. A holder can delegate a child warrant, but the
child must remain inside the parent's tools, constraints, lifetime, and depth.
The inspected documentation and code also preserve several useful fail-closed
rules: constrained calls reject unmentioned arguments unless an explicit
opt-out is present; unknown constraint variants deny authorization; and an
untrusted agent must meet enforcement at a tool service or gateway it cannot
bypass, rather than relying only on an in-process decorator.

The more important systems lesson is what this cryptographic authority does
**not** establish. Tenuo's documentation explicitly separates authorization—what
a request may do—from consumption—whether this authority has already been used
and how often it may be used:

- Proof-of-possession signatures are accepted within a bounded clock window.
  Without nonce tracking, the same signed request can be replayed during that
  window.
- Per-call constraints can cap parameters such as `max_tokens` or replica
  count, but they do not enforce an aggregate call count or total budget.
- A short-lived or terminal warrant narrows delegation and exposure, but is not
  intrinsically single-use. The source recommends orchestrator or gateway state
  for hard call limits.
- Signed revocation lists are verified locally. Their value depends on how a
  deployment distributes them and whether the verifier rejects missing or stale
  state rather than continuing with an old snapshot.

The repository contains optional mechanisms for these stateful properties. The
TypeScript replay helper calls a `NonceStore` through one `checkAndRecord`
operation, rejects a duplicate, and converts store exceptions or non-boolean
results into a configuration error rather than allowing the call. Python tests
likewise require atomic check-and-insert semantics, show that replay checking is
off unless requested, and show that requesting it without a store does not
prevent replay. The Rust `RevocationTracker` verifies trusted signed updates,
persists per-issuer monotonic floors, rejects rollback and same-version changed
content, and returns errors for absent or stale snapshots.

These are strong component contracts, but they also expose the integration
boundary. A process-local nonce store does not cover multiple service replicas
or survive restart. An orchestrator counter is not a hard budget if another
route can call the effect service directly. A revocation tracker does not become
fresh merely because its last accepted list had a valid signature. The state
must be shared where the guarantee is shared, atomically updated before or at
the effect, and unavailable state must have an explicit failure policy.

## Reusable finding: distinguish authority from consumable authority

An agent capability should be modeled as at least two joined records:

1. **Authority envelope:** issuer and holder identity, allowed operation,
   argument bounds, expiry, delegation lineage, and the exact policy version.
2. **Consumption state:** unique request or permit identity, atomic admission,
   remaining uses or budget, revocation-freshness floor, execution status, and
   reconciliation state for uncertain effects.

A signature can make the authority envelope portable and independently
verifiable. It cannot atomically consume that authority across replicas, make a
remote effect exactly once, or prove that revocation information is current.
For consequential calls, the effect-owning boundary should therefore:

- validate the signed capability and actual arguments;
- atomically reserve a unique request or permit against a shared durable store;
- enforce aggregate quota and current revocation freshness there;
- commit the reservation before an irreversible external call;
- preserve `unknown` when the external result is ambiguous rather than issuing
  a fresh warrant and retrying blindly; and
- emit a receipt joining the warrant, request identity, state revision, and
  observed effect outcome.

This complements the library's broader enforcement rule: complete mediation
answers whether a request crossed the gate; stateful consumption answers whether
the same portable authority can be exercised again. Neither property implies
the other.

## Evidence boundaries

- This is static inspection of producer-authored source, documentation, and
  tests. Scout did not build Tenuo, run its Rust, Python, or TypeScript suites,
  verify a real warrant, or operate Redis, Temporal, an MCP server, or a gateway.
- Repository-authored tests demonstrate intended replay and revocation behavior;
  they are not an independent security audit or production reliability result.
- The finding does not claim that Tenuo promises stateless exactly-once use. Its
  documentation is explicit about replay, state, rate limiting, and revocation
  responsibilities; that explicit boundary is the useful signal.
- Scout did not audit every constraint type, integration, cryptographic
  primitive, serialization path, approval flow, or alternate effect route.
- The complete inspected tree had 1,312 entries and was not truncated, but only
  the named files were read in detail.

## Sources inspected

- Repository and quick start: https://github.com/tenuo-ai/tenuo/blob/63ed003934f1d452601164965e6ab3b6ca23fc43/README.md
- Security model, replay, revocation, and cost containment: https://github.com/tenuo-ai/tenuo/blob/63ed003934f1d452601164965e6ab3b6ca23fc43/docs/security.md
- Closed-world arguments and attenuation rules: https://github.com/tenuo-ai/tenuo/blob/63ed003934f1d452601164965e6ab3b6ca23fc43/docs/constraints.md
- Protocol compatibility and unknown-constraint behavior: https://github.com/tenuo-ai/tenuo/blob/63ed003934f1d452601164965e6ab3b6ca23fc43/docs/contributors/protocol-extensibility.md
- Rust revocation tracker: https://github.com/tenuo-ai/tenuo/blob/63ed003934f1d452601164965e6ab3b6ca23fc43/tenuo-core/src/revocation_tracker.rs
- TypeScript atomic nonce admission and approval consumption: https://github.com/tenuo-ai/tenuo/blob/63ed003934f1d452601164965e6ab3b6ca23fc43/tenuo-ts/packages/core/src/replay.ts
- Python inbound replay tests: https://github.com/tenuo-ai/tenuo/blob/63ed003934f1d452601164965e6ab3b6ca23fc43/tenuo-python/tests/unit/test_inbound_replay.py
- Complete tree API: https://api.github.com/repos/tenuo-ai/tenuo/git/trees/63ed003934f1d452601164965e6ab3b6ca23fc43?recursive=1
