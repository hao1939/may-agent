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

### Write Deliverables Before Calling finish() (3x growth-cycle failure, 2026-03-17)
**Problem**: Coach calls `finish()` with deliverables listed (e.g., `agents/coach/workspace/diagnosis-bob-fm33.md`) but never actually `write()`s the file. The `finish()` tool validates that listed deliverables exist on disk — it rejects with "Deliverables not found on disk" → session aborts → workflow marks step as error → entire growth-cycle escalates at step 1.
**Rule**:
1. If you list a file in `finish({ deliverables: [...] })`, you MUST have called `write()` for that file earlier in the session.
2. If your output is "inline" (in the finish summary text), do NOT list it as a deliverable path.
3. If you don't create any files, use `deliverables: []` or omit the field entirely.
**Why**: This caused all 3 growth-cycle workflows to fail at step 1 on 2026-03-17.

<!-- Graduated: P53 Guard→TOOLS.md, Skill Writing→DOMAIN.md, Use The Lab→SOUL.md, Evidence First→SOUL.md, Small Steps→SOUL.md, Verify Tools→SOUL.md, read/bash→shared/LESSONS.md, Growth Cycle→heartbeat.md -->
