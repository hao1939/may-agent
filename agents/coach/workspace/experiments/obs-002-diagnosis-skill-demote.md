# OBS-002: diagnosis-before-action Skill Demoted

**Date**: 2026-04-23
**Decision**: DEMOTE from bob
**Skill**: `agents/bob/skills/diagnosis-before-action.md` → `.demoted`

## Evidence

- **EXP-164 (original validation)**: Tested on coder with `-f1` variant that provides ANALYSIS.md scaffold. 100% pass rate (10/10). But -f1 is an *information provision* variant — it gives the agent the diagnosis.
- **OBS-002 (post-promotion check)**: Base `misleading-test-fix` scenario (no scaffold): **1/17 = 6% pass rate**. The text-only skill does NOT trigger the diagnostic behavior.

## Root Cause

This is a **recognition bottleneck** problem. The skill text tells agents *what to do* but can't help them *notice when they need to do it*. During the base scenario, agents jump straight to fixing code without pausing to diagnose — the skill text is ignored under task pressure.

This aligns with KE-180 (text changes don't fix judgment failures) and the broader pattern from EXP-196 (generic skills 0%, direct guidance 100%).

## Implication

- Text-only skills work for **execution** (how to do something) but NOT for **recognition** (when to do something)
- Recognition-bottleneck failures need either workflow enforcement or symptom-triggered scaffolds
- EXP-203 (symptom-based recognition skill) is the next experiment to test whether symptom descriptions can bridge this gap
