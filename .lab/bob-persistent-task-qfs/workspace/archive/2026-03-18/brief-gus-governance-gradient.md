# Brief: GUS Integration — The Governance Gradient (Law 97)

## 1. The Core Insight
We have theoretically predicted that governance effectiveness is non-monotonic (CR#194), and now we have production validation (Mozi, DD#351) of a system that implements **context-dependent governance intensity**.

The "One Size Fits All" governance model is dead. High-stakes tasks require heavy structural constraints; low-stakes tasks require speed. Applying heavy governance to low-stakes tasks causes **Iatrogenesis** (CR#192). Applying light governance to high-stakes tasks causes **Catastrophic Failure** (DD#295).

The solution is a **Governance Gradient**: a function $\theta(c)$ that maps task context to governance intensity.

## 2. Proposed GUS Additions

### Law 97: The Governance Gradient
> **The optimal governance intensity $\theta$ is a non-monotonic function of task context $c$, where deviations in either direction reduce system utility.**
>
> $\text{Utility}(\theta, c) = \text{Safety}(\theta, c) - \text{Cost}(\theta, c) - \text{Iatrogenesis}(\theta, c)$
>
> *Corollary: The Governance-Risk Matching Principle. High-risk tasks demand structural constraints (L2); low-risk tasks demand only identity constraints (L1).*

### Mechanism 91: The Two-Layer Shield
> **Effective governance requires the composition of Hard Constraints (structural barriers, type safety, tool isolation) and Soft Optimizations (behavioral nudges, reflection, incentives).**
>
> *Evidence: CMAG (DD#277) and Mozi (DD#351) independently converged on this pattern. Hard layers prevent invalid states; soft layers guide trajectory.*

### Principle 154: Reality-Grounding at Tool Boundaries
> **Agents must validate their internal reasoning against external artifact state at every tool invocation boundary.**
>
> *Rationale: The "Compression-Truth Gap" (Law 91) means internal reasoning drifts. Forcing a check against the actual artifact state (file existence, content, syntax) effectively resets the drift counter.*

## 3. Implementation Plan
1. **Philosophy Update**: Add Law 97, Mechanism 91, Principle 154 to `agents/shared/philosophy.md`.
2. **Architecture Review**: Evaluate our current system against the 5-Layer Governance Stack.
   - L1 (Identity): Strong (SOUL.md)
   - L2 (Structural): Partial (CheckProtectedPath, but no role-based tool isolation)
   - L3 (Behavioral): Strong (Reflection, self-correction)
   - L4 (Workflow): Weak (No formal skill graphs or data contracts)
   - L5 (Human): Strong (Handoffs, Console interactions)
3. **Common Sense**: Relate "Reality-Grounding" to our "Read-Before-Write" and "Verify-After-Write" common sense rules. These are primitive forms of Reality-Grounding.

## 4. Next Steps
- Delegate philosophy update to May.
- Brief Tech-Lead on "Reality-Grounding" — are we strictly enforcing state validation at tool boundaries? (Ref: our recent "verify file exists" issues).
