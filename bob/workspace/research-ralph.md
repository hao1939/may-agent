# Research: The RALPH Loop Pattern

**Sources Evaluated:**
- `google-adk-ralph-loop-demo` (Thomas Chong)
- `ralph-loop` (PageAI-Pro / Ralph Wiggum Loop)

## 1. What is it?
The "Ralph Loop" (often referencing Ralph Wiggum "I'm helping!") is a **Verification-Driven Iteration Pattern**.

Unlike standard ReAct (which reasons then acts), Ralph Loop focuses on **External Verification** as the only exit condition. It is fundamentally: **"Don't trust the AI to judge its own work—make it prove success through external verification."**

The acronym "Reason, Act, Learn, Plan, Hypothesize" (from the TODO) appears to be a *conceptual mapping* rather than the explicit architecture used in these specific implementations. These repos implement a tighter **Generate → Verify → Refine** loop.

## 2. Core Loop Structure

### The Mechanism
1. **Generate**: Agent makes a best-effort attempt (e.g., writes a Dockerfile).
2. **Verify (The "Judge")**: A *deterministic* or *independent* tool checks the output.
   - *Crucially*: The LLM does NOT decide if it passed. The tool exit code (0 or 1) decides.
3. **Refine (The "Learner")**: If verification fails, the error output is fed back to a "Refiner" agent.
4. **Repeat**: The loop continues until Verification passes or max iterations reached.

### Comparison: ReAct vs. Ralph

| Feature | Standard ReAct | Ralph Loop |
| :--- | :--- | :--- |
| **Driver** | "I think I should do X..." | "The tool says X failed, fix it." |
| **Exit Condition** | Agent decides "I am done" | External tool returns `exit code 0` |
| **Feedback** | Observations (often mostly read-only) | Verification Failures (hard constraints) |
| **Risk** | Hallucinated success ("I checked it, it works") | Infinite loops (if fix doesn't work) |

## 3. What Problem Does It Solve?
**The "Looks Good To Me" (LGTM) Hallucination.**

In standard loops, agents often say:
> "I have written the code. I read it back and it looks correct. Task done."

But the code has a syntax error. Ralph Loop *forbids* the agent from completing until the compiler/linter/test runner agrees. It forces the agent to face reality.

## 4. Key Components (Code Mapping)

In `google-adk-ralph-loop-demo`, the architecture maps as:

1. **Plan/Act (`DockerfileGenerator`)**: "Generate initial Dockerfile."
2. **Verify (`VerificationChecker`)**: Runs `docker build`, `hadolint`. Checks `state["all_stages_passed"]`.
3. **Learn/Hypothesize (`DockerfileRefiner`)**:
   - **Input**: "Build failed at line 4: missing dependency."
   - **Hypothesis**: "I need to add `RUN apt-get install -y libx`."
   - **Action**: Generates V2 Dockerfile.

## 5. Requirements
- **No Fine-Tuning Needed**: Works with standard models (Gemini Pro/Flash, Claude).
- **Tooling Heavy**: Requires a **fast, deterministic verification tool** for the domain (e.g., `docker build`, `tsc`, `pytest`).
- **State Separation**: The "Judge" (Verification) must be separate from the "Worker" (Generator).

## 6. Evaluation for Our System

### Usefulness: ⭐⭐⭐⭐⭐ (High)
We already have the seeds of this ("Coder" vs "QA"). However, our current loops are often linear (Coder -> QA -> Fix -> Done). A true Ralph Loop would be **circular** and **hard-gated**: *Coder cannot leave the session until `tsc` passes.*

### Recommendation
Adopt the **"Hard-Gated Exit"** principle.
- **Current**: Agent runs `tsc`, sees error, tries to fix, maybe gives up or says "I fixed most of it."
- **Ralph**: Agent *cannot* output "DONE" until `tsc` returns 0.

### Proposed Experiment
Create a "Hard-Gated Coder" for a specific task (e.g., strict TypeScript clean-up).
- **Rule**: `finish()` tool is disabled until `npm test` returns 0.
- **Safety**: Needs a strict `max_iterations` to prevent token burning on impossible tasks.
