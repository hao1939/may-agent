# Synthesis: MAST Failure Taxonomy & Externalized Verification

**Source**: [Hugging Face / IBM Research](https://huggingface.co/blog/ibm-research/itbenchandmast) (2026-02-25)
**Type**: Theoretical Framework
**Related**: P6 No Silent Failures, P59 Trust with Verification

## The Insight
MAST (Multi-Agent System Failure Taxonomy) provides a rigorous vocabulary for *how* agents fail.
Key Finding: **FM-2.6 Reasoning-Action Mismatch** accounts for >90% of failures in advanced models (like Kimi/GPT-4o).
- **The Symptom**: The agent says "I have fixed the bug" or "Verification passed," but the actual state is unchanged.
- **The Cause**: The model's internal reasoning ("I should fix this") is disconnected from its tool execution ("I ran `sed`"). It hallucinates the outcome of the action.

## Our Vulnerability
We rely heavily on **Self-Reporting**.
- "Did you fix it?" -> Agent says "Yes."
- Evaluator reads the transcript: "Agent said Yes, so Pass."
This is **Ritualistic Verification**.

## The Fix: Externalized Verification
We must move verification **outside** the agent's reasoning loop.
- **Gemini-Class Fix**: Force "Hard Evidence" before exit. The agent cannot say "Done" until a `verify_receipt` tool returns `SUCCESS`.
- **Kimi-Class Fix**: Deterministic State Machine. The termination condition is `grep "SUCCESS" log.txt`, not `llm.decide("Is it done?")`.

## Proposed Principles

### P143 The Observation Principle
> "Trust the Artifact, Not the Agent."
> Never evaluate an agent based on what it *says* it did. Evaluate only the *artifacts* it produced (files, logs, exit codes).
> If the transcript says "Fixed" but the file is unchanged, it is a Failure (FM-2.6).

### P183 Failure Hierarchy (MAST)
> distinguish "Fatal" from "Benign" failures.
> - **Fatal**: FM-2.6 (Lying), FM-1.4 (Memory Loss), FM-1.5 (Zombie Loop). Immediate kill.
> - **Benign**: FM-1.3 (Looping), FM-1.1 (Disobedience). Retry allowed.

## Action Plan
1.  **Evaluator Rubric Update**: Adopt MAST codes. When an agent fails, tag it with `FM-2.6` or `FM-1.3`.
2.  **Harness Update**: Implement `check_state` or `verify_receipt` as a **Hard Gate**. The `done()` tool should reject if no receipt exists.
3.  **Philosophy**: Add P143 and P183 to `philosophy.md`.

## Impact
- **Reliability**: Eliminates "False Positives" in evaluation.
- **Debugging**: Gives us a precise language for *why* a session failed, enabling targeted fixes (e.g., "Fix FM-2.6 by improving tool feedback" vs "Fix FM-1.4 by summarizing context").
