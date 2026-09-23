<ai_context>
This finding examines pinned implementations and trust models for AI-agent audit evidence. It separates capture authenticity, content commitment, post-write mutation detection, clean-tail rollback detection, and the omission window introduced by asynchronous sealing; it does not treat repository tests or a live payment-discovery response as an independent security audit.
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

## Follow-up: an anchored commitment is not a semantic decision verdict

- **Source:** [HN item 49821905](https://news.ycombinator.com/item?id=49821905)
- **Repo:** [0xsims/rubric-attest](https://github.com/0xsims/rubric-attest)
- **Pinned revision:** [`66b8146325f5ca870ee16e3b02f363d5f79d61e1`](https://github.com/0xsims/rubric-attest/commit/66b8146325f5ca870ee16e3b02f363d5f79d61e1)

Rubric Decision Attestation adds a useful content-commitment layer to the same evidence stack. Its frozen DAR/0.1 record canonicalizes and hashes the schema, input, and output, includes those hashes in a per-agent linked record, and makes that record a Merkle leaf. The format explicitly labels the client timestamp as a claim; the batch anchor's consensus time is the trusted time ([record fields and time boundary](https://github.com/0xsims/rubric-attest/blob/66b8146325f5ca870ee16e3b02f363d5f79d61e1/spec/dar-0.1.md#L36-L75), [leaf construction](https://github.com/0xsims/rubric-attest/blob/66b8146325f5ca870ee16e3b02f363d5f79d61e1/spec/dar-0.1.md#L159-L173)). This can establish that supplied content matches a commitment included in a particular anchored batch without disclosing the content to the service in the default mode.

That guarantee is narrower than “verifying an agent decision.” The open verifier checks internal hash, Merkle-proof, root-reference, and caller-supplied signature consistency, but it neither contacts Hedera to prove that the root was anchored nor establishes that the signing key is trusted ([verifier scope](https://github.com/0xsims/rubric-attest/blob/66b8146325f5ca870ee16e3b02f363d5f79d61e1/packages/verify/src/verify.ts#L1-L10), [verification logic](https://github.com/0xsims/rubric-attest/blob/66b8146325f5ca870ee16e3b02f363d5f79d61e1/packages/verify/src/verify.ts#L33-L62)). Nor can a commitment prove that the client captured the real decision, that the schema describes an adequate policy, that the output was authorized or executed, or that omitted decisions never occurred. Raw-content retention is also a separate custody obligation: the default record carries only hashes, so later semantic review requires the relying party to preserve the corresponding inputs, outputs, and schema.

The client exposes another completeness boundary. `attest()` is intentionally non-blocking and swallows failures into an optional callback; without a shared chain-head store, chains are process-local, while a configured store failure skips the record rather than forking it ([attestor contract](https://github.com/0xsims/rubric-attest/blob/66b8146325f5ca870ee16e3b02f363d5f79d61e1/packages/attest-decision/src/attestor.ts#L1-L20), [error and store paths](https://github.com/0xsims/rubric-attest/blob/66b8146325f5ca870ee16e3b02f363d5f79d61e1/packages/attest-decision/src/attestor.ts#L107-L121)). The spool can also drop oldest pending records at its size cap, surfacing the loss through `onError` ([spool policy](https://github.com/0xsims/rubric-attest/blob/66b8146325f5ca870ee16e3b02f363d5f79d61e1/packages/attest-decision/src/spool.ts#L121-L148), [cap enforcement](https://github.com/0xsims/rubric-attest/blob/66b8146325f5ca870ee16e3b02f363d5f79d61e1/packages/attest-decision/src/spool.ts#L202-L220)). A sound integration must therefore treat a returned decision ID, durable local spooling, service admission, anchored inclusion, and semantic validation as distinct receipts.

The repository is unusually candid about institutional trust: its three signing regions are all operated by Rubric, so the current threshold protects against key compromise rather than the operator as an institution ([README](https://github.com/0xsims/rubric-attest/blob/66b8146325f5ca870ee16e3b02f363d5f79d61e1/README.md#L19-L24)). A live unauthenticated GET returned an x402 `402 Payment Required` discovery document advertising $0.10 verification and a free demo, which confirms endpoint shape and price on the observation date—not successful paid verification, anchor traversal, or independent operator diversity.

## Design implication

An agent audit verifier should expose separate verdicts rather than one `valid` bit:

- `capture_authenticity`: which principal or runtime signed the event before or at ingestion;
- `content_binding`: whether retained source content recomputes to the committed hashes;
- `raw_evidence_custody`: who retains the content needed for later semantic review;
- `range_integrity`: whether every row in the claimed range recomputes and links correctly;
- `range_completeness`: whether expected ordinals are contiguous, with scope and any allowed sparse-slice gaps explicit;
- `service_admission`: whether the service accepted the record, distinct from a local client return;
- `external_head_match`: whether the current chain head or included event matches a checkpoint obtained outside the mutable store;
- `anchor_coverage`: which events are checkpointed versus still pending;
- `unsealed_tail`: which admitted rows remain outside the verified prefix, plus the oldest unsealed age;
- `semantic_review`: whether the recorded action, decision, and policy interpretation are actually correct.

The external anchor must be independently retained, not merely written back into the same administrative domain. Otherwise a privileged operator who can rewrite both the log and its “anchor” can restore self-consistency without preserving history.

## Limits

This is repository-level implementation, documentation, and self-test evidence, not an independent cryptographic audit or proof of production deployment. The AI-Identity assessment downloaded the pinned verifier and its test file and independently executed two narrow unit tests—the tampered-link and per-organization sequence-gap cases—which passed; it did not run the full suite, validate the hosted checkpoint feed, inspect proprietary control-plane paths, or test resistance to key compromise. AI-Identity states that its API, gateway, dashboard, mandate service, and shared libraries are proprietary even though the verifier and integration surfaces are permissively licensed ([README](https://github.com/Levaj2000/AI-Identity/blob/3ba1bdf3507205d63a6a9d6d2fd24af377583db9/README.md#L91-L93), [licensing boundary](https://github.com/Levaj2000/AI-Identity/blob/3ba1bdf3507205d63a6a9d6d2fd24af377583db9/README.md#L128-L139)). The Preloop follow-up statically inspected its complete pinned tree, service, migration, and cited tests but did not execute them, inspect a deployment, measure actual sealing lag, or verify that a customer exported and retained any checkpoint. The Rubric follow-up inspected the complete pinned repository tree, specification, client spool, verifier, and relevant tests; a local `npm run check` could not start because the lockfile installation omitted the declared ESLint development binary in this environment. It did not make a payment, verify a real decision, traverse a Hedera anchor, audit the cryptography, or establish production adoption; the HN submission had one point and no comments when checked.
