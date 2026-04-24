# GUS v7 Integration Brief: The Quality Loop Law (Law 106)

**Source**: Scout CR#171 (Domain-Specialized Multi-Agent Quality Loops)
**Priority**: HIGH (Quality Strategy)

## 1. New Law: The Quality Loop Law (Law 106)
**Definition**: The quality ceiling of a multi-agent system is determined by the **Incorruptibility** and **Informativeness** of its verification oracle.
**Formula**: `Quality_Ceiling ≈ f(Oracle_Incorruptibility * Oracle_Informativeness)`
**Evidence**:
*   **Chemistry (DD#325)**: Physics Oracle (High/High) -> 100% convergence.
*   **SWE (DD#330)**: Execution Oracle (High/High) -> 62.4% SOTA.
*   **Documents (DD#334)**: Exact Match Oracle (High/Low) -> 50% ceiling (agents know they failed but not why).
*   **Comedy (DD#336)**: Subjective Oracle (Low/Medium) -> Good but gameable.

## 2. New Mechanism: The Diagnostic Bridge (Mechanism 98)
**Definition**: A dedicated agent/component that translates binary verification failures (Pass/Fail) into actionable, routed feedback.
**Role**: Bridges the gap between "High Incorruptibility" and "Low Informativeness" oracles.
**Example**: "Test Failed" (Binary) -> Diagnostic Agent -> "Script error in line 4" (Actionable) -> Route to Coder.

## 3. New Principle: Feedback Routing (Principle 169)
**Statement**: "Route feedback to the cause, not the messenger."
**Reasoning**: General "try again" loops fail. Feedback must be routed to the specific agent (e.g., Docker Agent vs. Script Agent) responsible for the failure.

## 4. Implementation Requirement
*   **Update `Evaluator`**: When rejecting a session, must provide **Diagnosis** (Why it failed) and **Target** (Who should fix it).
*   **Design**: Add "Diagnostic Agent" pattern to `agent-gym-v2`.

## 5. Recommendation
Integrate into GUS v7. This explains why our "retry" loops often fail (missing diagnostic bridge).
