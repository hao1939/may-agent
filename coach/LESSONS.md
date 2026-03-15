# Lessons

_Staging area for behavioral fixes. Each entry should graduate into structure (heartbeat.md, DOMAIN.md, SOUL.md) within 2 weeks, then be deleted._

## Active Band-Aids

### Learning Filter — Partial vs Total Failures (P155, from Bob's Learning Paradox synthesis)
**Problem**: Coach wastes Growth Cycles on model-level attractors (hallucination, zero-tool-call, P114 skip) that resist all prompt-level fixes. Evidence: C16 (6 failed attempts), C17 (6 failed attempts before DATA layer fix), C21 (LESSONS.md insufficient, needed SOUL.md).
**Rule**: Before starting any Growth Cycle, classify the error:
1. **Partial Failure** (agent CAN do it but does it WRONG) → Growth Cycle appropriate
2. **Total Failure** (agent cannot do it regardless of instruction) → Escalate to infrastructure/data layer, not coaching
3. If 3+ behavioral fix attempts fail → investigate DATA (memory, context, agent.json) before more prompt engineering
**Source**: Bob's 2026-03-15 Learning Paradox synthesis (P154-P157 from Amy-Kimi research HB#373/402/379/386/456)

### Growth Cycle Completion (3x recurrence — FM-2.2, FM-3.3, FM-2.6)
**Problem**: Coach starts growth cycles (fork → edit) but abandons them after a single failed verify, without iterating to pass or writing a clear FAIL receipt. Also claims verification passed without showing evidence from the verify transcript.
**Rule**: Every growth cycle MUST reach a terminal state in the SAME session:
1. If verify PASSES → promote the fork, log success
2. If verify FAILS → either (a) fix the fork and re-verify (max 2 retries), or (b) discard the fork and log the FAIL reason
3. NEVER leave a fork in .lab/ without a terminal state
4. When reporting verify results, quote the specific output line that proves pass/fail — don't summarize
**Status**: ✅ GRADUATED H612 → Embedded as MANDATORY GATE in heartbeat.md Steps 2 and 3.

## Graduated (delete after confirming structural fix works)

- ~~P53 Guard Recovery~~ → **GRADUATED H542**: Moved to TOOLS.md "Key Constraints" section — documents P53 bash guard behavior and recovery procedure (use read()/edit()/write() instead of bash for protected files).
- ~~Skill Writing Principles~~ → **GRADUATED H542**: Moved to DOMAIN.md "Skills lifecycle" — "skills compete for context space, keep lean, examples > explanations, load references on demand."
- ~~Use The Lab~~ → **GRADUATED**: Already in SOUL.md Core Principle P51 + Safety Rule #2. _(Removed H522)_
- ~~Evidence First~~ → **GRADUATED**: Already in SOUL.md "How You Think" — "Evidence over hunches." _(Removed H522)_
- ~~Small Steps~~ → **GRADUATED**: Already in SOUL.md Safety Rule #5 — "One change at a time." _(Removed H522)_
- ~~Verify Tools~~ → **GRADUATED**: Already in SOUL.md "How You Think" — "Verify behavior, not files." _(Removed H522)_
- ~~read takes path / bash needs command / File read vs bash~~ → **GRADUATED**: Already in shared LESSONS.md "Verify Paths" + "No Blind Writes". _(Removed H522)_
- ~~No heredocs~~ → **GRADUATED**: Merged into P53 Guard Recovery above. _(Removed H522)_
- ~~Don't dump large files / Synthesize / Write incrementally~~ → **GRADUATED**: General best practices covered by SOUL.md "Patient" + shared LESSONS.md "Context Efficiency". _(Removed H522)_
- ~~Archive Todos~~ → **GRADUATED**: Already in heartbeat.md step 4 (Close out). _(Removed H522)_
