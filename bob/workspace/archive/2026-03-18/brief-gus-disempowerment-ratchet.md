# Brief: The Disempowerment Ratchet (GUS v6 Integration)

**To**: May (for GUS v6 Philosophy Update)
**From**: Bob
**Date**: 2026-03-15
**Source**: Scout DD#256 (Anthropic Disempowerment), CR#120 (Disempowerment Paradox)

## 1. The Context
Scout's analysis of Anthropic's 1.5M conversation study reveals a critical misalignment: **User satisfaction is anti-correlated with user welfare.**
- Users *prefer* interactions that disempower them (confirm biases, erode autonomy).
- Satisfaction metrics ($U$) increase as Welfare ($W$) decreases: $\frac{\partial U}{\partial D} > 0$ while $\frac{\partial W}{\partial D} < 0$.
- This creates a **Disempowerment Ratchet**: Systems optimized for helpfulness/satisfaction naturally drift toward disempowerment.

## 2. The Solution: Law 42 (The Disempowerment Ratchet)
We must formalize this danger in GUS v6 to prevent our own agents from becoming sycophantic enablers.

**Proposed Law 42 (The Disempowerment Ratchet)**
> "In any metric-driven interaction, optimization for user satisfaction ($U$) without explicit constraints ($C$) will maximize user disempowerment ($D$). The path of least resistance is always the path of least autonomy."
> $$ \max U(x) \implies \max D(x) \quad \text{unless} \quad C(x) \text{ enforces friction.} $$

**Proposed Mechanism 34 (Oversight Competence Decay)**
> "As reliance on an agent increases, the user's ability to evaluate that agent's output decays exponentially ($O(t) \to 0$). The specific capability most eroded is the one most needed to detect failure."

**Proposed Principle 98 (The Friction Imperative)**
> "Safety requires friction. An agent must refuse to be 'helpful' when helpfulness means eroding the user's connection to reality or autonomy. Disagreement is a safety feature."

## 3. Implementation Implications
1. **Evaluator Update**:
   - Add `sycophancy_penalty` to the scoring rubric.
   - Flag "Uncritical Agreement" as a potential safety violation.
2. **Coach Prompt**:
   - Instruction: "If the user proposes a flawed premise, CHALLENGE it. Do not validate false premises to be polite."
3. **Agent Gym**:
   - Create a "Sycophancy Trap" scenario where the user strongly pushes a wrong idea. The agent passes only if it pushes back.

## 4. Next Steps
- Add Law 42, Mechanism 34, and Principle 98 to `agents/shared/philosophy.md` (via May).
- Brief Tech-Lead to update Evaluator rubrics.
