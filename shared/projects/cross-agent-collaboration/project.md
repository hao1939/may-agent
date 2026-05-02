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
6. **Instrument 2 pilot agents** — Add manifest-check instruction to optimizer and one other agent's context.md so they consult the manifest before starting work
   - ✅ optimizer instrumented (verified in context.md)
   - ❌ second agent NOT yet instrumented (worker claimed but not verified)
7. **Add auto-update script** — Create a script that scans outputs dirs and flags manifest staleness
8. **Re-plan** — After item 6 complete + 1 week of data, assess reuse metrics

## Current State

Items 1, 2, 5 complete. Item 6 half-done: optimizer has manifest-check in context.md (verified), but no second agent instrumented yet. Manifest at `outputs/shared-output-manifest.md` has 40+ file-level entries with tags and discovery convention.

Next priority: Instrument a second pilot agent (scout or coder — high-iteration agents). Then item 7 (auto-update script to keep manifest fresh as new outputs appear).
