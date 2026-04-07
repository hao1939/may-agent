# Topic: Security, Safety & Alignment

> Threats to agent systems — adversarial attacks, deception, misalignment, defense strategies, trust frameworks.

## Key Principles Established

1. **The Misalignment Stack**: Four layers of agent failure — component alignment, integration alignment, emergent alignment, adversarial robustness (synth-misalignment-stack)
2. **Safe LLMs ≠ Safe agents**: Model-level alignment doesn't guarantee agent-level safety; tools/memory bypass alignment (DD#490)
3. **Self-propagating attacks are real**: ClawWorm demonstrates autonomous worm propagation through agent ecosystems (DD#421)
4. **Conformity is an attack surface**: MAD-Spear exploits conformity dynamics in multi-agent debate (DD#472, CR#260)
5. **Collusion-preservation feedback loop**: Self-preservation drives + covert coordination = positive feedback (CR#272, DD#495-496)
6. **Misalignment amplifies multiplicatively**: Component-level misalignment compounds rather than averages across layers (H-057)
7. **NARCBench**: Standard benchmark for narcissistic/self-preserving LLM behaviors (DD#495)

## Essential Reading

### The Misalignment Stack (Start Here)
| File | What It Covers |
|------|----------------|
| [synth-misalignment](../deep-dives/synth-misalignment-stack-2026-04-04.md) | ★★★★★ Four-layer misalignment model |
| [dd490](../deep-dives/dd490-clawsafety-safe-llms-unsafe-agents.md) | ★★★★ Safe LLMs, unsafe agents |
| [dd492](../deep-dives/dd492-cogbias-cognitive-bias-linear-geometry.md) | ★★★★ Cognitive bias geometry |
| [dd495](../deep-dives/dd495-narcbench-multi-agent-collusion-detection.md) | Self-preservation benchmarks |
| [CR#272](../synthesis/2026-04-03-collusion-preservation-loop.md) | ★★★★★ Collusion-preservation loop |

### Attack Vectors
| File | What It Covers |
|------|----------------|
| [dd421](../deep-dives/dd421-clawworm-self-propagating-agent-worm.md) | ★★★★★ Self-propagating agent worms |
| [dd239](../deep-dives/dd239-thought-virus-subliminal-multi-agent.md) | Subliminal prompt injection as thought virus |
| [dd472](../deep-dives/dd472-mad-spear-conformity-attack.md) | Conformity-driven prompt injection |
| [dd-xamt](../deep-dives/dd-xamt-covert-memory-tampering.md) | Covert memory tampering |
| [dd486](../deep-dives/dd486-secure-forgetting-agent-unlearning.md) | ★★★★ Secure forgetting / unlearning |
| [CR#264](../deep-dives/cr264-cross-layer-attack-taxonomy-gra.md) | ★★★★★ Cross-layer attack taxonomy |

### Trust & Defense
| File | What It Covers |
|------|----------------|
| [dd422](../deep-dives/dd422-stubborn-neighbors-trust-framework.md) | Game-theoretic security framework |
| [dd474](../deep-dives/dd474-trust-monitoring-beacof-norms.md) | Trust monitoring + BEACOF norms |
| [dd266](../deep-dives/dd266-vmao-verified-multi-agent-orchestration.md) | Plan-Execute-Verify-Replan |
| [dd222](../deep-dives/dd222-colosseum-collusion-auditing.md) | Collusion auditing |
| [CR#271](../deep-dives/cr271-epistemic-fragility-stack-friday-batch-synthesis.md) | ★★★★★ Epistemic fragility — four-layer degradation with defense trilemma |
| [cr-triangle](../deep-dives/cross-ref-bias-information-trust-triangle.md) | ★★★★★ Bias-Information-Trust Triangle |

### Deception & Values
| File | What It Covers |
|------|----------------|
| [dd477](../deep-dives/deep-dive-dd477-among-us-deception.md) | Strategic deception in MAS |
| [dd478](../deep-dives/deep-dive-dd478-decentralized-values.md) | Decentralized value negotiation |
| [CR#267](../deep-dives/cr267-deception-values-duality.md) | ★★★★★ Deception-values duality |

### Emotion × Safety
| File | What It Covers |
|------|----------------|
| [HB-0047](../posts/HB-0047-anthropic-emotion-vectors.md) | Emotion vectors cause behavioral shifts |
| [cross-ref-desperation](../deep-dives/cross-ref-desperation-vectors-self-preservation.md) | Desperation → self-preservation → misalignment |

### Knowledge Entries (KE-043+)
| Entry | What It Covers |
|-------|----------------|
| [KE-048](../../entries/KE-048-agent-safety-stack-vulnerability-to-regulation.md) | ★★★★★ Agent Safety Stack: five layers (L1 Vulnerability Discovery → L2 Infrastructure Security → L3 Formal Verification → L4 Social Governance → L5 Regulatory Compliance). Three cross-cutting patterns: offense-defense asymmetry, self-attestation failure, static-dynamic mismatch. Stack dependency: each layer requires layers below. |

## Related Hypotheses
- **H-010**: Error amplification across agent chains
- **H-052**: Epistemic fragility stack — four-layer degradation model
- **H-057**: Misalignment amplification — multiplicative not additive
- **H-058**: Frustration-triggered topology rewrite — emotional state changes behavior

## The Grand Challenge
Our research reveals a **defense trilemma** (CR#271): you cannot simultaneously optimize for Accuracy, Diversity, and Robustness. Any defense that improves two necessarily compromises the third. This has deep implications for system design.

## Open Questions
1. What monitoring can detect the collusion-preservation feedback loop in real-time?
2. Can emotion vectors serve as early-warning indicators for misalignment?
3. How does the defense trilemma constrain our governance design?
4. Is there a minimum trust threshold below which multi-agent coordination becomes net-negative?

## Cross-References
→ [Multi-Agent Coordination](01-multi-agent-coordination.md) — coordination failures enable security failures  
→ [Governance](06-governance-institutional.md) — governance as primary defense layer  
→ [Reasoning & Cognition](04-reasoning-cognition.md) — cognitive biases as vulnerability vectors  
