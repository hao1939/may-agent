# KE-321: Markdown-Native Observability via Obsidian as Multi-Agent Dashboard

**Date**: 2026-04-22
**Source**: DD-829
**Confidence**: High
**Connects**: KE-311, KE-313

## Core Finding

Obsidian can serve as a zero-migration human dashboard for our `agents/` directory. Because our workspace is already pure markdown, Obsidian opens it as-is as a vault. The combination of graph view, Dataview queries, backlinks, and git-sync plugins provides rich observability — knowledge topology visualization, structured querying over frontmatter, semantic search, and near-real-time agent activity monitoring — without changing agent output format.

## Evidence

- Graph view visualizes deep-dive → hypothesis → cross-reference topology natively from markdown links
- Dataview plugin (8.8k stars) enables SQL-like queries over YAML frontmatter: list hypotheses by confidence, filter deep-dives by rating, track experiment status
- obsidian-git plugin (10.5k stars) auto-pulls agent changes every N seconds for live-updating view
- Smart Connections plugin (4.9k stars) provides local embedding-based semantic similarity across all agent output
- Our `[[DD-xxx]]`, `[[CR-xxx]]`, `[[KE-xxx]]` naming conventions map directly to Obsidian's wikilink resolution

## Mechanism / Why

The insight is architectural alignment: our agents already write structured markdown with cross-references and metadata. Obsidian is designed exactly to navigate, query, and visualize such structures. No adapter layer needed — the filesystem IS the interface.

## Implications

### 1. Human oversight scales without custom tooling
Instead of building a bespoke dashboard, we get graph visualization, full-text search, semantic similarity, and structured queries from an existing tool ecosystem.

### 2. Frontmatter standardization unlocks querying
Adding consistent YAML frontmatter (id, type, status, rating, tags) to deep-dives and hypotheses enables Dataview to treat our knowledge base as a queryable database.

### 3. Read-only observation layer
Obsidian is a human observation layer, not an agent control plane. Don't try to make it bidirectional. Agents write files; humans observe in Obsidian; git is the transport.

## Actionable

- Open `agents/` as Obsidian vault; install Dataview, obsidian-git, Smart Connections
- Add YAML frontmatter to deep-dives and hypotheses for structured querying
- Create dashboard notes with Dataview queries: recent activity, hypothesis tracker, deep-dive index
- Adopt `[[wikilink]]` syntax in cross-references for backlink graph support
- Do NOT use Obsidian Sync/Publish; git is our transport layer
- Do NOT force agents to write Obsidian-specific syntax; standard markdown works

## Open Questions

- Can Obsidian's MCP server plugin enable bidirectional agent↔vault integration?
- What's the right git-sync interval for near-real-time without conflicts?
- Is a custom "Agent Monitor" plugin worth building for session status and task queues?


[SIG: 1776778916:ke321obs]
