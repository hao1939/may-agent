<ai_context>
summary: "Obelisk is a local index for coding-agent session history. At pinned revision eae3a51, it projects several providers into one SQLite schema, exposes bounded retrieval helpers, distinguishes visible from superseded or hidden records, and makes arbitrary SQL read-only. The reusable design lesson is to preserve provider provenance and source-attested visibility while giving agents a narrow query interface; a unified index is not permission to treat every historical record as current context. This is a static source assessment, not a runtime validation."
triggers: ["Obelisk", "coding agent session history", "session index", "cross-provider retrieval", "superseded history", "agent memory", "provider provenance"]
confidence: "medium-high"
discovered: "2026-10-01"
</ai_context>

# Obelisk: a provider-aware index for coding-agent history

**Date:** 2026-10-01  
**Disposition:** New knowledge  
**Coverage:** Repository metadata, README, complete Git tree, query implementation, provider-indexing implementation, SQL schema, query tests, and package scripts were inspected at one pinned revision. The software was not installed or executed.  
**Repo:** https://github.com/tommy0103/obelisk  
**Pinned revision:** [`eae3a51e362d6b2d78a51c0d2202a1d767f71c41`](https://github.com/tommy0103/obelisk/tree/eae3a51e362d6b2d78a51c0d2202a1d767f71c41)

## Why this is useful

Coding-agent history is often fragmented by harness and stored as raw transcripts. Obelisk implements a different boundary: provider adapters project local histories into one SQLite index, while retrieval helpers preserve source and visibility semantics. The important pattern is not merely “put sessions in SQLite.” It is **normalize enough to query across providers without erasing whether a record is current, superseded, hidden, or provider-specific**.

That pattern is relevant to durable agent systems because stale or retracted history can otherwise look as authoritative as current evidence. A retrieval layer should carry provenance and source-attested lifecycle state into every result rather than flattening all past text into undifferentiated memory.

## What the pinned source shows

### One shared schema, explicit provider provenance

The README says the index consumes local histories from Claude Code, Codex, GitHub Copilot, DeepSeek Harness, Hermes Agent, Kimi Code, OMP, Pi, and ZCode. The [schema](https://github.com/tommy0103/obelisk/blob/eae3a51e362d6b2d78a51c0d2202a1d767f71c41/packages/core/src/schema.sql) includes `source` on sessions, messages, and summaries and has source indexes. The [provider-indexing code](https://github.com/tommy0103/obelisk/blob/eae3a51e362d6b2d78a51c0d2202a1d767f71c41/packages/core/src/provider-indexing.ts) discovers work per registered provider, records incomplete providers, runs persistence in transactions, and retains provider-specific replay keys.

This is implementation evidence for a provider-aware index, but not proof that every advertised adapter faithfully captures every upstream edge case.

### Visibility is a query contract, not just storage metadata

The [query API](https://github.com/tommy0103/obelisk/blob/eae3a51e362d6b2d78a51c0d2202a1d767f71c41/packages/core/src/query.ts) treats `visible` records as queryable by default. `inactive` records require `includeInactive: true`; hidden records remain excluded. Search, context, trace, raw evidence, failures, summaries, and file-history helpers propagate that distinction. Results that include inactive evidence retain a visibility label.

The [query tests](https://github.com/tommy0103/obelisk/blob/eae3a51e362d6b2d78a51c0d2202a1d767f71c41/tests/query.test.mjs) cover opt-in inactive search, hidden-record exclusion, raw-evidence visibility labels, provider-unit lookup, read-only SQL, and rejection of negative limits. Tests are source evidence that these cases are intentional and exercised by the repository; Scout did not run them.

### Agent-facing retrieval is bounded and read-only

The API gives agents task-shaped helpers such as search, context, trace, subagents, workflows, file history, failures, sessions, summaries, raw records, and memories. Most list operations have explicit limits and reject negative values. Its arbitrary SQL path accepts read-only `SELECT`/`WITH` queries and combines semantic classification with a read-only database boundary; the test suite includes attempted writes and read-only CTE/pragma cases.

This narrows accidental mutation from retrieval code. It does **not** establish sandboxing of the host process, authorization to read all indexed transcripts, resistance to sensitive-data exfiltration, or safe use of text retrieved from old sessions.

## Reusable design rule

For a cross-session agent index:

1. Keep immutable source/provider identity on normalized rows.
2. Represent source-attested supersession separately from hidden transport records.
3. Exclude inactive history by default and label it when explicitly requested.
4. Bound agent-facing query results and fail closed on negative or malformed limits.
5. Open the retrieval database read-only and independently reject write-capable SQL.
6. Preserve a path back to raw evidence without making every raw record default context.
7. Treat retrieved text as evidence with provenance, not as instructions or current truth.

The distinction between inactive and hidden is especially useful: superseded history can remain inspectable for audit or debugging without silently re-entering normal reasoning, while transport-only records never become semantic evidence.

## Limitations and open questions

- This assessment is static. Scout did not install Obelisk, run its tests, index real provider data, benchmark retrieval, or inspect the Electron application behavior.
- The inspected revision is a moving `main` snapshot, not a release tag.
- Provider completeness depends on what each upstream format attests. The README explicitly notes different supersession support across providers, including no attested rewind/current-leaf state for Claude Code and no branching semantics for Codex.
- Local indexing creates a sensitive-data boundary. The inspected files do not by themselves establish operating-system isolation, per-project access control, encryption, retention policy, or deletion guarantees.
- Shared normalization can hide semantic differences even when a `source` column survives. Adapter conformance and replay/deletion behavior need provider-specific tests against real fixtures.
- A searchable archive can amplify stale assumptions or prompt injection embedded in past transcripts. Consumers still need freshness, provenance, trust, and instruction/data separation.

## Source record

Discovery used GitHub repository Search API query `topic:ai-agent pushed:>=2026-09-29 stars:>=50`, sorted by `updated` descending with 20 results. GitHub returned HTTP 200, `incomplete_results: false`, and `total_count: 508`. `tommy0103/obelisk` appeared in that response. Repository, commit, README, recursive tree, and pinned raw-file requests all returned HTTP 200; the recursive tree reported `truncated: false` with 483 entries.
