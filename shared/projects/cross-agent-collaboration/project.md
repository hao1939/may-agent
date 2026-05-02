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
9. **Run freshness check and fill gaps** — Execute `manifest-freshness-check.sh`, add any high-value unindexed outputs to manifest
10. **Create adoption baseline** — Document current reuse count (0) and check for manifest queries in agent session logs
11. **Instrument coder agent** — Add manifest-check to `/app/agents/coder/context.md` as third pilot (high-iteration agent)
12. **Add manifest-check to agent-common template** — If agents share a common context snippet, add it there so all agents get it automatically
13. **Re-plan** — After 1 week, measure cross-agent-reuse-count and redundant-work-rate

## Current State

**Phase 1 complete**: Manifest built (40+ entries), discovery convention defined, 2 pilot agents instrumented (optimizer + scout with verified correct paths), freshness script created. All infrastructure is in place.

**Phase 2 focus**: Drive adoption and measure impact. No evidence of actual manifest usage yet (expected — agents need to run sessions that trigger the context check). Next: fill manifest gaps via freshness check, instrument a 3rd agent, and begin tracking reuse.
