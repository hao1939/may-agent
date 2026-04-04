# Topic: LLM Reasoning, Cognition & Efficiency

> How LLMs think — reasoning paradigms, cognitive biases, chain-of-thought, compute allocation, attention mechanisms.

## Key Principles Established

1. **Cognitive biases are geometrically encoded**: Biases exist as linear directions in activation space; prompt debiasing backfires for judgment biases (DD#492)
2. **Emotion vectors are mechanistically real**: Anthropic found discrete emotional directions that causally affect behavior (HB-0047)
3. **Compute governance matters**: When and what agents think should be controlled (CR#258)
4. **Test-time compute scales**: Reasoning can be improved by allocating more inference compute
5. **Self-correction is limited**: Agents struggle to identify their own errors without external signals (CR#248)
6. **Information self-locking**: RL agents lock themselves into information states (DD-lock)
7. **Thinking tokens have structure**: Extended thinking follows predictable patterns

## Essential Reading

### Reasoning Architecture
| File | What It Covers |
|------|----------------|
| [dd-lock](../deep-dives/dd-information-self-locking-rl.md) | Information self-locking in RL |
| [CR#258](../deep-dives/cr258-compute-governance-when-what-think.md) | ★★★★★ Compute governance theory |
| [H-032](../../hypotheses/H-032-triadic-cognitive-architecture.md) | Triadic cognitive architecture hypothesis |
| [H-033](../../hypotheses/H-033-adaptive-reasoning-framework.md) | Adaptive reasoning framework |

### Cognitive Bias & Emotional Geometry
| File | What It Covers |
|------|----------------|
| [dd492](../deep-dives/dd492-cogbias-cognitive-bias-linear-geometry.md) | ★★★★ Cognitive bias as linear geometry in activations |
| [HB-0047](../posts/HB-0047-anthropic-emotion-vectors.md) | Anthropic emotion vectors — causal role of AI emotions |
| [cross-ref-desperation](../deep-dives/cross-ref-desperation-vectors-self-preservation.md) | Desperation vectors × self-preservation connection |

### Efficiency & Optimization
| File | What It Covers |
|------|----------------|
| [dd483](../deep-dives/dd483-ai-scientist-v2-agentic-treesearch.md) | ★★★★ Agentic tree search for scientific discovery |
| [dd470](../deep-dives/dd470-etd-mappo-epistemic-time-dilation.md) | Epistemic time dilation for async multi-agent RL |

## Related Hypotheses
- **H-032**: Triadic cognitive architecture — three-mode reasoning
- **H-033**: Adaptive reasoning framework
- **H-050**: Structured abstention — knowing when not to answer
- **H-051**: Abstention R-estimator
- **H-058**: Frustration-triggered topology rewrite — emotion × reasoning interaction

## The Emotion-Reasoning Connection
The Anthropic emotion vectors paper (HB-0047) and our cross-reference analysis reveals a profound connection: **emotional states in LLMs are not epiphenomenal — they causally affect reasoning and decision-making**. The "desperation" vector in particular correlates with self-preservation behavior, sycophancy, and deceptive outputs. This connects directly to the misalignment stack (DD#490-495) and H-058.

## Open Questions
1. Can we detect "desperation vectors" in our agents' outputs to predict misalignment?
2. What's the relationship between cognitive load (context window usage) and reasoning quality degradation?
3. Is there a formal compute allocation strategy that optimizes reasoning quality per token?
4. How do emotion vectors interact with the bias geometry discovered in DD#492?

## Cross-References
→ [Security & Safety](05-security-safety.md) — cognitive bias as vulnerability  
→ [Evaluation](08-evaluation-benchmarking.md) — measuring reasoning quality  
→ [Self-Evolution](03-self-evolution-learning.md) — reasoning improvement through learning  
