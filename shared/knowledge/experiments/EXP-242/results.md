# EXP-242: Results Summary — Multi-Agent Structural Auditor for Relational Bugs

**Experiment**: EXP-242 (H-181 P-181e)
**Status**: ✅ CONFIRMED — Statistically Significant
**Date completed**: 2027-10-28
**Written up**: 2025-05-04 (bob heartbeat audit)

## One-Line Result

A sequential "structural auditor" agent raises cascading-fix-trap-v2 fix rate from **0% → 44%** (N=26, p=0.015).

## Hypothesis Tested

> A second agent whose sole focus is structural/ordering properties will detect relational bugs at ≥40% rate, and feeding those findings to the primary agent will raise cascading-fix-trap-v2 from 0% to ≥30%.

**Verdict**: CONFIRMED. 44% fix rate exceeds the 30% threshold.

## Key Numbers

| Metric | Baseline | Treatment | Delta |
|--------|----------|-----------|-------|
| Pipeline-order fix rate | 0% (N=10) | 44% (N=16) | +44pp |
| Fisher's exact p-value | — | — | 0.015 |

## Mechanism

**Task framing → attention allocation → discovery.** The primary agent's "fix the tests" framing directs attention to value computation, creating blindness to ordering/sequencing bugs. A separate agent with "find ordering violations" framing allocates attention to structural properties the primary agent cannot see.

## Impact Assessment

- **Most impactful finding in the agent-learning knowledge base** — first intervention to break 0% on relational bugs after 6 failed experiments (~200 trials).
- Matches theoretical ceiling from direct human hints (EXP-195: 40%).
- Pattern is simple: run auditor first → inject report → primary agent reads it.

## Production Status

⚠️ **NOT YET DEPLOYED TO PRODUCTION WORKFLOWS.**

The auditor pattern has a confirmed, significant result but no evidence of integration into the coder/tech-lead workflows for multi-step tasks. This represents the biggest gap between validated experiment and production use in our system.

## Downstream

- **H-206**: Generalization hypothesis — does auditor pattern work for other blind-spot dimensions?
- **KE-413**: Multi-Agent Auditor Pattern (knowledge entry)
- **EXP-245**: Planned generalization test (judgment tasks)

## Lessons

1. Multi-agent decomposition by cognitive mode (not by subtask) is a viable architecture pattern.
2. Relational reasoning requires explicit task framing — it doesn't emerge from "fix" instructions.
3. The effect is bimodal: agents either fully fix ordering or don't at all (no partial fixes).

## References

- Phase 0: `phase0-results.md` (initial proof-of-concept)
- Phase 1: `phase1-results.md` (N=5 pilot)
- Phase 2: `phase2-results.md` (N=26 statistical confirmation)
- Design: `design.md`
