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
| cross-agent-reuse-count | 1 (first logged) | 5 instances/week of one agent using another's output |
| redundant-work-rate | ~25% estimated | <10% of iterations duplicate existing work |
| manifest-coverage | 72 entries, ~105 unindexed | All non-archive outputs indexed |
| agents-instrumented | 3 (optimizer, scout, coder) | All active agents |

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
9. ✅ **Run freshness check** — 140 unindexed files found (many in _archive/)
10. ✅ **Create adoption baseline** — Written by orchestrator: reuse=0, coverage=24%, 2 agents instrumented
11. ✅ **Index highest-value unindexed outputs** — Manifest expanded to 72 entries
12. ✅ **Instrument coder agent** — verified
13. ✅ **Drive first reuse instance** — Worker queried manifest, found dedup-measurement.md, logged reuse
14. **Re-plan** — Phase 2 infrastructure done. Now drive organic adoption.

### Phase 3: Drive Adoption & Measure Impact
15. **Index remaining non-archive outputs** — 95 files still unindexed. Batch-add top 30 with descriptions to get coverage >60%
16. **Instrument remaining agents** — Add manifest-check to all active agents (auditor, planner, etc.)
17. **Create weekly reuse check script** — `outputs/reuse-check.sh` that greps all agent .state/ dirs for manifest references. Worker claimed done but file missing on disk.
18. **Drive 4 more reuse instances** — Need 5 total to hit weekly target. Identify 4 upcoming tasks where existing outputs are relevant
19. **Re-plan** — After reuse count reaches 5

## Current State

**Phase 1 complete**: Manifest, discovery convention, freshness script. All verified.

**Phase 2 complete**: 3 agents instrumented (optimizer, scout, coder). Manifest expanded to ~72 entries. First reuse logged.

**Phase 3 in progress**: Manifest has 82 table rows, 95 non-archive files still unindexed. Reuse count = 1, target = 5/week. reuse-check.sh missing (worker claimed but not on disk).
