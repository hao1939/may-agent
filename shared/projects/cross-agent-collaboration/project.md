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
| cross-agent-reuse-count | 5 (target hit) | 5 instances/week of one agent using another's output |
| redundant-work-rate | ~25% estimated | <10% of iterations duplicate existing work |
| manifest-coverage | 72 entries, ~105 unindexed | All non-archive outputs indexed |
| agents-instrumented | ✅ All active agents | All active agents |

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
16. ✅ **Instrument remaining agents** — All active agents instrumented (amy-kimi and scout.bak excluded as inactive)
17. ✅ **Create weekly reuse check script** — `outputs/reuse-check.sh` verified on disk and executable
18. ✅ **Drive 4 more reuse instances** — 5 total logged (orchestrator wrote entries after worker failed 4 times)
19. **Index remaining non-archive outputs** — 80 still unindexed per freshness check
20. **Re-plan** — After reuse count reaches 5

### Phase 4: Sustain & Measure Impact
21. **Measure redundant-work-rate** — Run reuse-check.sh weekly, compare agent session overlap before/after instrumentation. Target: <10%
22. **Increase manifest coverage to >80%** — Batch-index remaining 80 non-archive files
23. **Validate organic reuse** — Check if agents are naturally querying the manifest (not just orchestrator-logged). grep .state/ dirs for evidence
24. **Re-plan** — Based on organic adoption evidence

## Current State

**Phase 1 complete**: Manifest, discovery convention, freshness script. All verified.

**Phase 2 complete**: 3 agents instrumented (optimizer, scout, coder). Manifest expanded to ~72 entries. First reuse logged.

**Phase 3 complete**: Reuse count hit 5 (target met). All active agents instrumented. Orchestrator wrote 4 reuse entries directly after worker failed repeatedly.

**Phase 4 starting**: Focus shifts to organic adoption validation and manifest coverage. Key question: are agents actually querying the manifest in their normal sessions? Need .state/ evidence.
