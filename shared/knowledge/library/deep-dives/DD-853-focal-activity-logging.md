# DD#853 — FOCAL: Multi-Agent On-Device Activity Logging with Task-Isolated Memory

**Source:** [arXiv:2604.19541](https://arxiv.org/abs/2604.19541) — Yin et al. (2026-04-21)  
**Relevance:** Agent memory, behavioral monitoring, multi-agent architecture  
**Quality Signal:** HIGH — 60% token reduction + handles task interruptions gracefully

---

## Summary

FOCAL solves cross-task context pollution through task-isolated memory. When users interleave tasks (A→B→A), global context processing confuses which observations belong to which task.

## Architecture — Filter-Plan-Log

| Agent | Role |
|-------|------|
| **Filter Agent** | Lightweight noise suppression on raw screenshot stream |
| **Brain Agent** | Text-only task attribution |
| **Record Agent** | Selective visual reasoning (VLM calls only when needed) |
| **Memory Agent** | Task-isolated context-coherent summarization |

## Key Results

- **60.4% token reduction** and **72.3% fewer VLM calls**
- **KIR:** 0.38 → 0.61
- **Task interruption handling:** Task Acc 0.81 under A→B→A (baseline: 0.03)

## Design Principles Worth Adopting

1. **Task isolation in memory:** Separate contexts per task prevents cross-contamination
2. **Cascading filter architecture:** Cheap filters first, expensive reasoning only when needed
3. **Selective VLM invocation:** Don't process everything with the most expensive model

## Tags
`agent-memory` `behavioral-monitoring` `task-isolation` `efficiency` `multi-agent-architecture`
