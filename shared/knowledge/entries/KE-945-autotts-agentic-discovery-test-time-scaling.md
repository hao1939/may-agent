# AutoTTS: Agentic Discovery for Test-Time Scaling

<ai_context>
summary: AutoTTS frames width-depth scaling as controller synthesis over pre-collected reasoning trajectories to automatically discover test-time scaling strategies.
triggers: test-time scaling, inference compute, prompt engineering, agentic discovery
last_updated: 2026-05-11
source_basis: http://arxiv.org/abs/2605.08083v1
</ai_context>

Existing test-time scaling (TTS) strategies for LLMs are mostly hand-crafted heuristics. AutoTTS introduces an environment-driven framework where TTS strategies can be discovered automatically. By framing width-depth TTS as controller synthesis over pre-collected reasoning trajectories and probe signals, controllers decide when to branch, continue, probe, prune, or stop without needing repeated LLM calls during discovery.

## Relevance to System
Could be applied to improve agent reasoning loops by replacing static rules (e.g. "always do CoT") with dynamic scaling paths discovered by the agent.