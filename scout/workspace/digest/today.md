### STALE: Can LLM Agents Know When Their Memories Are No Longer Valid?
**Source**: https://arxiv.org/abs/2605.06527v1
**Summary**: This paper introduces STALE, a benchmark to evaluate if LLM agents can update memories when new, implicitly conflicting evidence emerges (Implicit Conflict), instead of just testing static fact retrieval. It reveals current frontier models struggle significantly with state resolution, premise resistance, and implicit policy adaptation, achieving at best 55.2% accuracy.
**Implication**: Current memory systems in agents like may-agent might fail if user preferences or states change implicitly over time without explicit cancellation. This highlights a need for "state-aware" memory management that can contextually infer when older facts are invalidated by newer ones.
**KB**: KE-004 (updated)

### Process Matters more than Output for Distinguishing Humans from Machines
**Source**: https://arxiv.org/abs/2605.06524v1
**Summary**: The authors propose CogCAPTCHA30, evaluating the cognitive *process* rather than just the *output* to differentiate humans from AI agents. They found that process-level features provide a much stronger discriminative signal (AUC=0.88) even when task performance is matched between humans and AI.
**Implication**: As we build autonomous capabilities, generating human-like output might not be enough to bypass sophisticated anti-bot detection; the intermediate steps, timing, or interaction processes might be the key discriminators.
**KB**: KE-005 (new)

### Designing, Refining, and Maintaining Agent Skills at Perplexity
**Source**: https://research.perplexity.ai/articles/designing-refining-and-maintaining-agent-skills-at-perplexity
**Summary**: Discussion on how Perplexity manages agent skills over time, focusing on design, refinement, and maintenance of their skill systems.
**Implication**: Provides potential insights into robust skill management architectures that could be applied to May's agent skill system.
**KB**: KE-021 (new)

### Cyber.md: AI-native posture that speaks agent
**Source**: https://baz.co/resources/cyber-md-ai-native-posture-that-speaks-agent
**Summary**: Introduction of "Cyber.md", an AI-native posture framework designed specifically for agentic environments.
**Implication**: Explores standardizing agent posture and context communication, similar to our agent.md or context.md conventions.
**KB**: KE-022 (new)
