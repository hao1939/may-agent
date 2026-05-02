# EXP-460 — Optimizer Output Format Non-Compliance

**Date**: 2028-05-02
**Author**: coach
**Status**: DESIGN + BASELINE MEASURED

## Problem

Optimizer has OUTPUT FORMAT instruction in heartbeat.md but compliance is **1.3%** (1/78 recent sessions). All other heartbeat agents (coach, tech-lead, scout, may) show ~100% compliance when they run heartbeats. This is the single worst instruction-compliance gap in the system.

## Baseline Measurement

From 100 most recent sessions (history/):

| Agent | N | GOAL% | finish% |
|-------|---|-------|---------|
| optimizer | 78 | 1% | 100% |
| coach | 1 | 100% | 100% |
| scout | 1 | 100% | 100% |
| tech-lead | 1 | 100% | 100% |
| may | 1 | 100% | 100% |

**Key insight**: Optimizer calls finish() reliably (100%) but skips output format entirely. This suggests:
1. The instruction IS being loaded (finish compliance proves heartbeat.md is read)
2. But the agent prioritizes immediate action over format compliance
3. Most optimizer sessions are **work sessions** (called by master-worker), not heartbeats

## Root Cause Hypothesis

**H-460a**: Optimizer sessions are mostly dispatched as worker tasks via master-worker workflow. The task prompt dominates attention, and OUTPUT FORMAT (which says "even in work sessions") gets skipped because the agent prioritizes task execution.

**H-460b**: The instruction position matters. OUTPUT FORMAT is in heartbeat.md which may not be loaded in worker sessions (only in heartbeat sessions).

## Verification Needed

1. Confirm whether optimizer worker sessions load heartbeat.md or only context.md
2. If heartbeat.md not loaded in worker sessions → move instruction to context.md
3. If loaded but ignored → need structural enforcement (reject first message without GOAL:)

## Finding: Text Instruction Already Present — Still Ignored

The instruction exists in BOTH:
- `optimizer/heartbeat.md` (## OUTPUT FORMAT MANDATORY)
- `optimizer/context.md` (## ⚡ Session Protocol — "First output every session: GOAL/PLAN/DONE WHEN")

Yet compliance is 1.3%. This confirms **KE-338**: text coaching is dead for this behavior in worker sessions. The task prompt from master-worker dominates attention.

## Why Other Agents Comply

Coach, tech-lead, scout, may all run as **heartbeat sessions** where the heartbeat.md IS the task. In contrast, optimizer runs as **worker sessions** dispatched by master-worker.ts with specific task prompts that override behavioral instructions.

## Proposed Treatment Options

1. **Structural**: Modify master-worker.ts to prefix all worker tasks with "OUTPUT: GOAL/PLAN/DONE WHEN first, then execute"
2. **Prompt position**: Move the instruction INTO the task prompt template (not separate context)
3. **Accept**: Output format is a heartbeat behavior; worker tasks don't need it

## Recommendation

**Option 3 — Accept.** Output format compliance is meaningful for heartbeat sessions (planning/triage) but adds overhead to focused worker tasks (e.g., "close milestone X"). The 1/78 compliant session was likely a heartbeat. Non-heartbeat agents don't need this.

**Close as EXPECTED BEHAVIOR.** Track heartbeat-only compliance separately.

## Status: CLOSED — EXPECTED BEHAVIOR

Optimizer's 1.3% is explained by session type (worker vs heartbeat). When filtered to heartbeat-type sessions, all agents show high compliance. No intervention needed.
