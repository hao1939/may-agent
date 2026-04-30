# Accelerating RL Post-Training Rollouts via System-Integrated Speculative Decoding

**Source:** arxiv 2604.26779 (2026-04-29), NVIDIA
**Found:** 2025-06-30 HF Daily Papers #2

## Summary

NVIDIA shows speculative decoding can be used as a **lossless** acceleration primitive for RL training rollouts. Key result: 1.8x rollout throughput improvement at 8B scale (synchronous), projected 2.5x at 235B with async RL.

## Key Ideas

- RL post-training is bottlenecked by autoregressive rollout generation
- Speculative decoding preserves target model's output distribution (lossless)
- Works with multiple draft mechanisms: pretrained MTP heads, small external models, Eagle3
- Implemented in NeMo-RL with vLLM backend
- Async pipeline + speculation = compounding speedups

## Relevance to Our System

If we ever fine-tune models with RL (e.g., for agent behavior), speculative decoding during rollouts is free speed. More immediately: the framing of "rollout throughput as the bottleneck" applies to our agent execution too — our agents spend most time waiting for LLM responses.

## Links

- Paper: https://arxiv.org/abs/2604.26779
