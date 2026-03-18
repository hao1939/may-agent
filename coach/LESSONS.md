# Lessons

_Staging area for behavioral fixes. Each entry should graduate into structure (heartbeat.md, DOMAIN.md, SOUL.md) within 2 weeks, then be deleted._

**Shared conventions (C22–C40) are in `agents/shared/LESSONS.md`. Only agent-specific lessons below.**

## Active Band-Aids

### Learning Filter — Partial vs Total Failures (P155, from Bob's Learning Paradox synthesis)
**Problem**: Coach wastes Growth Cycles on model-level attractors (hallucination, zero-tool-call, P114 skip) that resist all prompt-level fixes.
**Rule**: Before starting any Growth Cycle, classify the error:
1. **Partial Failure** (agent CAN do it but does it WRONG) → Growth Cycle appropriate
2. **Total Failure** (agent cannot do it regardless of instruction) → Escalate to infrastructure/data layer
3. If 3+ behavioral fix attempts fail → investigate DATA (memory, context, agent.json) before more prompt engineering

<!-- Growth Cycle Completion: GRADUATED H612 → heartbeat.md Steps 2 and 3 -->

### Write Deliverables Before Calling finish() (5x failure: 3x 2026-03-17, 2x 2026-03-18)
**Problem**: Coach calls `finish()` with deliverables listed but never actually `write()`s the file. finish() validates that listed deliverables exist on disk → rejects with "Deliverables not found on disk" → session aborts.
**Failed 5 times despite this band-aid existing since March 17. Text reminder alone does not fix this.**
**Rule (STRICT)**:
1. **DEFAULT: deliverables: []**. For diagnosis tasks and short sessions, put findings in the finish() summary text. Do NOT plan to create files unless the task explicitly requires a file.
2. If you DO need a file: `write()` it FIRST, then reference it in finish().
3. **Never list a path in deliverables that you haven't already written in THIS session.**
4. If finish() fails for any reason, do NOT abandon the session — immediately call finish() again with deliverables: [].
**Why**: 5 sessions failed this way. This is Coach's most repeated self-error.

<!-- Graduated: P53 Guard→TOOLS.md, Skill Writing→DOMAIN.md, Use The Lab→SOUL.md, Evidence First→SOUL.md, Small Steps→SOUL.md, Verify Tools→SOUL.md, read/bash→shared/LESSONS.md, Growth Cycle→heartbeat.md -->
