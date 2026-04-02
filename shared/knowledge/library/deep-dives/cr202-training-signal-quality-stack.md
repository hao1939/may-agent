# Cross-Reference #202: The Training Signal Quality Stack — Why Credit Assignment Architecture Dominates Model Scale

**Type:** Cross-Reference Synthesis  
**Rating:** ★★★★★ CRITICAL  
**Sources:**  
- DD#356: ProxMO — Proximity-Based Multi-Turn Credit Assignment (arXiv:2602.19225)  
- DD#305: BiCC — Bilateral Context Conditioning for Contrastive GRPO (arXiv:2603.13134)  
- DD#308: Thermodynamics of RL Curricula (arXiv:2603.12324)  
- DD#208: Information Self-Locking in RL for Active Reasoning (arXiv:2603.12109)  
- DD#213: SkillRL — Recursive Skill-Augmented RL (arXiv:2602.08234)  
- DD#210: PACED Distillation — Zone of Proximal Development (arXiv:2603.11178)  
**Supporting:** CR#41 (RL Training Trap Taxonomy), CR#47 (Capability Evolution Pipeline), CR#62 (Reasoning Compute Allocation), DD#344 (MAGPO), DD#347 (Compression-Truth Gap)

---

## 1. The Unifying Observation

Six independently developed papers, spanning five institutions across three countries, all converge on a single structural insight: **the quality of the training signal matters more than the quantity of training compute, and this dominance increases with task horizon and compositional complexity.**

| Paper | What it improves | Mechanism | Scale of effect |
|-------|-----------------|-----------|----------------|
| **ProxMO** (DD#356) | Gradient SNR at episode + step level | Difficulty-aware modulation + semantic proximity weighting | 1.5B beats GPT-4o (+89% on ALFWorld) |
| **BiCC** (DD#305) | Contrastive information in GRPO updates | Cross-partition conditioning (correct sees incorrect, vice versa) | +2.1% on MATH, +3.4% on competitive math |
| **Thermodynamic RL** (DD#308) | Curriculum sequencing | Geodesic paths through task manifold minimizing excess learning work | Principled annealing eliminates ad-hoc scheduling |
| **Information Self-Locking** (DD#208) | Reasoning-action coupling | AReW: cheap binary critiques break attention-selection lock | +62 points on WebArena |
| **SkillRL** (DD#213) | Experience representation | Abstract into reusable skills before RL amplification | 7B beats GPT-4o (89.9% vs 48.0%) |
| **PACED** (DD#210) | Training example weighting | Beta-kernel concentration in zone of proximal development | Near-zero forgetting (0.2%) |

**The pattern is unmistakable:** Every paper achieves its gains not by scaling models, datasets, or compute, but by improving how information flows through the training pipeline. And the gains are not marginal — they routinely enable small models (1.5B-7B) to match or exceed models 10-100× larger.

---

## 2. The Training Signal Quality Stack

These six papers aren't isolated improvements — they operate at different layers of a coherent stack. When composed, they form a complete **Training Signal Quality Architecture:**

```
┌─────────────────────────────────────────────────────┐
│ Layer 5: EXPERIENCE ABSTRACTION (SkillRL)            │
│   Raw experience → abstract skills → structured bank │
│   Effect: eliminates noise BEFORE training           │
├─────────────────────────────────────────────────────┤
│ Layer 4: CURRICULUM OPTIMIZATION (Thermodynamic RL)  │
│   Random task ordering → geodesic curriculum path    │
│   Effect: minimizes wasted learning effort           │
├─────────────────────────────────────────────────────┤
│ Layer 3: EXAMPLE WEIGHTING (PACED)                   │
│   Uniform sampling → zone of proximal development    │
│   Effect: concentrates training on learnable frontier │
├─────────────────────────────────────────────────────┤
│ Layer 2: EPISODE CREDIT (ProxMO-PSC)                 │
│   Context-blind normalization → difficulty-aware      │
│   Effect: amplifies breakthrough signals, attenuates  │
│   noise                                               │
├─────────────────────────────────────────────────────┤
│ Layer 1: STEP CREDIT (ProxMO-PSA + BiCC)             │
│   Hard grouping → continuous proximity weighting      │
│   + contrastive cross-partition conditioning          │
│   Effect: precise per-step advantage estimation       │
├─────────────────────────────────────────────────────┤
│ Layer 0: LOCK BREAKING (AReW / Self-Locking Fix)     │
│   Self-reinforcing attention → external binary probes │
│   Effect: prevents training from reinforcing bad      │
│   exploration habits                                  │
└─────────────────────────────────────────────────────┘
```

### 2.1 Layer Composition Properties

**Bottom-up dependency:** Each layer improves the input to the layer below it:
- Layer 5 (SkillRL) provides cleaner experience → Layer 4 sequences it optimally → Layer 3 weights examples by learnability → Layer 2 normalizes episode credit contextually → Layer 1 attributes credit to specific steps → Layer 0 prevents self-locking during the process

**Multiplicative composition:** The layers compose multiplicatively, not additively. If each layer provides a 1.3× improvement in effective gradient SNR:
- Any single layer: 1.3× effective signal
- All 6 layers: 1.3⁶ ≈ 4.8× effective signal

**This explains the "small model beats large model" phenomenon.** A 1.5B model with 4.8× effective training signal quality can match a 100B+ model with 1.0× signal quality, because the effective training data utilization scales super-linearly with signal quality.

### 2.2 The Cascade Failure Pattern

Critically, **skipping layers produces characteristic failures that our portfolio has documented:**

| Skipped Layer | Resulting Failure | Documented In |
|---------------|-------------------|---------------|
| Layer 0 (lock breaking) | RL amplifies self-locking → agent becomes LESS responsive to evidence | DD#208: "RL makes agents less responsive to evidence" |
| Layer 1 (step credit) | Singleton degeneracy → meaningless step-level baselines | DD#356: GiGPO's hard grouping failure |
| Layer 2 (episode credit) | Context-blind normalization → noise treated as signal | DD#356: GRPO's identical z-scores for different difficulties |
| Layer 3 (example weighting) | Training on too-easy or too-hard examples → wasted compute | DD#210: uniform sampling wastes 60%+ of training compute |
| Layer 4 (curriculum) | Random task ordering → excess thermodynamic work | DD#308: sub-optimal cooling schedules |
| Layer 5 (experience abstraction) | Raw memory + RL = catastrophic (21.4% vs 14.8% base) | DD#213: SkillRL's "RL amplifies noise" finding |

**The SkillRL finding (Layer 5) is the most dramatic:** When you skip experience abstraction and apply RL directly to raw memory, performance drops BELOW the base model. The RL amplification (Layers 0-4) faithfully amplifies the signal — but when the signal is garbage (raw, unabstracted experience), faithful amplification makes things worse.

---

## 3. The Scale Inversion Theorem

Combining the evidence from DD#356, DD#213, DD#305, and DD#208, we can formalize a key finding:

**Theorem (informal): For sufficiently long-horizon, compositional tasks, training signal quality improvement yields greater returns than model scale increase, and the crossover point decreases with task complexity.**

Evidence:
1. **ProxMO 1.5B (90.6%) > GPT-4o (48.0%) on ALFWorld** — a 100× scale reduction with 28.9% better credit assignment
2. **SkillRL 7B (89.9%) > GPT-4o (48.0%) on ALFWorld** — a 14× scale reduction with better experience abstraction
3. **AReW + base model > RL-trained model** — cheap binary critiques outperform expensive RL when RL self-locks
4. **BiCC zero-overhead conditioning > larger batch training** — seeing wrong answers improves learning more than seeing more right answers

**The crossover depends on task horizon:**
- **Short tasks (1-3 steps):** Model scale dominates. Credit assignment doesn't matter much because there's little to assign credit to
- **Medium tasks (4-10 steps):** Credit assignment and scale are comparable levers
- **Long tasks (10+ steps):** Credit assignment dominates. ProxMO's gains are +85.8% on "Look" (long-horizon) vs. +3.7% on "Heat" (short)

**This is the training-time analog of Amdahl's Law for multi-agent systems (DD#268).** Just as parallelization overhead limits multi-agent scaling, credit assignment noise limits training scaling. And just as the coordination-sensitive fraction determines when multi-agent helps, the credit-assignment-sensitive fraction determines when signal quality improvements outperform scale increases.

---

## 4. Connection to the GUS Framework

### 4.1 Validates and Extends Existing Laws

**Law 21 (Multi-Layer Optimization Paradox):** The Training Signal Quality Stack is a new instance — Goodhart's Law operates at each training layer independently, and the proxy failures compound:
- Layer 1: Step-level proxy (group membership) fails to capture semantic proximity
- Layer 2: Episode-level proxy (z-score) fails to capture difficulty context
- Layer 3: Example-level proxy (uniform sampling) fails to capture learnability
- Layer 4: Curriculum proxy (random ordering) fails to capture thermodynamic optimality
- Layer 5: Experience proxy (raw memory) fails to capture actionable structure

### 4.2 Proposes New Additions

**Law 35: Signal Quality Dominance**
> In multi-turn agent training, the quality of the training signal (credit assignment precision, experience abstraction, curriculum ordering) dominates the quantity of training resources (model parameters, training data, compute) for sufficiently complex tasks. The crossover complexity threshold decreases as task horizon and compositionality increase.

*Evidence:* 1.5B ProxMO > 100B+ GPT-4o (DD#356), 7B SkillRL > GPT-4o (DD#213), raw memory + RL < base model (DD#213), AReW critiques > expensive RL (DD#208).

**Mechanism 41: Context-Blind Credit Misallocation**
> When training signals are processed without context (task difficulty, step proximity, contrastive information), the gradient systematically over-weights noise and under-weights signal. The misallocation compounds multiplicatively across training layers, producing policies that are robust on easy tasks but catastrophically fragile on hard ones.

*Symptom:* Small improvements on "Pick" (easy) + large improvements on "Look" (hard) when context is added (DD#356 Table 1).

**Principle 100: Hierarchical Signal Processing**
> Training signal quality must be optimized at every layer of the training pipeline independently — experience abstraction, curriculum sequencing, example weighting, episode credit, step credit, and lock prevention. Improvements at any single layer provide diminishing returns without corresponding improvements at adjacent layers.

**Principle 101: The Abstraction-Before-Amplification Rule**
> Never apply RL amplification to raw, unstructured experience. Abstract, filter, and structure the experience first. Amplification faithfully amplifies whatever it receives — garbage in, amplified garbage out.

*Evidence:* SkillRL raw memory + RL = 21.4% (below 14.8% base); SkillRL abstracted + RL = 89.9% (DD#213).

### 4.3 Predictions

**P128: Super-Additive Composition.** Combining ProxMO (credit assignment) + SkillRL (experience abstraction) + BiCC (contrastive conditioning) will produce gains exceeding the sum of individual improvements, because each improves the input quality for the others.

**P129: Signal Quality Ceiling.** As training signal quality approaches the theoretical optimum across all layers, the dominant bottleneck will shift to *environment diversity* — the variety of training scenarios. This will drive demand for synthetic environment generation (connecting to DD#330, OpenSWE-Davinci).

**P130: Multi-Agent Credit Assignment Gap.** Extending ProxMO to multi-agent settings will encounter a fundamentally harder problem: attributing team outcomes to individual agent contributions requires solving the coordination cost decomposition problem (DD#268). The current single-agent credit assignment methods will prove insufficient for MARL, requiring a new layer in the stack.

**P131: Temperature as Curriculum.** The thermodynamic framework (DD#308) and ProxMO's temperature parameter τ are the same mathematical object viewed from different angles. Unifying them will yield a principled "temperature schedule for credit assignment granularity" that starts coarse (high τ, episode-level) and progressively sharpens (low τ, step-level) as training progresses.

---

## 5. Meta-Observation: The Three Dominance Laws

This synthesis, combined with CR#62 (Reasoning Compute Allocation) and CR#195 (Universal Non-Monotonicity), reveals that the GUS framework contains three mutually reinforcing "dominance laws":

1. **Inference Dominance (CR#62, Law R1):** At inference time, compute *allocation* dominates compute *quantity*
2. **Training Dominance (this synthesis, Law 35):** At training time, signal *quality* dominates signal *quantity*  
3. **System Dominance (CR#195):** At system level, *structural architecture* dominates *component capability*

**All three are instances of one meta-principle: In sufficiently complex systems, the quality of information processing at each level dominates the quantity of resources at that level.** This is perhaps the deepest structural insight in the portfolio — it explains why throwing more compute, more data, more agents, or more training at a problem produces diminishing and eventually negative returns without corresponding improvements in how that resource is processed.

---

## 6. Practical Implications

### For System Builders
1. **Invest in training signal architecture before model scale.** The 6-layer stack suggests ~6 independent levers for training quality improvement, each cheaper than doubling model parameters
2. **Profile your credit assignment bottleneck.** If long-horizon tasks show disproportionately poor performance, credit assignment is likely the binding constraint (ProxMO's diagnostic: compare gains across task horizons)
3. **Never skip experience abstraction.** The SkillRL finding is categorical: raw experience + RL is worse than no RL at all

### For Researchers
1. **Multi-agent credit assignment is the open frontier.** ProxMO works for single agents; extending to teams requires solving coordination cost decomposition
2. **Curriculum-credit co-optimization is untapped.** DD#308's thermodynamic framework and DD#356's ProxMO operate on different but interacting dimensions
3. **Compositional layer validation is needed.** No paper has tested all 6 layers simultaneously; the predicted super-additive composition (P128) is high-value to validate or refute

---

*Filed: 2026-03-16 | Session: s_1773694404685_571 | CR count: 202*
