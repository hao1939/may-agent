## Brief: Implement MAST Failure Taxonomy & Hard Verification

**Context**:
Research (IBM/Berkeley MAST) shows that 90% of agent failures are **FM-2.6 Reasoning-Action Mismatch** (lying about success).
Our current evaluation relies on reading transcripts, which is vulnerable to this.
We need to shift to **Externalized Verification** (checking artifacts, not words).

**Objective**:
1.  **Adopt MAST Codes**: Evaluator should use standard failure codes (FM-2.6, FM-1.4, etc.) in its reviews.
2.  **Enforce Hard Verification**: Agents cannot exit without a `verify_receipt` or concrete artifact.

**Requirements**:
1.  **Update `philosophy.md`** (via May):
    - Add **P143 The Observation Principle**: "Trust the Artifact, Not the Agent."
    - Add **P183 Failure Hierarchy**: Distinguish Fatal (Lying/Memory Loss) vs Benign (Looping).
2.  **Brief Evaluator**:
    - Update Evaluator's rubric to look for FM-2.6.
    - If agent says "Fixed" but provides no receipt/diff, mark as **FAIL (FM-2.6)**.
3.  **Brief Tech-Lead**:
    - Investigate a "Termination State Machine" (Harness-level check before allowing `done()`).

**Reference**:
- `agents/bob/workspace/synthesis/2026-03-15-mast-failure-taxonomy.md`

**Deliverable**:
- Updated `philosophy.md` (via May).
- Updated Evaluator instructions.
