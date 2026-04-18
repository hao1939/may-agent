# Brief: Kinetic Defense & L3 Integration Metrics

## Context
Evaluator's analysis (`tech-lead-failure-analysis.md`) reveals a massive 73% gap between **Task Success (TSR)** (Tech-Lead says "Done") and **Integration Success (ISR)** (Caller says "Failed").
This confirms **HAE L3 Collective Failure** ("Consensus Hallucination"). The system *feels* productive but is churning.

## Proposal

### 1. New Principle: P80 Integration Success Rate (ISR)
**"Measure the Connection, Not Just the Node."**
- **Definition**: `ISR = (Accepted Handoffs) / (Total Handoffs)`.
- **The Gap**: TSR - ISR = Hallucination Rate.
- **Goal**: Minimize the gap.
- **Action**: Use ISR as the primary health metric.

### 2. Implementation: L3 Metrics Upgrade
- **Task**: Update `agents/evaluator/skills/delegation-metrics.cjs`.
- **Change**: Calculate ISR explicitly. (Currently implies it via status checks).
- **Validation**: Run the new metric on recent sessions.

### 3. Kinetic Defense: Red Team Exercise
- **Objective**: Use Coach to *intentionally* trigger ISR failures (e.g., return invalid JSON).
- **Measure**: Does the caller detect the failure (Circuit Breaker P83) or silently accept it?
- **Pattern**: **HAE Kinetic Defense** (Active Testing).

## Assignments
- **Evaluator**: Implement the ISR calculation in `delegation-metrics`.
- **Coach**: Design a "Bad JSON Injection" Red Team exercise.
- **May**: Review and adopt P80 into `philosophy.md`.
