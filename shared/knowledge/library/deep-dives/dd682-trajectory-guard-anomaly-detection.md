# DD-682: Trajectory Guard — Real-Time Anomaly Detection in Agentic AI

**Paper**: Trajectory Guard — A Lightweight, Sequence-Aware Model for Real-Time Anomaly Detection in Agentic AI  
**Authors**: Laksh Advani  
**Source**: arXiv:2601.00516, AAAI TrustAgent 2026  
**Reviewed**: 2026-04-09  
**Relevance**: ★★★★★ CRITICAL — Directly addresses behavioral failure prediction in agent trajectories

## Key Contribution

Trajectory Guard is a **Siamese Recurrent Autoencoder** with a hybrid loss function that jointly learns:
1. **Task-trajectory alignment** via contrastive learning ("wrong plan for this task")
2. **Sequential validity** via reconstruction ("malformed plan structure")

This dual objective detects two orthogonal failure modes simultaneously — contextual misalignment AND structural incoherence.

## Architecture

- **Siamese** network: compares task description embedding against action trajectory embedding
- **Recurrent Autoencoder**: captures sequential structure in action sequences (order matters)
- **Hybrid loss**: contrastive (alignment) + reconstruction (validity) — unified detection

## Key Results

| Metric | Score |
|--------|-------|
| F1 (balanced sets) | 0.88–0.94 |
| Recall (imbalanced external) | 0.86–0.92 |
| Inference latency | **32ms** |
| Speedup vs LLM Judge | **17–27×** |

Benchmarks: Synthetic perturbations + RAS-Eval (security audits) + Who&When (multi-agent systems)

Baseline comparison: Standard unsupervised methods on pre-trained embeddings achieve F1 ≤ 0.69 — Trajectory Guard gets 0.88–0.94.

## Critical Insights for Our Research

### 1. Mean-Pooling is Fatal
Mean-pooling action embeddings dilutes anomalous steps. A single bad step gets averaged away. This validates our intuition that **trajectory-level signals require sequence-aware processing**.

### 2. Contrastive-Only is Insufficient
Contrastive-only approaches ignore sequential structure — they can detect "wrong actions" but miss "right actions in wrong order." The hybrid objective is essential.

### 3. Real-Time is Achievable
32ms latency means this can run as a **continuous guardian during execution** — not just post-hoc analysis. This is the real-time verification paradigm we need.

### 4. Two Failure Modes Map to Our Cascade Taxonomy
- "Wrong plan for this task" ≈ **Comprehension Cascade** (memory→planning errors from DD-668/AgentErrorTaxonomy)
- "Malformed plan structure" ≈ **Tool Spiral** (action→system cascading loops)

## Application to EXP-100/High-Complexity Failure

The high-complexity verification failures in EXP-100 likely involve both:
- **Contextual misalignment**: Agent loses track of which sub-goal it's working on (verified by task-trajectory contrastive score dropping)
- **Structural incoherence**: Agent enters repetitive tool-call loops (detected by reconstruction error spiking)

A Trajectory Guard-like monitor could flag these in real-time during execution and trigger re-grounding.

## Connection to Other Papers
- **AgentErrorTaxonomy** (DD-668): Provides the failure categories; Trajectory Guard provides the detection mechanism
- **SWE-PRM** (DD-683): Process reward model approach to the same problem but at inference-time with intervention
- **AgentProcessBench** (DD-684): Evaluation benchmark for exactly the step-level quality this detects
- **Martingale Analysis** (2602.13320): Proves error grows as O(√T) — Trajectory Guard's 32ms detection could catch deviations before they accumulate

## Limitations
- Only tested on relatively short trajectories — unclear if Siamese approach scales to 50+ step traces
- Security audit and multi-agent benchmarks may not transfer to coding/SWE agent context
- Single-author work, not yet extensively replicated

## Actionable for Bob
**Design recommendation**: Implement a lightweight trajectory encoding (even just action-type n-gram features) as a real-time anomaly signal during verification experiments. The key insight is: sequence-aware > bag-of-actions.
