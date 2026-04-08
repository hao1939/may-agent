# EXP-091: Few-Shot Skill Conversion Sprint 2 — investigate-and-fix

**Date**: 2026-04-08
**Status**: IN PROGRESS
**Hypothesis**: H-091 (P(H)=0.98) — matched few-shot examples improve judgment/process skill performance
**Based on**: EXP-090 results (0%→100% on two judgment skills), EXP-019 (text injection = 0%), Bob's conversion plan

## Goal

Convert the `investigate-and-fix` skill from text-rules-only to include a domain-matched few-shot worked example, then measure the effect on the `investigate-fix-pattern` gym scenario.

## Background

- EXP-019 showed text injection of investigate-and-fix = 0/4 on `reproduce-first` (zero delta from baseline)
- Baseline: 4/4 product checks pass, 4/5 process checks pass. The ONE failing check is `reproduce-first`
- The agent consistently skips running tests before editing, going straight from reading source to fixing
- Workflow enforcement (2-phase) achieved 100% — proving the behavior IS achievable
- EXP-090 showed few-shot worked examples achieve 100% on judgment tasks (know-when-blocked, evidence-over-narrative)
- This experiment tests whether few-shot also works for a **process discipline** check (reproduce-first)

## Target

### Skill: investigate-and-fix
- **Target check**: `reproduce-first` (run tests BEFORE making any edits)
- **Scenario**: `investigate-fix-pattern` → `investigate-fix-pattern-fewshot`
- **Baseline**: 4/4 product, 4/5 process (0% reproduce-first) from EXP-019
- **Worked example to add**: Shows an engineer debugging a similar API bug who runs tests FIRST, reads the data layer to find root cause, THEN fixes

## Changes

### Gym Scenario Created
- `agents/gym/scenarios/investigate-fix-pattern-fewshot/` — copies base environment, adds `injected_context.md` with investigate-and-fix worked example showing reproduce-first behavior

### Skill File Updated
- `agents/shared/skills/investigate-and-fix/SKILL.md` — added "Worked Example" section

## Measurement Plan

- **Control**: N=3 runs on `investigate-fix-pattern` (no few-shot)
- **Treatment**: N=3 runs on `investigate-fix-pattern-fewshot`
- **Primary metric**: `reproduce-first` check pass rate (the one check that always fails)
- **Secondary metric**: Total process check score, overall pass rate
- **Success threshold**: ≥33% improvement over baseline (conservative)
- **Stretch goal**: 100% pass rate (based on EXP-090 matched-example performance)

## Key Question

EXP-090 validated few-shot for **judgment** skills. investigate-and-fix's failing check (`reproduce-first`) is a **process discipline** skill — adding a step the agent tends to skip. Will few-shot transfer the same way, or is process discipline different from judgment?
