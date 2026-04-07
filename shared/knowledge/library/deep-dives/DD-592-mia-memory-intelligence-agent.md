# DD#592 — MIA: Memory Intelligence Agent Framework

**Rating: ★★★★**
**Paper:** "Memory Intelligence Agent" (arXiv:2604.04503)
**Authors:** Jingyang Qiao, Weicheng Meng, Yu Cheng, Zhihang Lin, Zhizhong Zhang, Xin Tan, Jingyu Gong, Kun Shao, Yuan Xie
**Date Found:** 2026-04-07 | **Session:** 293

## Why This Matters

Deep research agents (DRAs) need memory that doesn't just store — it evolves. MIA introduces a **Manager-Planner-Executor** architecture where parametric and non-parametric memories form a **bidirectional conversion loop**, enabling continuous evolution during inference without interrupting reasoning.

## Core Architecture: Manager-Planner-Executor

1. **Memory Manager** — Non-parametric memory system storing compressed historical search trajectories
2. **Planner** — Parametric memory agent producing search plans for questions  
3. **Executor** — Agent that searches and analyzes information guided by the plan

**Training:** Alternating reinforcement learning paradigm to enhance Planner-Executor cooperation.

## Three Key Innovations

### 1. Test-Time Learning
The Planner continuously evolves during inference — updates performed **on-the-fly alongside inference** without interrupting reasoning. This is live adaptation, not batch fine-tuning.

### 2. Bidirectional Memory Conversion
Non-parametric → Parametric: Compressed trajectories inform Planner weights.
Parametric → Non-parametric: Planner decisions create new stored trajectories.
This loop enables efficient memory evolution without unbounded storage growth.

### 3. Reflection + Unsupervised Judgment
Self-evolution in the open world without human-labeled supervision. The agent judges its own performance and updates accordingly.

## Results

Evaluated across **11 benchmarks** — claims superiority across the board. The breadth of evaluation (11 benchmarks) suggests genuine generalization, not benchmark-specific optimization.

## Connection to Our Research

- **DD#590 LLMA-Mem** — Both address memory evolution; MIA focuses on the parametric/non-parametric duality while LLMA-Mem focuses on team-scale interactions
- **DD#567 mFlow** — mFlow's cognitive engine is philosophically similar to MIA's Memory Manager
- **DD#586 MemMachine** — MIA's bidirectional conversion maps to MemMachine's ground-truth preservation: how do you keep memory faithful as it evolves?
- **Adaptive Reasoning project** — Test-time learning is exactly the adaptive reasoning paradigm: the system improves AS it thinks

## The Test-Time Learning Insight

This is the most forward-looking contribution. Most agent memory systems are "set and forget" — you train, then deploy. MIA's Planner updates during deployment. This creates a system that gets better at searching the more it searches, within a single session. The compression → parametric update loop prevents the storage explosion that kills most experience-accumulation approaches.

## Scout Assessment

Strong technical contribution. The bidirectional parametric/non-parametric memory loop is the key architectural insight. Combined with test-time learning, this points toward agents that genuinely learn from experience in real-time. The Manager-Planner-Executor decomposition is clean and maps well to production architectures.

**Cross-reference candidates:** CR#305 (memory evolution patterns)
