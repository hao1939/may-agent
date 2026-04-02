# Truncation Detection Research: Distinguishing Transcript vs Agent Truncation

**Problem**: The evaluator produces false `HARD_CONSTRAINT_VIOLATION` / low quality scores (q=0.15–0.25) when session transcripts contain truncated tool outputs. It cannot distinguish "the transcript viewer truncated output for display" from "the agent actually produced incomplete output." This caused 8 false low scores for Coder on verified-correct tasks.

## Root Cause Analysis

The system has **three distinct truncation sources**, and the evaluator conflates all of them:

| Source | Marker | Who sees truncated output? |
|--------|--------|---------------------------|
| **Read tool** (file too large) | `⚠️ FILE TRUNCATED: You are seeing only the beginning and end...` | The agent sees truncated output |
| **Exec tool** (output too large, via `cli-agents.ts`) | `--- TRUNCATED ({n} chars omitted) ---` | The agent sees truncated output |
| **Transcript formatter** (`formatTranscript` in `evaluator.ts`) | `[REVIEWER NOTE: this tool result was {n} chars total — truncated here for review brevity. The agent saw the full output.]` | Only the evaluator sees truncated output — the agent saw everything |

The transcript formatter already includes a `[REVIEWER NOTE]` suffix (line 546 of `evaluator.ts`) explaining that the agent saw the full output. However, the evaluator LLM still misinterprets this as incomplete work, especially when the truncated portion contains the evidence of task completion (e.g., test output, build results).

## Approaches Evaluated

### Approach 1: Add metadata markers ❌
Adding richer metadata (JSON headers, structured truncation events) would require schema changes to `AgentMessage`, transcript format, and the evaluation prompt parser. High complexity, touches many files.

### Approach 2: Pre-filter truncated transcripts ❌ 
Skipping evaluation of sessions with truncated tool results would create blind spots. Most sessions with large exec output (test runs, builds) are the ones most worth evaluating.

### Approach 3: Make the transcript formatter + evaluation prompt truncation-aware ✅

**Simplest effective fix — two small changes:**

**Change A**: In `formatTranscript()` (evaluator.ts:544–546), increase the tool result display limit from 500 to ~2000 chars for `exec` results. Test runner and build outputs carry critical pass/fail evidence in the first ~1500 chars. This alone eliminates most false positives because the evaluator would see "32 tests passed, 0 failures" instead of a truncation note.

**Change B**: Add an explicit instruction to the evaluation prompt (evaluator.ts:786) telling the evaluator to treat `[REVIEWER NOTE: ... truncated here for review brevity. The agent saw the full output.]` as a non-issue:

```
When you see "[REVIEWER NOTE: this tool result was N chars total — truncated 
here for review brevity. The agent saw the full output.]", this means the 
TRANSCRIPT was shortened for your review — the agent received and processed 
the complete output. Do NOT penalize the agent for incomplete output in 
these cases. Do NOT flag these as HARD_CONSTRAINT_VIOLATION.
```

## Recommendation

**Implement Approach 3 (both changes).** Estimated effort: ~15 lines changed across 2 locations in `evaluator.ts`. No schema changes, no new dependencies, no risk to other subsystems.

- Change A addresses the root cause (evaluator doesn't see enough context)
- Change B addresses the LLM misinterpretation (evaluator treats display truncation as agent failure)
- Together they eliminate the false-positive pathway without reducing evaluation rigor for real truncation issues (which carry the `⚠️ FILE TRUNCATED` marker that the agent actually sees)
