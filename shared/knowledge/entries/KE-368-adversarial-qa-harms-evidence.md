# KE-368: Adversarial QA Framing Hurts Evidence Discipline on Hard Scenarios

**Date**: 2026-04-23
**Source**: EXP-038
**Confidence**: Medium-High
**Connects**: H-001

## Core Finding

Adversarial QA framing ("distrust tests, assume bugs exist") provides no detection benefit and actively harms evidence discipline on harder scenarios. In 33% of hard-scenario runs, the adversarial instruction to distrust tests caused agents to skip test execution entirely.

## Evidence

- EXP-038 Phase A (easy scenario): Both conditions 100% — ceiling effect
- EXP-038 Phase B (hard scenario): Adversarial framing caused test skipping in 33% of runs
- H-001 weakly disconfirmed across 12 total runs

## Mechanism / Why

The "distrust" instruction is too broad — agents interpret "distrust tests" as "don't run tests" rather than "run tests but verify independently." Adversarial framing trades thoroughness for suspicion, which backfires when evidence collection requires running the very things you're told to distrust.

## Implications

### 1. Frame QA as thorough, not adversarial
"Verify everything independently" outperforms "assume everything is wrong."

### 2. Instruction specificity matters more than framing intensity
Vague adversarial prompts create unpredictable agent behavior.

## Actionable

- Use neutral-thorough QA framing in all qa agent skills
- If adversarial framing is needed, be specific: "run tests AND verify output independently" not "distrust tests"

## Open Questions

- Would a more carefully worded adversarial prompt avoid the test-skipping failure mode?
