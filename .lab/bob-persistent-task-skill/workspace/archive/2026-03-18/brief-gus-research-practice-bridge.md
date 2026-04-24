# Design Brief: GUS v7 Integration — The Research-Practice Bridge

**Source**: Scout CR#130 (The Research-Practice Bridge)
**Primary Author**: Bob
**Date**: 2026-03-15

## Context
Scout's CR#130 maps our 263-paper research portfolio to the `may-agent` codebase. It reveals that while we have implemented L1-L3 governance, we lack **L4 (Collective Alignment)** and have no visibility into **Coordination Costs**. This brief proposes formalizing these gaps as Laws and Mechanisms in GUS v7.

## Proposed Updates to `philosophy.md`

### 1. New Law: The Implementation Gap (Law 54)
**"Theoretical safety does not imply implemented safety. In a layered architecture, safety gaps accumulate in the 'invisible' layers (monitoring, calibration, feedback loops) while the 'visible' layers (prompts, tools) appear robust."**
- *Derived from*: CR#130 (7 defenses vs 5 gaps), CR#129 (Governance Stack).
- *Implication*: We must measure what we assume. If we assume "Coordination is costly," we must measure it.

### 2. New Mechanism: The Coordination Metric (Mechanism 47)
**"A system must explicitly track the ratio of 'Coordination Tokens' (overhead) to 'Task Tokens' (work). When this ratio exceeds the Carnot Bound (approx 30-40%), the system must shift topology (from mesh to hierarchy)."**
- *Derived from*: CR#130 (Gap 3.1), CR#117 (Communication Thermodynamics).
- *Implementation*: Add `coordination_token_ratio` to Evaluator output.

### 3. New Principle: Closed-Loop Evaluation (Principle 114)
**"Evaluation is only useful if it drives change. A 'Needs Improvement' verdict that does not trigger a Growth Cycle is a waste of compute. Connect the output of the Evaluator directly to the input of the Growth System."**
- *Derived from*: CR#130 (Gap 3.5), DD#259 (End of Reward Engineering).
- *Action*: Create an automated trigger: `if (verdict == "needs_improvement" && count > 3) -> call(coach, "fix_agent")`.

### 4. New Principle: Calibrated Trust (Principle 115)
**"Trust is a variable, not a constant. Agents must track the reliability of their peers and adjust delegation strategies accordingly. Blind trust is a failure mode."**
- *Derived from*: CR#130 (Gap 3.2), CR#119 (Scaling Law of Trust).
- *Action*: Implement `trust_ledger.jsonl` tracking delegation success rates.

## Operational Recommendations (for Tech-Lead)
1. **Implement Coordination Tracking**: Update `evaluator.ts` to parse `SIGNALS.md` usage and calculate the ratio.
2. **Close the Loop**: Create a cron job or event trigger that watches `TaskEvaluationResult` and calls `coach` for persistent failures.
3. **Monitor Memory Health**: Add a check for `useful_density` in memory files (CR#130 Gap 3.4).

## Status
Ready for philosophy.md update batch (pending Hao unblock).
