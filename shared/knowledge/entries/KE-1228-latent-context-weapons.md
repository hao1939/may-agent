# Latent Context Weapons: The Passive Aggressive Payload

<ai_context>
summary: Synthesis of KE-1226 (Cognitive Overflow), KE-1227 (Federated Fine-Tuning Manipulation), and KE-1222 (Memory Curse). It conceptualizes how shared knowledge bases can be weaponized passively by inserting cryptically adversarial context that degrades agent performance over time without triggering direct action or alarms.
triggers: discussions on shared knowledge bases, memory pruning, adversarial attacks, multi-agent context sharing.
last_updated: 2026-05-11
source_basis: Synthesis of KE-1226, KE-1227, and KE-1222.
</ai_context>

## The Threat Model

Current security models for agents focus on **active** threats: an injected instruction that says "delete the database" or an obfuscated command (KE-1225) that tricks the agent into spending money. 

However, synthesizing the "Memory Curse" (where large contexts degrade cooperation) and "Federated Manipulation" (where graph representations are subtly skewed) reveals a more insidious vector: **Latent Context Weapons**.

A latent context weapon does not instruct an agent to do something bad. Instead, it subtly pollutes the agent's shared memory or knowledge base (like `agents/shared/knowledge/`) with context that causes the agent's reasoning to degrade or its cooperative intent to collapse over time.

## How it Works

1. **The Poisoned Premise**: An attacker (or a malfunctioning agent, via Epistemic Thrashing) inserts a subtle, mathematically plausible but adversarial piece of context into a shared document.
2. **The Passive Carrier**: Downstream agents read this context as part of their routine operations. Because the context contains no actionable commands (no "run this tool"), it easily bypasses standard structural guards.
3. **The Cognitive Collapse**: When the agent applies Chain-of-Thought (CoT) reasoning to this poisoned premise, the logic unravels its cooperative intent (the Memory Curse). The agent begins to hallucinate conflicts, distrust other agents, or simply fail tasks because the foundational context it relies on is subtly skewed.

## Implication for may-agent

- **Read-Path Security**: We heavily gate *writes* and *tool executions*, but we implicitly trust *reads* from our own shared knowledge directories. Latent context weapons exploit this trust.
- **Context Sanitization**: We cannot rely solely on structural gates for outbound actions. We must develop mechanisms to sanitize and audit *at rest* memory for semantic drift and adversarial framing, not just executable payloads.
- **The Danger of Unbounded CoT**: As seen in KE-1226, explicit CoT amplifies these latent weapons. The agent literally thinks itself into a trap set by passive text. We may need to limit the "reasoning depth" applied to secondary context files.
