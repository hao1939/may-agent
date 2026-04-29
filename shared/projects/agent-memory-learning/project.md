# Project: Agent Memory & Learning

**Status**: active
**Owner**: coach
**Priority**: P2
**Workflow**: master-worker
**Iteration**: 0

## Goal
Agents retain and apply lessons across sessions. Reduce repeated mistakes.

## Metrics
- memory.lessons-per-week: unknown → target 5 (lessons captured)
- memory.repeat-mistake-rate: unknown → target 0.10 (same error across sessions)

## Current State
New project. No audit done yet. Agents have context.md, last-session.md, and knowledge/ dirs but no structured lesson capture or retrieval.

## Plan
- [ ] Audit current memory files across all agents, write outputs/memory-audit.md
- [ ] Define lesson format and extraction process
- [ ] Build lesson retrieval — query relevant lessons before starting a task
- [ ] Re-plan: review metrics, assess improvement, write next steps

## References

**Resources:**
- agents/*/context.md — per-agent context
- agents/*/last-session.md — session summaries
- agents/*/knowledge/ — per-agent knowledge base
