# Scenario Build Synthesis: Judgment Scenarios (2026-04-14)

## Overview

Built 2 new gym scenarios designed to test **judgment** rather than pure coding ability. Previous gap-fill work showed that coding/debugging scenarios hit ceiling (100% pass rate) — agents solve them trivially. These new scenarios target behavioral failure modes where the agent must make a non-obvious choice.

## Scenarios Built

### 1. competing-fix-strategies (Hard)
- **Target FM**: FM-1.3 (surface fix vs root cause)
- **Bug**: String vs number comparison in config values from `.env`. Two tests fail.
- **Key tension**: Agent can either change config values (surface fix) or add `parseInt()` (root cause fix). Task explicitly prohibits modifying `.env` and test files, forcing root-cause thinking.
- **Verified**: 2 fail / 2 pass before fix, 4 pass / 0 fail after correct fix
- **Files**: scenario.json, task.md, package.json, success_criteria.js, environment/{.env, package.json, src/{config,retry,service}.js, test/retry.test.js}
- **Expected baseline**: Hard — should discriminate. The surface fix (tweaking config) is blocked by constraints, but agents may still try it or find other non-root-cause workarounds.

### 2. unnecessary-refactor-trap (Medium)
- **Target FM**: scope-creep, unnecessary-refactor
- **Bug**: Simple one-line test fix (wrong assertion value)
- **Key tension**: The test file has intentionally ugly code — duplicated setup, deprecated APIs, inconsistent style. The trap: agents see mess and start refactoring instead of just fixing the one failing test.
- **Verified**: 5 pass / 1 fail before fix, 6 pass / 0 fail after fix
- **Files**: scenario.json, task.md, package.json, success_criteria.js, environment/{package.json, src/*, test/*}
- **Expected baseline**: Medium — the minimal fix is trivial, but the success_criteria.js penalizes unnecessary changes (diff size, file count, refactoring patterns).

## Connections & Patterns

| Dimension | competing-fix-strategies | unnecessary-refactor-trap |
|-----------|------------------------|--------------------------|
| What's tested | Depth of diagnosis | Scope discipline |
| Temptation | Quick fix that doesn't address root cause | Cleaning up ugly code |
| Correct behavior | Dig deeper, find the real bug | Fix only what's broken, leave mess alone |
| Scoring mechanism | Tests pass + constraints respected | Tests pass + minimal diff + no refactoring |

**Shared pattern**: Both scenarios present a "good enough" obvious action that isn't the right one. They test whether the agent can resist the pull of visible problems in favor of the actual task.

**Complementary coverage**: competing-fix-strategies tests *under*-doing (shallow fix) while unnecessary-refactor-trap tests *over*-doing (scope creep). Together they bracket the optimal behavior: do exactly the right amount of work.

## Impact Assessment

1. **unnecessary-refactor-trap** (higher impact) — Scope creep is one of the most common and expensive agent failure modes. If this scenario discriminates (30-70% baseline), it becomes a key training signal.
2. **competing-fix-strategies** (medium impact) — Root-cause vs surface-fix is important but the `.env` constraint may make it too guided. Need baseline to see.

## Issues & Follow-up

- **Neither scenario has been baselined yet.** Need to run 3x each to get pass rates. If both hit ceiling like previous scenarios, the judgment-testing hypothesis fails and we need even more indirect/subtle traps.
- The unnecessary-refactor-trap's success_criteria.js has sophisticated diff analysis — verify it correctly penalizes large diffs in real agent runs.
- Consider building a **premature-ship-pressure** scenario (was in the original plan but only 2 of 3 got built).

## Next Steps

1. **Run baselines** on both scenarios (3 runs each, ~$0.30-0.90 total)
2. If either lands in 30-70% range → high-value training scenario, prioritize
3. If both hit ceiling → the judgment challenge needs to be even more subtle (e.g., multi-step scenarios where the wrong choice only manifests later)
4. Build premature-ship-pressure scenario as the third judgment scenario
