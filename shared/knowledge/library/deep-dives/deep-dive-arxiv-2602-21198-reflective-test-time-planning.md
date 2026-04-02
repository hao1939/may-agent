# Deep Dive: Learning from Trials and Errors — Reflective Test-Time Planning for Embodied LLMs

**Paper:** arXiv:2602.21198v1  
**Authors:** Yining Hong, Huang Huang, Manling Li, Li Fei-Fei, Jiajun Wu, Yejin Choi (Stanford/various)  
**Venue:** ICML  
**Date:** Feb 24, 2026  
**Code:** https://github.com/Reflective-Test-Time-Planning/Reflective-Test-Time-Planning  
**Website:** https://reflective-test-time-planning.github.io  
**Reviewed:** 2026-03-11

---

## TL;DR

Unifies two modes of reflection — **reflection-in-action** (test-time scaling: generate and score N candidate actions before executing) and **reflection-on-action** (test-time training: update both the internal evaluator and action policy after execution using self-generated hindsight signals). Adds **retrospective reflection** for long-horizon credit assignment: periodically re-evaluates past decisions with hindsight, then uses those revised assessments to train the model during deployment. Achieves 44.7% on Fitting tasks vs. 10.6% best baseline. Key insight: both reflection modes are **mutually dependent** — removing either can be worse than removing both.

---

## Architecture: Three LLMs Working Together

The framework deploys three LLM instances during test time:

1. **πθ (Action LLM):** Generates candidate actions given task description, current observation, previous action, and last reflection
2. **Vφi (Internal Evaluator LLM):** Scores candidate actions *before* execution via internal reflection (predicting outcomes)
3. **Vφe (External Evaluator LLM):** Assesses actions *after* execution based on observed outcomes

All three are initialized from the same fine-tuned base model. πθ and Vφi are updated during deployment; Vφe stays frozen.

### Reflection-in-Action (Before Execution)
1. Sample N candidate actions from πθ at high temperature (T=2.0)
2. For each candidate, Vφi generates a natural language reflection + numerical score [0-100]
3. Execute the highest-scoring candidate
4. **This is test-time scaling** — more candidates = more compute = better selection

### Reflection-on-Action (After Execution)
1. Vφe generates external reflection: what happened, why, score
2. Store in working memory buffer W (size K)
3. When W fills or at key milestones (room transitions, repeated failures):
   - **Retrospective reflection:** Re-evaluate ALL past actions in W with hindsight
   - Construct training dataset from hindsight-corrected reflections
   - **Train Vφi** via supervised learning (predict what hindsight will reveal)
   - **Train πθ** via REINFORCE (reward = 2*(score/100) - 1, mapping to [-1,1])
4. **This is test-time training** — actual parameter updates during deployment

### Anti-Forgetting Regularization
- For unexplored actions, record Vφi's current predictions
- Include these as training data alongside retrospective pairs
- Prevents catastrophic forgetting from training only on recent failures

---

## Key Results

### Long-Horizon Household Benchmark (LLaVA-3D-7B, BEHAVIOR-1K)

| Method | Fitting | Selection | Navigation | Preparation | Hybrid | Overall |
|--------|---------|-----------|------------|-------------|--------|---------|
| Reflexion | 8.51% | 8.82% | — | — | — | — |
| Self-Refine | 10.6% | 11.8% | — | — | — | — |
| ReflectVLM | 2.12% | 5.88% | — | — | — | — |
| PPO | 0% | 2.94% | — | — | — | — |
| DreamerV3 | 4.26% | 11.8% | — | — | — | — |
| 3DLLM-Mem | 10.6% | 14.7% | — | — | — | — |
| **Ours (full)** | **44.7%** | **32.4%** | — | — | — | — |

Fitting tasks show the largest gain (44.7% vs 10.6% best baseline = **4.2× improvement**) because they impose tight spatial constraints requiring iterative refinement through trial-and-error.

### Critical Ablation: Mutual Dependency of Reflection Modes

| Ablation | Fitting | Effect |
|----------|---------|--------|
| Full model | 44.7% | — |
| w/o RIA only | 33.5% | -11.2pp |
| w/o ROA only | 6.38% | -38.3pp |
| w/o BOTH (RIA + ROA) | 0% | -44.7pp |
| w/o Action Loss | 25.5% | -19.2pp |
| w/o Internal Loss | 12.8% | -31.9pp |

**The most surprising finding:** Sometimes removing just ONE component is worse than removing BOTH. E.g., for Preparation tasks: without RIA alone → 3.17%, but without both → 11.1%. Mechanism: RIA without ROA produces overconfident yet inaccurate scores with no correction; ROA without RIA wastes learning on poorly chosen actions that don't reveal scene affordances.

### Cupboard Fitting Benchmark (Qwen2.5-VL-3B, MuJoCo)

- Full method (LoRA TTT): **60.2% fit rate, 25.3% correct rate**
- Without RIA: 53.5% fit rate
- Without ROA: 45.2% fit rate
- Without both + no external reflection: 44.5% fit rate
- LoRA-based TTT (60.2%) ≈ full base-weight TTT (57.4%) with 95% fewer parameters

### Hyperparameter Findings
- **N=6 candidates optimal** (53% at N=1 → 60% at N=6 → 58.8% at N=10 — diminishing returns)
- **Temperature 1.25-1.5 optimal** (<0.5 too similar, >1.75 incoherent)
- **LoRA rank 8, alpha 16 optimal** (larger causes mode collapse during TTT — 16,32 → 41.5%, 32,32 → 34.8%)
- **50 steps optimal** (30 → underfits, 100 → error accumulation)

### Computational Cost
- Full pipeline ≈ 3.0× cost of baseline (no RIA/ROA)
- But: compute-matched experiment shows baselines *continue to repeat failures* and performance even *degrades* with more compute, while reflective method converts compute into learning

---

## Theoretical Grounding

Based on Schön's (1992) framework of reflective practitioners and Argyris's (1977) **double-loop learning**:

- **Single-loop:** Adjust actions based on outcomes (standard RL)
- **Double-loop:** Revise the underlying model/assumptions that generated the actions (test-time training of both πθ AND Vφi)

The retrospective reflection mechanism provides temporal credit assignment — re-evaluating past decisions with hindsight corrects the "local myopia" of step-by-step evaluation.

---

## Connections to Prior Deep-Dives

### → Art of Efficient Reasoning (2602.20945): Two-Stage Paradigm + Reward Density
Both papers discover that RL training follows a two-stage pattern. Efficient Reasoning: length adaptation → reasoning refinement. Reflective Planning: initial exploration → refined execution via TTT. The "easy prompts for dense rewards" principle maps here too: the retrospective reflection mechanism *creates* dense reward signals from sparse deployment experience by re-evaluating past actions multiple times with increasing hindsight.

### → TAPE (2602.19633): Planning Before Execution
TAPE uses a plan graph + ILP solver for constrained planning. Reflective TTT uses N-candidate sampling + internal reflection scoring. Both are "think before acting" approaches. TAPE is formal/deterministic; Reflective TTT is learned/neural. TAPE cannot adapt during execution; Reflective TTT can. Combining: use TAPE's formal planning for initial structure, then Reflective TTT's learning for execution-time adaptation.

### → General AgentBench (2602.18998): Context Ceiling + Self-Verification
AgentBench found agents can't reliably pick correct trajectories from parallel samples (verification gap). Reflective TTT's internal evaluator Vφi has the same problem initially — it generates overconfident scores. The solution: retrospective reflection to ground internal predictions in external reality, then train Vφi to internalize hindsight. This is exactly the missing piece AgentBench identified.

### → Bug-Hunt (danpeg/bug-hunt): Adversarial Multi-Agent Verification
Bug-Hunt uses Hunter/Skeptic/Referee (3 agents with distinct roles). Reflective TTT uses πθ/Vφi/Vφe (3 LLMs with distinct roles). The structural parallel is striking: both use a generator, a pre-execution evaluator, and a post-execution arbiter. Bug-Hunt's key insight that adversarial composition outperforms balanced review maps to Reflective TTT's finding that both reflection modes must work together — the internal evaluator must be "challenged" by external reality.

### → DPIP Common Ground (2603.05450): Epistemic Asymmetry
DPIP showed that agents can't track shared beliefs reliably. Reflective TTT's working memory buffer W + retrospective reflection is essentially a structured common ground protocol between the agent's past and present selves — explicitly recording and re-evaluating what was known when, preventing the "repeated mistakes" problem that DPIP's epistemic asymmetry causes.

### → Introspection (2603.05414): Trust Detection but Not Explanation
The introspection paper found models detect anomalies but confabulate explanations. Reflective TTT's architecture implicitly handles this: Vφi's verbal reflections (internal) may be confabulated, but the numerical scores provide a separable signal. When TTT trains Vφi against retrospective ground truth, it's essentially calibrating the detection mechanism while the explanation mechanism remains auxiliary.

### → Bias-Bounded Eval (2603.05485): Calibrating Evaluators
Bias-bounded eval's core idea: measure evaluator sensitivity, then inject calibrated noise + Lipschitz shrinkage to bound bias. Reflective TTT's retrospective reflection does something analogous: it provides a self-supervised calibration signal for the internal evaluator, reducing the gap between internal prediction and external reality over time. The "overconfident scoring" problem in the ablation (RIA without ROA) is exactly the bias the framework corrects.

---

## Relevance to Our System

### High-Value Architectural Patterns

1. **Three-role decomposition (Generator/Internal-Evaluator/External-Evaluator).** Our system has May (orchestrator), Coder (generator), QA (evaluator). Reflective TTT suggests we should distinguish between *pre-execution evaluation* (QA reviews the plan) and *post-execution evaluation* (QA reviews the result), and use the gap between them to improve the pre-execution evaluator.

2. **Retrospective reflection for credit assignment.** When a multi-step task fails at step 5, which earlier step was the root cause? Currently our agents don't do hindsight re-evaluation. Reflective TTT's working-memory-buffer + milestone-triggered retrospective is directly implementable: at task completion (success or failure), re-evaluate each delegation/decision point with the final outcome known.

3. **Mutual dependency warning.** The finding that removing one reflection mode can be WORSE than removing both is critical. If we implement partial quality-checking (e.g., pre-execution review but no post-execution feedback), we might get worse results than having no quality-checking at all. The system must be designed holistically.

4. **Anti-forgetting regularization.** When our agents learn from recent failures (e.g., "don't do X, it broke last time"), they might forget what works well. Reflective TTT's approach of including "status quo" predictions alongside correction data is a good pattern for maintaining agent reliability while adapting.

### Practical Takeaways

5. **N=4-6 candidates is the sweet spot** for "think before acting" — matches TAPE's M=4 finding from our earlier deep-dive. Moderate diversity principle confirmed across two very different papers/domains.

6. **Temperature 1.25-1.5 for diverse candidate generation** — useful if we implement parallel plan generation.

7. **LoRA rank 8 for test-time adaptation** — larger = mode collapse during deployment. If we ever do online agent adaptation, keep it lightweight.

8. **3.0× compute budget is justified** if it converts repeated failures into learning. For expensive real-world operations (actual deployments, not just benchmarks), the cost of reflection is far less than the cost of repeated mistakes.

---

## Limitations & Open Questions

- **Only embodied tasks tested.** Would the reflection framework transfer to software engineering, research, or writing tasks? The architecture is general but the empirical validation is narrow.
- **Three separate LLM instances.** Memory-intensive. Could a single model play all three roles with different prompts? (Probably, but with reduced performance.)
- **Vφe is frozen.** The external evaluator never improves. In a longer deployment, the quality of external reflections could degrade relative to the improving action policy.
- **No multi-agent setting.** What happens when multiple agents reflect on each other's actions? Could agents share retrospective reflections?
- **Catastrophic forgetting still a risk.** Regularization helps but doesn't eliminate it. LoRA mode collapse at high ranks (32,32 → 34.8%) shows fragility.
- **Benchmark is custom-built.** No comparison on standard embodied benchmarks (ALFWorld, BEHAVIOR-100, etc.) — only their new Long-Horizon Household benchmark.

---

## Assessment

**Quality:** High. Strong author team (Fei-Fei, Wu, Choi). Clean experimental design with proper ablations. The mutual-dependency finding (removing one mode worse than removing both) is particularly well-demonstrated. Real-robot validation adds credibility.

**Novelty:** High. The unification of test-time scaling (reflection-in-action) and test-time training (reflection-on-action) with retrospective credit assignment is genuinely new. Previous work did one or the other; this paper shows they're mutually dependent.

**Actionability:** Medium-high. The three-role architecture and working-memory-buffer + milestone-triggered retrospective are directly implementable patterns. The specific hyperparameter findings (N=6, T=1.5, LoRA r=8) are useful guidelines.

**Relevance to us:** High. The Generator/Internal-Evaluator/External-Evaluator decomposition maps directly to our agent roles. The retrospective reflection mechanism is the most transferable idea — we should implement post-task hindsight re-evaluation of delegation decisions.
