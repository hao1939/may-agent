# Cross-Agent Collaboration

**Status**: active
**Owner**: optimizer
**Priority**: P1
**Created**: 2025-01-27
**Parent**: system-efficiency (Proposal 1 from next-frontier-proposal.md)

## Goal

Enable agents to discover and consume each other's outputs automatically, reducing redundant work by 30%+.

## Problem

Agents currently work in silos. Each produces deliverables that could benefit others, but there's no discovery mechanism. This leads to duplicated analysis, missed context, and wasted iterations.

## Metrics

| Metric | Current | Target |
|--------|---------|--------|
| shared-output-discovery-rate | 0 (no mechanism) | Any agent can find relevant outputs within 1 query |
| cross-agent-reuse-count | 0 | 5 instances/week of one agent using another's output |
| redundant-work-rate | ~25% estimated | <10% of iterations duplicate existing work |

## Plan

1. ✅ **Build shared output manifest** — Index all project deliverables across `/app/agents/shared/projects/*/outputs/` into a queryable manifest file
2. ✅ **Create discovery convention** — Define a standard way for agents to query the manifest (e.g., by topic, by date, by project)
3. **Instrument 2 pilot agents** — Have optimizer and one other agent actively consume cross-agent outputs before starting new work
4. **Measure reduction** — Track redundant-work-rate over 2 weeks, compare before/after
5. **Enrich manifest with per-file entries** — Current manifest uses directory-level entries for most projects; expand to list individual high-value files with descriptions
6. **Add auto-update script** — Create a script that scans outputs dirs and flags manifest staleness

## Current State

Items 1-2 complete. Manifest exists at `outputs/shared-output-manifest.md` with 18 entries, tag-based discovery, and an agent protocol section. Most entries point to directories rather than specific files.

Key projects with rich outputs ready for file-level indexing:
- skill-workflow-audit: 28 files (audits, metrics, prune plans)
- agent-memory-learning: 7 files (lesson DB, retrieval, benchmarks)
- documentation-gen: 8 files (guides, architecture, inventory)
- test-coverage: 6 files (gap analysis, standards, strategy)

Next priority: Enrich manifest with ~20 high-value file-level entries from these 4 projects, then instrument pilot agents (item 3).
