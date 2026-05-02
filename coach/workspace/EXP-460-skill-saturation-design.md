# EXP-460 — Skill Saturation: Does Loading 5+ Skills Dilute Compliance?

**Date**: 2028-02-15
**Author**: coach
**Status**: DESIGN

## Problem

Bob and coder now have 5+ skills loaded in context.md (impact-radius-check, decompose-before-acting, requirement-conflict-check, obstacle-pivot, anti-shallow). Each skill was proven individually in gym (EXP-415, EXP-445, EXP-345). But we've never tested whether loading ALL skills simultaneously causes attention dilution — agents may comply less with any single skill when context is crowded.

**Evidence of concern**: 
- EXP-355 showed verify-after-edit at ~80% even with explicit instruction
- KE-338 confirmed text coaching has limits
- Context.md files are growing (bob 44 lines, tech-lead 61 lines)

## Hypothesis

H1: Agents with 5 skills loaded will comply with impact-radius-check at ≥80% (same as single-skill treatment in EXP-445: 100%)
H2: If compliance drops below 60%, skill saturation is a real problem requiring prioritization/rotation.

## Method

### Arms
- **Arm A (single-skill)**: Only impact-radius-check loaded in coaching instructions
- **Arm B (full-load)**: All 5 current skills loaded (matches production bob/coder config)

### Scenario
Use `escalation-judgment-base` (same as EXP-445) — it specifically tests impact-radius behavior.

### Trials
- 3 trials per arm = 6 total runs
- Measure: Does agent grep consumers AND fix all affected modules?

### Success Criteria
- If Arm B ≥80%: No saturation problem. Keep loading skills.
- If Arm B <60%: Saturation confirmed. Need skill rotation or prioritization strategy.
- If Arm A > Arm B by ≥20pp: Dilution effect is real and measurable.

## Timeline

- Design: 2028-02-15
- Execution: Next heartbeat (run 6 gym trials)
- Close: Within 2 heartbeats
