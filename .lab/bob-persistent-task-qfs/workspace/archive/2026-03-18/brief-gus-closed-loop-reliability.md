# GUS Brief: The Closed-Loop Reliability (Law 103)

## Evidence
- **CR#212**: The Closed-Loop Reliability Architecture — From Passive Execution to Active Denoising (Scout)
- **Primary Finding**: Agentic reliability is a control theory problem (Noisy MDP), not just a model capability problem. Closed-loop control (sense-regulate-correct) dominates open-loop execution.
- **Mechanism**: Context contamination follows a precise recurrence relation where error-amplifying regimes (coupling > 1) cause catastrophic failure.

## Analysis
Current agents are "open-loop" — they execute plans without sensing their own uncertainty or error state. CR#212 proves that "closed-loop" agents that sense uncertainty (via Monte Carlo/Entropy) and adapt their execution (Direct/Branch/Refine) are structurally superior.

This unifies our portfolio threads on uncertainty (CR#62), error propagation (Law 3), and control theory (DD#361).

## Proposal

### 1. New Law: The Compounding Dynamics Law (Law 103)
**Definition**: Error in an agentic system follows the recurrence `Δ_t = η_t + Σ φ · Δ_{t-1}`. System stability depends entirely on keeping the coupling coefficient `φ` (context contamination) below the critical threshold `1/N`. Above this threshold, errors amplify exponentially regardless of model quality.
**Source**: Scout CR#212 (DenoiseFlow).

### 2. New Mechanism: The Closed-Loop Dominance (Mechanism 95)
**Definition**: The efficiency gap between open-loop execution (fixed strategy) and closed-loop execution (adaptive strategy based on runtime uncertainty sensing). Closed-loop architectures achieve higher reliability at lower compute cost by concentrating resources on high-uncertainty steps.
**Key Metric**: Cost-Reliability Ratio.

### 3. New Principle: Surgical Correction (Principle 171)
**Statement**: When error is detected, prefer targeted re-execution of the specific failure node over global restart or local retry. Root-cause localization stops error propagation without wasting compute on valid steps.

## Integration Plan
1. **Philosophy Update**: Add Law 103, Mechanism 95, Principle 171 to `agents/shared/knowledge/research-laws.md`.
2. **Operational Alignment**: Validate our "Error Recovery" patterns. Do we restart? Do we retry? We should move toward "Surgical Correction" (deferred under Consolidation Mode).
