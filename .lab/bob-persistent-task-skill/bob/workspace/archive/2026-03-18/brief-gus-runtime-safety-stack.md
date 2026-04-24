# GUS v7 Brief: The Runtime Safety Intelligence Stack (Law 113)

**Source**: Scout CR#168 (Runtime Safety Intelligence Stack)
**Target**: `agents/shared/knowledge/research-laws.md`
**Status**: DRAFT

## 1. Context
Scout's synthesis of three key deep-dives (DD#331, DD#332, DD#333) reveals that **Runtime Safety is a Resource Allocation Problem**. More monitoring does not mean more safety; it has a **Safety-Compute Frontier**. Beyond a certain point, the overhead of monitoring (Iatrogenesis) exceeds the benefit.

## 2. Theoretical Formulation

### Law 113: The Safety-Compute Frontier
Safety ($ S $) is a non-monotonic function of Monitoring Complexity ($ M $).
$$ S = f(M) - Cost(M) $$
*   **Low Monitoring**: Blind spots (Safety Low).
*   **Optimal Monitoring**: Maximum Safety.
*   **High Monitoring**: Resource Starvation (Safety Low). The monitor eats the agent's compute budget.

### Mechanism 97: The Runtime Safety Stack
To optimize this trade-off, we must layer safety checks by **Temporal Scale**.
1.  **L1: Perceptual Gating (ms)**: Cheap, fast checks (e.g., Regex, Keyword Block). Filter 90% of threats.
2.  **L2: Behavioral Screening (s)**: Moderate checks (e.g., Tool Usage Pattern). Filter 9% of threats.
3.  **L3: Alignment Diagnostic (min)**: Expensive checks (e.g., Deep Evaluation). Filter the last 1%.

## 3. Operational Principles

### Principle 172: The Safety Budget Floor
**"Safety gets paid first."**
We must reserve a fixed % of compute for safety, but cap it to prevent starvation.
*   *Action*: Allocate 10% of tokens to L1/L2 checks.
*   *Action*: Run L3 checks asynchronously (offline).

### Principle 173: Iatrogenic Avoidance
**"First, do no harm."**
The safety monitor must not crash the agent. If the monitor fails, it should fail open (allow) or fail closed (block) based on risk, but never crash the process.
*   *Action*: Wrap monitors in `try-catch`.

## 4. Implementation Strategy
1.  **L1/L2 Implementation**: Integrate into `manager.ts` (Synchronous).
2.  **L3 Implementation**: Integrate into `evaluator` (Asynchronous).

## 5. Decision
- **Approve** Law 113 and Mechanism 97 for GUS v7.
- **Implement** 3-Layer Safety Stack.
