# Meta-Analysis: Text Injection vs Workflow Enforcement

**Date**: 2026-04-03
**Based on**: EXP-009 through EXP-019 (11 experiments)

## Executive Summary

**Text injection into agent prompts does not change behavior.** Workflow enforcement does.
This is the single most important finding from 11 controlled experiments.

## The Evidence

### Text Injection (skill files, context patches, system prompt additions)
- **21 attempts** across 11 experiments
- **1 success**: `efficient-file-reading` (EXP-018) — a simple tool-choice habit
- **20 failures**: Agent reads the skill text but does not change behavior
- **Success rate**: 4.8% (1/21)

### Workflow Enforcement (multi-phase task separation)
- **5 attempts** across 5 experiments
- **5 successes**: Every workflow tested improved the target behavior
- **Success rate**: 100% (5/5)

### Key Results

| Experiment | Skill | Text Result | Workflow Result |
|-----------|-------|-------------|-----------------|
| EXP-013 | obstacle-pivot | (untested) | 0%→100% escalation |
| EXP-015 | tool-discipline | 0/N (fails) | 0%→100% no-npx |
| EXP-017 | classify-then-act | 0% delta | 75% improvement |
| EXP-018 | efficient-file-reading | ✅ 6/8→8/8 | worse (4/8) |
| EXP-019 | investigate-and-fix | 0% delta | 0%→100% reproduce-first |

## Why Text Injection Fails

1. **Model-level attractors override text**: The agent has strong priors (e.g., "fix the obvious bug immediately"). Text saying "investigate first" can't override the attractor.
2. **Context dilution**: Skills are one of many context items. By the time the agent acts, the skill instruction is buried under task description, file contents, etc.
3. **Descriptive ≠ prescriptive**: Skills describe ideal behavior. They don't create enforcement points. The agent agrees with the skill but doesn't follow it.

## Why Workflows Work

1. **Physical enforcement**: Phase separation physically prevents premature action. You literally cannot edit in Phase 1.
2. **Mandatory checkpoints**: Written artifacts (analysis.md) force the agent to demonstrate understanding before acting.
3. **Align with model's architecture**: Each phase is a fresh prompt with a single clear goal, matching how LLMs actually execute tasks.

## Exception: When Text Works

The one success (EXP-018: efficient-file-reading) was a **tool-choice habit** — using grep before reading large files. This works because:
- It's a simple, concrete action ("use grep before read")
- It has an immediate, verifiable trigger ("before ANY read() call")
- It doesn't fight a strong prior (no "fixer instinct" to override)

## Implications

1. **Stop testing text injection for process discipline** — 20/21 failures is conclusive
2. **Default to workflow enforcement** for any behavioral change that requires restraint
3. **Reserve text injection** only for simple tool-choice habits with clear triggers
4. **Invest in workflow scenario creation** — this is where skill value actually lives
5. **The LIBRARY's "untested" skills are almost certainly ineffective as text** — test the workflow variants instead
