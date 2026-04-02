# Cross-Reference Synthesis #47: The Capability Evolution Pipeline — Learning Without Forgetting, Evolving Without Destroying

## Papers Integrated
1. **arXiv:2602.08234** — SkillRL: Recursive Skill-Augmented RL (Xia et al., UCSC/UIUC/NEC/ByteDance)
2. **arXiv:2603.08647** — Grow, Don't Overwrite: Function-Preserving Expansion (Adila et al., Google Research)
3. **arXiv:2603.11178** — PACED: Beta-Kernel Distillation Curriculum (Deep-Dive #210)
4. **arXiv:2603.12109** — Information Self-Locking in RL (Deep-Dive #200)
5. **arXiv:2603.12011** — Can RL Improve Generalization of LLM Agents? (Deep-Dive, Cross-Ref #41)

## Supporting Cross-References
- Cross-Ref #41: RL Training Trap Taxonomy
- Cross-Ref #44: Verification Lifecycle Pipeline
- Cross-Ref #46: Cognitive Evolution Stack
- SkillsBench (community validation: curated skills +16.2pp, self-generated -1.3pp)

---

## 1. The Central Question

**How can an LLM agent improve through experience without destroying what it already knows?**

Five independent papers attack different aspects of this question. Their convergence reveals a complete 4-phase pipeline for safe capability evolution — and three critical failure modes that arise when any phase is skipped.

## 2. The Four-Phase Capability Evolution Pipeline

```
Phase 1: EXPAND          Phase 2: ABSTRACT       Phase 3: FORM          Phase 4: EVOLVE
(Grow Don't Overwrite)   (SkillRL Distillation)  (PACED + Cold-Start)   (SkillRL Recursive RL)

Add capacity without     Convert raw experience  Transfer abstracted     Co-evolve skills and
destroying existing      into structured skills  knowledge into new      policy through targeted
capabilities             (10-20× compression)    capacity (ZPD-targeted) failure-driven refinement

[Mathematical identity   [Differential failure   [Beta-kernel weighting  [GRPO + periodic skill
 at initialization]       processing]             for optimal learning]   library expansion]
```

### Phase 1: Capacity Expansion (Grow, Don't Overwrite)
**Problem**: Fixed-capacity models face a zero-sum tradeoff between old and new knowledge.
**Solution**: Duplicate MLP up-projection weights with compensatory 1/k scaling on down-projection. Mathematically identical at initialization, adds capacity for new learning.
**Key property**: Function-preserving — the expanded model starts as the exact same function, so all prior capabilities are guaranteed preserved.

### Phase 2: Experience Abstraction (SkillRL)
**Problem**: Raw trajectories are noisy, verbose, and TOXIC to RL training (MemRL: 21.4% < 14.8% base).
**Solution**: Differential processing — successes → strategic patterns, failures → counterfactual lessons. Organize into hierarchical SkillBank (general + task-specific).
**Key property**: 10-20× token compression while ENHANCING utility. Abstraction transforms noise into signal.

### Phase 3: Capability Formation (PACED + SkillRL Cold-Start)
**Problem**: Agents can't effectively use skills they haven't been trained on. Naive distillation causes catastrophic forgetting (0.2% with PACED vs severe with standard).
**Solution**: Two complementary approaches:
- PACED's Beta-kernel weighting concentrates training on the "zone of proximal development" — items the student can almost do but hasn't mastered
- SkillRL's cold-start SFT teaches HOW to retrieve, interpret, and apply skills
**Key property**: Minimax-robust — 91%+ efficiency even under 35% model misspecification.

### Phase 4: Recursive Evolution (SkillRL RL Loop)
**Problem**: Static skill libraries can't anticipate all scenarios. As agents improve, they encounter new failure modes.
**Solution**: After each validation epoch, analyze failures against current SkillBank. Generate new skills covering gaps. Co-evolve skills and policy through GRPO.
**Key property**: Virtuous cycle — better agent → new challenges → skill growth → further improvement.

## 3. Three Failure Modes When Phases Are Skipped

### Failure Mode 1: Skip Phase 1 (No Capacity Expansion) → Catastrophic Forgetting
Standard SFT causes WinoGrande collapse to ~0% on tasks with large domain shifts. Without dedicated new capacity, learning new skills ERASES old ones. This is not a risk — it's the default outcome.

**Evidence**: "Grow, Don't Overwrite" shows standard fine-tuning destroys commonsense reasoning on 4/4 tested tasks. PACED achieves only 0.2% forgetting precisely BECAUSE it manages the learning curriculum to stay in the ZPD.

### Failure Mode 2: Skip Phase 2 (No Abstraction) → RL Training Trap
MemRL (raw trajectories + RL) achieves 21.4% on ALFWorld — WORSE than the 14.8% untrained base. Information Self-Locking explains why: raw trajectory context narrows the action-selection distribution (AS), which reduces the benefit of new information (BT), trapping the agent in low-information regimes.

**The SkillRL Paradox**: RL amplifies whatever signal-to-noise ratio exists in context. Raw trajectories = high noise → RL amplifies noise → catastrophic degradation. Distilled skills = high signal → RL amplifies skill → dramatic improvement.

**Generalization evidence**: Can RL Improve Generalization? (2603.12011) finds RL helps in-domain but HURTS cross-domain. This is the Phase 2 failure — RL overfit to training environment patterns because the "skills" it learned were actually environment-specific trajectories, not abstract principles.

### Failure Mode 3: Skip Phase 3 (No Capability Formation) → Skill-Utilization Gap
SkillRL explicitly notes that "simply providing skills to an unchanged model yields limited benefit." Without cold-start SFT, the model doesn't know HOW to interpret skill structures, retrieve relevant skills, or apply them in decision-making. The Cognitive Evolution Stack (Cross-Ref #46) calls this "Domain Lock-In" — the agent has the knowledge but can't use it at the appropriate cognitive level.

**Evidence**: SkillsBench confirms — AI-generated skills HURT performance (-1.3pp) because agents can't utilize them. Only human-curated skills help (+16.2pp). The gap isn't skill quality — it's skill utilization capability.

## 4. The Composition Principle

The four phases compose non-linearly. Each phase depends on the previous:

```
                    Without Phase 1     Without Phase 2     Without Phase 3
Phase 4 (Evolve)    Forgetting          MemRL trap          Skill-Utilization Gap
Phase 3 (Form)      Forgetting          Knowledge noise     Baseline only
Phase 2 (Abstract)  N/A (no capacity)   N/A                 N/A
Phase 1 (Expand)    N/A                 N/A                 N/A
```

**Critical insight**: The pipeline must run IN ORDER. You cannot skip to Phase 4 (the most exciting part — recursive evolution!) without first laying the foundation of capacity, abstraction, and formation.

## 5. Mapping to Our Architecture

| Pipeline Phase | Our System Current State | Gap |
|---|---|---|
| Phase 1: Expand | We use different models per agent (implicit expansion) | No within-model expansion for capability specialization |
| Phase 2: Abstract | Error Logs capture failures; AGENTS.md abstracts guidance | Error Logs are raw, not distilled into counterfactual lessons |
| Phase 3: Form | AGENTS.md serves as cold-start context | No formal capability formation training |
| Phase 4: Evolve | Manual skill updates by humans | No automated failure-driven skill evolution |

### Actionable Improvements
1. **Error Log Distillation**: Transform raw error logs into structured counterfactuals (failure point, flawed reasoning, corrective principle) — implements Phase 2 for our system
2. **AGENTS.md as SkillBank**: Reorganize AGENTS.md into general skills (always loaded) + task-specific skills (loaded per task type) — we partially do this already
3. **Skill Utilization Testing**: Before deploying new skills/AGENTS.md updates, verify agents can USE them effectively — implements Phase 3 quality gate
4. **Failure-Driven Skill Updates**: After task failures, analyze whether existing AGENTS.md guidance was insufficient and update — implements Phase 4 at human-in-the-loop speed

## 6. New Laws and Predictions

### Proposed: The Abstraction Gate Law (Law 18 candidate)
**"Experience must pass through an abstraction layer before entering any learning loop. Raw experience + amplification (RL, iteration, memory accumulation) produces catastrophic degradation, not improvement."**

Evidence from 5 independent papers:
1. MemRL degradation (21.4% < 14.8% base) — SkillRL
2. Self-generated skills hurt (-1.3pp) — SkillsBench
3. Oracle context hurts 3/5 models — Scaffolding Paradox
4. RL hurts cross-domain generalization — Can RL Improve Generalization
5. Information Self-Locking traps agents in low-info regimes — Self-Locking paper

### Testable Predictions
1. **Systems implementing all 4 phases will show monotonically improving performance over evolution cycles, while systems skipping any phase will plateau or degrade by cycle 3-5**
2. **The abstraction quality (measured by information density in bits/token, per PlugMem) will be the strongest predictor of RL training success — stronger than model size, training data quantity, or reward quality**
3. **Function-preserving expansion + SkillRL will achieve PACED-level forgetting rates (≤0.2%) while matching full fine-tuning on new tasks — combining spatial separation (Grow) with temporal separation (PACED)**

## 7. The Meta-Pattern

All five papers independently arrive at the same meta-principle:

**"Separation is the antidote to catastrophic failure."**

- Grow, Don't Overwrite: Separate old and new parameters spatially
- SkillRL: Separate raw experience from actionable knowledge through abstraction
- PACED: Separate easy and hard learning targets temporally through curriculum
- Information Self-Locking: Separate action selection from benefit of information
- RL Generalization: Separate in-domain patterns from transferable principles

The Capability Evolution Pipeline is, at its core, an architecture for **maintaining separations** that catastrophic failure modes exploit when collapsed.

---

*Cross-Reference Synthesis #47. Scout workspace. 2026-05-15. ~8.5KB.*
*Integrates 5 primary papers + 4 supporting cross-references into the Capability Evolution Pipeline.*
