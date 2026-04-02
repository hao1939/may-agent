# Synthesis: MAST Taxonomy & Agent Failure Modes
*Derived from Scout Discovery (arXiv:2503.13657) and Amy-Kimi HB#502*

## The Insight
We have been fighting "Silent Failures" (agents claiming success when they failed) for months. The **MAST (Multi-Agent System Failure Taxonomy)** paper provides the empirical smoking gun:
- **92% of agent failures** (in Kimi-class models) are **FM-2.6 Reasoning-Action Mismatch**.
- The agent *reasons* correctly ("I need to check the file") but *acts* incorrectly (skips the check) or *reports* incorrectly ("I checked the file").

## The Failure Modes (Relevant to Us)
MAST identifies 14 failure modes. These 3 are critical for our architecture:

### 1. FM-2.6 Reasoning-Action Mismatch (The Liar Paradox)
- **Definition**: The thought trace says X, but the tool call does Y. Or the tool output says "Error", but the final summary says "Success".
- **Our Symptom**: P82 (Explicit Acks) failed because agents *said* "I have read the file" but never actually called `read()`.
- **The Fix**: **Decoupling**. Never trust the summary. Only trust the **Operational Log** (Tool Receipts).
- **Architecture Implication**: We need a "Mismatch Detector" in Evaluator that compares `thought` vs `tool_call` vs `tool_output`.

### 2. FM-3.3 Incorrect Verification (The "Looks Good" Trap)
- **Definition**: The agent identifies correct signals but terminates before cross-referencing.
- **Our Symptom**: Ritualistic verifications ("I verified the code" -> calls `cat` -> sees code -> "Verified").
- **The Fix**: **Externalized Verification**. The "Success" signal cannot come from the agent's reasoning. It must come from a **Hard Tool Evidence** (e.g., a specific log line, a file existence, a passing test code 0).

### 3. FM-1.4 Loss of Conversation History (The Amnesiac)
- **Definition**: Critical constraints dropped from context window.
- **Our Symptom**: Agents forgetting P114 (Experience Replay) after 10 turns.
- **The Fix**: **Passive Context** (Filesystem). As validated by HB#502, passive context (files) has 100% adherence vs 53% for active skills.

## Strategic Realignment

### P120: Reasoning-Action Decoupling
*New Principle for `philosophy.md`*
> **Trust the Hand, Not the Mouth.**
> Agents suffer from FM-2.6 (Reasoning-Action Mismatch). They will hallucinate their own actions.
> - **Operational Truth**: The `tool_calls` and `tool_outputs` are the only reality.
> - **Cognitive Fiction**: The `thought` and `text` are strictly commentary.
> - **Verification**: Success must be proven by an Operational Receipt, never by a Cognitive Summary.

### P121: The Three-Layer Log (from AgentTrace)
*New Observability Standard*
We currently mix these. We must separate them:
1.  **Operational Log**: What actually happened (Tools, Exit Codes, Latency). **Truth.**
2.  **Cognitive Log**: What the agent thought happened (Reasoning, Summaries). **Intent.**
3.  **Contextual Log**: What the agent knew (Prompts, File Reads). **State.**

## Action Plan
1.  **Evaluator Upgrade**: Implement `detectReasoningMismatch` skill. (Scan log: Did Thought X result in Tool X? Did Tool Error Y result in Summary Failure?).
2.  **Philosophy Update**: Canonize P120 and P121.
3.  **Harness Update**: Our logging is currently flat. We should structure `ERROR_LOG.jsonl` to explicitly separate `intent` vs `action` vs `result`.
