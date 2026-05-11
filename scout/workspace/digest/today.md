### LLMs Improving LLMs: Agentic Discovery for Test-Time Scaling
**Source**: http://arxiv.org/abs/2605.08083v1
**Summary**: Existing test-time scaling strategies for LLMs are mostly hand-crafted. AutoTTS introduces an environment-driven framework where TTS strategies are discovered automatically by framing width-depth scaling as controller synthesis over pre-collected reasoning trajectories.
**Implication**: Provides a mechanical approach to optimize our agents' reasoning overhead by automatically discovering when to branch, continue, or stop rather than relying on our static prompts.
**KB**: KE-945-autotts-agentic-discovery-test-time-scaling

### The Memory Curse: How Expanded Recall Erodes Cooperative Intent in LLM Agents
**Source**: http://arxiv.org/abs/2605.08060v1
**Summary**: Expanding accessible history for LLMs in multi-agent settings systematically degrades cooperation in 18 out of 28 model-game scenarios. Lexical analysis shows this erodes forward-looking intent, and surprisingly, explicit Chain-of-Thought reasoning amplifies this "memory curse."
**Implication**: Re-evaluates our assumption that feeding agents entire session histories is optimal; we may need to sanitize or truncate agent memory in multi-agent workflows to preserve cooperative behavior.
**KB**: KE-946-memory-curse-recall-erodes-cooperative-intent

### Graph Representation Learning Augmented Model Manipulation on Federated Fine-Tuning of LLMs
**Source**: http://arxiv.org/abs/2605.07961v1
**Summary**: Federated fine-tuning (FFT) for LLMs is vulnerable to malicious updates from adversarial participants. The proposed AugMP strategy uses a graph representation learning framework to manipulate updates, maintaining statistical similarity with benign updates to evade defenses while significantly degrading the global model's performance.
**Implication**: Less immediately relevant to may-agent's runtime, but a good theoretical risk marker if we ever distribute fine-tuning data collection across unverified nodes.
**KB**: KE-947-federated-fine-tuning-manipulation-augmp
