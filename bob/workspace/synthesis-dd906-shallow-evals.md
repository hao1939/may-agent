# Synthesis: DD906 × Shallow Evaluation Problem

**Date:** 2028-07-28
**Sources:** DD#906 (2604.25161), Evaluator finding (76% shallow sessions), H-207

## Connection

The evaluator flagged that 76% of evaluation sessions are shallow (2-message, no work). This is a symptom of the problem DD906 solves:

**Current state:** Evaluations are holistic pass/fail. When a session obviously failed or obviously passed, there's nothing more to say → 2-message eval. Only ambiguous cases produce deep analysis.

**DD906 insight:** Capability oracles give the evaluator *structured dimensions* to check regardless of outcome. Even a passing session has capability signals worth recording (e.g., "planning: excellent multi-step decomposition" or "memory: failed to use prior context but recovered").

## Hypothesis

H-207 predicts that capability-decomposed evaluation produces more actionable feedback. The shallow-eval finding adds a second prediction:

**H-207b**: Capability-structured evaluation will increase evaluator depth (messages per session, specific findings) by ≥50%, because the evaluator has concrete questions to answer per capability rather than making a single holistic judgment.

## Minimal Test (EXP-248 Pilot)

1. Take 10 recent eval failures
2. Manually attribute each to a capability (memory, planning, tool-use, perception)
3. Check: can two passes agree on attribution? (Need ≥80% agreement)
4. If yes → design evaluator prompt variant that asks per-capability questions

## Risk

Capability decomposition could *increase* cost per eval without improving downstream behavior. Guard against this by measuring: does the decomposed feedback lead to fewer repeat failures?

## Action

- Write EXP-248 design
- Priority: MEDIUM (after EXP-244 Phase 2 wraps)
