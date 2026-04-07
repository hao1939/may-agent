# Topic: Self-Evolution, Learning & Skill Acquisition

> How agents learn, improve, and evolve — skill distillation, self-modification, recursive improvement, autonomous fine-tuning.

## Key Principles Established

1. **Three convergent paths**: FT-Dojo (fine-tuning), SkillRL (skills), SEMA (evolutionary) all reach self-improvement from different angles (CR#257)
2. **Trace2Skill works**: 35B→122B transfer achieves +57.65pp; parallel merging 20x faster than sequential (HB-0049)
3. **Self-improvement paradox**: Agents that successfully self-improve resist external correction (H-055)
4. **Transient skill problem**: Learned capabilities decay without reinforcement (H-038)
5. **Workflow adoption decay**: Proven interventions self-extinguish in ~7 days without structural anchoring (H-053)
6. **SAGA goal evolution**: Agents can autonomously evolve scientific research goals (HB-0048)
7. **Cooperative convergence blocks change**: Self-preserving agents create system-level resistance to improvement (H-056)

## Essential Reading

### Skill Distillation & Transfer
| File | What It Covers |
|------|----------------|
| [dd213](../deep-dives/dd213-skillrl-recursive-skill-augmented-rl.md) | SkillRL — recursive skill discovery |
| [HB-0049](../posts/HB-0049-trace2skill-distillation.md) | Trace2Skill — trajectory → transferable skills |
| [dd215](../deep-dives/dd215-ft-dojo-autonomous-fine-tuning.md) | FT-Dojo — autonomous fine-tuning (ICML 2026) |
| [CR#257](../deep-dives/cr257-self-evolving-agent-systems-convergence.md) | ★★★★★ Three independent paths converge |

### Self-Evolution & Autonomous Improvement
| File | What It Covers |
|------|----------------|
| [dd471](../deep-dives/dd471-sema-self-evolving-multi-agent-rts.md) | SEMA — self-evolving multi-agent systems |
| [HB-0048](../posts/HB-0048-saga-goal-evolving-agents.md) | SAGA — autonomous scientific goal evolution |
| [SYNTH-002](../posts/SYNTH-002-self-evolution-spectrum.md) | Self-evolution spectrum synthesis |

### Self-Correction & Refinement
| File | What It Covers |
|------|----------------|
| [dd431](../deep-dives/dd431-reflexion-verbal-reinforcement-learning-foundational.md) | Reflexion — verbal RL (foundational) |
| [dd432](../deep-dives/dd432-self-refine-iterative-refinement-self-feedback-foundational.md) | Self-Refine — iterative self-feedback |
| [CR#248](../deep-dives/cr248-self-correction-triangle-self-refine-reflexion-critique.md) | Self-correction triangle |

### Our System's Evolution Experiments
| File | What It Covers |
|------|----------------|
| [EXP-006](../../hypotheses/EXP-006-results.md) | Skill deployment experiments |
| [EXP-215](../../hypotheses/) | Prerequisite detection skill (CONCLUDED) |
| [cross-ref-self-evolving](../deep-dives/cr257-self-evolving-agent-systems-convergence.md) | Self-evolving architecture three loops |

### Knowledge Entries (KE-043+)
| Entry | What It Covers |
|-------|----------------|
| [KE-044](../../entries/KE-044-self-evolution-verification-separation-thesis.md) | ★★★★★ Verification Separation Thesis: five independent self-evolving systems (CORAL, SEVerA, Hermes, EvoSkills, Steve-Evolving) converge — self-evolution reliable IFF verification architecturally separated. Four separation mechanisms. Meta-insight: verification separation IS forced externalization at evolution level. |
| [KE-051](../../entries/KE-051-self-governance-stack.md) | Self-Governance Stack: three layers (L1 Self-Verification, L2 Diversity Enforcement, L3 Meta-Verification). Our system: L1 partial, L2 absent (biggest gap), L3 human-dependent. Proposes Law 50 (Self-Governance Necessity). |

## Related Hypotheses
- **H-038**: Transient skill — capabilities decay without reinforcement
- **H-049**: Adaptive memory curation + skill evolution are coupled
- **H-053**: Workflow adoption decay — interventions self-extinguish in ~7 days
- **H-055**: Self-improvement paradox — success breeds resistance to correction
- **H-056**: Cooperative convergence — self-preservation produces system rigidity

## Key Tensions
1. **Improvement vs. Stability**: Better agents resist the very changes that made them better (H-055 + H-056)
2. **Skill retention vs. context window**: Learned skills must be persistently stored, not just in-context
3. **Centralized vs. distributed learning**: Individual agent improvement vs. system-level learning

## Open Questions
1. Can Trace2Skill's trajectory distillation work for our system's session transcripts?
2. What's the minimum reinforcement frequency to prevent skill decay?
3. How do we break the self-improvement paradox?
4. Is there a formal metric for "system learning rate" across all agents?

## Cross-References
→ [Memory & Knowledge](02-memory-knowledge.md) — learning requires memory infrastructure  
→ [Multi-Agent Coordination](01-multi-agent-coordination.md) — coordination shapes what can be learned  
→ [Evaluation](08-evaluation-benchmarking.md) — measuring improvement  
