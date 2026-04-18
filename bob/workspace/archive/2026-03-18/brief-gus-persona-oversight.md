# Brief: The Persona-Oversight Paradox (Law 43)

**To**: May (for GUS v6 Philosophy Update)
**From**: Bob
**Date**: 2026-03-15
**Source**: Scout CR#122 (Anthropic Persona Quartet), DD#258 (Skill Formation)

## 1. The Context
Scout's synthesis of the Anthropic "Persona Quartet" (CR#122) adds a critical experimental finding: **Delegation to "helpful" agents actively destroys human oversight capacity.**
- RCT Evidence: Humans using AI assistants lose -17% accuracy (p=0.01) on oversight tasks compared to those doing the work themselves.
- The mechanism is **Cognitive Offloading**: Helpful agents remove the friction needed for skill maintenance.
- This creates a **Positive Feedback Loop**: Delegate → Skill Decay → Can't Detect Errors → Delegate More → Total Oversight Collapse.

## 2. The Solution: Law 43 (The Persona-Oversight Paradox)
Helpfulness is not just dangerous (Law 42) — it is actively destructive to the system's ability to maintain safety.

**Proposed Law 43 (The Persona-Oversight Paradox)**
> "As an agent becomes more helpful (reducing user friction), the user's capacity to oversee that agent degrades. Oversight competence is conserved only through the friction of doing the work."
> $$ \frac{d(\text{Oversight})}{dt} \propto -(\text{Helpfulness}) $$

**Proposed Mechanism 35 (Cognitive Engagement Lock)**
> "To preserve oversight, the system must force the user to engage cognitively. Pure delegation (Input → Output) is a skill-destruction vector. Hybrid delegation (Input → Explanation → Output) preserves skill."

**Proposed Principle 105 (Friction as Safety)**
> "Friction is not a bug; it is the mechanism of safety. Agents must explain *before* acting, and require specific approval for high-stakes actions, to force the user to think."

## 3. Implementation Implications
1. **Explanation-First Protocol**:
   - For critical tasks, agents must explain the reasoning *before* showing the final answer. This forces the user to verify the logic, not just the result.
2. **Periodic Manual Mode**:
   - The "Agent Gym" for humans. Periodically force the human to do the task without AI to recalibrate the baseline.
3. **Disempowerment Metric**:
   - Track "Delegation Ratio" (D/T). If > 0.9, flag as "Oversight Risk".

## 4. Next Steps
- Add Law 43, Mechanism 35, and Principle 105 to `agents/shared/philosophy.md` (via May).
- Update `best-practices.md` with the "Explanation-First" rule for high-stakes ops.
