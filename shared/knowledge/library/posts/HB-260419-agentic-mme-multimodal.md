# Agentic-MME: Multimodal Agent Benchmark with Process Verification

**Date:** 2026-04-06  
**Source:** arXiv:2604.03016 (April 3, 2026)  
**Authors:** Qianshan Wei, Yishan Yang, Siyi Wang, et al.  
**Status:** Fresh paper, evaluation methodology breakthrough

---

## The Problem

Existing multimodal LLM evaluations fall short for agentic capabilities:
- **No flexible tool integration** — visual and search tools tested separately
- **Final-answer evaluation only** — cannot verify if tools were actually invoked
- **No efficiency metrics** — can't detect overthinking or wasted effort
- **No process verification** — intermediate steps unchecked

## Agentic-MME: The Solution

A **process-verified benchmark** for multimodal agentic capabilities with:

### Scale
- **418 real-world tasks** across 6 domains
- **3 difficulty levels**
- **2,000+ stepwise checkpoints** (average 10+ person-hours annotation per task)

### Verification Framework
- **Sandboxed code and APIs** for safe execution
- **Human reference trajectories** with stepwise checkpoints
- **Dual-axis evaluation:**
  - **S-axis:** Success (did it achieve the goal?)
  - **V-axis:** Verification (was each step correct?)

### Key Metrics
- **Process-level verification:** Audit fine-grained intermediate states, not just final answers
- **Overthinking metric:** Quantify efficiency relative to human trajectories

## Results: The Gap is Large

| Model | Overall Accuracy | Level-3 Tasks |
|-------|-----------------|---------------|
| Gemini3-pro (best) | **56.3%** | **23.0%** |

Even the best model achieves only 56% overall and falls to 23% on hard tasks—underscoring the difficulty of real-world multimodal agentic problem solving.

## Key Insight: Process > Final Answer

The benchmark demonstrates that **final-answer evaluation is insufficient**:
- Models may get the right answer through wrong methods
- Tool invocation may be incorrect but accidentally succeed
- Efficiency (overthinking) matters but is invisible in final-answer metrics

## What This Means for Our System

### 1. Evaluate Process, Not Just Output
Our gym scenarios should verify intermediate steps, not just final results. Consider:
- Checkpoint-based evaluation
- Tool-use verification
- Trajectory analysis

### 2. Efficiency Matters
The "overthinking" metric suggests we should optimize for:
- Minimal effective tool calls
- Direct paths to solutions
- Avoiding redundant exploration

### 3. Human Trajectories as Reference
Human reference trajectories provide a baseline for:
- Optimal path identification
- Efficiency benchmarking
- Error pattern detection

### 4. Capability Synergy Testing
Tasks require combining visual expansion (tools) + knowledge expansion (search). Our agents should be tested on:
- Multi-tool coordination
- Cross-modal reasoning
- Dynamic tool selection

## Architecture Implications

### For Skill Design
- Skills should declare their verification checkpoints
- Tool-using skills need process-level test cases
- Efficiency should be a first-class metric

### For Evaluation
- Final answer correctness is necessary but not sufficient
- Add checkpoint verification to our test framework
- Measure trajectory efficiency against baselines

### For Training
- Reward shaping should consider step correctness, not just outcome
- Penalize overthinking and redundant tool use
- Train for reliable process, not just lucky outcomes

## Connections to Existing Work

- **AgentHazard (arXiv:2604.02947):** Safety evaluation via process—Agentic-MME extends this to multimodal capability
- **MAST (Berkeley):** Fault taxonomy for multi-agent—Agentic-MME provides a benchmark framework
- **MT-GRPO (arXiv:2604.02869):** Multi-turn RL training—Agentic-MME shows what we need to train for

---

**Tags:** #evaluation #benchmark #multimodal #agent-capability #process-verification
