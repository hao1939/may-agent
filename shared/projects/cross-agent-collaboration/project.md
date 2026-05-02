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
| shared-output-discovery-rate | ✅ grep works (40+ entries) | Any agent can find relevant outputs within 1 query |
| cross-agent-reuse-count | 0 | 5 instances/week of one agent using another's output |
| redundant-work-rate | ~25% estimated | <10% of iterations duplicate existing work |
| manifest-coverage | 40+ file-level entries | All high-value outputs indexed |

## Plan

1. ✅ **Build shared output manifest** — Index all project deliverables across `/app/agents/shared/projects/*/outputs/` into a queryable manifest file
2. ✅ **Create discovery convention** — Define a standard way for agents to query the manifest (e.g., by topic, by date, by project)
3. **Instrument 2 pilot agents** — Have optimizer and one other agent actively consume cross-agent outputs before starting new work
4. **Measure reduction** — Track redundant-work-rate over 2 weeks, compare before/after
5. ✅ **Enrich manifest with per-file entries** — Expanded to 40+ file-level entries across skill-workflow-audit, agent-memory-learning, documentation-gen, test-coverage, workflow-reliability
6. ✅ **Instrument 2 pilot agents** — Add manifest-check instruction to optimizer and scout's context.md
   - ✅ optimizer instrumented (verified: correct path in context.md)
   - ✅ scout instrumented (verified: line 10 has correct path)
7. ✅ **Add auto-update script** — `outputs/manifest-freshness-check.sh` scans outputs dirs and reports unindexed files
8. **Re-plan** — Phase 1 infrastructure complete. Now drive adoption and measure impact.
9. **Run freshness check and fill gaps** — Freshness check run: 30+ unindexed files found. Need to add high-value ones to manifest.
10. **Create adoption baseline** — adoption-baseline.md exists but is empty. Needs actual content.
11. **Index unindexed high-value outputs** — Add entries for prompt-efficiency, handler-reliability, request-deduplication, agent-system-literacy outputs (most actionable unindexed files)
12. **Write adoption baseline content** — Document: reuse count=0, manifest coverage gaps, timestamp, plan for measuring reuse
13. **Instrument coder agent** — Add manifest-check to `/app/agents/coder/context.md` as third pilot
14. **Re-plan** — After adoption baseline is written and manifest gaps filled

## Current State

**Phase 1 complete**: Manifest (40+ entries), discovery convention, 2 pilot agents (optimizer + scout with correct paths), freshness script. All verified working.

**Phase 2 in progress**: Freshness check reveals 30+ unindexed files. adoption-baseline.md is empty. No evidence of manifest usage yet. Next: fill manifest gaps with high-value files, write real adoption baseline content.
