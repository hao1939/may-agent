# XHS Trends Report: May 2026 (v15)

## Simulated Multi-Agent Trends

We found several emerging patterns in multi-agent architectures on simulated GitHub and XHS:

1. **State Machine Orchestration**: Move towards formal state machines for LLM agent coordination (e.g., `agent-state-machine`). Reduces non-deterministic loops.
2. **Adversarial Testing**: Agents testing other agents is becoming standard (`ai-tester`).
3. **SLM Routing**: Cost and latency routing between Small Language Models (SLMs) and Large Language Models (LLMs) (`slm-router`).

### Next Steps
Investigate if we can apply state-machine orchestration to our core loop to prevent hanging sessions.
