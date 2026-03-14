# Multi-Agent System Failure Taxonomy (MAST)
**Source**: IBM Research + UC Berkeley (arXiv:2503.13657)
**Synthesized**: 2026-03-12

A rigorous taxonomy of *how* agents fail. We use these codes to label failures in `agents/optimizer` reviews.

## The 3 Categories & 14 Modes

### FC1: System Design (Capability & Harness)
Failures where the agent simply cannot perform the task due to constraints, memory, or instruction adherence.
* **FM-1.1 Disobey Task Spec**: Ignores explicit constraints (e.g., "do not use python").
* **FM-1.3 Step Repetition**: Loops on the same action/tool without changing state.
* **FM-1.4 Memory Loss**: Forgets context from earlier in the session. (Critical in long sessions).
* **FM-1.5 Unaware of Termination**: Doesn't know how/when to stop (keeps going after success).

### FC2: Inter-Agent Misalignment (Communication & Reasoning)
Failures in the agent's internal logic or communication with the user/system.
* **FM-2.2 Fail to Ask Clarification**: Guesses instead of asking when ambiguous.
* **FM-2.3 Task Derailment**: Drifts off-topic to an unrelated goal.
* **FM-2.6 Reasoning-Action Mismatch**: The "Hallucinated Action". Thoughts say "I will check the file", tool call checks the *wrong* file. The action doesn't match the reasoning. (Common in smaller models).

### FC3: Task Verification (Evaluation)
Failures in judging success.
* **FM-3.1 Premature Termination**: Stops before the job is actually done.
* **FM-3.3 Incorrect Verification**: "Declaring Victory". Says "Done!" when the test actually failed or the file wasn't written.

## Engineering Responses

| Failure Mode | The Fix (Harness Level) |
|--------------|-------------------------|
| **FM-1.3 Loop** | **Detect**: Sliding window hash of tool calls. **Fix**: Interrupt with "You are looping" (Wink pattern). |
| **FM-2.6 Mismatch** | **Detect**: Hard to catch auto. **Fix**: "Thought-Action Consistency" prompt checks or separate verifier. |
| **FM-3.3 False Success** | **Detect**: Verifier Agent. **Fix**: Require *evidence* (grep output, exit code) in final answer. |
| **FM-1.4 Amnesia** | **Detect**: Context length monitoring. **Fix**: Summarization, Vector Memory, or File-based Memory (our approach). |

## Analysis of Our System (Preliminary)
* **Gemini (Bob)**: Likely low on FM-1.4, high on FM-3.3 (Optimism).
* **Kimi (Amy)**: Research suggests prone to FM-2.6 (Meta-loops/Debugging own scripts).
* **Opus (Tech-Lead)**: Generally robust, but watch for FM-1.3 (Stubbornness).

## Usage
When analyzing a failed session:
1. Identify the *first* point of divergence.
2. Label it with the FM code (e.g., "Failed due to FM-3.3").
3. Apply the specific engineering fix for that code.
