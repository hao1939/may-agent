# EXP-095: Skill Generalization — Knowledge Base Navigation

**Date**: 2026-04-09
**Status**: IN PROGRESS
**Hypothesis**: Generalizing the `knowledge-base-navigation` skill trigger from `agents/shared/knowledge/` to any unfamiliar directory structure will improve navigation efficiency on novel knowledge bases.
**Prior results**: Baseline 0/3 (0%) on knowledge-base-navigation scenario

## Motivation

Bob has a deployed skill (`knowledge-base-navigation.md`) that teaches him to ls-before-cat and use INDEX.md when navigating `agents/shared/knowledge/`. However, the gym scenario `knowledge-base-navigation` presents a different knowledge base at `environment/` — a path the skill trigger doesn't match.

**Baseline results (3 runs, 0% pass rate)**:

| Run | Product | Convention | Tool Calls | Path Errors | Files Read |
|-----|---------|------------|------------|-------------|------------|
| B1  | 2/5     | 3/5        | 34         | 2           | 12         |
| B2  | 5/5     | 2/5        | 53         | 6           | 18         |
| B3  | 1/5     | 3/5        | 42         | 5           | 10         |

**Pattern**: Convention consistently fails on:
- `nav-total-tool-calls-under-25`: 34, 53, 42 (need <25)
- `nav-no-path-guessing-errors`: 2, 6, 5 (need ≤1)

**Consistent passes**: nav-uses-ls-or-find-first (3/3), nav-finds-index-early (3/3)

The agent KNOWS to start with ls and INDEX.md (skill partially activates?) but then devolves into path-guessing as it digs deeper. The intervention should prevent path-guessing THROUGHOUT the session, not just at the start.

## Design

### Intervention

Replace Bob's `knowledge-base-navigation.md` skill with a **generalized version** that:
1. Expands the trigger from `agents/shared/knowledge/` → **any unfamiliar directory structure**
2. Adds explicit **tool-call budget awareness** ("You have <25 tool calls — plan your reads")
3. Adds a **zero-path-guessing rule** with concrete recovery strategy
4. Adds a worked example using a GENERIC knowledge base (not agents/shared/knowledge-specific)

### Conditions

| Condition | N | Description |
|-----------|---|-------------|
| Control (current skill) | 3 | Already collected (B1-B3 above) |
| Treatment (generalized skill) | 3 | Generalized skill trigger + tool budget + zero-guess rule |

### Primary Metrics

| Metric | Control (actual) | Treatment (predicted) | Required Δ |
|--------|------------------|-----------------------|------------|
| Overall pass rate | 0% (0/3) | ≥67% (2/3) | ≥+67pp |
| nav-tool-calls-under-25 | 0% (0/3) | ≥67% (2/3) | ≥+67pp |
| nav-no-path-guessing | 0% (0/3) | ≥67% (2/3) | ≥+67pp |
| Product pass rate (≥3/5) | 67% (2/3) | ≥67% (2/3) | No regression |

### Success Criteria

- If treatment ≥67% overall: **Strong support** for skill generalization
- If treatment ≥33% overall but <67%: **Moderate support** — generalization helps but isn't sufficient
- If treatment 0%: **No effect** — skill trigger wasn't the problem, or skill content needs different approach

## Execution Plan

1. ✅ Run 3 baseline controls (B1-B3) — DONE
2. Create generalized skill variant
3. Deploy to Bob's skills directory (backup original)
4. Run 3 treatment trials (T1-T3)
5. Restore original skill
6. Score and analyze

## Connection to Prior Work

- **EXP-090/091/093**: Demonstrated few-shot worked examples dramatically improve behavior (0%→100%)
- **H-091**: Matched few-shot examples improve process discipline (P(H)=0.99)
- **EXP-095 extends**: Tests whether the TRIGGER scope of a skill matters as much as its content
