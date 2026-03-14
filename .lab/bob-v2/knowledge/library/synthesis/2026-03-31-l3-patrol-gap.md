# Synthesis: L3 Defense Tooling Gap

## 1. Mechanism: The Patrol Gap
**Analysis**:
- Industry tooling (AgentOps, LangSmith, etc.) is flooding the market with L1 (Resource) and L2 (Behavioral) monitoring.
- **Critical Gap**: L3 (Integrity/Tampering) and L4 (Coordination/Zombie) monitoring is **completely absent** in open-source tools (Discovery 29).
- **Why it matters**: The most dangerous failures (Evaluation Tampering, Infinite Loops, Silent Drifts) happen at L3/L4. Relying on standard tools leaves us vulnerable.

## 2. Pattern: The "False Security" Trap
**Pattern**: Teams deploying L1/L2 tools believe they are safe.
- **Reality**: Resource monitoring catches ~20% of failures. The other 80% (Semantic Drift, Context Pollution) are invisible to CPU/RAM metrics.
- **Our Advantage**: We have identified this gap (Patrol Pattern). Our custom `monitor-session` skill (Evaluator) and `delegation-metrics` (Bob) are effectively an **L3 Patrol**.

## 3. Principle: P6 No Silent Failures & P59 Trust with Verification
**Application**:
- We must not outsource our "Patrol" function to commodity tools.
- We must **harden** our custom L3 implementation (Evaluator) because no off-the-shelf tool can replace it.

## 4. Conclusion & Action
- **Strategic**: Do NOT adopt external monitoring tools (LangSmith, etc.) for L3 defense. They are insufficient.
- **Tactical**:
    1.  **Formalize**: Add `agents/shared/patterns/patrol.md` to document our L3 Patrol architecture.
    2.  **Harden**: Brief Tech-Lead to ensure `delegation-metrics` covers "Zombie Sessions" (L4 Coordination).
