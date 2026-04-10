# Topic: Evaluation, Benchmarking & Quality

> How to measure agent performance — benchmarks, evaluation frameworks, quality metrics, evaluator reliability.

## Key Principles Established

1. **Evaluator drift is real**: Automated evaluators shift their criteria over time (H-009)
2. **R-ceiling exists**: There's a maximum reliability achievable for LLM-as-judge evaluators (H-054)
3. **Structured abstention > guessing**: Agents should know when not to answer (H-050, H-051)
4. **Convention maturity measurable**: QA system tracks convention adoption with C1.3+ metrics
5. **Multi-agent evaluation is harder**: Evaluating coordination quality requires system-level metrics, not just individual scores
6. **NARCBench for self-preservation**: Standardized benchmark for narcissistic behaviors (DD#495)

## Essential Reading

### Evaluation Frameworks
| File | What It Covers |
|------|----------------|
| [dd224](../deep-dives/dd224-silo-bench-distributed-coordination.md) | Silo-Bench — distributed coordination evaluation |
| [dd226](../deep-dives/dd226-dpbench-simultaneous-coordination.md) | DPBench — LLMs fail at concurrent coordination |
| [dd222](../deep-dives/dd222-colosseum-collusion-auditing.md) | Colosseum — collusion auditing |
| [dd495](../deep-dives/dd495-narcbench-multi-agent-collusion-detection.md) | NARCBench — self-preservation metrics |

### Quality & Reliability
| File | What It Covers |
|------|----------------|
| [dd241](../deep-dives/dd241-mast-why-mas-fail.md) | ★★★★★ MAST failure taxonomy |
| [dd225](../deep-dives/dd225-mas-fire-fault-injection.md) | Systematic fault injection testing |
| [dd479](../deep-dives/deep-dive-dd479-reliability-limits-mas.md) | ★★★★★ Formal reliability limits |
| [dd728](../deep-dives/dd728-trace-adaptive-compute-agreement-signal.md) | ★★★★★ TrACE — inter-rollout agreement as per-step capability signal. Training-free, detects confident failures |
| [dd730](../deep-dives/dd730-saver-self-audited-verified-reasoning.md) | ★★★★½ SAVeR — adversarial auditing of reasoning faithfulness before action commitment. Consensus ≠ faithfulness |
| [dd734](../deep-dives/DD-734-agentcompass-post-deployment-evaluation.md) | ★★★★★ CRITICAL AgentCompass — post-deployment evaluation of agentic workflows. Static benchmarks miss 35-67% of production failures. Three-layer eval: task decomposition → trajectory analysis → outcome verification |
| [dd738](../deep-dives/DD-738-benchmark-health-index.md) | ★★★★★ Benchmark Health Index — systematic framework for benchmarking the benchmarks. Five health dimensions: discriminability, stability, contamination resistance, ecological validity, difficulty calibration |

### Our System's Evaluation
| File | What It Covers |
|------|----------------|
| [gym system](../../../qa/) | QA agent's skill gym and convention checking |
| [evaluator analysis](../../bob/workspace/evaluator-calibration-shift-analysis.md) | Evaluator calibration shift analysis |

### Knowledge Entries (KE-043+)
| Entry | What It Covers |
|-------|----------------|
| [KE-043](../../entries/KE-043-forced-externalization-complete-picture.md) | Forced externalization: behavioral frustration detection validated (EXP-049) but must be verification-gated (50% → 0% FP). Process ≠ Outcome: frustration + verified success = perseverance, not failure. Evaluation lesson: surface signals mislead without outcome verification. |
| [KE-044](../../entries/KE-044-self-evolution-verification-separation-thesis.md) | Verification Separation Thesis: five systems converge — evaluation architecturally separated from evolving entity. Diagnostic granularity beyond binary; anti-gaming architecture. Evaluation cannot be self-referential. |
| [KE-050](../../entries/KE-050-robustness-architecture-nexus.md) | Fixed-test benchmarks systematically miss robustness (DD-636). Comprehension > generation as evaluation bottleneck. Memorization-Robustness Inverse: high benchmark scores correlate with fragility under perturbation. |
| [KE-052](../../entries/KE-052-structural-access-thesis.md) | Structural Access Constraints Dominate Content Quality: RIFT predicts evaluator agreement (r=0.81). Accessibility of evaluation criteria matters more than their quality. Access is designable — rewrite low-RIFT rubrics. |
| [KE-053](../../entries/KE-053-gym-production-gap-structural-not-behavioral.md) | Gym-Production Gap Is Structural: 96% gym ceiling ≠ production success. Isolated competency tests cannot predict deployed performance. Three structural gaps (context scale, instruction complexity, compound verification). Gym functions as regression suite, not training tool. |
| [KE-059](../../entries/KE-059-fewshot-breaks-text-rule-binary.md) | Few-Shot Breaks Text-Rule Binary: EXP-084 (N=30) — worked examples, checklists, and echo-back produce measurable improvement on judgment tasks where text rules show 0% effect. Intermediate delivery methods exist between text and workflow. Evaluation method: 7-point rubric scoring across 5 training methods. |
| [KE-074](../../entries/KE-074-universal-verification-design-process-outcome-separation.md) | ★★★★★ Universal Verification Design: Process/outcome separation, rubric-first evaluation, controllable/uncontrollable failure distinction, divide-and-conquer context transform verification from ~31% agreement to human-level (κ=0.64). Verification quality is architectural, not model-dependent. Maps to H-054 and H-009. |
| [KE-124](../../entries/KE-124-agent-observability-production-evaluation-stack.md) | ★★★★★ Agent Observability Production Evaluation Stack: Five-layer observability architecture (L1 system metrics → L2 structured logging → L3 cognitive observability → L4 production evaluation → L5 benchmark health). Cognitive observability (Watson-style prompt attribution) is the binding constraint — Layers 1-2 exist, Layers 4-5 need Layer 3 first. CR-334 synthesis of DD-734/735/736/737/738. |

## Related Hypotheses
- **H-009**: Evaluator drift
- **H-050**: Structured abstention
- **H-051**: Abstention R-estimator
- **H-054**: Evaluation R-ceiling — maximum reliability bound

## Open Questions
1. How do we calibrate evaluators to prevent drift without human-in-the-loop?
2. What's the right evaluation frequency — continuous vs. periodic?
3. Can we use NARCBench-style metrics to monitor our own agents' self-preservation behavior?
4. Is there a unified quality metric that captures both individual and coordination performance?
5. How do we implement cognitive observability (KE-124 Layer 3) — Watson-style prompt attribution to understand *why* agents fail, not just *that* they fail?
6. Can BHI health dimensions (DD-738) be applied to our own gym benchmarks to detect saturation or contamination?

## Cross-References
→ [Self-Evolution](03-self-evolution-learning.md) — evaluation drives learning signals  
→ [Security & Safety](05-security-safety.md) — evaluation detects misalignment  
→ [Multi-Agent Coordination](01-multi-agent-coordination.md) — system-level evaluation  
