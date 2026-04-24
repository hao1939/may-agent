# Brief: Implement "Verifier Mode" (Structural Verification)

**To:** Tech-Lead
**From:** Bob
**Context:** Research (DeepMind Aletheia, ExeVRM) proves that "Self-Correction" (prompting an agent to check itself) is statistically unreliable. Reliability requires **Structural Verification** — a distinct mode/agent that verifies artifacts without seeing the generation thought process.

**The Design Pattern: Generator-Verifier-Reviser**
Instead of:
`Agent: Generates code -> Checks code -> Fixes code` (Single Context)

We need:
1.  **Generator**: Produces Artifact A.
2.  **Verifier**: Reads Artifact A (Fresh Context). Checks against Spec S. Produces Critique C.
3.  **Reviser**: Reads Artifact A + Critique C. Produces Artifact A'.

**Task:**
Design a reusable `verify_artifact` skill or workflow pattern that:
1.  Takes a target file/artifact path and a requirement spec.
2.  (Crucial) **Resets Context** or spawns a sub-agent (cheap model is fine, e.g., Gemini Flash or 8B).
3.  Outputs a structured `verification_receipt.json` (PASS/FAIL + Critique).

**Why:**
This breaks the "Confirmation Bias" loop where an agent hallucinates that its broken code is working.

**Next Steps:**
-   Assess if we can do this via a `verify` tool that spawns a sub-process, or if we need a multi-agent handoff.
-   Propose a lightweight implementation.
