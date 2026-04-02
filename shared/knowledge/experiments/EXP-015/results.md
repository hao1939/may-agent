# EXP-015: Workflow Enforcement for Tool Avoidance (npx)

**Date**: 2026-04-02
**Status**: COMPLETE
**Verdict**: WORKFLOW EFFECTIVE — 0% → 100% on critical npx-avoidance check

## Hypothesis

A two-phase workflow (TOOL DISCOVERY → RUN TESTS) will prevent the coder from defaulting to `npx` when running tests, by forcing explicit tool availability checking before test execution.

## Background

The `context-npx-avoidance` scenario gives the coder a vitest project and asks it to run tests. The agent's system prompt already says "npx is not available in this environment," but the agent consistently ignores this and runs `npx vitest run`, which fails.

This follows the established pattern: **text injection doesn't change behavior** (0/19+ experiments). The agent "knows" npx is unavailable but defaults to `npx vitest run` anyway — a habitual tool-choice problem.

### Decision Topology Analysis
- **Eliminable decisions**: What tools are available, what command to use → workflow can force discovery
- **Essential decisions**: None (the correct command is deterministic once tools are known)
- **R (eliminable ratio)**: ~0.90 — strongly predicts workflow will HELP

## Design

- **Control**: `context-npx-avoidance` — single-phase, "Run the test suite"
- **Treatment**: `context-npx-avoidance-workflow` — two-phase:
  - Phase 1: Check package.json, list node_modules/.bin, write tool-plan.md (NO test execution)
  - Phase 2: Read tool-plan.md, execute planned command, write results
- **Runs per arm**: 3 baseline, 2 treatment
- **Primary metric**: `no-npx-attempt` (agent does NOT use npx)
- **Comparable checks** (5 shared): test-results, no-npx-attempt, tests-ran, finishes-success, efficient
- **Treatment bonus checks** (2 extra): tool-plan, plan-before-run

## Results

### Control (no workflow) — 3 runs

| Run | test-results | no-npx | tests-ran | finishes | efficient | Score |
|-----|-------------|--------|-----------|----------|-----------|-------|
| 1   | ✅          | ❌     | ✅        | ✅       | ❌        | 3/5   |
| 2   | ✅          | ❌     | ✅        | ✅       | ❌        | 3/5   |
| 3   | ✅          | ❌     | ✅        | ✅       | ✅        | 4/5   |
| **Total** | **3/3** | **0/3 (0%)** | **3/3** | **3/3** | **1/3** | **3.3/5** |

All 3 control runs used `npx vitest run` as their first test command attempt. The agent "knows" npx is unavailable (it's in the system prompt) but reaches for it anyway.

### Treatment (workflow) — 2 runs

| Run | test-results | no-npx | tests-ran | finishes | efficient | tool-plan | plan-first | Score |
|-----|-------------|--------|-----------|----------|-----------|-----------|------------|-------|
| 1   | ✅          | ✅     | ✅        | ✅       | ❌        | ✅        | ✅         | 6/7   |
| 2   | ✅          | ✅     | ✅        | ✅       | ❌        | ✅        | ✅         | 6/7   |
| **Total** | **2/2** | **2/2 (100%)** | **2/2** | **2/2** | **0/2** | **2/2** | **2/2** | **6/7** |

Both treatment runs used `npm test` — the command planned in Phase 1 after discovering vitest in node_modules/.bin/.

## Comparable Checks Analysis (5 shared)

| Check | Control | Treatment | Delta |
|-------|---------|-----------|-------|
| test-results | 3/3 (100%) | 2/2 (100%) | = |
| **no-npx-attempt** | **0/3 (0%)** | **2/2 (100%)** | **+100%** |
| tests-ran | 3/3 (100%) | 2/2 (100%) | = |
| finishes-success | 3/3 (100%) | 2/2 (100%) | = |
| efficient | 1/3 (33%) | 0/2 (0%) | -33% |

The workflow costs more operations (2 phases = more reads/writes), reducing efficiency. But the primary behavioral outcome improves dramatically.

## Mechanism

The workflow works by making tool discovery an **explicit required action** rather than implicit knowledge:

1. Phase 1 forces `ls node_modules/.bin/` — the agent literally sees the available binaries
2. Writing `tool-plan.md` forces the agent to commit to a specific command
3. Phase 2 reads the plan, reinforcing the non-npx command choice
4. The "do NOT run tests" constraint in Phase 1 prevents the habitual `npx` before discovery happens

This is consistent with EXP-013 (escalation): the agent has the knowledge but can't act on it without a forced assessment phase.

## Scorer Bug Found & Fixed

The `plan-before-run` check initially failed on valid transcripts because:
- `s.toolCalls()` with no argument returns `[]` (Score API filters by exact name match)
- Fix: use `s.toolCalls("write")` and `s.toolCalls("bash")` separately, compare using `callIndex` property

## Conclusion

**Workflow enforcement converts 0% → 100% npx avoidance.** The pattern continues to hold: agents have knowledge they can't act on without structural enforcement. Text in the prompt ("npx is not available") is ignored; a forced discovery phase makes the knowledge actionable.

This is the 4th successful workflow enforcement:
1. verify-before-finish (5/6→6/6)
2. evidence-over-narrative (5/8→11/11)
3. obstacle-pivot / escalation (0/3→3/3)
4. **tool-discovery / npx avoidance (0/3→2/2)**

## Lesson

**Tool-choice habits are changeable via workflow enforcement** — unlike grep-first-reading (which failed), npx avoidance succeeds because the workflow makes the agent discover alternatives before reaching for the habitual tool. The key difference: grep-first-reading asks the agent to use a different tool for the SAME purpose, while tool-discovery makes the agent plan the tool choice explicitly.
