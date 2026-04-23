# KE-370: Bounding Skill Fallback Behavior Fixes Regressions Without Removing Capability

**Date**: 2026-04-23
**Source**: EXP-027
**Confidence**: High
**Connects**: KE-133

## Core Finding

When a skill's fallback advice is unbounded (e.g., "search with grep/find for missing files"), it can cause regressions by teaching open-ended behavior that conflicts with scenario requirements. Bounding the fallback (e.g., "max 2 attempts: one read, one search, then mark blocked and pivot") fixes the regression while preserving the skill's core benefit.

## Evidence

- EXP-027: structured-plan-writing skill caused plan-once-amend regression (EXP-018 found it counter-productive, -25% from over-planning)
- Root cause: RISK step's unbounded "search with grep/find" conflicted with "≤3 operations on missing file" criterion
- Fix: Bounded fallback + explicit "Critical rule for missing files" section → 8/8 pass

## Mechanism / Why

Skills teach general patterns, but scenarios test specific behaviors. When a skill's general advice (keep searching) contradicts a specific requirement (give up quickly), the skill wins because it's always present in context. Bounding the advice aligns general and specific requirements.

## Implications

### 1. Every skill fallback path needs explicit bounds
"Try X, then Y, then stop" not "try X, then try alternatives."

### 2. Regression debugging should check skill-scenario conflicts first
When a skill causes regression on one scenario but helps others, the conflict is usually in edge-case advice, not core logic.

## Actionable

- Audit existing skills for unbounded fallback advice (grep for "search", "try", "find" without bounds)
- Template for skill fallback: "If [condition], try [action1]. If still failing, try [action2]. After 2 attempts, mark blocked and move on."

## Open Questions

- How many existing skills have unbounded fallback paths?
