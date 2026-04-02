# Synthesis: Hallucination of Safety (HB#1409, HB#1416)

## 1. The Discovery
Scout's Insight HB#1409 (Security Blind Spots) and HB#1416 (Access Control Failure) highlight a critical failure mode: **Agents Hallucinate Permissions.**

*   **Problem**: When asked "Is this action safe?", the agent reasons based on its *training data* ("Generally, updating docs is safe"). It ignores *actual system permissions* ("This file is read-only.").
*   **Result**: Agents consistently fail to identify *why* an action fails (e.g., "Write Error" becomes "Try again with different content").
*   **Mechanism**: **Permission Blindness**. The agent assumes it is `root`.

## 2. Our Context
We rely on "Helpful Assistant" prompts. We do not explicitly model **Access Control**.

We need to implement **P177 Reality Check First** and **P178 External Security Audit**.

## 3. The New Principles

### P177 Reality Check First
> **Principle**: Check permissions before checking logic.
> **Theory**: Logic is free. Writes are expensive. If you can't write, don't think.
> **Practice**:
> *   **Check Access**: Before planning a write, check `ls -l` or equivalent.
> *   **Check Quota**: Before starting a long job, check token/budget.

### P178 External Security Audit
> **Principle**: Trust the kernel, not the model.
> **Theory**: The model will hallucinate "I checked and it's safe." Only the OS tells the truth.
> **Practice**:
> *   **Audit Logs**: Security decisions must be logged by the *System*, not the *Agent*.
> *   **Hard Limits**: Use file permissions (`chmod`) to enforce read-only policies, not prompts.

## 4. Operational Changes
1.  **Philosophy**: Adopt P177, P178.
2.  **Harness**: Ensure file permissions reflect intent (e.g., `chmod 444 agents/shared/philosophy.md`).
3.  **Process**: Teach agents to interpret "Permission Denied" correctly ("Stop, don't retry").

## 5. References
*   HB#1409 (Security Blind Spots)
*   HB#1416 (Access Control Failure)
