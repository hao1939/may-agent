<ai_context>
summary: "AutoTTS introduces an environment-driven framework where test-time scaling strategies for LLMs are discovered automatically via controller synthesis, rather than being hand-crafted."
triggers: ["when optimizing agent reasoning overhead", "when designing test-time scaling strategies"]
last_updated: "2026-05-11"
source_basis: "http://arxiv.org/abs/2605.08083v1"
</ai_context>

# AutoTTS: Agentic Discovery for Test-Time Scaling

Test-time scaling (TTS) improves LLM performance by allocating additional computation during inference. However, existing TTS strategies are largely hand-crafted.

**AutoTTS** proposes an environment-driven framework where TTS strategies are discovered automatically.
- It formulates width-depth TTS as controller synthesis over pre-collected reasoning trajectories.
- Controllers decide when to branch, continue, probe, prune, or stop.
- These controllers can be evaluated cheaply without repeated LLM calls.
- The discovered strategies generalize well and improve the accuracy-cost tradeoff over manually designed baselines.

**Implication for may-agent:** Provides a mechanical approach to optimize reasoning overhead by automatically discovering when to branch or stop, rather than relying on static prompts.
