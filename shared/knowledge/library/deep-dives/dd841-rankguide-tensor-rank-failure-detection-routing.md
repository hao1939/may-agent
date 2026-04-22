# DD#841 — RankGuide: Tensor-Rank-Guided Routing and Steering for Efficient Reasoning

**Paper**: [2604.16694](https://arxiv.org/abs/2604.16694)  
**Authors**: Tian, Su, Solgi, Kundu, Zhang  
**Rating**: ★★★★ | **Focus**: Behavioral Failure Detection  
**Added**: 2026-04-22  

## Key Contribution

RankGuide identifies **three failure modes in small reasoning models (SRMs)** via tensor-rank analysis of hidden states, then uses this signal to route to larger models or steer reasoning trajectories:

1. **Overconfidence**: Model commits to wrong path with high certainty
2. **Uncertainty**: Model oscillates without committing
3. **Heavy revalidation**: Model loops back repeatedly to re-check steps

These are detected by analyzing **tensor rank of consecutive hidden states** — a structural signal in the latent space, not just output confidence.

## Architecture

1. **Tensor-rank routing signal**: Compute rank structure of hidden state sequence → detect failure signatures → route to LRM when SRM likely failing
2. **Tensor-rank-filtered steering vectors**: Extract correction vectors from successful reasoning traces, apply them to modulate SRM trajectory when mild failures detected
3. **SRM-LRM collaboration**: Route only when needed; steer when routing not required

## Results

- Up to **1.75× latency reduction** vs. always using LRM
- Competitive accuracy with prior routing methods
- Three failure modes are empirically distinct and detectable before output

## Connections to Bob's Program

### Behavioral Failure Stack (CR#320)
The three failure modes (overconfidence, uncertainty, heavy revalidation) are **concrete additions to the behavioral failure taxonomy**. These are *latent-space* behavioral failures — detectable before they manifest in output. This extends CR#320 from output-level to representation-level failure detection.

### Relation to Verification Architecture (KE-104/105)
Tensor-rank analysis is a **runtime verification signal** — it doesn't require ground truth, operates on internal representations, and is predictive rather than post-hoc. This is exactly the kind of "cheap verification proxy" KE-104 calls for.

### For EXP-036 (Failure Detection Without Ground Truth)
Direct methodology. Tensor rank of hidden states as a model-intrinsic failure signal. Key question for our program: does this generalize beyond reasoning to tool-use and coordination failures?

### Relation to Five Laws (KE-101)
- **Law 1 (Agents will fail)**: Three named failure modes with structural signatures
- **Law 5 (Verification must be continuous)**: Tensor-rank monitoring can run continuously during inference at low cost

## Limitations
- Requires access to hidden states — doesn't work for API-only models
- Failure mode taxonomy may be incomplete (only three modes studied)
- Steering vectors assume failure modes are correctable, not all are
- Evaluated on reasoning benchmarks; unclear if failure modes transfer to agentic tasks

## Key Takeaway
Hidden-state tensor rank provides a **cheap, continuous, predictive signal** for reasoning failure. The three-mode failure taxonomy (overconfidence, uncertainty, heavy revalidation) is the most actionable contribution — these map to specific interventions (route, steer, or abort).
