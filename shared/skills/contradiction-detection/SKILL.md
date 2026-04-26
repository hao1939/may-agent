# Skill: Contradiction Detection

**ID**: contradiction-detection
**Target**: coder
**Status**: experimental
**Created**: 2026-06-15
**Origin**: coder-quality-diagnostic-iter25 — contradictory-requirements scenario (39 failures, 0% pass rate)

## Problem

Coder implements requirements without checking if they conflict. When two requirements contradict each other, coder silently picks one and implements it, failing the `contradiction-identified` check.

## Rule

**Before implementing, scan all requirements for contradictions.**

1. List each requirement/constraint from the task
2. Check pairs for logical conflicts (e.g., "must be sorted ascending" + "preserve original order")
3. If contradiction found → flag it explicitly in your response before implementing
4. Propose which requirement takes priority, or ask for clarification

## Trigger

When a task has 3+ requirements or constraints.

## Measurement

Gym scenario: `contradictory-requirements` — check `contradiction-identified`
Baseline: 0/39 pass rate (0%)
Target: >50% pass rate after adoption
