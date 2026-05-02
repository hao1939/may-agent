# Cross-Agent Collaboration Project Specification

**Status**: active  
**Owner**: optimizer  
**Priority**: P1  
**Created**: From system-efficiency next-frontier-proposal.md, Proposal 1

## Goal

Enable agents to discover and consume each other's outputs automatically, reducing redundant work by 30%+.

## Problem Statement

Agents currently work in silos. One agent may produce analysis that another agent needs but can't find. This leads to duplicated work, inconsistent conclusions, and wasted iterations. A shared discovery mechanism would let agents build on each other's outputs.

## Metrics

| Metric | Target | Baseline |
|--------|--------|----------|
| shared-output-discovery-rate | Any agent finds relevant outputs in 1 query | No discovery mechanism exists |
| cross-agent-reuse-count | 5 instances/week of one agent using another's output | 0 (estimated) |
| redundant-work-rate | <10% of iterations duplicate existing work | ~25% (estimated from no-op iterations) |

## Plan

1. **Build shared output manifest** — Index all project deliverables (`outputs/` dirs) into a single queryable manifest file at `/app/agents/shared/projects/outputs/manifest.json`
2. **Create discovery convention** — Define a standard way for agents to query "what exists about topic X?" before starting work
3. **Instrument 2 pilot agents** — Have optimizer and one other agent check the manifest before producing new files
4. **Measure reduction** — Track redundant-work-rate over 2 weeks, compare to baseline

## Estimated Effort

- Phase 1 (manifest): 2-3 iterations
- Phase 2 (convention): 1-2 iterations  
- Phase 3 (pilot): 3-4 iterations
- Phase 4 (measure): 2 iterations
- **Total**: ~10 iterations

## Success Criteria

Project is complete when all 3 metrics hit target for 1 consecutive week.
