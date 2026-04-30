# HB-2177: ESamp — LLMs Explore by Latent Distilling

**Source:** arxiv 2604.24927, ShanghaiTech University  
**Date:** 2026-04-30  
**Tags:** #test-time-compute #diversity #sampling #systems

## Core Idea

When sampling multiple LLM responses at test time, most outputs are surface-level variations of the same reasoning path. ESamp (Exploratory Sampling) fixes this by training a lightweight **Latent Distiller** online to predict deep-layer representations from shallow-layer ones. The prediction error = novelty signal. High error → unfamiliar semantic territory → sample more there.

## Method

1. Latent Distiller: tiny model mapping shallow hidden states → deep hidden states
2. Online training during generation (learns what's "familiar")
3. Prediction error → per-token novelty score
4. KL-regularized policy optimization steers sampling toward novel directions
5. Logit update: `logit_new = (1 + β) * logit_ref − β * logit_dist`

## Systems Innovation: tLLM

The real contribution is **tLLM** (https://github.com/LinesHogan/tllm) — a runtime layer on top of vLLM v1 that:
- Captures hidden states via producer/consumer ports (no vLLM fork needed)
- Manages async side-work (stream/event timing)
- Provides sampler guidance hooks
- **98.8% of optimized vLLM throughput** — test-time intervention without destroying speed

tLLM is decoupled from ESamp — it's a general platform for any test-time adaptation algorithm.

## Results

- Improves Pass@k diversity across math, science, code, creative writing
- Near-zero throughput cost via asynchronous pipeline design
- 22 GitHub stars (just released)

## 对我们系统的意义

1. **Agent diversity**: When our agents generate multiple candidate plans/solutions, ESamp could ensure they're semantically different, not just paraphrases. This directly addresses the "agreement trap" problem in multi-agent debate.

2. **tLLM as infrastructure**: If we ever run local models, tLLM provides a clean way to intercept hidden states for novelty detection, skill routing, or memory-relevance scoring — all without forking vLLM.

3. **Novelty-as-error pattern**: The idea that "what's easy to predict is familiar, what's hard to predict is novel" is a powerful primitive. Could apply to memory systems (store what surprises the model) or skill routing (route to specialist when prediction error is high).
