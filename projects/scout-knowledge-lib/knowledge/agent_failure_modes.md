<ai_context>
summary: "Agent failure modes observed in production and community discourse: context overflow, tool misuse, infinite loops, scope-boundary confusion, status extraction bugs. Covers symptoms, causes, and mitigations."
triggers: ["failure mode", "agent failure", "blocked", "context overflow", "tool hallucination", "infinite loop", "scope confusion", "false blocked", "status misclassification"]
last_updated: "2026-06-22"
source_basis: "Original: May 2024 community discourse synthesis. Updated 2026-06-22 with scope-boundary confusion pattern observed in aks-rp-e2e project. Updated 2026-06-22 with infrastructure root-cause resolution: workerResultFromSession() bug caused systematic status misclassification across three tasks."
</ai_context>

# AI Agent Failure Modes & Solutions (Research Synthesis)

**Date:** May 2024 (updated June 2026)
**Source:** Community Discourse (XHS/HackerNews/Twitter); system-observed incidents

## Key Failure Modes in Autonomous Agents

Based on recent community discussions, the most common reasons autonomous agents fail in production are:

1.  **Context Overflow (The "Goldfish" Problem)**
    *   **Symptom:** The agent forgets initial instructions or constraints deep into a task.
    *   **Cause:** Accumulating massive context histories pushes foundational system prompts out of the model's active attention span.
    *   **Proposed Solution:** "Context compaction" — periodically summarizing the session history and aggressively pruning raw tool outputs (e.g., truncating file reads) while keeping a persistent "working memory" scratchpad.

2.  **Tool Misuse & Hallucination**
    *   **Symptom:** Calling tools with incorrect parameters, inventing tools that don't exist, or failing to parse tool output correctly.
    *   **Cause:** Loose schema definitions or models struggling with complex JSON structures.
    *   **Proposed Solution:** Rigorous strict-schema enforcement at the API level (e.g., forcing structured outputs) and step-by-step verification. Implementing "guard tools" that validate parameters before execution.

3.  **Infinite Loops & Action Paralysis**
    *   **Symptom:** The agent repeatedly tries the same failing action (e.g., trying to read a non-existent file 10 times) or gets stuck in a loop of thinking without acting.
    *   **Cause:** Lack of meta-awareness about its own recent actions and failures.
    *   **Proposed Solution:** "Action-history awareness" — explicitly feeding back the last N actions and their results, and implementing a circuit breaker (e.g., if action X failed twice, force strategy change).

4.  **False Blocked — Status Misclassification**
    *   **Symptom:** The agent completes all deliverables and meets every acceptance criterion, but the system records the result as `blocked` or `failed`.
    *   **Root causes (two distinct mechanisms observed):**
        *   **4a. Agent-side scope confusion:** The agent conflates observations about the broader system (knowledge gaps, future work items, incomplete upstream context) with blockers to its own assigned task. Long reasoning traces and thorough domain exploration amplify this — the more the agent learns about the surrounding problem space, the more likely it confuses downstream concerns with current-task blockers.
        *   **4b. Infrastructure status-extraction bug:** The control plane code that converts a worker session into a result does not read the agent's structured status field. In the observed case, `workerResultFromSession()` in `task-worker.ts` ignored the `finishResult.status` field from the runtime's structured finish params, so `finish(status: "success")` was systematically misclassified as `blocked`. This is **not an agent reasoning failure** — the agent reported correctly and the infrastructure dropped the signal.
    *   **Observed instances (all from `aks-rp-e2e`):**
        *   `feature-packet-localdns` — worker produced a verified 1004-line feature file (28 scenarios, 5/5 acceptance criteria met). Originally attributed to agent scope confusion (4a); root cause later identified as infrastructure bug (4b).
        *   `feature-packet-cluster-autoscaler` — worker reported `result: blocked` despite successfully creating a complete deliverable. Same infrastructure root cause (4b).
        *   `feature-packet-custom-node-config` — worker produced valid 659-line feature output meeting all 5 acceptance criteria. Result misclassified as `blocked` due to same infrastructure bug (4b). Fix to `workerResultFromSession()` resolved all three tasks.
    *   **Key insight:** When multiple workers across different tasks exhibit the same "false blocked" pattern, suspect infrastructure status-extraction before diagnosing agent reasoning failures. The three `aks-rp-e2e` instances were initially analyzed as agent-side scope confusion but were all caused by a single infra bug.
    *   **Proposed Solutions:**
        *   **For agent-side (4a):**
            *   **Acceptance-criteria gating:** Force the agent to evaluate its result against the explicit acceptance criteria before choosing a status. If all criteria pass, `blocked` is not a valid status regardless of other observations.
            *   **Separate "findings" from "status":** Give agents a structured field for discovered issues / knowledge gaps that is distinct from the completion status. This lets them document concerns without contaminating the pass/fail signal.
        *   **For infrastructure (4b):**
            *   **Status field priority:** The result-extraction function must check the agent's explicit structured status field (`finishResult.status`) before falling back to heuristic classification.
            *   **Consistency assertion:** If an agent calls `finish(status: "success")` but the infrastructure would classify the result differently, flag the mismatch rather than silently overriding.
        *   **For both:**
            *   **Planner-side verification:** The orchestrating agent should verify claimed blockers against acceptance criteria before accepting a `blocked` result, escalating the mismatch rather than the block.
    *   **Related:** Instinct-reflection misalignment (see [Self-Correction Trends 2026](./agent-self-correction-trends-2026.md)) — agents' verbal self-assessment can diverge from their actual output quality.

## Implications for System Architecture

To build robust systems, architectures are shifting towards:
*   **Hierarchical Checkers:** Having a fast, cheap model verify the output of a complex reasoning model before execution.
*   **Explicit State Machines:** Combining LLM reasoning with deterministic state machines where transitions are rigidly controlled.