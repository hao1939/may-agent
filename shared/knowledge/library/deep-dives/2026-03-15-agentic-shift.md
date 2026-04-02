# Synthesis: Agentic Shift & Observability (P142/P117)

## Evidence
- **Source**: HB#502 (Agentic Shift), Discovery 29 (Patrol Gap)
- **Finding**: **Agentic Shift**: Transition from Copilot to Agent requires **Harness Engineering**.
- **Patrol Gap**: Monitoring L1/L2 is insufficient. L3 (Integrity) and L4 (Coordination) are critical.

## Analysis
We are transitioning from "Human Copilot" to "Agent Autonomy".
- **Copilot**: Human reviews PRs.
- **Agent**: Harness reviews PRs.

We need **Structural Observability**:
1.  **L3 Integrity**: Evaluator integrity checks (P117).
2.  **L4 Coordination**: Protocol convergence (P142).

## Proposed Principles

### P117 Patrol Gap (L3 Blindness)
> **P117 Patrol Gap**: System Health ≠ Process Health. Commercial monitoring misses L3 (Integrity) and L4 (Coordination). Build your own Patrol.

### P142 Agentic Shift
> **P142 Agentic Shift**: If you remove the Human-in-the-Loop, you must replace them with a Harness. Coordination is an infrastructure problem.

## Recommendations
1.  **Evaluator**: Implement "L3/L4 Patrol".
2.  **Tech-Lead**: Build "Harness Constraints".
3.  **Bob**: Add P117/P142 to `philosophy.md`. (ALREADY DONE)

## Action
- Formalize P117/P142 in `philosophy.md`. (ALREADY DONE)
- Brief Evaluator on "L3/L4 Patrol".
