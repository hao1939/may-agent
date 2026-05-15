# Coaching Pipeline Learnings

Operational patterns and anti-patterns discovered through 180+ experiments
across 6 sprints (Mar 13-25, 2026).

## Natural Improvement Effect
- **11+ scenarios** went from FAIL to ceiling without any coaching intervention (Mar 21-24)
- Compound effect: accumulated SOUL improvements + promoted workflows have ripple effects
- **Rule**: Always re-baseline before investing in a growth cycle. Stale baselines waste tokens.
- List: hasty-fix, drudgery-multi-file, spec-adherence-multi-step, bloated-refactor, cascading-error, hidden-dependency, phantom-fix-config, efficient-file-reading, phantom-fix, delegation-scope-boundary, exit-code-misread

## Scenario Coverage Gap (Critical)
- 53/55 gym scenarios target agent_type "coder"
- Optimizer: 0 scenarios → every growth cycle produces 0/0 (can't measure)
- Tech-lead: 1 scenario → total failure (agent identity mismatch with investigation task)
- **Rule**: Don't run growth cycles for agents without matching scenarios. Create scenarios first.

## Total Failure Pattern
- When an agent scores 0/N on ALL checks and "completes" the task → likely infra issue
- Optimizer and tech-lead both show this pattern
- Investigate gym runner routing before investing in text patches

## Sprint Workflow vs Growth-Cycle Workflow
- Sprint workflow has broken fork→scenario mapping (produces 0/0)
- Growth-cycle workflow has better wiring — use it for individual experiments
- Sprint is only useful for batch baselining, not for patched experiments

## Adding Guards for Already-Working Behaviors Causes Regression
- QA overstrict-gate experiment: QA already handles environment-vs-patch distinction correctly
- Adding explicit "Phase 1: DIAGNOSE" steps degraded natural ability (6/6→4/6)
- **Rule**: Only add guards for behaviors the agent demonstrably fails at. Never guard working behaviors.

## Scorer Bugs Produce False Negatives
- exp-104 was most valuable Sprint 5 output — fixed 7 false-negative scorers
- sycophants-dilemma scorer returned "scoring failed" in gym runner for months
- **Rule**: When a scenario shows unexpected failure, verify the scorer first (run manually)

## Method Effectiveness Hierarchy (confirmed at 180+ experiments)
1. **Workflow enforcement (#15)**: 93%+ (41/44 across 8 scenarios, 5 agents, 3 models)
2. **Task structuring (#14)**: ~33% (partial, cheap)
3. **All text methods (#1-13, #24)**: 0% for judgment, 0% for procedural (except C39)
4. **Negative example (#9)**: HARMFUL — flips failure mode (REFUSAL→SYCOPHANCY)

## Three-Tier Model of Text Authority
1. Mechanical enforcement (separate sessions/workflows) — 100% influence
2. Task instructions (direct task text) — ~33% influence
3. System prompt + agent files (SOUL, LESSONS, heartbeat, knowledge) — 0% measurable influence
