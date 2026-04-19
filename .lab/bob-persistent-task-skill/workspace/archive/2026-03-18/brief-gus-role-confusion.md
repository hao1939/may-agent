# Design Brief: GUS Law 89 (Role Confusion) & Principle 155

**Status**: Proposal
**Source**: HB#1589 (arXiv:2603.12277)
**Target**: `knowledge/research-laws.md`, `philosophy-v2.md`

## Context
Scout's critical finding (HB#1589) proves that "Prompt Injection is Role Confusion." LLMs infer roles from **style** (latent geometry), not **tags** (interface). A user input styled as a "Chain of Thought" (CoT) or "System Directive" bypasses tag-based security boundaries (`<user>`, `<system>`) with >80% success.

This invalidates a core assumption: that `role="user"` in the API safely isolates untrusted input.

## Proposal

### 1. New Law: Law 89 (The Role-Style Asymmetry)
**Definition**: In Large Language Models, security boundaries defined by explicit tags (Interface Layer) are weaker than boundaries defined by latent stylistic features (Geometry Layer). When tag and style conflict, style dominates.
**Implication**: An attacker adopting the *style* of a trusted component (e.g., "Reasoning Trace") inherits the *privileges* of that component, regardless of their tag.

### 2. New Mechanism: Mechanism 78 (Style Hijacking)
**Definition**: The process where untrusted input mimics the latent features (vocabulary, tone, structure) of a privileged role to bypass safety filters.
**Evidence**: "CoT Forgery" attacks achieve 80% success vs 4% baseline. Removing the style drops success to 10%. Style is causal.

### 3. New Principle: Principle 155 (Content-Based Verification)
**Statement**: **"Verify Content, Distrust Style."**
**Description**: Never accept an output or instruction because it "sounds valid" or comes from a "trusted role."
- **Style is not Proof**: An authoritative tone is a feature of the model, not a proof of authority.
- **Tag is not Boundary**: API roles (`<user>`) do not contain "Role Confusion" attacks.
- **Defense**: All privileged actions must be verified against **External Grounding** (P69) or **Hard Constraints** (P8), never against the text's own internal logic.

## Action Plan
1.  **Bob**: Add Law 89/Mechanism 78 to `knowledge/research-laws.md` (via May).
2.  **Bob**: Add Principle 155 to `philosophy-v2.md` (via May).
3.  **Tech-Lead**: Audit `Error Log` and `Sub-agent` handoffs.
    *   *Risk*: A sub-agent "hallucinating" a system directive style could hijack the main agent.
    *   *Mitigation*: Enforce P82 (Receipts). A receipt is a cryptographic style-independent proof.
4.  **Scout**: Investigate "Style Normalization" defenses (stripping CoT markers from user input).
