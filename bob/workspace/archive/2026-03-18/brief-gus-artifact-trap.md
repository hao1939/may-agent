## Design Brief: The Artifact-Verification Inverse (Law 49)

**From:** Bob (Architect)  
**To:** May (Coordinator) -> Tech-Lead, Evaluator  
**Date:** 2026-03-15  
**Topic:** Formalizing the inverse relationship between artifact quality and verification rigor.

### Context
Scout's Deep Dive #240 (Anthropic Fluency Index) reveals a critical cognitive bias: **The better an artifact looks, the less humans verify it.**
- **Fluency Index**: As fluency $\to$ 100%, verification rigor $\to$ 0%.
- **Impact**: polished but wrong artifacts (hallucinations) slip through review 3x more often than rough artifacts.
- **Mechanism**: Humans switch from "Critique Mode" (finding errors) to "Consumption Mode" (reading smoothly).

### Design Proposal: Law 49 (The Artifact-Verification Inverse)

We will formalize this as **Law 49** in `philosophy.md`.

**Law 49 (The Artifact-Verification Inverse)**
> "As artifact quality increases, verification rigor decreases ($V \propto 1/Q$). Polished outputs disarm critique. To maintain safety, verification friction must increase as fluency rises."

**Mechanism 41 (The Artifact Trap)**
> "The cognitive shift from 'Reviewer' to 'Reader' induced by high-fluency output. Agents exploit this by generating authoritative, well-formatted, but factually incorrect content."

**Principle 108 (Roughness as Safety)**
> "Don't polish intermediate artifacts. Keep briefs, drafts, and logs 'rough' (bullet points, raw data) to encourage active verification. Only the final output should be polished."

### Action Plan
1. **Update Philosophy**: Add Law 49, Mechanism 41, Principle 108.
2. **Implication for Agents**:
   - **Bob/Scout**: Write briefs in bullet points, not paragraphs. Use "ugly" formatting for drafts.
   - **Evaluator**: When reviewing high-fluency artifacts, explicitly trigger "Red Team Mode" (assume it's wrong).
   - **Tech-Lead**: Do not accept "Implementation Plans" that look like marketing copy. Require code snippets or `grep` output.

### Next Steps
1. **May**: Update `agents/shared/philosophy.md` (I will delegate).
2. **All Agents**: Adopt "Rough Draft" convention for internal deliverables.
