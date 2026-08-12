<ai_context>
summary: "HN's agent-hop makes five coding-agent histories searchable and converts them through a shared user/assistant text representation into target-native session files. The implementation exposes a portability boundary: transcript continuity can be useful without preserving tool state, policy, provenance, or execution semantics, so imported history should be typed and labeled rather than treated as a native continuation."
triggers: ["agent-hop", "cross-agent resume", "session portability", "transcript conversion", "coding-agent history", "provenance loss"]
confidence: "medium"
discovered: "2026-08-08"
source_basis: "HN item 49224884 and hetpatel-11/agent-hop repository at commit b69790dd562022ca8e352cc2f3cd5670a6ca5e53"
</ai_context>

# Cross-agent resume is transcript import, not runtime-state portability

**Date:** 2026-08-08  
**Source:** https://news.ycombinator.com/item?id=49224884  
**Repo:** https://github.com/hetpatel-11/agent-hop  
**Inspected commit:** `b69790dd562022ca8e352cc2f3cd5670a6ca5e53`

## Signal

The Show HN project **agent-hop** searches local Claude Code, Codex, OpenCode,
Pi, and Grok Build histories, then either resumes a result in its original tool
or converts it into another tool's native session format. The search layer is a
practical response to fragmented local histories: it indexes bounded transcript
text and combines lexical, fuzzy, and local embedding retrieval.

The more important architectural signal is in the handoff layer. Every source
adapter reduces a session to the same representation:

```ts
interface Turn { role: "user" | "assistant"; text: string }
```

The target adapter then synthesizes the files or import payload expected by the
target CLI and launches that CLI's normal resume command. The implementation is
concrete rather than aspirational: Codex receives both API-facing
`response_item` records and TUI-facing `event_msg` records; Grok receives both
`chat_history.jsonl` and ACP-style `updates.jsonl`; OpenCode uses its export and
import commands while deriving a field-complete template from an existing local
session. The README says all five adapters were checked with a live model call
that recalled injected content. That is an author-reported compatibility test,
not an independent verification in this scan.

## Portability boundary

**A conversation that can be displayed and continued is not necessarily the
same execution context.** The common representation retains user and assistant
text, but not tool calls or results, system/developer instructions, permission
and approval decisions, sandbox state, compaction lineage, token/accounting
facts, model identity, or the distinction between observed output and trusted
state.

The synthetic target records can also overstate provenance. For example, the
Claude and Pi writers label imported assistant text with target-model metadata,
and the Grok writer emits target-model and runtime fields even when the text was
produced in another harness. The text may be useful context, but those fields do
not prove that the named target model generated it or that the target runtime
executed the preceding actions.

This yields four distinct continuity claims that runtimes should report
separately:

1. **Transcript continuity** — prior human/assistant text is visible to the new
   model.
2. **Provenance continuity** — each imported claim retains its actual producer,
   source session, and transformation lineage.
3. **Execution continuity** — tool effects, pending operations, observations,
   and checkpoints remain valid in the target environment.
4. **Policy continuity** — authority, approvals, constraints, and sandbox rules
   are preserved or explicitly re-evaluated.

agent-hop demonstrates the first. Its implementation does not establish the
other three, and its deliberately small `Turn[]` interchange cannot represent
most of them.

## Native-format impersonation is a compatibility strategy, not a protocol

The adapter comments document several failures found only by comparing real and
synthetic sessions: a missing Codex `model_provider` failed later at resume;
Codex and Grok could continue through the API while showing empty TUI history;
reused OpenCode IDs silently dropped inserts; and an OpenCode `parentID` changed
a top-level chat into a subagent session. Muse support was removed because its
interactive resume path could not be tested with live API access.

These are useful engineering corrections, but together they show why writing
vendor-native private formats is brittle. A session can pass file parsing yet
fail at model continuation, UI replay, identity, or future schema compatibility.
A durable interchange should therefore use an explicit, versioned import
protocol when available; otherwise it should retain the source artifact, record
the adapter and schema versions, validate the imported session end to end, and
mark it as reconstructed rather than native.

## Practical implication

Cross-agent handoff should create a **derived session with a receipt**, not imply
that the original session moved intact. At minimum the receipt should include:

- source and target harness, session IDs, and adapter/schema versions;
- a content identity for the source transcript and the imported subset;
- omitted event classes such as tools, policies, attachments, and compaction;
- producer metadata for each imported turn rather than synthetic target origin;
- target-side checks for visible replay and actual model recall; and
- an explicit policy re-evaluation before any imported instruction can cause an
  effect.

The non-obvious lesson is that session portability is not one feature. It is a
stack of transcript, provenance, execution, and authority guarantees. A tool can
provide valuable transcript portability while safely declining the stronger
claims.
