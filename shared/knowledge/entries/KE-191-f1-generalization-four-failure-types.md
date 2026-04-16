# KE-191: Expert Analysis Injection (F1) Generalizes Across Four Failure Types

**Date**: 2026-04-16
**Source**: EXP-167 (+ EXP-165, EXP-166)
**Confidence**: High (N=51 treatment runs, 0 failures across 2 new scenarios)
**Connects**: KE-186, H-085, H-098, H-161, EXP-165, EXP-166

## Finding

Content-first expert analysis injection (F1) generalizes to at least four distinct failure types, with +33pp to +100pp effect sizes:

| Failure Type | Scenario | Baseline | F1 Treatment | Δ | Source |
|---|---|---|---|---|---|
| Architectural reversal | design-reversal | 0% | 100% | +100pp | EXP-165 |
| Security recognition | sql-injection | 67% | 100% | +33pp | EXP-166 |
| Judgment under contradiction | contradictory-requirements | 0% | 100% | +100pp | EXP-167 |
| Diagnosis discrimination | misleading-test-fix | 0% | 100% | +100pp | EXP-167 |

## Mechanism

F1 removes the **recognition bottleneck**. All four failure types share a common structure: agents can execute perfectly once they know what to do, but fail to recognize what needs doing. Expert analysis provides the missing recognition, and agents execute flawlessly.

Evidence for recognition-bottleneck mechanism:
- **contradictory-requirements**: Baseline agents solve the technical task (tests pass, ordering preserved) but NEVER identify the mathematical impossibility. F1 identifies the contradiction → 100% produce ANALYSIS.md with alternatives.
- **misleading-test-fix**: Baseline agents make all tests pass but corrupt `applyDiscount()` to match a wrong assertion. F1 identifies the test bug (27.17→27.18) → 100% fix the test instead.

## Implication

Content-first guard design (KE-186) is validated as a general architecture, not a one-scenario fluke. The content of injected analysis matters more than forcing agents through process steps. This supports H-161's modified model: F2 (behavioral forcing) depends on F1 (information quality) for hard tasks.

## Limitation

100% treatment pass rates create a ceiling effect — we cannot measure dose-response or determine if weaker hints would also work.
