# Project: Context Learning — Implementation Phase

**Status**: active
**Owner**: bob
**Priority**: P1
**Iteration**: 3
**Health**: 7/10

## Goal
Integrate the reflexion-based learning pipeline into the agent infrastructure so agents automatically learn from failed sessions. Design is complete — this is implementation.

## Background
- Design phase complete: `agents/bob/workspace/projects/context-learning/`
- Core pipeline implemented and tested: `extract-reflection.js` (17/17 tests passing)
- Integration design doc: `integration-design.md`
- Two gym scenarios ready: `reflexion-npx-recovery`, `reflexion-read-before-edit`
- Key blocker from design phase: npx actually works in this environment (need to handle in scenario design)

## Dependencies
- Design docs: `agents/bob/workspace/projects/context-learning/integration-design.md`
- Core module: `agents/bob/workspace/projects/context-learning/extract-reflection.js`
- Gym scenarios: `agents/gym/scenarios/reflexion-npx-recovery/`, `reflexion-read-before-edit/`

## Milestones
- [x] M1: Fix test suite (9/9 passing) and write integration wiring spec → `agents/src/lib/LESSONS-WIRING-SPEC.md`
- [ ] M2: Wire `extractLessons()` into session completion handler (requires `src/lib/manager.ts` access)
- [ ] M3: Wire `retrieveLessons()` into `buildSessionContext()` (requires `src/lib/manager.ts` access)
- [ ] M4: Run reflexion gym experiments — baseline + treatment comparison
- [ ] M5: Write results doc with quantitative comparison (phase2-results.md)

## Key Decisions
- Pipeline triggers on session failure/error only (not clean sessions)
- Lessons stored as text bullets in `agents/<name>/context.md`
- Max 15 lessons, FIFO pruning
- Use cheap/fast model for extraction

## Open Questions
- Where in infrastructure is the session completion handler? Need to find the hook point.
- npx works in this env — need alternative failure scenario or npx-shadow wrapper
- Does the gym runner support automated multi-run experiments?

## Current State
Iteration 3. Milestones: 1/5 done. Next: M2: Wire `extractLessons()` into session completion handler (requires `src/lib/m
## Iteration Summary
- **Iter 1**: Already committed in a prior step. Good.

- **Iter 2**: All 19 tests pass (9 original + 10 new).

