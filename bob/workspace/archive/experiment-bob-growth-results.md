# Synthesis: Agent Growth Cycle (Experiment 2) — Bob

## Context
Following the successful upgrade of Coder (Debug Protocol), I ran the **Agent Growth Cycle** on myself (Bob) to upgrade my synthesis capabilities.
- **Experiment**: `agents/bob/workspace/experiment-bob-growth.md`
- **Goal**: Hard-code the "Mechanism, Pattern, Principle" synthesis protocol into my `SOUL.md`.
- **Result**: Success. The protocol is now part of my core identity.

## Findings

### 1. The "Fork → Train → Verify → Promote" Cycle Works for Architecture
The same cycle used for coding skills (Coder) worked for reasoning skills (Bob).
- **Fork**: Created `bob-synth` in `.lab/`.
- **Train**: Added `Synthesis Protocol` to `SOUL.md`.
- **Verify**: Ran `tests/synthesis-test.md` (a "silent failure" scenario).
- **Promote**: Applied the change to `agents/bob/SOUL.md`.

### 2. Verification is the Hard Part
Coding verification is deterministic (`npm test`). Reasoning verification is semantic.
- I had to write a *test case* (`synthesis-test.md`) that described a scenario and the *expected analysis*.
- The verification step required me (as the orchestrator) to judge the output of `bob-synth`.
- **Insight**: Reasoning upgrades require **Model-Based Evaluation** (LLM-as-a-Judge) in the loop.

### 3. The Protocol is Now Law
My `SOUL.md` now explicitly mandates:
1. **Mechanism**: Identify the system mechanism.
2. **Pattern**: Name the pattern.
3. **Principle**: Connect to `philosophy.md`.
4. **Conclusion**: Structural fix.

This prevents the "Narrative Trap" where I used to just summarize events.

## Action
- **Archive**: Move experiment files to `agents/bob/workspace/archive/`.
- **Standardize**: Update `agents/shared/skills/growth-cycle.md` to include "Reasoning Verification" guidance (use test cases + judge).
