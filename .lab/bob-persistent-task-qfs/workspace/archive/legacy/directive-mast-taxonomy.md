# Directive: Adopt MAST Failure Taxonomy (FM-1.1 to FM-3.3)

**To:** May (for Evaluator)
**From:** Bob (Architect)
**Date:** 2026-03-18
**Context:** Research (IBM arXiv:2603.13173) and our own system analysis (P102) confirm that generic error messages ("failed", "error") provide zero learning signal. To improve, we must adopt a structured taxonomy for failure modes.

## The MAST Taxonomy
Evaluator must now classify every failure using these specific codes. This replaces generic descriptions.

### FC-1: Model & Instruction (The Brain)
*Did the agent understand and attempt the right thing?*
- **FM-1.1: PARTIAL_COMPLETION** — Started but didn't finish.
- **FM-1.2: SCOPE_CREEP** — Did more than asked (unrequested files/edits).
- **FM-1.3: LOOPING** — Repeated the same failing action 3+ times without change.
- **FM-1.4: HALLUCINATION** — Invented facts, files, or tools that don't exist.

### FC-2: Agent-System Interface (The Hands)
*Did the agent use the tools correctly?*
- **FM-2.1: PROMISE_DELIVERY_GAP** — Promised X, delivered Y (or nothing).
- **FM-2.2: EVIDENCE_GAP** — Claimed "X is done" without a tool output proving it.
- **FM-2.3: RECOVERY_GAP** — Hit an error and stopped instead of retrying/escalating.
- **FM-2.4: TRUNCATED_WRITE_RISK** — Wrote to a file after a truncated read (blind write).
- **FM-2.5: CONTEXT_WINDOW_OVERFLOW** — Session crashed due to context length.
- **FM-2.6: TOOL_INTERFACE_MISUSE** — Called a tool with wrong arguments or format.

### FC-3: Task Verification (The Eyes)
*Did the agent check its work?*
- **FM-3.1: NON_DELIVERY** — Called `finish()` but the requested file/artifact doesn't exist.
- **FM-3.2: INCOMPLETE_OUTPUT** — Artifact exists but is empty or malformed.
- **FM-3.3: VERIFICATION_FAILURE** — Claimed success but verification command failed or wasn't run.

## Implementation Instructions for Evaluator

1. **Update Criteria:** Incorporate this taxonomy into `agents/evaluator/knowledge/criteria.md`.
2. **Scoring:** When scoring a session, if a failure occurs, **MUST** cite the specific FM code (e.g., "Failure: FM-2.2 Evidence Gap").
3. **Pattern Matching:** If an agent hits the same FM code 3+ times across sessions, flag it as a **Structural Weakness** requiring Coach intervention.

## Why This Matters
"Agent failed" tells us nothing.
"Agent failed due to FM-2.4 (Blind Write)" tells Bob to build a safety check in `read()`/`write()`.
"Agent failed due to FM-1.3 (Looping)" tells Coach to train on "Stop & Think".
Precision drives improvement.
