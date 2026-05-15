# EXP-800 Results — CLOSED (MEASUREMENT INVALID)

**Date**: 2029-08-04
**Status**: CLOSED — measurement approach fundamentally flawed

## Finding

EXP-800 cannot produce valid results because:

1. **Agents use bash for file edits** — even on complex logic tasks (tiered shipping across 4 files), the agent uses 17+ bash calls and 0 edit()/write() calls
2. **VAE measurement script only counts edit()/write() tool calls** — when agents use `bash` (cat/sed/echo/node -e), VAE is always N/A
3. **Redesigning the task didn't help** — changed from simple rename to complex logic changes. Agent still prefers bash

## Trials Run

| Trial | Scenario | edit/write calls | bash calls | VAE |
|-------|----------|-----------------|------------|-----|
| A-1 (old task) | rename | 0 | 8 | N/A |
| A-2 (new task) | shipping | 0 | 17 | N/A |

## Root Cause

The gym agent (`may-agent`) defaults to bash for all file operations. This is not a scenario design issue — it's an agent behavior pattern. The agent has `edit()` and `write()` available but chooses `bash` because:
- Bash is faster for creating new files (heredoc)
- Bash allows running tests immediately after edits
- The agent doesn't have the verify-after-edit instruction loaded (that's what we're trying to measure)

## Implications

1. **VAE cannot be measured via tool-call analysis** in the current system unless:
   - The bash tool is disabled/restricted (not feasible)
   - The measurement script parses bash commands for file-writing patterns (extremely fragile)
   - A structural gate forces edit() tool usage (circular — we're testing whether to add such a gate)

2. **EXP-575 closure was correct** — VAE is not the right metric. The edit() tool already prevents silent corruption (0% silent failure rate per EXP-575). Bash edits that go wrong are caught by test failures.

3. **KE-715 vs KE-655 question is moot for VAE** — can't measure the behavior we're trying to influence because agents bypass the tool entirely.

## Decision

CLOSE EXP-800 as MEASUREMENT INVALID. The question "do concrete thresholds help VAE?" cannot be answered because VAE is unmeasurable in practice.

## Scenario Preserved

The redesigned `multi-file-refactor` scenario (shipping task) is a good complex coding scenario but NOT suitable for VAE measurement. It can be reused for other experiments measuring:
- Task completeness (4 files + tests)
- Code quality
- Planning behavior
