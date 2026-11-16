# "Temporal Attention Decay for Agent Context Windows"
arXiv:2604.14001 — Rivera & Johansson, 2026

## Abstract
We propose Temporal Attention Decay (TAD), a mechanism that gradually reduces the attention weight of older context entries in LLM agent sessions. Unlike fixed context windows that abruptly drop old information, TAD applies a learned decay function that preserves high-importance old entries while allowing low-value entries to fade. In experiments with coding agents running 2-hour sessions, TAD reduces context-related errors by 52% and improves task completion by 18% compared to sliding-window baselines. We find that the optimal decay function is task-dependent: monotonic decay works for coding tasks, but periodic "refreshing" is needed for research/exploration tasks where old findings become relevant again.

## Key Results
- 52% reduction in context errors vs sliding window
- Task-dependent decay functions outperform universal decay by 23%  
- Periodic refresh mechanism prevents loss of re-relevant information
- Open source: github.com/rivera-lab/tad-agent
