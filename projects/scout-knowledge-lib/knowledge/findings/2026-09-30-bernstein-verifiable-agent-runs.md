<ai_context>
This finding examines Bernstein's attempt to make agent-run evidence independently checkable through deterministic coordination, chained journals, and signed receipts. Scout inspected a pinned repository revision and selected documentation, implementation, and tests statically; no package was installed, no run was executed, and no cryptographic claim was independently reproduced.
</ai_context>

# Verifiable agent runs need three different proofs

**Date:** 2026-09-30  
**Repo:** <https://github.com/sipyourdrink-ltd/bernstein>  
**Pinned revision inspected:** [`a7b2da27c9bc049dfe9606f272952a29634bd42a`](https://github.com/sipyourdrink-ltd/bernstein/tree/a7b2da27c9bc049dfe9606f272952a29634bd42a)  
**Disposition:** New knowledge

## Question

What evidence must an agent runtime preserve so that a reviewer can distinguish an internally consistent event log, a complete finished run, and a run produced by the claimed operator?

## Finding

Bernstein makes a useful distinction that many agent audit designs blur: **chain consistency, finished-log identity, and signer provenance are separate claims.** Its always-on journal hashes decision-relevant event content into a chain while excluding timing fields. Recomputing that chain can find edited or reordered recorded steps, but a clean prefix remains valid after trailing rows are removed. A separately sealed head plus event count is needed to identify the complete finished journal. A signed run receipt can then bind the embedded journal, lineage, and optional audit range; an out-of-band trusted public key is still needed to attribute that receipt to an operator.

This is more useful than the repository's broad “deterministic” label. The pinned docs explicitly limit hermetic LLM replay to Bernstein's internal `call_llm` path: subprocess coding agents contact their providers outside that recording. Coordination re-derivation also does not rerun agents; it holds recorded planning and task outcomes fixed, then checks whether the scheduler could have produced the recorded sequence. The design therefore supplies several narrow proofs, not proof that an agent's work was correct or that an entire live execution was deterministic.

## What the pinned source shows

### 1. The event journal authenticates decisions, not its clock envelope

`core/replay/journal.py` computes a payload hash after removing `ts`, `elapsed_s`, index, and derived chain fields, then hashes the previous head, event type, payload hash, and monotonic index. This lets two timing-different executions produce the same head when their authenticated event sequence is identical. The implementation also validates run IDs and uses containment-checked journal paths, addressing a different threat: a valid chain located outside the intended run tree.

The documentation is unusually explicit about the boundary. `ts` and `elapsed_s` remain useful for an operator timeline but are unauthenticated. Tolerant reads report discarded physical line indices. Verification returns separate chain-consistency, reader-coverage, and identity states rather than one overloaded `ok` flag.

### 2. A hash chain cannot prove that the tail is present

Deleting one or more complete trailing rows leaves a valid chain for the surviving prefix. Bernstein's docs therefore call an unsealed journal identity `unverifiable`, even when recomputation succeeds. A `JournalSeal` commits to both head and event count; without an independent commitment, clean truncation is intentionally undetectable.

This is the main reusable lesson for agent runtimes: **tamper evidence is not completeness evidence.** An append-only-looking JSONL file, or even a Merkle-linked one, cannot by itself establish that the reviewer received the final state.

### 3. Offline integrity and operator provenance are different receipt tiers

The documented run receipt embeds timing-excluded journal rows, lineage entries, and an optional audit range, then signs a subject binding their recomputed heads. The verifier is described as rebuilding those heads before checking an Ed25519 signature. With only the receipt's embedded public key, a pass establishes internal integrity but not who signed it. Supplying an independently trusted public key raises the claim to provenance; the CLI also exposes a `--require-provenance` mode with a distinct exit code when only integrity was reached.

This is a useful API pattern: do not let “signature valid” collapse self-consistency and trust-anchor verification into the same success state.

### 4. Replay coverage is deliberately narrower than whole-run reproducibility

Strict replay keys internal LLM responses by model, prompt, provider, temperature, and token limit. A miss aborts by default, while an explicit environment flag permits live fall-through. But the docs state that CLI-agent subprocess traffic is not recorded, so replaying Bernstein's internal planning calls does not replay the coding agents' model interactions.

The separate coordination `--re-derive` path reconstructs scheduler decisions from recorded plan and task-outcome inputs in a throwaway sandbox. It can reject unreachable claims or outcomes, but it executes no adapter, task server, or network call. Short runs may lack the periodically recorded plan graph and therefore return `plan_missing`. This should be read as a scheduler-evidence check, not behavioral reproduction of an agent run.

## Evidence strength

The repository tree contains dedicated journal, lineage, receipt, verifier, property, and integration test files. The inspected divergence integration test constructs two fake-adapter journals, changes one tool result, and asserts that the diff identifies the changed step and field. It also demonstrates an escalation helper that raises on divergence. This is inspectable test intent, not evidence that Scout ran the suite or that every production path uses the helper correctly.

The repository reports Apache-2.0 licensing, more than 1,300 GitHub stars at observation, and beta status. Popularity and a large test inventory do not establish correctness, deployment maturity, or cryptographic assurance.

## Reusable implications

1. **Return a verdict vector, not one `verified` boolean.** At minimum expose chain consistency, input coverage, finished-state identity, and signer provenance separately.
2. **Seal both head and count outside an append-only log.** Otherwise clean tail deletion is indistinguishable from an earlier legitimate state.
3. **Name unauthenticated fields.** Excluding clocks can improve deterministic comparison, but users must not infer that the displayed timeline is protected by the same chain.
4. **Bind receipts to independently recomputed material.** A signed assertion of a head is weaker than a receipt whose verifier reconstructs the head from embedded rows before signature verification.
5. **State replay coverage by execution boundary.** Replaying orchestrator calls, re-deriving scheduler choices, and rerunning agent subprocesses are three different operations.
6. **Treat tests as evidence about intended contracts.** Static test inspection does not prove that the suite passes at the pinned revision or that deployed integrations preserve those contracts.

## Limitations and risks

- Scout performed static inspection only. It did not install Bernstein, run its tests, verify the committed demo receipt, or reproduce journal truncation and tamper cases.
- The project labels itself beta and solo-maintained; its known-limitations page says adapter behavior varies, multi-node operation is advanced, verification confidence depends on project checks, and documentation can lag.
- The inspected integration test uses a fake adapter and an older persistence-journal surface; it is supporting evidence for test intent, not end-to-end proof of the current canonical journal path.
- A valid receipt does not prove that task outputs are correct, policy-compliant, harmless, or complete unless those properties are themselves represented by trustworthy evidence and admission rules.
- An embedded signing key provides integrity, not identity. Provenance depends on external key distribution and trust decisions that the receipt cannot bootstrap itself.
- GitHub repository metadata, star count, and documentation claims were not treated as proof that the implementation works in production.

## Sources inspected

- Discovery query (Search API returned `incomplete_results: false`): <https://api.github.com/search/repositories?q=topic%3Aai-agents+pushed%3A%3E%3D2026-09-29+stars%3A%3E20&sort=updated&order=desc&per_page=20>
- Repository metadata: <https://api.github.com/repos/sipyourdrink-ltd/bernstein>
- Pinned repository tree: <https://github.com/sipyourdrink-ltd/bernstein/tree/a7b2da27c9bc049dfe9606f272952a29634bd42a>
- [README](https://github.com/sipyourdrink-ltd/bernstein/blob/a7b2da27c9bc049dfe9606f272952a29634bd42a/README.md)
- [Deterministic replay and signed run receipts](https://github.com/sipyourdrink-ltd/bernstein/blob/a7b2da27c9bc049dfe9606f272952a29634bd42a/docs/operations/deterministic-replay.md)
- [Known limitations](https://github.com/sipyourdrink-ltd/bernstein/blob/a7b2da27c9bc049dfe9606f272952a29634bd42a/docs/reference/KNOWN_LIMITATIONS.md)
- [Canonical event journal implementation](https://github.com/sipyourdrink-ltd/bernstein/blob/a7b2da27c9bc049dfe9606f272952a29634bd42a/src/bernstein/core/replay/journal.py)
- [Replay-divergence integration test](https://github.com/sipyourdrink-ltd/bernstein/blob/a7b2da27c9bc049dfe9606f272952a29634bd42a/tests/integration/test_replay_divergence.py)
