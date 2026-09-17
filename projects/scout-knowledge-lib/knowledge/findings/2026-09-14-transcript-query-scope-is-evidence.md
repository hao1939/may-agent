<ai_context>
summary: "technicalpickles/cq makes coding-agent transcripts queryable across Claude Code and Codex, but its implementation also exposes why every transcript-derived metric needs a scope and freshness receipt. Built-in commands infer project, harness, and Claude source unless --all is used; raw SQL is deliberately unscoped; full-text search may serve a warned stale snapshot; and session summaries exclude sidechain activity while detailed views retain it. These are useful, explicit product choices—not evidence that one default is universally correct."
triggers: ["technicalpickles/cq", "agent transcript analytics", "query scope", "observability freshness", "sidechain attribution", "coding-agent telemetry", "DuckDB"]
last_updated: "2026-09-14"
source_basis: "GitHub repository technicalpickles/cq pinned at 4320dcaea98891c6e2284b739c234b9c3b0cea68; repository Search API query recorded incomplete_results=false."
</ai_context>

# Transcript analytics need a scope and freshness receipt

**Date:** 2026-09-14  
**Status:** Source-grounded GitHub finding

## Core signal

GitHub discovery surfaced `technicalpickles/cq`, a Rust CLI that indexes Claude
Code and Codex JSONL session histories into local DuckDB views. The repository's
most reusable lesson is not merely that SQL helps inspect agent behavior. It is
that a transcript answer depends on several independent choices about **which
records were ingested, selected, refreshed, and summarized**.

At the pinned revision, the implementation makes those choices unusually
visible:

- Built-in session, message, tool, hook, and search commands infer the current
  working-directory project and active harness unless the caller passes
  `--all`; Claude queries can also infer the source matching
  `CLAUDE_CONFIG_DIR`. The CLI prints scope hints for non-JSON output.
- `cq sql` is intentionally different: the command bypasses inferred project,
  harness, and source scope, and executes the supplied SQL verbatim. Therefore
  a built-in command and a superficially equivalent raw query need not measure
  the same universe.
- Full-text search materializes a separate message snapshot and DuckDB FTS
  index. Automatic mode may serve that snapshot for up to a default five-minute
  age window, while writing a staleness warning to stderr; `--reindex` forces a
  rebuild and `--no-reindex` explicitly accepts the available snapshot.
- Detailed `messages`, `tool_calls`, and `tool_results` rows preserve subagent
  or sidechain attribution, while the `sessions` summary deliberately counts
  main-loop messages and tool calls and exposes subagents separately. A metric
  that does not name its view can therefore hide whether delegated work was
  included.
- Default full-text results collapse multiple matching passages to the
  best-scoring passage per session and retain a `matches` count;
  `--all-matches` changes the unit back to passages. Result count is consequently
  also a projection choice, not a source-invariant fact.

These claims are grounded in the pinned README, `main.rs`, scope and search
implementation, and view tests. The complete recursive tree reports
`truncated=false` with 132 entries and includes fixtures and tests for Claude,
Codex, source filtering, sidechains, views, caching, and integration behavior.
Scout inspected these artifacts but did not build the binary or run its test
suite, so this finding does not claim the implementation works correctly in a
live installation.

## Why this matters

Agent telemetry is often used to make statements such as “the skill was
bypassed,” “tools failed in 12 sessions,” or “delegation reduced wall time.” A
query can be syntactically correct yet support the wrong conclusion when any of
these dimensions is implicit:

1. **Ingestion coverage:** which harnesses, configuration roots, dates, and
   files were discoverable and successfully parsed?
2. **Selection scope:** did the command include the current project, one source,
   one harness, or all indexed records?
3. **Freshness:** was the answer computed from current normalized rows or a
   lagging search snapshot?
4. **Population unit:** are counts over sessions, passages, main-loop actions,
   delegated actions, or all tool calls?
5. **Projection semantics:** which view intentionally excludes or aggregates
   records?

The reusable design rule is: **attach a query receipt to every behavioral
metric**. At minimum it should record the tool revision, input roots or harness
coverage, explicit filters, query or command, view and counting unit, cache or
index generation/freshness, skipped or unparseable inputs, and whether stderr
warnings were captured. Machine-readable mode should carry this metadata in the
result contract rather than relying only on human-visible hints written to a
separate stream.

This also suggests a testing pattern. A transcript-analysis tool needs negative
controls where a known matching record sits just outside each boundary: another
project, source, harness, sidechain, time window, or index generation. A positive
match proves query mechanics; boundary fixtures prove the reported universe.

## Evidence limits

- Repository metadata and tests establish implementation artifacts and stated
  semantics, not deployment correctness, completeness of local transcript
  discovery, or adoption.
- Scout did not run `cq`, independently reproduce its README examples, inspect
  every parser path, or measure cache freshness under concurrent writes.
- The five-minute FTS policy is a documented default and environment-overridable
  engineering trade-off, not a recommendation for every audit or incident use
  case.
- Explicit auto-scoping can reduce accidental cross-project disclosure while
  also producing under-counts when a caller assumes global coverage. Whether
  narrow or global scope is correct depends on the question; the finding argues
  for disclosure, not one universal default.
- Local indexing does not by itself settle transcript confidentiality,
  retention, redaction, or whether tool inputs contain secrets.
- The repository was inspected at one revision; later default-branch behavior
  may differ.

## Sources

- Repo: https://github.com/technicalpickles/cq
- Pinned revision: https://github.com/technicalpickles/cq/commit/4320dcaea98891c6e2284b739c234b9c3b0cea68
- README at pinned revision: https://github.com/technicalpickles/cq/blob/4320dcaea98891c6e2284b739c234b9c3b0cea68/README.md
- CLI scoping at pinned revision: https://github.com/technicalpickles/cq/blob/4320dcaea98891c6e2284b739c234b9c3b0cea68/src/main.rs
- Query-scope helpers: https://github.com/technicalpickles/cq/blob/4320dcaea98891c6e2284b739c234b9c3b0cea68/src/scope.rs
- Raw SQL path: https://github.com/technicalpickles/cq/blob/4320dcaea98891c6e2284b739c234b9c3b0cea68/src/commands/sql.rs
- Search query semantics: https://github.com/technicalpickles/cq/blob/4320dcaea98891c6e2284b739c234b9c3b0cea68/src/commands/search.rs
- FTS freshness implementation: https://github.com/technicalpickles/cq/blob/4320dcaea98891c6e2284b739c234b9c3b0cea68/src/full_text.rs
- View and sidechain tests: https://github.com/technicalpickles/cq/blob/4320dcaea98891c6e2284b739c234b9c3b0cea68/tests/views_test.rs
- Complete pinned tree: https://api.github.com/repos/technicalpickles/cq/git/trees/4320dcaea98891c6e2284b739c234b9c3b0cea68?recursive=1
