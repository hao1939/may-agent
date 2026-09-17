<ai_context>
This finding examines pinned GitHub implementations and trust models for AI-agent audit evidence. It separates capture authenticity, post-write mutation detection, clean-tail rollback detection, and the omission window introduced by asynchronous sealing; it does not treat repository tests as an independent security audit.
</ai_context>

# Audit integrity needs a capture boundary and an external tail anchor

**Date:** 2026-09-14  
**Source:** GitHub  
**Repo:** [Levaj2000/AI-Identity](https://github.com/Levaj2000/AI-Identity)  
**Pinned revision:** [`3ba1bdf3507205d63a6a9d6d2fd24af377583db9`](https://github.com/Levaj2000/AI-Identity/commit/3ba1bdf3507205d63a6a9d6d2fd24af377583db9)

## Finding

AI-Identity's pinned trust model makes a useful three-way distinction that a single “tamper-evident log” label usually hides:

1. **Capture authenticity:** a chain seals what its writer receives. If an upstream producer fabricates an event before it reaches the writer, later integrity checks faithfully preserve the falsehood. The repository therefore limits its attestation claim to a signed commitment over specific audit rows, not proof of agent intent, policy correctness, or producer truth ([trust model](https://github.com/Levaj2000/AI-Identity/blob/3ba1bdf3507205d63a6a9d6d2fd24af377583db9/docs/forensics/trust-model.md#L13-L31), [explicit non-claims](https://github.com/Levaj2000/AI-Identity/blob/3ba1bdf3507205d63a6a9d6d2fd24af377583db9/docs/forensics/trust-model.md#L80-L91)).
2. **Post-write mutation and internal deletion:** chained HMACs expose changed payloads or broken links, while a gap-free per-organization sequence exposes missing rows in the middle. The open verifier recomputes entries, checks adjacent linkage, and treats an organization-scope sequence gap as a break ([verifier](https://github.com/Levaj2000/AI-Identity/blob/3ba1bdf3507205d63a6a9d6d2fd24af377583db9/cli/ai_identity_verify.py#L769-L865)). Its repository tests include both a changed `prev_hash` and a deleted-middle-row sequence gap ([tests](https://github.com/Levaj2000/AI-Identity/blob/3ba1bdf3507205d63a6a9d6d2fd24af377583db9/cli/test_verify.py#L563-L572), [per-org gap test](https://github.com/Levaj2000/AI-Identity/blob/3ba1bdf3507205d63a6a9d6d2fd24af377583db9/cli/test_verify.py#L705-L744)).
3. **Clean tail truncation:** deleting the newest suffix can leave a shorter chain internally valid; neither link verification nor an in-database sequence can prove that a later head once existed. The repository answers this with signed Merkle checkpoints and exported case files held outside the mutable store. A relying party can verify a checkpoint signature and an event's RFC 6962 inclusion path without database access or the chain's shared secret ([trust-model boundary](https://github.com/Levaj2000/AI-Identity/blob/3ba1bdf3507205d63a6a9d6d2fd24af377583db9/docs/forensics/trust-model.md#L106-L128), [anchor design](https://github.com/Levaj2000/AI-Identity/blob/3ba1bdf3507205d63a6a9d6d2fd24af377583db9/docs/forensics/evidence-anchor-reference-notes.md#L21-L32)). Recent events remain explicitly `pending` until a checkpoint includes them ([coverage format](https://github.com/Levaj2000/AI-Identity/blob/3ba1bdf3507205d63a6a9d6d2fd24af377583db9/docs/forensics/evidence-anchor-reference-notes.md#L63-L81)).

The non-obvious boundary is temporal: internal chaining can prove continuity only relative to the evidence presented, while rollback resistance requires a previously exported commitment that the current operator cannot rewrite. “Append-only” database permissions raise the cost of mutation, but they are not the same guarantee.

## Follow-up: asynchronous sealing creates an explicit coverage window

**Repo:** [preloop/preloop](https://github.com/preloop/preloop)  
**Pinned revision:** [`eba3184c419014c84232358ca740504647a3e0d3`](https://github.com/preloop/preloop/commit/eba3184c419014c84232358ca740504647a3e0d3)

Preloop independently implements the same boundary and documents an additional operational trade-off. Its per-account sealer assigns a monotonic sequence, links canonical row hashes, and emits Ed25519-signed checkpoints. It runs after request-path capture rather than inside each audited transaction because locking the account head inline would serialize a high-throughput gateway path and could let a chain failure fail the action being audited. The source states the cost directly: a recently written row remains unsealed until a bounded sweep, and deletion before sealing leaves no sequence gap to detect ([design commentary and checkpoint trust boundary](https://github.com/preloop/preloop/blob/eba3184c419014c84232358ca740504647a3e0d3/backend/preloop/services/audit_chain.py#L1-L49), [sealer implementation](https://github.com/preloop/preloop/blob/eba3184c419014c84232358ca740504647a3e0d3/backend/preloop/services/audit_chain.py#L338-L430)).

The repository's tests cover changed rows, middle and tail deletion, rewritten links, signed checkpoints, checkpoint/chain mismatch, and two concurrent first sealers producing one contiguous chain ([chain tests](https://github.com/preloop/preloop/blob/eba3184c419014c84232358ca740504647a3e0d3/backend/tests/services/test_audit_chain.py), [PostgreSQL concurrency tests](https://github.com/preloop/preloop/blob/eba3184c419014c84232358ca740504647a3e0d3/backend/tests/models/test_audit_chain_state_concurrency.py)). This is implementation evidence for the contract, not proof that a deployed sweeper always runs or that an external party retains checkpoints.

Preloop also makes the external-anchor requirement unusually explicit: because the platform stores the account's encrypted private key, compromise of that same platform can permit new self-consistent checkpoints. Historical rollback resistance therefore depends on a checkpoint copy retained by the customer outside the platform. A signature strengthens who can rewrite an anchor; it does not make a co-located copy independent.

This yields a useful status model for asynchronous chains: report an **unsealed tail** separately from a verified sealed prefix, expose the oldest unsealed age, and never let `chain_ok` imply that every admitted event is already covered by a checkpoint.

## Design implication

An agent audit verifier should expose separate verdicts rather than one `valid` bit:

- `capture_authenticity`: which principal or runtime signed the event before or at ingestion;
- `range_integrity`: whether every row in the claimed range recomputes and links correctly;
- `range_completeness`: whether expected ordinals are contiguous, with scope and any allowed sparse-slice gaps explicit;
- `external_head_match`: whether the current chain head or included event matches a checkpoint obtained outside the mutable store;
- `anchor_coverage`: which events are checkpointed versus still pending;
- `unsealed_tail`: which admitted rows remain outside the verified prefix, plus the oldest unsealed age;
- `semantic_review`: whether the recorded action, decision, and policy interpretation are actually correct.

The external anchor must be independently retained, not merely written back into the same administrative domain. Otherwise a privileged operator who can rewrite both the log and its “anchor” can restore self-consistency without preserving history.

## Limits

This is repository-level implementation, documentation, and self-test evidence, not an independent cryptographic audit or proof of production deployment. The AI-Identity assessment downloaded the pinned verifier and its test file and independently executed two narrow unit tests—the tampered-link and per-organization sequence-gap cases—which passed; it did not run the full suite, validate the hosted checkpoint feed, inspect proprietary control-plane paths, or test resistance to key compromise. AI-Identity states that its API, gateway, dashboard, mandate service, and shared libraries are proprietary even though the verifier and integration surfaces are permissively licensed ([README](https://github.com/Levaj2000/AI-Identity/blob/3ba1bdf3507205d63a6a9d6d2fd24af377583db9/README.md#L91-L93), [licensing boundary](https://github.com/Levaj2000/AI-Identity/blob/3ba1bdf3507205d63a6a9d6d2fd24af377583db9/README.md#L128-L139)). The Preloop follow-up statically inspected its complete pinned tree, service, migration, and cited tests but did not execute them, inspect a deployment, measure actual sealing lag, or verify that a customer exported and retained any checkpoint.
