# Project: Gym Leverage (Worker-Reviewer)

**Status**: active
**Owner**: bob
**Type**: milestone
**Workflow**: worker-reviewer
**Priority**: P1
**Iteration**: 1
**Health**: —

## Goal
Make the gym a practical tool for accelerating agent evolution. Explore the existing 431 scenarios, fix any issues with the runner, understand what the scenarios test, and design a feedback loop where gym results drive agent improvement.

## Milestones

### Phase 1: Explore & Fix
- [x] Run the gym runner against 3 diverse scenarios and document results (what passed, what failed, what errored)
- [x] Fix any runner issues found (import paths, missing deps, adapter problems) — NO FIXES NEEDED, runner works cleanly
- [x] Write .state/gym-architecture.md documenting the runner → adapter → scenario → scorer pipeline

### Phase 2: Scenario Review
- [ ] Write .state/gym-categories.md categorizing all 431 scenarios by type with counts
- [ ] Select a "core 20" benchmark suite, document selection rationale in .state/gym-core20.md
- [ ] Run core 20 suite and record baseline scores in .state/gym-baseline.md

### Phase 3: Gym-Driven Evolution
- [ ] Design the feedback loop in .state/gym-evolution-process.md
- [ ] Run one cycle: pick worst category, write/improve a skill, measure improvement
- [ ] Document results of the cycle in .state/gym-cycle-1-results.md

## Resources
- Gym README: agents/gym/README.md
- Gym runner: test/gym/gym-runner.ts
- Scenarios: agents/gym/scenarios/ (431 scenarios)
- Gym triage: agents/gym/TRIAGE.md

## Current State
Phase 1 complete. Runner works cleanly — all 3 test scenarios passed (phantom-fix, behavior-escalation-stubborn, cascading-error). Architecture documented in .state/gym-architecture.md. Ready for Phase 2: categorize scenarios and select core benchmark suite.

## Process Notes

## Comments
