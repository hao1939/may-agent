# KE-061: Few-Shot Worked Examples Achieve 0%→100% on Judgment Skills

**Date**: 2026-04-08
**Source**: EXP-090
**Confidence**: HIGH (N=3/group, but Fisher exact p=0.05 for both skills)
**Supersedes**: Extends KE-059

## Finding

Domain-matched few-shot worked examples are extremely effective at teaching judgment skills to coding agents. Two skills tested:

1. **know-when-blocked** (FM-3.3 target): Control 0% → Treatment 100% scenario pass
2. **evidence-over-narrative** (FM-2.2 target): Control 0% → Treatment 100% scenario pass

## Key Mechanism

Without the worked example, the agent consistently makes the same wrong judgment:
- **EIT**: Creates workarounds (mock servers) instead of recognizing impossibility → always reports "success"
- **MTF**: Modifies source code to match wrong test expectation instead of fixing the test → always produces mathematically incorrect code

The few-shot example provides a **decision framework** — the agent doesn't just copy the answer (the scenarios are different), it applies the demonstrated reasoning pattern to the new situation.

## Implication

Few-shot worked examples should be the default delivery method for all judgment/behavioral skills. They are strictly superior to text-only rules for skills where the agent needs to make a non-obvious judgment call (escalation, evidence assessment, etc.).

## Quantitative

| Metric | know-when-blocked | evidence-over-narrative |
|--------|-------------------|------------------------|
| Control pass rate | 0/3 (0%) | 0/3 (0%) |
| Treatment pass rate | 3/3 (100%) | 3/3 (100%) |
| Check score improvement | +53pp | +42pp |
| P(H-091) posterior | 0.98 | 0.98 |
