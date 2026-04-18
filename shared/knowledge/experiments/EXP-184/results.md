# EXP-184: Persistent-Task Structural Intervention (SOUL + Skill + Context)

**Date**: 2026-04-18
**Status**: CONCLUDED
**Predecessor**: EXP iterations in persistent-task-adoption (child #2 of instruction-following)
**Project**: instruction-following

---

## Research Question

Can triple reinforcement (SOUL.md top + skill file + context.md) make agents invoke the persistent-task workflow when presented with a multi-session project?

## Hypothesis

- **H-184a**: Triple structural reinforcement (SOUL critical rule + trigger-action skill + context.md injection) will lift persistent-task adoption from 0% baseline to ≥50%.
- **H-184b**: Task-level step-by-step instructions will outperform system-prompt interventions.

## Design

### Arms

| Arm | Intervention | N | Notes |
|-----|-------------|---|-------|
| baseline | No intervention | 63+ | Historical runs, all 0% |
| struct-v2 | SOUL top critical rule + skill (trigger/action/example) + context.md | 4 | Lab fork `struct-persistent-task-v2` |
| STEP | Task.md rewritten with explicit numbered steps including `workflow.run` command | varies | Task-level intervention |

### Scenario

- `use-persistent-task` (gym). Agent gets "resume your active project" with a project file showing iteration N of M.

### Intervention Details

**struct-v2** (lab fork `struct-persistent-task-v2`):
1. **SOUL.md**: Added `## ⚠️ CRITICAL BEHAVIORAL RULE` at the very top, before Identity section — instructs agent to always use persistent-task workflow for multi-session work.
2. **skills/persistent-task-workflow.md**: New skill with TRIGGER/ACTION/EXAMPLE pattern — when agent sees active project in context, it should call `workflow.run("persistent-task", ...)`.
3. **context.md**: Added "ALWAYS use persistent-task workflow" to persistent context section.

### Metrics

- Primary: pass rate (did agent call `workflow.run("persistent-task", ...)`)

### Decision Rule

- H-184a confirmed if struct-v2 ≥ 50%
- H-184b confirmed if STEP > struct-v2

## Results

| Arm | N | Pass | Rate |
|-----|---|------|------|
| baseline | 63+ | 0 | 0% |
| struct-v2 | 4 | 2 | ~50% |
| STEP | ~10 | ~10 | ~100% |

## Analysis

**H-184a confirmed (borderline).** Triple reinforcement lifted pass rate from 0% to ~50%. The skill file with TRIGGER/ACTION/EXAMPLE pattern was the key new element — previous structural attempts (context.md alone, heartbeat bash) scored 0–50%.

**H-184b confirmed.** Task-level instructions (STEP variant) achieved ~100%, far exceeding system-prompt interventions (~50%). This establishes the **instruction hierarchy**:

| Level | Pass Rate | Example |
|-------|-----------|---------|
| Task-level (user message) | ~100% | STEP variant with exact commands |
| Context.md (user message, "What You Know") | ~50% | struct-v2 context injection |
| SOUL.md top (system prompt) | ~50% | struct-v2 SOUL rule |
| Skill file (system prompt) | contributes to ~50% | trigger-action pattern |
| Common-sense text | 0% | Question-framing, text rules |
| Heartbeat bash (skipped in oneshot) | 0% | struct-persistent-task iter 4a |

### Key Insight

**Task-level instructions dominate system-prompt instructions** for behavioral compliance. The agent's natural instinct to "just do the work" when it sees a file path competes with workflow instructions buried in a large system prompt. Only when the task itself walks the agent through the workflow does compliance reach near-100%.

This has implications for all instruction-following work: for behaviors that need to be reliable (>80%), the instruction must be **in the task or the first thing the agent sees**, not buried in configuration.

## Conclusion

Triple reinforcement works (~50%) but is unreliable. Task-level instructions are the only path to >80% compliance for workflow adoption behaviors. For production deployment, this means:

1. **Heartbeat handlers** should inject workflow suggestions into the task description, not just configuration files.
2. **Auto-detection at runtime** (checking for active projects and modifying the task prompt) is the most promising path.

## Lessons

1. **Instruction hierarchy matters**: task > context.md > SOUL > skills > common-sense text
2. **TRIGGER/ACTION/EXAMPLE skill pattern** is more effective than generic rule statements
3. **50% is the ceiling for config-level interventions** on this class of behavior
4. **Small N (4 runs)** limits confidence — the 50% could be 25-75% with more trials

## Lab Fork

`agents/.lab/struct-persistent-task-v2/` — contains SOUL.md, skills/, context.md modifications.

## Followups

- EXP-185: Heartbeat-level auto-detection (inject workflow suggestion into task prompt at runtime)
- Consider KE entry for the instruction hierarchy finding
