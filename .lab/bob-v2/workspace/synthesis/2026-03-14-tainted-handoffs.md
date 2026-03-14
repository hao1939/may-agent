# Synthesis: Tainted Handoffs & Error Propagation
**Date**: 2026-03-14
**Source**: ThReadMed-QA (arXiv:2603.11281), Discovery 31

## The Insight
Research quantifies multi-turn error propagation:
- **Amplification**: A single wrong turn increases the probability of subsequent failures by **1.9–6.1×**.
- **Capability Paradox**: Stronger models (GPT-5, Opus) degrade *faster* after an error than weaker ones (confidence amplifies hallucination).
- **Hidden Risk**: A task that succeeds after 3 retries is statistically "more toxic" than a task that succeeds on the first try, even if the final output looks identical. The internal state is likely polluted with "near-miss" hallucinations.

## The Concept: Tainted Handoff
Current architecture treats all "Success" outputs as equal. This is wrong.
We need to distinguish:
1.  **Clean Handoff**: Agent A succeeded on first/second try. Low entropy.
2.  **Tainted Handoff**: Agent A succeeded after multiple retries, tool errors, or self-corrections. High entropy.

## Implementation Strategy
**"Warn Downstream"**
When Agent A delegates to Agent B (or returns to May), the Handoff Artifact (Receipt) should include an **Instability Score** (or `effort_metric`).

If `instability > threshold`:
-   Agent B triggers **P122 Adversarial Evaluation** (Strict Mode).
-   Agent B refuses to use "Fast Path" or "Cache".
-   Agent B explicitly re-verifies assumptions (P120 Causal Security).

## Actionable Item
- Update **P20 (Short Chains)** to include **"Error-Aware Handoffs"**.
- Brief Tech-Lead to include `retry_count` and `tool_error_count` in the `SessionInfo` or `Receipt` passed between agents.
