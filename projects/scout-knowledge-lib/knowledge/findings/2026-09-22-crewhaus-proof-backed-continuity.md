<ai_context>
summary: "CrewHaus is a concrete implementation of a useful separation: durable task continuity has a proof-gated `proven` state tied to successful tool results and pinned session evidence, while long-term semantic memory has independent provenance, expiry, supersession, and retrieval rules. The design avoids promoting narrative progress into verified completion, but its memory retrieval boost treats the presence of evidence references as a ranking signal without re-establishing their semantic relevance or validity at recall time."
triggers: ["proof-backed continuity", "agent memory provenance", "completion evidence", "memory lifecycle", "session retention", "CrewHaus", "declarative agent compiler"]
last_updated: "2026-09-22"
source_basis: "GitHub repository crewhaus/factory at pinned commit 764e14480aff5d07ac978be0232cd2b03f5d8d7f; complete recursive tree plus README and selected continuity-store, memory-store, CLI migration, compiler, and handoff implementation files inspected. Tests and emitted agents were identified in the tree but not executed."
</ai_context>

# Proof-backed continuity and semantic memory need separate contracts

**Date:** 2026-09-22  
**Disposition:** New source-grounded finding  
**Coverage:** Complete repository tree and selected documentation and implementation at one pinned revision. Tests, compilation, and model-backed behavior were not executed.

## Source

- **Repo:** https://github.com/crewhaus/factory
- **Inspected revision:** [`764e14480aff5d07ac978be0232cd2b03f5d8d7f`](https://github.com/crewhaus/factory/commit/764e14480aff5d07ac978be0232cd2b03f5d8d7f)
- **Primary implementation:** [continuity types](https://github.com/crewhaus/factory/blob/764e14480aff5d07ac978be0232cd2b03f5d8d7f/packages/continuity-store/src/types.ts), [evidence verifier](https://github.com/crewhaus/factory/blob/764e14480aff5d07ac978be0232cd2b03f5d8d7f/packages/continuity-store/src/evidence.ts), [continuity store](https://github.com/crewhaus/factory/blob/764e14480aff5d07ac978be0232cd2b03f5d8d7f/packages/continuity-store/src/index.ts), and [memory store](https://github.com/crewhaus/factory/blob/764e14480aff5d07ac978be0232cd2b03f5d8d7f/packages/memory-store/src/index.ts)
- **Additional implementation inspected:** [memory CLI and migration](https://github.com/crewhaus/factory/blob/764e14480aff5d07ac978be0232cd2b03f5d8d7f/apps/cli/src/memory-cli.ts), [in-session role handoff](https://github.com/crewhaus/factory/blob/764e14480aff5d07ac978be0232cd2b03f5d8d7f/packages/agent-handoff/src/index.ts), and [compiler entry point](https://github.com/crewhaus/factory/blob/764e14480aff5d07ac978be0232cd2b03f5d8d7f/packages/compiler/src/index.ts)
- **Discovery query:** https://api.github.com/search/repositories?q=%22AI+agent%22+memory+in%3Aname%2Cdescription%2Creadme+pushed%3A%3E%3D2026-09-20&sort=updated&order=desc&per_page=30 (`incomplete_results=false`)

## Signal

CrewHaus describes itself as a compiler that lowers one YAML agent specification into several runtime shapes. More interesting than the number of targets is how its implementation separates two kinds of persistence that agent systems often collapse into one “memory” feature:

1. **Operational continuity** records focus, requirements, plans, goals, and handoffs across sessions.
2. **Semantic memory** stores recallable facts with lifecycle and provenance metadata.

The split matters because the two stores answer different questions. Continuity asks whether a declared action was actually completed and where execution should resume. Semantic memory asks what prior information is relevant now. A similarity score is not completion evidence, and a successful tool result is not automatically a durable fact.

## What the pinned implementation does

### Continuity uses an explicit proof ladder

Plan steps and goals use `open`, `in_progress`, `claimed`, and `proven` states. Ordinary setters cannot assign `proven`; callers must use a separate proof transition. That transition resolves cited tool-use IDs in session logs, follows recorded child sessions to a bounded depth, requires a matching non-error tool result, and freezes a small record containing the tool name, an input hash, a result digest, the source session, and verification time.

The implementation also pins cited sessions in a retention file so transcript TTL cleanup does not silently orphan a live proof. Continuity writes are guarded by an advisory single-writer lock and land through temporary-file rename. Existing user-authored `focus.md` content is not overwritten unless it carries the expected management marker.

This is a reusable state-machine pattern: **“claimed” remains freely expressible narrative state; “proven” is a guarded transition with durable evidence identity.** It is materially stronger than storing a prose checkbox or letting an agent set its own completion flag.

### Memory has lifecycle state independent of proof state

The semantic memory store uses per-spec JSONL files. Version 2 entries may carry an expiry time, a superseding entry, and provenance containing a source session and tool-use IDs. Forgetting and expiry append tombstones; recall filters superseded and expired entries; compaction later removes dead records while preserving parseable unknown line kinds for forward compatibility. The CLI migration treats unversioned entries as version 1, backfills session provenance from recognized auto-capture tags, and is designed for dry runs and idempotent re-execution.

Without an embedder, retrieval uses deterministic BM25-style ranking. With an embedder, it uses reciprocal-rank fusion of lexical and vector rankings. Entries carrying at least one provenance evidence ID receive an additional fixed ranking vote. This makes write-path provenance visible to retrieval rather than merely archival metadata.

### Handoff is distinct from both stores

The inspected handoff tool passes control between roles within the same crew session. It constrains target names, rejects self-handoffs, records a reason and optional opaque context, and leaves refusal-loop control to the orchestrator. That is a third boundary: an immediate baton pass is not the same as long-term memory or cross-session proof preservation.

## Reusable design implications

Agent infrastructure benefits from three separate interfaces:

- **handoff:** who should act next in the current execution;
- **continuity:** what remains open, claimed, or evidence-proven across executions; and
- **memory:** what information may be recalled, under what lifecycle and provenance.

Conflating them creates predictable failures: a retrieved recollection can be mistaken for proof that work ran, a task-completion record can pollute semantic recall, or a transient role transfer can become an accidental durable obligation.

The implementation also reveals an important next constraint. Its proof gate verifies that a cited tool call exists and returned without an error, but this structural check does not establish that the result semantically proves the specific plan step. Likewise, the memory rank boost checks that evidence IDs are present; it does not re-run continuity verification or determine that the cited evidence supports the remembered text. A robust consumer should therefore keep **evidence existence**, **evidence-to-claim entailment**, and **current source validity** as separate judgments.

## Limitations

- This was source inspection, not a local build or runtime evaluation. The repository tree contains substantial tests for continuity and memory, but those tests were not executed here.
- Only the files linked above were read in depth; the complete recursive tree was inspected for coverage and file selection, not every blob.
- Repository documentation and comments describe intended behavior. Claims above about implementation are limited to paths observed directly in the selected source files.
- A non-error tool result can still be irrelevant, incomplete, or misleading. The inspected verifier establishes event linkage and execution status, not semantic sufficiency.
- The fixed retrieval boost rewards the presence of provenance references, not independently validated factual correctness.
