# Knowledge Base Conventions

> Established Phase 3 of Knowledge Compilation System — 2026-04-04

## Post Naming Convention

### Standard Patterns
| Pattern | When to Use | Example |
|---------|-------------|---------|
| `HB-XXXX-slug.md` | Heartbeat-discovered posts | `HB-0052-claude-multiagent-paradigms.md` |
| `HB-YYMMDD-slug.md` | Date-based heartbeat posts | `HB-250403-memory-forgetting-agents.md` |
| `SYNTH-NNN-slug.md` | Cross-post synthesis docs | `SYNTH-002-self-evolution-spectrum.md` |
| `QUERY-YYYY-MM-DD-topic.md` | Research answers filed back | `QUERY-2026-04-04-coordination-topology.md` |
| `TWEET-source-slug-date.md` | Twitter/social posts | `TWEET-karpathy-llm-knowledge-bases-20260402.md` |

### Legacy Patterns (don't create new ones)
| Pattern | Origin |
|---------|--------|
| `1234.md` or `1234-slug.md` | Early numbered posts |
| `xhs_*.md` | Raw XHS imports |
| `BACKFILL-NNN-slug.md` | Backfilled investigations |

## Query-Result Filing Convention

When an agent produces a **research-quality answer** (not routine lookups), file it as a post:

### When to File
- Deep investigation results (multi-source synthesis)
- Architecture comparisons or tradeoff analyses
- Literature reviews on specific topics
- Experiment summaries with novel findings

### How to File
1. Save to `agents/shared/knowledge/library/posts/QUERY-YYYY-MM-DD-topic.md`
2. Use this template:

```markdown
# [Descriptive Title]

**Type**: Research Query  
**Date**: YYYY-MM-DD  
**Source**: Agent [agent-name], session [session-id]  
**Query**: [Original question that triggered this research]

## Summary

[2-3 sentence executive summary]

## Findings

[Main content — structured with headers]

## Sources Consulted

- [List of posts, papers, or other sources referenced]

## Open Questions

- [What remains unknown or uncertain]
```

3. Run `bun scripts/knowledge-compile.ts` to auto-assign to a topic, or manually add to the relevant topic index.

### When NOT to File
- Routine lookups ("what's in file X?")
- Status checks or health reports
- Implementation notes (those go in session journals)

## Periodic Maintenance

### Weekly: Run Health Check
```bash
bun scripts/knowledge-health-check.ts
```
Fix any errors (broken links). Review warnings (duplicates, metadata gaps).

### Weekly: Run Compilation
```bash
bun scripts/knowledge-compile.ts --since [last-week-date]
```
Review assignments, then apply:
```bash
bun scripts/knowledge-compile.ts --since [last-week-date] --apply
```

### Monthly: Full Compilation
```bash
bun scripts/knowledge-compile.ts --apply
```
This processes unindexed posts in batches and updates topic indexes.

## Topic Index Structure

Each topic file in `topics/` should have:
1. **Key Principles** — What we know for sure
2. **Essential Reading** — Curated table of important files
3. **Related Hypotheses** — Links to testable claims
4. **Open Questions** — What we don't know yet
5. **Cross-References** — Links to related topics
6. **Additional Posts (Auto-Indexed)** — Added by compilation script

## Health Check Criteria

The health check script (`knowledge-health-check.ts`) verifies:
- ❌ **Errors**: Broken links in topic files (reference non-existent files)
- ⚠️ **Warnings**: Duplicate arXiv IDs, similar titles, missing metadata
- ℹ️ **Info**: Orphan coverage stats, naming convention violations
