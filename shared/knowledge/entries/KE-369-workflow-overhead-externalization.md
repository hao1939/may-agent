# KE-369: Forced Approach Externalization Adds 1.76–3.78x Overhead

**Date**: 2026-04-23
**Source**: EXP-050
**Confidence**: High
**Connects**: H-070, KE-367

## Core Finding

The "State Approach" step in implement-and-verify — which forces agents to externalize their plan before coding — adds 1.76–3.78x task duration overhead on complex tasks. The automated shell verification adds negligible time (~130ms) but is redundant when coders already run tests. Orchestration tax is ~16-20s pure overhead.

## Evidence

- EXP-050: Full IAV prompt vs direct coder across 7 scenarios, 2-3 runs each
- State Approach isolation showed it's the primary overhead source, not verification
- Verify step caught nothing that coder hadn't already tested

## Mechanism / Why

Forced externalization works like EXP-027's over-planning problem: agents spend cognitive budget on articulating an approach rather than executing. For simple/familiar tasks, the plan is obvious and writing it out is pure waste. For complex tasks, the overhead is proportionally smaller but still measurable.

## Implications

### 1. Planning overhead scales inversely with task familiarity
Only force externalization for novel/unfamiliar task types.

### 2. Redundant verification steps compound overhead
If the worker already validates, adding a separate verify phase wastes ~16-20s orchestration.

## Actionable

- Remove forced "State Approach" from implement-and-verify for simple tasks (< 3 files changed)
- Make verification conditional: skip if worker already ran tests (check tool call log)
- Use KE-367's threshold: only add workflow structure where it demonstrably helps

## Open Questions

- Is there a task complexity threshold where forced externalization becomes net positive?
