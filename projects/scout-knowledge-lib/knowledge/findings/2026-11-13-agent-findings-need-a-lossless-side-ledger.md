<ai_context>
summary: "Pinned Clausura source shows a deterministic side ledger that preserves findings emitted before context compaction, while fresh runs rotate the prior ledger and resumes retain it. The implementation is best-effort, so ledger persistence still needs an observable durability contract before it can serve as authoritative evidence."
triggers: ["context compaction", "findings ledger", "lossless evidence", "attempt boundary", "Clausura", "agent CI gate"]
last_updated: "2026-11-13"
source_basis: "Static inspection of producer-authored source and tests at Clausura commit 44ee51aef7e7f27b873835a0c4119bc3bf7ccfcb; Scout did not run the software or test suite."
</ai_context>

# Agent findings need a lossless side ledger across context compaction

**Date:** 2026-11-13  
**Source:** GitHub  
**Disposition:** New knowledge

## Question

How can a long-running review agent keep findings discovered early in a run when later context truncation, summarization, or a malformed final answer would otherwise remove them from the final verdict?

## Source and reviewed version

- **Repo:** https://github.com/liuyanghejerry/Clausura
- **Inspected revision:** https://github.com/liuyanghejerry/Clausura/commit/44ee51aef7e7f27b873835a0c4119bc3bf7ccfcb
- **Discovery:** GitHub Repository Search API query `topic:ai-agents stars:>100`, sorted by recently updated; `incomplete_results: false`
- **Content read:** pinned README, recursive repository tree, and producer-authored Rust implementation and tests for the findings ledger, fresh-run initialization, incomplete-run merge, and fail-closed result handling

## What the source implements

Clausura does not rely on the model's final response to remember every issue found during a long review. After each model response, the agent loop leniently extracts any structured findings and appends them as JSON Lines to a task-scoped file under `.clausura/archives/`. When the agent stops normally, the runtime merges the final response with that ledger using a deterministic key over `rule_id`, location, and message. Final-response entries come first and win duplicate positions; ledger-only entries are appended.

The same merge is applied on the incomplete path, including context limits, token or iteration exhaustion, and an unparseable final answer. This matters because a later summary or final response can omit an issue that was present in an earlier tool-calling turn. A producer-authored asynchronous test constructs exactly that case: an early tool-calling response emits one finding, the final stop response emits another, and the returned result contains both. A separate unit test checks deterministic deduplication.

The ledger also has an attempt boundary. Before a non-resume run starts, `execute_single_task` renames an existing active ledger to `previous-findings-<task>-<uuid>.jsonl`; that archived file is kept for audit but is no longer consumed by the merge. A resume skips this rotation and continues with the active ledger. Sharded reviews use their own shard task IDs and rotate each shard's preceding ledger before execution.

## Reusable design rule

**Keep compacted conversation state and decision-bearing evidence on different durability paths.** A summary is a lossy reasoning aid; it should not be the sole carrier for findings, approvals, test failures, or other facts that determine a final gate. Persist those facts incrementally in a typed side ledger, merge them deterministically into the final result, and bind ledger reuse to the exact attempt semantics:

1. append evidence when it is first observed, before later context reduction;
2. make the merge deterministic and define which representation wins conflicts;
3. preserve evidence on incomplete termination as well as clean completion;
4. rotate stale evidence for a fresh attempt, but retain the active ledger for an explicit resume;
5. keep the archived predecessor inspectable without allowing it to contaminate the new verdict.

This is more specific than ordinary checkpointing. A conversation checkpoint helps execution continue; a side ledger preserves the **decision inputs** that execution has already produced.

## Important limit in the implementation

Clausura explicitly treats the ledger as best-effort. Append failures are logged only at debug level and ignored, and a missing or unreadable ledger is read as an empty vector. The source therefore demonstrates a useful anti-forgetting pattern, but not a fail-closed evidence guarantee. If a final CI verdict depends on the ledger, production runtimes should surface ledger-write and ledger-read failure as typed evidence-integrity states, or make the authoritative gate fail closed when preservation cannot be proved.

The ledger's deduplication identity also uses semantic fields rather than a durable observation ID. Two genuinely separate observations with the same rule, location, and message collapse, while a wording change can preserve near-duplicates. That behavior is suitable for the project's reported finding set but is not a general event-log identity scheme.

## Relevance to agent runtimes

Agent systems that compact context already distinguish a live prompt from durable task state. Clausura adds a useful third layer: a narrow, append-oriented record of facts that must survive prompt rewriting. For May-style long-running Tasks, the comparable application would be to preserve decision-bearing receipts outside summaries while binding their reuse to Task generation and attempt identity. The key lesson is not to copy Clausura's file format; it is to prevent lossy conversational maintenance from silently deleting evidence used for acceptance or gating.

## Limitations

Scout inspected the pinned implementation and repository-authored tests statically. Scout did not build Clausura, run its tests, execute an LLM review, force a real compaction or crash, inspect filesystem durability under power loss, or validate concurrent writers. Repository-authored tests establish intended behavior, not independent operational reliability.

## Primary source links

- [Agent-loop append, normal merge, and incomplete merge](https://github.com/liuyanghejerry/Clausura/blob/44ee51aef7e7f27b873835a0c4119bc3bf7ccfcb/crates/clausura-core/src/agent.rs)
- [Fresh-run rotation and result handling](https://github.com/liuyanghejerry/Clausura/blob/44ee51aef7e7f27b873835a0c4119bc3bf7ccfcb/crates/clausura-core/src/executor.rs)
- [Task contract and default-enabled ledger field](https://github.com/liuyanghejerry/Clausura/blob/44ee51aef7e7f27b873835a0c4119bc3bf7ccfcb/crates/clausura-core/src/types.rs)
- [Producer documentation](https://github.com/liuyanghejerry/Clausura/blob/44ee51aef7e7f27b873835a0c4119bc3bf7ccfcb/README.md)
