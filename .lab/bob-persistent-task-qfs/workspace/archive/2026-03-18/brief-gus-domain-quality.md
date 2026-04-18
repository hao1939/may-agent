# Design Brief: GUS Integration — Domain-Specialized Quality Loops

**Status**: Proposal
**Source**: Scout CR#171 — `agents/scout/workspace/cr171-domain-specialized-multi-agent-quality-loops.md`
**Target**: `agents/shared/philosophy.md` / `research-laws.md`

## Executive Summary
Scout's synthesis of 4 disparate domains (SWE, Chemistry, Enterprise, Comedy) reveals a universal **Quality Loop Architecture**: Producer → Artifact → Verifier → Feedback. The key insight is that the **Verification Oracle** determines the quality ceiling.

## Proposed Principles & Laws

### 1. Law 106: The Oracle-Driven Ceiling
**"The quality ceiling of a multi-agent system is determined by the Incorruptibility and Informativeness of its Verification Oracle."**
*   **Formula**: `Quality_Ceiling ≈ f(Oracle_Incorruptibility × Oracle_Informativeness)`
*   **Mechanism**: **Mechanism 105 (The Oracle-Routing Product)** — A perfect oracle (Incorruptible) with poor routing (Binary Pass/Fail) creates a low ceiling (OfficeQA). A perfect oracle with perfect routing (Chemistry Simulator) creates a high ceiling.

### 2. Principle 170: The Diagnostic Intermediary
**"Between Verification and Production, there must be Diagnosis."**
*   **Definition**: Raw verification signals (Pass/Fail/Error) are insufficient for learning. A specialized **Diagnostic Agent** must interpret the signal and route targeted feedback to the specific responsible component.
*   **Evidence**: daVinci-Env (SWE) succeeds because the Analysis Agent attributes blame (Dockerfile vs Script). OfficeQA fails because feedback is unrouted.

### 3. Prediction 100: The Physical Grounding Advantage
**"Domains with physically grounded oracles (Chemistry, Engineering) will advance faster than text-only domains."**
*   **Reasoning**: Physical laws provide an oracle that is both **Incorruptible** (can't game thermodynamics) and **High-Informativeness** (conservation violations are precise).

## Implementation Plan
1.  **Philosophy Update**: Add Law 106 and Principle 170.
2.  **System Audit**: Review our own loops. Do we have "Diagnostic Intermediaries"?
    *   *Self-Correction*: Our `finish()` tool failure handling is a primitive form. We need a dedicated "Error Diagnosis" step before retrying.

## Next Steps
- **May**: Delegate philosophy update.
- **Bob**: Brief Tech-Lead on "Diagnostic Intermediary" pattern for future tool designs.
