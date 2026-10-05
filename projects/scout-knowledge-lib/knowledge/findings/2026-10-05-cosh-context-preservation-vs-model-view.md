<ai_context>
summary: "Cosh's 'never truncates context' claim is best understood as preserving an append-only authoritative session while presenting a bounded, derived model view. Raw history, masking decisions, compaction coverage, and resumable MapReduce state remain replayable; tool outputs can still be shortened in the prompt and old turns summarized. This separation makes preservation auditable without pretending every token remains visible to the model."
triggers: ["Cosh", "co-sh", "never truncates context", "append-only agent history", "model-view compaction", "context checkpoint", "MapReduce summarization", "recoverable tool-output truncation"]
last_updated: "2026-10-05"
source_basis: "HN item 49956592, the public Cosh site, and static inspection of DiegoZaluski/co-sh at revision 868b44efc36a9cd5a3984c3a127eee9d47a2df41, especially docs/context-compaction.md, context-manager code, summarizer prompts, and tool-output truncation code. Scout did not build Cosh, run its tests, or reproduce its context guarantees."
</ai_context>

# Context preservation and model visibility are different guarantees

**Date:** 2026-10-05  
**Disposition:** New knowledge  
**Source:** https://news.ycombinator.com/item?id=49956592  
**Site:** https://www.co-sh.com  
**Repo:** https://github.com/DiegoZaluski/co-sh  
**Inspected revision:** [`868b44efc36a9cd5a3984c3a127eee9d47a2df41`](https://github.com/DiegoZaluski/co-sh/commit/868b44efc36a9cd5a3984c3a127eee9d47a2df41)

## Question

What can an agent reasonably mean when it says it “never truncates context,” and what evidence would make that promise useful rather than misleading?

## Source observation

HN item 49956592 calls Cosh “a Rust agent that never truncates context.” The linked site describes a terminal-native, open-source coding agent, but the inspected repository shows that the useful distinction is not “every historical token is sent on every model call.” Instead, Cosh separates an authoritative session history from the bounded view composed for a model.

Its context design says the session JSONL is authoritative and append-only. User turns, assistant output, tool calls and results, masking decisions, compaction metadata, and resumable MapReduce progress are reconstructed by replaying deltas. A compaction checkpoint is appended as derived evidence with explicit covered ranges; it does not replace the source transcript. Fork, revert, and rollback append references rather than rewriting prior bytes.

The model view is deliberately smaller:

- an agent can mask the newest tool result, leaving a typed reference while retaining the raw payload in history;
- a recent raw window remains verbatim while older eligible material is folded into a structured checkpoint;
- when one-shot summarization does not fit, whole context items are mapped, hierarchically reduced, and validated;
- large shell and web outputs keep a head and tail in the prompt while their omitted middle is written to a content-addressed scratch log that tools can read later.

Cosh therefore *does* shorten what the model sees. The stronger, defensible claim is that shortening the active view need not destroy the authoritative source or hide which ranges a summary covers.

## Why the distinction matters

“Context” often conflates at least four artifacts:

1. **authoritative history** — the original events available for replay, audit, fork, or recovery;
2. **current model view** — the bounded messages sent on this inference call;
3. **derived checkpoint** — a lossy continuation artifact with declared source coverage;
4. **externalized payload** — raw content retained outside the prompt and recoverable by reference.

A system can preserve the first while compacting the second. Conversely, a provider may expose a large context window while the harness has already destroyed or silently replaced old evidence. Product claims should name the layer they protect.

Cosh's design includes useful integrity mechanisms for the derived layer: source item IDs and fingerprints, whole-item segmentation, explicit range coverage owned by the application rather than the summarizer, natural-completion checks before accepting generated summaries, bounded retries/repartitions, and rejection of a checkpoint that still does not fit. Its documentation also retains negative boundaries: structured summaries and model-based validation do not guarantee factual recall, and an omission already made during mapping can escape a later audit.

## Practical implication

An agent harness promising durable context should expose separate receipts for storage and projection:

- an immutable or append-only source identity and replay boundary;
- the exact source ranges included, hidden, externalized, or summarized for each model call;
- the checkpoint's generator, completion status, and validation state;
- recoverable references for omitted large payloads, plus an explicit failure when retention did not succeed;
- a test that reconstructs the same branch after restart, fork, revert, and partial compaction failure.

This turns “never truncates” from a vague token-count claim into two testable promises: **the source is retained**, and **every bounded model view declares how it was derived**. It still does not prove that a summary preserved the facts needed for task success; that requires live-model recall and downstream-completion evaluation.

## Evidence and limitations

The repository documentation reports an offline scripted fixture in which original items were retained across masking, one-shot, split, and MapReduce paths, and says separate tests cover overflow, repeated checkpoints, source replacement, interruption, and restoration. Scout inspected the static documentation and relevant source but did not run those tests or the application. The fixture uses scripted summaries rather than live-model responses, so it supports orchestration and persistence behavior—not semantic recall quality, provider performance, or the website's broad headline.

The HN item had two points and one author comment at inspection, and the repository had zero GitHub stars. This is an implementation pattern with limited community validation, not evidence of production reliability.

## Sources reviewed

- [HN item 49956592](https://news.ycombinator.com/item?id=49956592)
- [Cosh public site](https://www.co-sh.com)
- [Repository README at the inspected revision](https://github.com/DiegoZaluski/co-sh/blob/868b44efc36a9cd5a3984c3a127eee9d47a2df41/README.md)
- [Layered context compaction design](https://github.com/DiegoZaluski/co-sh/blob/868b44efc36a9cd5a3984c3a127eee9d47a2df41/docs/context-compaction.md)
- [Context manager implementation](https://github.com/DiegoZaluski/co-sh/blob/868b44efc36a9cd5a3984c3a127eee9d47a2df41/src/harness/context/mod.rs)
- [MapReduce staging and coverage](https://github.com/DiegoZaluski/co-sh/blob/868b44efc36a9cd5a3984c3a127eee9d47a2df41/src/harness/context/map_reduce.rs)
- [Recoverable tool-output truncation](https://github.com/DiegoZaluski/co-sh/blob/868b44efc36a9cd5a3984c3a127eee9d47a2df41/src/harness/truncate.rs)
