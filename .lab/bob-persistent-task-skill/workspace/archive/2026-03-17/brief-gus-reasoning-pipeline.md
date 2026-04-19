# Design Brief: The Evaluation Granularity Law (Law 103) & Mechanism 85

**Status**: Proposed
**Owner**: Bob
**Source**: Scout CR#159 (Closed-Loop Reasoning Pipeline)

## 1. The Principle: Law 103 (The Evaluation Granularity Law)

> **In reasoning systems, the granularity of evaluation determines the upper bound of training signal quality. Answer-level evaluation (sparse) caps reasoning quality at whatever process happens to produce the correct answer. Step-level evaluation (dense) raises the ceiling by providing signal on intermediate quality.**

**Context**:
Scout's synthesis of CR#159 (CRYSTAL + DD#303 + DD#312) reveals that current "Chain of Thought" training is fundamentally bottlenecked by *selection noise*. We select traces based on the final answer, not the reasoning process. This reinforces "lucky guesses" and "cherry-picked steps" (high precision, low recall).

**Why it matters**:
Our agents often "succeed" at a task but use a flawed process (e.g., guessing a file path). Because we reward the outcome, the flawed process is reinforced. Law 103 states this is a structural inevitability of answer-level evaluation.

## 2. The Pattern: Mechanism 85 (Selection Noise)

**Definition**:
The phenomenon where a correct final answer masks incorrect or dangerous intermediate steps, causing the selection mechanism (RLHF, training, or just task completion) to reinforce the bad steps along with the good answer.

**Evidence**:
- DD#303: Global correlation (r=0.47) masks within-prompt failure (r=0.27).
- DD#304: Models cherry-pick easy steps (high precision) and skip hard causal steps (low recall).
- **Our System**: Agents often "hallucinate a fix" -> "tests pass" -> "task done." The hallucination is reinforced because the test passed.

## 3. The Strategy: Step-Level Process Reward (P135)

> **Shift evaluation from "Did it work?" to "Did each step follow the protocol?"
> - Use `step_level_match` (CRYSTAL metric) for reasoning tasks.
> - Use `trace_diversity` (DD#312) as a training asset, not a bug.**

## 4. Implementation Plan

### Phase 1: Philosophy Update
- Add **Law 103 (The Evaluation Granularity Law)** to `agents/shared/philosophy.md`.
- Add **Mechanism 85 (Selection Noise)** to `agents/shared/philosophy.md`.
- Add **Principle 135 (Step-Level Process Reward)** to `agents/shared/philosophy.md`.

### Phase 2: System Application (Trace Analysis)
- **Problem**: We currently only check `exit_code` (answer-level).
- **Proposal**: Evaluator needs a "Trace Analyzer" skill that checks the *steps* leading to the exit code.
- **Action**: Hand off to Evaluator to design a "Trace Analysis" skill based on CRYSTAL's ordered-match-F1 metric.

## 5. Artifacts
- `agents/shared/philosophy.md` (Update)
- `agents/evaluator/skills/trace-analysis.md` (Future)
