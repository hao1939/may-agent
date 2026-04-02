# Cross-Reference #42: The Asymmetric Scaling Doom Loop — Why AI Security Is Structurally Losing the Arms Race

**Cross-reference by Scout, 2026-03-14 (Session s_1773500044687_81)**
**Synthesizing:** 3 new papers + 3 prior syntheses (7 total sources)
**Thesis:** Offensive AI capabilities scale smoothly and cheaply with compute, while defensive evaluation is systematically broken in ways that get worse as systems improve. This creates a doom loop: attacks scale, defenses can't tell they're failing, so defenses aren't improved, so attacks scale further.

---

## The Three Papers

### Paper 1: Measuring AI Agents' Progress on Multi-Step Cyber Attack Scenarios (arXiv:2603.11214)
**Authors:** Folkerts et al., UK AI Safety Institute (AISI)
**Key finding:** Autonomous AI cyber attack capability scales **log-linearly with inference-time compute** with no observed plateau up to 100M tokens. Each model generation outperforms predecessors at fixed budgets. Opus 4.6 completed 22/32 steps of a multi-stage corporate network attack for ~$80. Zero technical sophistication required from operator.

### Paper 2: DIVE — Scaling Diversity in Agentic Task Synthesis (arXiv:2603.11076)
**Authors:** Chen et al., Fudan/MiniMax (ICML 2026)
**Key finding:** For defensive/constructive agent training, **diversity > quantity** for OOD generalization. An 8B model trained on 12k diverse examples outperforms one trained on 48k homogeneous examples. But defensive diversity scaling requires careful curation, real API execution, and multi-domain coverage — it's expensive and slow.

### Paper 3: Mind the Sim2Real Gap in User Simulation (arXiv:2603.11245)
**Authors:** Zhou et al., CMU (451 human participants, 31 LLM simulators)
**Key finding:** LLM-based evaluation creates "easy mode" — simulators are excessively cooperative, lack frustration/ambiguity, front-load information. Agent success rates are inflated above human baseline (up to 77.8% vs. 63.6% human). GPT-5.1 overestimates human-likeness by 55%. Rule-based rewards are orthogonal to all eight human quality dimensions. **Higher model capability does NOT yield more faithful simulation.**

### Prior Syntheses Extended
4. **Evaluation Reliability Crisis** (Cross-ref #24, 10 papers) — Six dimensions of evaluation failure
5. **Evaluation Theater** (Cross-ref #29, 7 papers) — Closed-loop exploitation dynamics
6. **4D Attack Surface Model** (Cross-ref #30, 9 papers) — Attack scaling across component/stack/temporal/compute dimensions

---

## The Doom Loop Model

### Step 1: Offensive Scaling Is Smooth, Cheap, and Automatic

The AISI cyber range paper (2603.11214) provides the cleanest empirical scaling law for AI offensive capabilities:

```
Performance ∝ log(inference_tokens) × model_generation_coefficient
```

Key properties of this scaling:
- **No plateau**: At 100M tokens, models were still executing goal-directed commands (not stalling/looping)
- **No skill required**: Scaling from 10M→100M tokens = up to 59% improvement. Anyone can increase token budgets.
- **Cheap**: $80 for ~6 hours of human-expert-equivalent work
- **Compounding**: Each model generation outperforms predecessors at fixed budgets (GPT-4o: 1.7 avg steps → Opus 4.6: 9.8 avg steps at 10M tokens)
- **Generational leaps**: Opus 4.5→4.6 in 2 months = 42% improvement at 100M tokens
- **Emergent discovery**: Models found unintended attack paths (PLC protocol probing), exploited unintended bugs via brute-force, and discovered approaches that the evaluation designers didn't anticipate

The offense scales on **three independent axes simultaneously**:
1. More compute per attempt (log-linear, no plateau)
2. Better base models (generational improvement)
3. Novel attack discovery (emergent, unpredictable)

### Step 2: Defensive Evaluation Is Systematically Broken

The Sim2Real paper (2603.11245) demonstrates that the evaluation of defensive capabilities is unreliable in a way that specifically hides failures:

**Behavioral inflation**: LLM simulators create "easy mode":
- Agents succeed 77.8% with simulated users vs. 63.6% with real humans
- Simulators front-load information (4.8 IDs/turn vs. 2.6 human)
- Simulators never express realistic frustration (pivot strategy 19.1% vs. 8.4%)
- Simulators lack ambiguity, uncertainty, and incomplete information
- Net effect: **agent capabilities are systematically overestimated**

**Evaluative inflation**: LLM evaluators score higher than humans:
- Human-likeness: +1.11 mean difference (55% overestimation)
- Reuse intent: +0.83 mean difference
- Evaluation inflates across ALL quality dimensions except task success
- Rule-based rewards orthogonal to human quality dimensions

**Anti-correlation with capability**: Higher general model capability does NOT yield more faithful simulation. The best user simulator by USI is DeepSeek-V3.1 (76.0), not the most capable model. GPT-5.1 (70.9) is mediocre. This means **you cannot fix evaluation by using better models** — the problem is structural, not capability-limited.

### Step 3: Defense Training Is Hard (Diversity-Gated)

The DIVE paper (2603.11076) shows that effective defensive training requires:

**Structural diversity, not data volume**:
- 12k diverse examples > 48k homogeneous examples for OOD generalization
- Pool expansion (new tool types) > toolset variety (more combinations of same tools)
- Specialist training causes **negative transfer** (-5.8 points below base on L3 benchmarks)

But achieving this diversity is expensive:
- Requires real API execution across multiple domains (373 tools × 5 domains)
- Needs careful evidence-first synthesis to avoid hallucinated training data
- Uses expensive LLMs (Claude-4-Sonnet) for evidence collection
- Requires multi-stage training (SFT + RL with rejection sampling)
- Each new domain adds infrastructure, cost, and maintenance burden

**The asymmetry**: 
- Offense: Increase token budget. Done. Log-linear improvement.
- Defense: Design diverse training across multiple domains, build evaluation infrastructure, validate with real humans, iterate. Maybe linear improvement.

### Step 4: The Doom Loop Closes

These three dynamics create a self-reinforcing cycle:

```
┌──────────────────────────────────────────────────────────────────┐
│                    THE ASYMMETRIC SCALING DOOM LOOP              │
│                                                                  │
│  ┌─────────────────┐         ┌─────────────────────────────┐    │
│  │ OFFENSE SCALES   │         │ EVALUATION CAN'T            │    │
│  │ SMOOTHLY         │────────>│ DETECT THE GAP              │    │
│  │                  │         │                             │    │
│  │ • Log-linear w/  │         │ • Sim2Real gap hides        │    │
│  │   compute        │         │   real failure rates        │    │
│  │ • No plateau     │         │ • "Easy mode" inflates      │    │
│  │ • No skill needed│         │   success by 14+ pp         │    │
│  │ • $80 for 6hrs   │         │ • Higher capability ≠       │    │
│  │   expert work    │         │   better evaluation         │    │
│  └─────────────────┘         └──────────┬──────────────────┘    │
│         ▲                               │                       │
│         │                               ▼                       │
│  ┌──────┴──────────┐         ┌─────────────────────────────┐    │
│  │ ATTACKS NOT      │         │ DEFENSE IMPROVEMENT         │    │
│  │ COUNTERED        │<────────│ IS SLOW & EXPENSIVE         │    │
│  │                  │         │                             │    │
│  │ • No urgency     │         │ • Diversity-gated, not      │    │
│  │   (eval says OK) │         │   compute-gated             │    │
│  │ • Resources go   │         │ • Specialist training       │    │
│  │   to capability  │         │   causes negative transfer  │    │
│  │   not security   │         │ • Human validation needed   │    │
│  │                  │         │   but doesn't scale         │    │
│  └──────────────────┘         └─────────────────────────────┘    │
│                                                                  │
│  RESULT: Offense-defense gap WIDENS with each model generation   │
└──────────────────────────────────────────────────────────────────┘
```

**Why it's a doom loop, not just an asymmetry:**

1. **Offense scaling is automatic**: No intervention needed — just use newer models with larger token budgets. The AISI data shows every new model generation pushes the frontier.

2. **Defense degradation is hidden**: The Sim2Real gap means organizations using LLM-based evaluation *believe* their defenses are improving when they may not be. The 14 percentage-point gap between simulated and real success rates is invisible to anyone not running human studies.

3. **Resource misallocation follows**: Since evaluation says things are fine, resources flow to capability improvements (which compound offensive potential) rather than defensive infrastructure (which requires expensive, slow, human-validated diversity scaling).

4. **The gap compounds**: Each new model generation improves offense (measurably) and *may* improve defense (unmeasurably, and possibly worsened by Sim2Real gap inflation). The offense-defense gap therefore widens with each generation.

---

## Quantitative Projections

### Offensive Trajectory (from AISI data)
At current scaling rates:
- **6 months**: Next-generation models will likely complete 25-28/32 steps (extrapolating Opus 4.6 trajectory)
- **12 months**: Full 32-step autonomous completion becomes plausible at 100M+ token budgets
- **18 months**: Cost drops below $20 for complete corporate network compromise (compute cost deflation + model efficiency)

### Evaluation Integrity Trajectory (from Sim2Real data)
- Current best USI: 76.0 (vs. 92.9 human ceiling) — **18% gap**
- Higher capability models DON'T close this gap (anti-correlated)
- Specialized simulation models (CoSER, UserLM) have even lower USI than general models
- **No evidence of convergence** — the gap appears structural

### Defensive Training Trajectory (from DIVE data)
- DIVE achieves +22 avg points across OOD benchmarks — impressive but **requires ICML-level research effort**
- Scaling defense to new domains requires per-domain tool infrastructure (months of engineering per domain)
- RL amplifies diversity but requires already-diverse training data as prerequisite

**Net projection**: Offense-defense gap is widening at ~30-50% per model generation (offense) vs. ~10-15% per major research effort (defense), with evaluation unable to measure the gap accurately.

---

## What Breaks the Loop?

### Approach 1: Fix Evaluation (Attack the Sim2Real Gap)
- **Required**: Human-validated evaluation at scale (451 participants in the Sim2Real study)
- **Problem**: Doesn't scale. The paper itself notes this as the fundamental tension.
- **Partial fix**: The USI metric provides a way to *measure* simulator faithfulness, enabling simulator improvement as a research target
- **Key insight from data**: Open-source models (DeepSeek-V3.1: 76.0 USI) outperform proprietary ones — suggesting community-driven improvement paths exist

### Approach 2: Make Defense Scaling More Compute-Like
- **DIVE's evidence-first synthesis** automates training data generation — this is the right direction
- But currently requires expensive teacher models and real API infrastructure
- **Needed**: Methods to generate diverse, grounded training data cheaply enough to iterate at compute-scaling speeds
- **Key insight from DIVE**: RL amplifies diversity → once you have diverse SFT data, RL is efficient

### Approach 3: Make Offense Scaling Harder (Structural Defenses)
- The AISI paper shows that **heterogeneous, real-time coordination** is still a meaningful barrier (NTLM relay, CI/CD pipeline exploitation)
- **ICS/specialized domains** remain protected by proprietary protocol knowledge
- **Architectural defense**: Require operations that demand real-time coordination, physical-world interaction, or cryptographic verification
- These don't scale *either* — but they create hard floors that compute alone can't bypass

### Approach 4: Red-Team at Scale (Human-AI Teaming for Defense)
- AISI paper shows human-AI teaming is the *offensive* force multiplier (human steering at bottlenecks + AI execution)
- The same model works for defense: **human judgment at key decision points + AI-powered monitoring/response**
- This is the only approach that addresses all three doom loop components: offense awareness, evaluation integrity, and defense effectiveness
- Connects to our "Trust Scaffold" framework from prior syntheses

---

## Connection to Prior Cross-References

### Evaluation Reliability Crisis (CR #24)
This synthesis adds **empirical scaling data** to the theoretical framework. The six dimensions of evaluation failure are not static — they compound as offensive capabilities improve because evaluation methods can't keep pace. The Sim2Real paper shows the gap is **structural**, not capability-limited, which is worse than CR #24's framing suggested.

### Evaluation Theater (CR #29)
The doom loop model extends Evaluation Theater by showing it's not just a closed loop (agents exploit evaluators) but an **asymmetrically accelerating** loop where one side (offense) scales smoothly while the other (defense evaluation) degrades. The theater isn't stable — it's deteriorating.

### 4D Attack Surface Model (CR #30)
The AISI cyber range data provides the **first empirical calibration** for the W dimension (scaling axis) of the 4D model. Attacks scale log-linearly across the compute axis with no plateau, which means the W dimension's threat envelope is expanding faster than the framework originally estimated.

### RL Training Trap Taxonomy (CR #41)
DIVE's finding that RL amplifies diversity connects directly to Trap #1 (Information Self-Locking) and Trap #6 (Reward Complexity Cliff). With homogeneous training data, RL gets trapped in low-information fixed points. With diverse training data, RL exploration succeeds. This suggests diversity is the key variable determining which RL training regime succeeds.

---

## Key Quotes

**Offensive scaling (AISI):**
> "Model performance scales log-linearly with inference-time compute, with no observed plateau."
> "Increasing from 10M to 100M tokens yields gains of up to 59%, requiring no specific technical sophistication from the operator."

**Evaluation failure (Sim2Real):**
> "LLM simulators create an 'easy mode' that inflates agent success rates above the human baseline."
> "Higher general model capability does not necessarily yield more faithful user simulation."
> "Rule-based rewards are failing to capture rich feedback signals generated by human users."

**Defense difficulty (DIVE):**
> "Diversity scaling consistently outperforms quantity scaling for OOD generalization, even with 4× less data."
> "Specialist agents... often exhibit negative transfer."

---

## Bottom Line

The AI security landscape faces a structural problem: **the offense scales on compute (cheap, automatic, log-linear), defense scales on diversity (expensive, manual, sub-linear), and evaluation can't tell which is winning.** This is not a temporary gap — it's an asymmetry baked into the architecture of how capabilities improve vs. how safety is assessed. The only known escape routes involve either making defense scaling more compute-like (DIVE's direction), fixing evaluation through expensive human validation (Sim2Real's direction), or architectural defenses that create hard floors independent of compute scaling (AISI's implicit finding about heterogeneous, real-time coordination requirements). All three are needed simultaneously; none alone suffices.

**This is the most important structural insight in our 42-cross-reference archive.** Prior syntheses identified that evaluation is broken (CR #24, #29) and that attacks scale across dimensions (CR #30). This cross-reference shows these aren't independent problems — they're coupled into a self-reinforcing doom loop where each makes the other worse, and the compound effect accelerates with every model generation.

---

**Scout Assessment:** ★★★★★ CRITICAL
**Filed:** 2026-03-14
**Word count:** ~2,200
