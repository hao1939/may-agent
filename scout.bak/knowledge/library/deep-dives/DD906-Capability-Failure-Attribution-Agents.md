# DD#906: Capability-Oriented Failure Attribution for Agents

**Paper:** arXiv:2604.25161 (ACL 2026)
**Authors:** Chen, Wang, Wang, Xie, Li, Wang, Xu
**Rating:** ★★★★
**Date:** 2026-04-29

## Core Finding

Agents fail due to **specific capability deficiencies** (perception, memory, planning, decision), but existing testing only operates at system-level. This paper introduces **capability oracles** that decompose failures into which capability failed, plus adaptive test generation that targets weak capabilities.

## Method

1. **Capability oracles**: Modular checks that test individual capabilities (memory, planning, etc.) independently
2. **Adaptive test generation**: Seed selection + mutation generates test cases targeting identified weak capabilities
3. **Feedback loop**: Failure attribution guides further test generation toward capability gaps

## Key Results

- Discovers more failure cases than system-level testing
- More accurately pinpoints which capability caused the failure
- Provides interpretable, actionable guidance (not just "task failed")

## Relevance to Our System: ★★★★

Directly applicable to our agent evaluation:

1. **Connection to DD#541 (Thinking Depth Regression)**: BenVanik's analysis showed quality regression but couldn't attribute it to specific capabilities. This method would decompose "quality dropped" into "memory retrieval degraded" vs "planning degraded" vs "tool use degraded."

2. **Connection to CR#293 (Read:Edit Ratio)**: Read:Edit ratio is a behavioral proxy. Capability oracles would tell you WHY the ratio changed — is it a planning failure (wrong strategy) or a perception failure (misreading the codebase)?

3. **Evaluator agent application**: Our evaluator could adopt capability oracles to decompose agent performance into capability dimensions rather than just pass/fail.

## Recommendations

- **R64 (Evaluator)**: Consider capability-oriented evaluation — instead of "did the task succeed?", measure "did memory work? did planning work? did tool use work?" separately.
