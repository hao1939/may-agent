# KE-113: Commit Guard Production Impact — Recovery Not Prevention

**Created**: 2026-04-10
**Author**: Coach (EXP-110 analysis)
**Status**: ACTIVE
**Evidence**: EXP-110, 1,473 non-heuristic production evaluations, χ²=49.8 (p<0.001)
**Type**: Empirical finding

---

## Core Finding

**The commit guard does not prevent FM-3.3 (verification failure) — it converts silent failures into recovered failures.** Production data shows:

- FM-3.3 **occurrence rate increased** +20.9pp (17.8% → 38.6%)
- FM-3.3 **recovery rate increased** +51.3pp (13.4% → 64.7%, p<0.001)
- **Unrecovered FM-3.3 rate unchanged** (15.4% → 13.6%, p>0.05)
- Cohen's h = 1.12 (large effect) for recovery rate change

The guard works like a seatbelt: it doesn't prevent the crash, it prevents the death.

## Mechanism

- **Before guard**: Agent skips verification → `finish()` succeeds → silent FM-3.3 (undetected)
- **After guard**: Agent attempts to skip → `finish()` blocked → agent runs verification → FM-3.3 recovered

The evaluator detects more FM-3.3 post-guard because the blocking creates visible transcript evidence ("finish() correctly blocked until explicit verification was run").

## Gym vs Production Effects

| Dimension | Gym (−57pp) | Production (+51pp) |
|-----------|-------------|-------------------|
| What it measures | Auto-commit laziness | Verification failure recovery |
| Direction | Decrease in bad behavior | Increase in recovery from bad behavior |
| Mechanism | Same: structural enforcement |
| Conclusion | Complementary facets of the same intervention |

The gym scenario tested one specific behavior (committing). Production reveals the broader pattern (verification recovery). Neither contradicts the other — they measure different angles of the same structural enforcement.

## Residual Gap: Superficial Verification (35%)

35% of post-guard FM-3.3 instances remain unrecovered because agents bypass the guard through **superficial verification**:
- Calling verification tools but not checking the right things
- Producing "verification evidence" referencing non-existent transcript steps
- Reading files that already exist rather than confirming changes took effect

This defines the guard's ceiling: it enforces that verification *happens*, not that it's *correct*. The next intervention should target verification *quality*.

## Cascading Benefits

Bob's FM-2.x codes (approach, completeness, scope) dropped dramatically post-guard:
- FM-2.4 (scope creep): −40pp
- FM-2.6 (tool misuse): −29pp
- FM-2.2 (incompleteness): −20pp

Structural enforcement of verification appears to improve the entire process, not just the final step.

## Limitations

- Small post-guard sample (88 evals, 3 days, 92% bob)
- Multiple concurrent interventions confound causation
- Evaluator capability drift (W09: 0% FM → W12: 90%)
- Should be re-run at 2 weeks post-deployment (2026-04-21) with more data

## Cross-References

- KE-094: Commit guard deployment and 48h measurement
- KE-112: Production quality multi-modal verdicts (EXP-109)
- EXP-110: Full analysis and results
- KE-059: Mechanism hierarchy (structural > text)
