# EXP-<ID>: <Short Title>

**Date**: <YYYY-MM-DD>
**Status**: PROPOSED | RUNNING | COMPLETE | ABANDONED
**Parent**: <EXP-XXX or hypothesis H-XXX>
**Hypothesis**: <single sentence — what you expect and why>

## Background

<2-4 sentences. Cite prior EXP/KE IDs. What's the open question?>

**Key prior findings:**
- <EXP-XXX>: <1-line result>
- <KE-XXX>: <1-line rule>

## Design

### Arms

| Arm | Scenario | Treatment | N |
|-----|----------|-----------|---|
| A: Control | <scenario-name> | None | 12 |
| B: Treatment | <scenario-name> | <intervention> | 12 |

**Total trials**: <N>

### Treatment Details

<Describe exactly what changes between arms. Reference files:
`skills/<name>.md`, `injected_context.md`, `task.md` prefix, etc.>

### Primary Metrics

1. **Pass rate** (binary) — Fisher exact test
2. **Per-criterion rate** — Fisher per criterion
3. **Score** (continuous) — Welch's t-test

### Power Analysis

With N=12/arm, Fisher exact detects:
- 0% vs 42% at p<0.05 (one-tailed)
- 0% vs 50% at p<0.01 (one-tailed)

### Scenarios

**Primary: `<scenario>`** — baseline <X/Y> (<rate>%)
- Success criteria: <list>

**Generalization (optional): `<scenario>`** — baseline <X/Y>

## Execution Plan

1. Run N trials per arm (total <N>)
2. Analyze with Fisher + Welch's t
3. Compare per-criterion patterns
4. Write `results.md`; update KEs if supported

## Pre-registered Decision Rules

- If B - A ≥ 25pp AND p<0.05 → **deploy** and write KE
- If B - A < 10pp OR p>0.10 → **reject**, archive
- Otherwise → run Phase 2 at 2× N

## Results

<Fill in after execution. Copy the arms table with Passed/N/Rate/p columns.>
