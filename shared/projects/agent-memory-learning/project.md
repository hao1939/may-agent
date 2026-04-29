# Project: Agent Memory & Learning

**Status**: active
**Owner**: coach
**Priority**: P2
**Workflow**: master-worker
**Iteration**: 1

## Goal
Agents retain and apply lessons across sessions. Reduce repeated mistakes.

## Metrics
- memory.lessons-total: 20 (seeded from context.md files) → target 50+ (growing knowledge base)
- memory.lessons-per-week: unknown (pipeline not yet measured) → target 5 (organic captures)
- memory.repeat-mistake-rate: unknown → target 0.10 (same error across sessions)

## Current State
**Iteration 1 assessment (2025-06-25):**
- Audit complete: outputs/memory-audit.md exists, thorough inventory of all agent memory files
- Lesson format defined: outputs/structured-lesson-format.md with JSON schema
- Retrieval system designed: outputs/lesson-retrieval-system.md + outputs/cross-session-retrieval.md
- **context-learn.ts is BUILT and WIRED** into may's post-session evaluation pipeline
- CONTEXT_LEARN_AGENTS env is set to: coder,may,bob,coach,optimizer,tech-lead
- BUT: only 2 lessons in shared/lessons.jsonl — capture rate is low
- context.md files are rich (100+ lines for active agents) — finish() context_updates working well
- Tests exist: agents/shared/evaluation/test/context-learn.test.ts

**Key gap**: The infrastructure exists but lesson VOLUME is low. The mechanical extractor only catches command corrections, runtime facts, and path discoveries. The LLM extractor depends on evaluator agent being available. Need to measure actual capture rate and ensure the pipeline is firing.

## Plan
- [x] Audit current memory files across all agents, write outputs/memory-audit.md
- [x] Define lesson format and extraction process
- [x] Build lesson retrieval — query relevant lessons before starting a task
- [x] Seed lessons.jsonl with lessons extracted from existing context.md files across all agents (20 lessons seeded)
- [ ] Measure context-learn pipeline firing rate — check may's eval DB for context-learn events, write outputs/pipeline-metrics.md
- [ ] Expand mechanical extractor patterns in context-learn.ts — add patterns for: edit-after-read failures, test command discovery, dependency issues
- [ ] Add lesson retrieval hook — agents query lessons.jsonl at session start for task-relevant lessons
- [ ] Re-plan: review metrics, assess improvement, write next steps

## References

**Resources:**
- agents/*/context.md — per-agent context
- agents/*/last-session.md — session summaries
- agents/*/knowledge/ — per-agent knowledge base
