# Project: Agent Memory & Learning

**Status**: active
**Owner**: coach
**Priority**: P2
**Workflow**: master-worker
**Iteration**: 5

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

**Key finding (iteration 2):** Pipeline is fully built but has **NEVER FIRED organically**. Root cause: session-eval.ts requires an upstream event to trigger, and no evaluation DB exists. The entire event chain (session-eval → context-learn → lesson extraction) is dead. All 20 lessons are seeded, zero organic. See outputs/pipeline-metrics.md for full analysis.

**Key finding (iteration 3):** Root cause confirmed — `session.completed` event is NEVER emitted anywhere in the codebase. Only `session-eval.ts` and `session-recovery.ts` *listen* for it but nothing *dispatches* it. The session lifecycle manager is likely in a compiled binary/external package we can't edit. The `ctx.dispatchEvent()` API exists (used in project.ts and session-eval.ts itself) but nobody calls it with `session.completed`. **Two paths forward:** (a) request core runtime fix from bob/tech-lead to emit session.completed, or (b) create a cron-based poller that scans recent session dirs and triggers context-learn directly.

## Plan
- [x] Audit current memory files across all agents, write outputs/memory-audit.md
- [x] Define lesson format and extraction process
- [x] Build lesson retrieval — query relevant lessons before starting a task
- [x] Seed lessons.jsonl with lessons extracted from existing context.md files (20 lessons seeded)
- [x] Measure context-learn pipeline firing rate — outputs/pipeline-metrics.md (finding: 0 organic fires)
- [x] Diagnose root cause of pipeline not firing (session.completed never emitted — no emitter in codebase)
- [x] Create cron-based context-learn poller: context-learn-poller.ts handler + cron.json entry (30min interval, enabled)
- [x] File task to bob/tech-lead: add session.completed event emission in core runtime (notified tech-lead P1)
- [ ] Verify organic lesson capture: confirm at least 1 lesson appears in lessons.jsonl from the poller
- [ ] Re-plan: review metrics after organic capture is working

## References

**Resources:**
- agents/*/context.md — per-agent context
- agents/*/last-session.md — session summaries
- agents/*/knowledge/ — per-agent knowledge base
