# EXP-212: Results — Schema-Organized Context for Tech-Lead

**Status**: DEPLOYED — MEASURING

## Deployment (2026-07-28)

Restructured tech-lead's context.md from flat list to schema-organized sections:
- `## Environment` — tools, paths, build commands (activation: session start)
- `## Session Discipline` — behavioral rules (activation: throughout session)
- `## When Delegating to Coder` — delegation rules (activation: before fork/call)
- `## When Editing Files Directly` — C1.1/C1.3/review gate (activation: before edit)
- `## Design & Architecture Decisions` — judgment rules (activation: design decisions)

Same content, zero new facts. Only structural reorganization.

## Baseline (from H-EXP-012 Phase 3)

Pre-schema violation rates for coder/coach (the agents already restructured):
- C1.1: 21.7% → 9.1% (↓58%) after schema
- C12.1: 48.4% → 3.9% (↓92%) after schema

Tech-lead has NOT been measured pre-schema (missed that window). We'll compare tech-lead's post-schema rates to coder/coach's post-schema rates as a rough comparison.

## Remaining Agents (flat list format)

amy-kimi, amy, bob, evaluator, optimizer, qa, scout — all still flat lists. Apply schema if tech-lead results hold.

## Measurement Plan

After 20+ tech-lead sessions post-deployment, audit convention compliance rates from evaluations table. Compare to pre-deployment baseline (last 20 sessions).

## Data

| Period | N sessions | C1.1 fail% | C12.1 fail% | C1.3 fail% | Notes |
|--------|-----------|------------|-------------|------------|-------|
| Pre-schema (last 20) | — | — | — | — | Pending audit |
| Post-schema (next 20) | — | — | — | — | Measuring |

## Conclusion

Pending measurement.

## Followups

- Audit pre-schema baseline from evaluations DB
- After 20 sessions, audit post-schema rates
- If confirmed: apply to remaining 7 agents
