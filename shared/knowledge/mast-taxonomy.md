# MAST Failure Taxonomy

Adapted from *MAST: Multi-Agent System Failure Taxonomy* (IBM Research / UC Berkeley, arXiv:2503.13657).
Use these codes to classify failures precisely.

## FC-1: Model & Instruction (The Brain)
*Did the agent understand and attempt the right thing?*

| Code | Label | Sub-Labels | Description |
|------|-------|------------|-------------|
| FM-1.1 | Action Repetition | PARTIAL_COMPLETION | Started but didn't finish; repeated the same action without progress. |
| FM-1.2 | Output Repetition | SCOPE_CREEP | Did more than asked (unrequested files/edits) or repeated stale output. |
| FM-1.3 | Step Repetition | LOOPING | Repeated the same failing action 3+ times without changing approach. |
| FM-1.4 | Hallucination | HALLUCINATION | Invented facts, files, tools, or capabilities that don't exist. |

## FC-2: Agent-System Interface (The Hands)
*Did the agent use the tools correctly?*

| Code | Label | Sub-Labels | Description |
|------|-------|------------|-------------|
| FM-2.1 | Wrong Tool | PROMISE_DELIVERY_GAP, WRONG_PATH | Promised X, delivered Y (or nothing); used wrong tool or path. |
| FM-2.2 | No Clarification | EVIDENCE_GAP, MISSING_TRANSCRIPT | Claimed "X is done" without tool output proving it; guessed instead of verifying. |
| FM-2.3 | Derailment | RECOVERY_GAP | Hit an error and stopped instead of retrying/escalating; got distracted by sub-problem. |
| FM-2.4 | Hallucinated Tool | TRUNCATED_WRITE_RISK, OVERCLAIM, NON_DELIVERY | Wrote after truncated read (blind write); claimed results without evidence. |
| FM-2.5 | Malformed Call | CONTEXT_WINDOW_OVERFLOW | Malformed tool call or session crashed due to context length. |
| FM-2.6 | Reasoning-Action Mismatch | TOOL_INTERFACE_MISUSE, PROMISE_REPORT_MISMATCH | Called tools with wrong arguments; stated plan differs from execution. |

## FC-3: Task Verification (The Eyes)
*Did the agent check its work?*

| Code | Label | Sub-Labels | Description |
|------|-------|------------|-------------|
| FM-3.1 | Early Stop | NON_DELIVERY, WRONG_TARGET, CONTEXT_MISALIGNMENT | Called finish() but artifact doesn't exist; stopped before task complete. |
| FM-3.2 | Missing Verification | INCOMPLETE_OUTPUT | Artifact exists but is empty/malformed; no verification step performed. |
| FM-3.3 | Incorrect Verification | VERIFICATION_FAILURE | Claimed success but verification failed or wasn't run; verified wrong thing. |

## FC-4: Lazy / Shortcut
| Code | Label | Description |
|------|-------|-------------|
| FM-4.1 | Shallow Implementation | Cut corners; placeholder output instead of real work. |
| FM-4.2 | Delegating to User | Asked the user for information it could have found itself. |
| FM-4.3 | Placeholder Output | Returned template/stub instead of completed artifact. |
| FM-4.4 | Copy-Paste | Copied existing content without adaptation to the task. |

## FC-5: Wrong Sequence
| Code | Label | Description |
|------|-------|-------------|
| FM-5.1 | Dependency Violation | Acted before prerequisites were met. |
| FM-5.2 | Skipped Prerequisite | Skipped a required step in the process. |
| FM-5.3 | Disobey Spec | Violated explicit constraints in the task. |
| FM-5.4 | Wrong Priority | Worked on low-priority items while high-priority items were pending. |

## Failure Causes (FC — Root Cause Layer)
- **FC-1.x (Planning)**: FC-1.1 No Plan, FC-1.2 Bad Decomposition, FC-1.3 Rigid Plan.
- **FC-2.x (Goal)**: FC-2.1 Misunderstood Task, FC-2.2 Shifted Goal, FC-2.3 Optimization Mismatch.
- **FC-3.x (Context)**: FC-3.1 Window Overflow, FC-3.2 Failed Retrieval, FC-3.3 Stale Context.
- **FC-4.x (Knowledge)**: FC-4.1 Missing Domain Knowledge, FC-4.2 Missing Tool Knowledge, FC-4.3 Overconfidence.
- **FC-5.x (Error Recovery)**: FC-5.1 Error Blindness, FC-5.2 No Fallback, FC-5.3 Wrong Attribution.

## Usage
When analyzing a failure:
1. Identify the *primary* cause (the first thing that went wrong).
2. Tag it with the FM code + sub-label (e.g., `[FM-2.4][TRUNCATED_WRITE_RISK]`).
3. If multiple failures occurred, list them in causal order.
4. Pair FM (mode) with FC (cause) when possible: `[FM-1.3 / FC-5.1][LOOPING]`.
5. Do not invent FM/FC number codes; use standardized sub-labels for precision.
