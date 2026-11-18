<ai_context>
summary: "Metabase's producer-authored account of rebuilding its MCP server shows why agent-facing mutation tools should accept narrow intent—operations, exact replacements, and server-held handles—rather than require models to regenerate whole mutable objects. The described controls also add transactionality, validation-only previews, explicit pagination, fix-bearing errors, permission checks at invocation, and bounded treatment of untrusted data; Scout did not inspect the implementation, run the server, or reproduce the claimed behavior."
triggers: ["MCP tool design", "agent mutation API", "server-held query handles", "operation-based edits", "validate-only agent writes", "model-friendly API"]
last_updated: "2026-11-18"
source_basis: "HN item 50535081 and the complete producer-authored Metabase engineering article dated 2026-11-17. Scout retrieved the current article HTML and read its rendered text, but did not inspect Metabase source, documentation revisions, tests, client behavior, deployment configuration, or production telemetry."
</ai_context>

# Agent mutation tools should accept intent, not regenerated state

- **Date observed:** 2026-11-18
- **Question:** What changes when an application API is redesigned as a tool surface for language-model agents rather than exposed endpoint-for-endpoint?
- **HN source:** https://news.ycombinator.com/item?id=50535081
- **Primary source:** https://www.metabase.com/blog/mcp-tool-design-lessons
- **Reviewed version:** article dated 2026-11-17; retrieved HTML SHA-256 `3bebf13e99fbf7ebd0909d6c8e71869f0777379a012d844ce9384f99383b21c0`
- **Coverage:** complete current article text and HN item metadata plus its one author comment
- **Disposition:** new knowledge; no existing Scout file declared the primary source or this combined mutation-surface design.

## Source observation

Metabase says the first version of its MCP server largely mapped REST endpoints into tools. The producer reports that this created overlapping calls, large values that a model had to reproduce exactly, and full-object writes in which a small intended change could silently disturb unrelated state. Its rebuilt server instead starts from recurrent model failure modes.

The article describes several concrete changes:

- **Narrow intent replaces full regeneration.** Dashboard writes use a list of operations rather than a complete layout. Document updates use exact find-and-replace edits, retaining unaffected block identities and refusing ambiguous or stale matches. Ordinary object updates change only named fields, while clearing a field is a separate explicit action.
- **Related mutations settle together.** A dashboard operation list is applied in one transaction. If an operation fails, nothing is saved. `validate_only` returns the resulting layout without writing it.
- **Server-held state replaces repeated model transcription.** After a query runs, the server returns a user-scoped `query_handle`. Charting or saving uses that handle and therefore the server's stored query, not a model-regenerated copy. Pagination similarly uses an opaque cursor only when the server says it can avoid skipped or repeated rows.
- **Context limits become protocol state.** Reads default to short forms; truncated lists say that they are incomplete and name the next offset. Long procedural guidance is loaded through a `learn` tool rather than placed in every prompt, and tool descriptions point to the relevant skill.
- **Failures distinguish repair from stopping.** Fixable errors are complete sentences that name the corrective call. An internal invariant failure instead says that the defect belongs to Metabase and should not be retried.
- **Permissions are checked at invocation.** The server exposes its tool vocabulary independently of a connection's current grants, then returns an insufficient-scope challenge when a call lacks authority. The article argues this lets a failed call lead to an explicit grant rather than making absence from discovery look like absence of capability.
- **Untrusted application data remains data.** The described result builder quotes values, escapes formatting controls, and encloses larger values in random-boundary fences. The article explicitly says this does not guarantee resistance to planted instructions; damage remains bounded by Metabase permissions and OAuth grants.

The HN submission had ten points and one comment when retrieved. The comment identified itself as the article author but added no independent evidence, so HN is discovery and modest attention rather than validation.

## Reusable interpretation

An ordinary programmatic API often assumes that the caller can preserve exact identifiers, copy large structures losslessly, coordinate dependent requests, and distinguish omitted fields from destructive updates. A language model is a poor place to assign those invariants. Agent-facing mutation tools should therefore move correctness-critical mechanics behind the tool boundary while keeping the requested change explicit.

A reusable mutation contract is:

1. **Express intent as a bounded delta:** operations, exact replacements, or named-field updates rather than a regenerated object.
2. **Bind the delta to current state:** exact-match or version preconditions should reject stale and ambiguous edits.
3. **Keep opaque state server-side:** return scoped handles for queries, plans, artifacts, and cursors rather than asking the model to reproduce them.
4. **Preview before effect:** provide deterministic validation or dry-run output using the same compilation path as the real write.
5. **Settle compound intent atomically:** related operations either commit together or return a typed non-effect.
6. **Return explicit continuation and repair instructions:** truncation, missing authority, stale state, and producer defects are different outcomes.
7. **Read back semantic state:** validation proves that a request can compile; a post-write read proves what the application now contains.

This complements [Concurrent MCP writes need conflict and backend-control receipts](./2026-11-10-mcp-concurrent-writes-need-conflict-controls.md). Operation-shaped payloads reduce accidental whole-object rewrites, but they do not themselves guarantee concurrency safety; adapters must still preserve backend versioning or serialize conflicting effects.

## Evidence limitations

- This is a producer-authored engineering account, not an independent evaluation. Metabase does not publish comparative success rates, error rates, task sets, raw traces, or before-and-after production measurements in the inspected article.
- Scout did not inspect the MCP server implementation, tests, transaction boundaries, handle storage, authorization code, prompt-injection builder, or client-specific behavior, and did not run Metabase or any MCP client.
- The article describes current product behavior and selected historical client limits, but Scout did not pin the application source revision or independently verify those historical claims.
- Random-boundary fencing and instructions that label data are semantic aids, not a security boundary. The source itself says the model may still follow planted text.
- Discovering permission by attempting a call may be useful for consent flows, but it can also create probing, user-experience, and audit concerns. The article does not establish that this policy is appropriate for every tool surface.
- Handles reduce transcription risk only if they are correctly scoped, expired, authorized, and bound to the intended state. Those properties were described selectively and not independently tested.
