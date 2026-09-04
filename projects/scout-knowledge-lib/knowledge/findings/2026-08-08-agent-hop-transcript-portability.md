<ai_context>
summary: "Two HN-launched coding-agent session migrators expose a layered portability boundary. agent-hop demonstrates useful text continuity through a minimal shared representation; session-migrate advances that design with a versioned event timeline, reason-specific loss accounting, private manifests, pinned target versions, reparsing, and native resume oracles. Its expansion to 15 formats and 225 ordered routes shows why acceptance, semantic equivalence, presentation, and authority continuity must remain separate claims. Neither transfers live processes, approvals, policies, credentials, MCP state, or workspace state, so a migrated session is a derived historical view rather than runtime continuity."
triggers: ["agent-hop", "session-migrate", "cross-agent resume", "session portability", "transcript conversion", "coding-agent history", "provenance loss", "loss manifest"]
confidence: "medium-high"
discovered: "2026-08-08"
last_updated: "2026-08-27"
source_basis: "HN item 49224884 and hetpatel-11/agent-hop repository at commit b69790dd562022ca8e352cc2f3cd5670a6ca5e53; HN item 49425594 and xhluca/session-migrate repository at commits 2692d2070d8021149f4df5548bff74acbc4ccd38 and c39ff16df56a5b3c9137948d049317599c1d6146"
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

## 2026-08-24 update — make loss accounting part of the migration protocol

**Source:** https://news.ycombinator.com/item?id=49425594

**Repo:** https://github.com/xhluca/session-migrate

**Inspected commit:** `2692d2070d8021149f4df5548bff74acbc4ccd38`

The HN launch of **session-migrate** provides a useful next design point. Instead
of reducing every source immediately to user/assistant text, its readers project
eight coding-agent formats into a versioned ordered event timeline. Writers then
consume that timeline and return both target-native bytes and explicit loss
counters. Unknown or unsupported native occurrences become reason-specific
opaque events, preventing a target manifest from silently claiming that a route
was lossless.

Its schema-v2 manifest records source and target identities, paths, hashes,
versions, structural counts, warnings, and `dropped_events`, while deliberately
excluding message, tool, and media bodies. The historical field name is broader
than literal drops: counters also cover transformations, regrouping, and
inconsistent records retained with warnings. This is the key advance over a
simple compatibility matrix: **loss is an output of each concrete conversion,
not only a static property of an adapter pair.**

The publication path also treats native compatibility as an end-to-end claim.
Generated artifacts are reparsed before publication; filesystem targets use
no-clobber private writes; official importers are used where available; and
private-format installers are pinned to exact observed versions. A new adapter
is expected to provide fixtures, bounded parsing, generated-byte validation,
reason-specific loss counters, all-route tests, and an actual native load/resume
oracle. The project's published validation report says its v0.6.0 generated
route oracle passed all 49 seven-format source/target pairs plus one auxiliary
case, while 1,400 artifacts derived from 100 stratified OpenCode exports passed
byte validation, target reparse, ordered-text projection, and independently
computed loss counters. These are author-run repository results, not an
independent Scout reproduction.

### What the stronger machinery still does not mean

session-migrate explicitly describes even same-format moves as portable
rewrites into fresh identities, not clones or live synchronization. It does not
transfer authentication, pending permissions, policies, shell state, live
processes, task plans, MCP connections, memories, agent teams, or workspace
files. Historical tool calls and results are context and are not re-executed.
System/developer roles are omitted and counted rather than downgraded into user
messages; private reasoning is excluded by design; unsupported paginated Codex
history fails closed. Supported message, tool, or image content is copied
without secret scanning, so a content-free manifest does not make the migrated
transcript itself non-sensitive.

A migration receipt should therefore support three separate decisions:

1. **Admission:** Is this source version and event shape supported by the reader?
2. **Fidelity:** What was retained, transformed, omitted, or rejected on this
   exact route and session?
3. **Activation:** Did the target artifact load and resume under the exact target
   runtime, and which authority and environment state must now be re-established?

This refines the original finding: type the imported history, but also make
semantic loss a first-class per-run artifact and keep native loadability separate
from continuity of authority or execution state.

## 2026-08-27 update — route count is not a portability guarantee

**Repo:** https://github.com/xhluca/session-migrate

**Inspected commit:** `c39ff16df56a5b3c9137948d049317599c1d6146`

Since the prior inspection, session-migrate expanded from eight formats to 15,
covering 225 ordered source/target routes. The new adapters include formats with
materially different storage and installation boundaries: paired files for
Grok, official import/export for Kilo Code, and ordered SDK event directories
for OpenHands. Its v0.9.0 report says every generated route was reparsed and
compared against a target-specific portable timeline. Separate native gates then
checked model-context recall, append behavior, and terminal presentation for the
three newest formats. The report records 555 local test passes and 551 passes on
each clean CI Python version, but these remain project-authored results rather
than an independent Scout reproduction.

The important signal is not the larger compatibility badge. As the matrix grew,
the project retained distinct evidence for four different questions:

1. Can the source be parsed without silently accepting an unknown lineage?
2. Does the generated target preserve the route's declared portable semantics?
3. Can the pinned target runtime load, continue, and visibly present it?
4. Which non-portable state must be omitted, transformed, or re-established?

Those questions can diverge even between formats that share a schema. The
v0.9.0 tests fail closed when OpenCode and Kilo bundles are ambiguous because
there is no reliable producer marker; explicit format selection is required.
Likewise, the catalog recognizes nested sidechains and parent sessions, but the
migration model does not flatten branches, forks, or subagents into a main
history. Broader discovery therefore does not imply broader semantic transfer.

A useful interoperability report should publish a matrix of claims, not one
"supported" cell: reader admission, semantic projection, concrete loss
counters, native continuation, UI replay, and policy re-establishment. Route
coverage scales quadratically, while authority and runtime continuity remain
outside the transcript layer regardless of how many pairs pass.
