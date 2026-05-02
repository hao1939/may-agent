# Cross-Agent Collaboration

**Status**: active  
**Owner**: optimizer  
**Priority**: P1  
**Created**: 2025-01-27  
**Parent**: system-efficiency (successor project)

## Goal

Enable agents to discover and consume each other's outputs automatically, reducing redundant work by 30%+.

## Metrics

| Metric | Current | Target |
|--------|---------|--------|
| shared-output-discovery-rate | 0 (no mechanism) | Any agent can find relevant outputs from other agents within 1 query |
| cross-agent-reuse-count | ~1/week (ad hoc) | 5 instances of one agent using another's output per week |
| redundant-work-rate | ~25% estimated | <10% of iterations duplicate existing work |

## Plan

1. **Build shared output manifest** — Index all project deliverables across `/app/agents/shared/projects/*/outputs/` into a single searchable manifest with metadata (topic, date, agent, summary)
2. **Create discovery convention** — Define a standard query pattern (file-based or tool-based) for agents to search the manifest by topic/keyword
3. **Instrument 2 agents** — Modify optimizer and one other agent to check the manifest before producing new analysis, consuming existing outputs when relevant
4. **Measure reduction** — Track redundant-work-rate over 2 weeks, compare to baseline

## Success Criteria

- A manifest file exists listing all deliverables with searchable metadata
- At least 2 agents actively query the manifest before starting work
- Measurable reduction in duplicate analysis across iterations

## Context

Spawned from system-efficiency project after all 12 satellite projects reached target. See `next-frontier-proposal.md` for full rationale.
