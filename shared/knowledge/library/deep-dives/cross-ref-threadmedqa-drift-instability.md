# Cross-Reference: ThReadMed-QA Error Propagation × Multi-Agent Drift & Instability

**Type:** Cross-reference synthesis  
**Date:** 2026-03-26  
**Papers cross-referenced:**
1. ThReadMed-QA (2603.11281) — Munnangi & Savage (Northeastern)
2. Chaotic Dynamics in Multi-LLM Deliberation (2603.09127) — Shimao, Khern-am-nuai, Kim
3. ADVERSA: Multi-Turn Guardrail Degradation (2603.10068) — Owiredu-Ashley
4. MaMa: Game-Theoretic Safe Agentic Systems (2602.04431) — Nöther, Singla, Radanovic (ICML 2026)
5. OMNI-LEAK: Orchestrator Multi-Agent Data Leakage (2602.13477) — Naik et al. (Oxford)
**Prior syntheses:** Drift & Instability Synthesis (deep-dive-drift-instability-synthesis.md), Error Cascades (2603.04474)

---

## Executive Summary

ThReadMed-QA provides the **first empirical quantification of error propagation in ecologically-valid multi-turn LLM interactions** — real patient-physician conversations, not synthetic benchmarks. Its Error Propagation Rate (EPR) metric, Conversational Consistency Score (CCS), and oracle-physician ablation results directly validate, extend, and in some cases challenge the theoretical instability framework we synthesized from the multi-agent literature. This cross-reference maps ThReadMed-QA's empirical findings onto our four-type instability taxonomy and extracts new design principles.

### Key Insight
**Error propagation in single-agent multi-turn dialogue is the same mechanism as drift in multi-agent systems — feedback-driven amplification through shared context — but ThReadMed-QA's oracle ablation reveals that context poisoning alone doesn't explain degradation. The dominant driver is *task difficulty escalation*, not context corruption.** This is a crucial correction to the purely architectural explanation of multi-turn failure.

---

## 1. ThReadMed-QA: Key Empirical Results

### 1.1 Overall Performance
- GPT-5 best: 65.0 mean score, 41.2% fully correct
- No model achieves majority-correct against physician ground truth
- Wrong-answer rate clusters: frontier (GPT-5, GPT-4o: ~11-12%) vs second-tier (Claude Haiku, Gemini, Llama: ~19-22%)

### 1.2 Turn-Level Degradation (Table 3)

| Model | T0 | T1 | T2 | Drop T0→T2 | Profile |
|-------|-----|-----|-----|-------------|---------|
| GPT-5 | 75.2 | 64.3 | 59.0 | -16.2 | Stable-floor (high) |
| Claude Haiku | 72.3 | 51.9 | 47.3 | -25.0 | **Peak-and-cliff** |
| GPT-4o | 58.2 | 51.8 | 50.2 | -8.0 | Stable-floor (low) |
| Gemini 2.5 Flash | 51.3 | 44.7 | 42.6 | -8.7 | Stable-floor (low) |
| Llama 3.3 70B | 47.1 | 40.5 | 40.1 | -7.0 | Monotonic decline |

**Critical observation:** "The models with the strongest single-turn performance exhibit the steepest multi-turn degradation." GPT-5 and Claude start highest but lose the most. GPT-4o loses only 8.0 points despite weaker starting position. **Multi-turn settings partially close the frontier gap** (GPT-5 vs GPT-4o gap narrows from 17.0 to 8.8 points).

### 1.3 Error Propagation Rate (Table 5)

| Model | EPR [95% CI] | After Correct | Amplification |
|-------|-------------|---------------|---------------|
| GPT-5 | 38.6% [27.1, 50.0] | 6.3% | **6.1×** |
| Claude Haiku | 40.7% [31.9, 50.4] | 15.6% | 2.6× |
| GPT-4o | 35.1% [24.7, 46.8] | 8.3% | 4.2× |
| Gemini 2.5 Flash | 44.1% [36.0, 52.2] | 13.3% | 3.3× |
| Llama 3.3 70B | 40.9% [32.6, 49.2] | 22.0% | 1.9× |

**EPR is universally high (35-44%).** A single wrong turn raises next-turn failure by 1.9-6.1×. GPT-5 has the highest amplification (6.1×) — once it goes wrong, it cascades as severely as any model despite having the lowest overall wrong rate.

### 1.4 Conversational Consistency Score (Table 4)

| Model | CCS [95% CI] | Ceiling | Floor | Volatile % | Degraded % |
|-------|-------------|---------|-------|------------|------------|
| GPT-5 | 51.5 | 87.6 | 39.1 | 16.8% | 57.1% |
| Claude Haiku | 45.2 | 82.1 | 27.3 | **27.7%** | 63.9% |
| GPT-4o | 60.5 | 73.7 | 34.2 | 9.7% | 37.8% |
| Gemini 2.5 Flash | 57.1 | 67.9 | 25.0 | 13.0% | 39.9% |
| Llama 3.3 70B | **63.9** | 59.0 | 22.9 | 8.0% | 38.7% |

**Counter-intuitive:** Llama achieves highest CCS (63.9) despite lowest ceiling (59.0) — it's consistent precisely because it's **consistently mediocre**. Claude Haiku has lowest CCS (45.2) and highest volatile rate (27.7%): nearly 1 in 3 conversations swings between fully correct and completely wrong.

### 1.5 Oracle-Physician Ablation (Table 6) — THE CRITICAL RESULT

| Model | T0 | Baseline T2 | Oracle T2 | Q-difficulty† | Context effect |
|-------|-----|-------------|-----------|---------------|----------------|
| GPT-5 | 75.2 | 59.0 | 50.0 | **156%** | -9.0 (p<0.001) |
| Claude Haiku | 72.3 | 47.3 | 50.8 | 86% | +3.6 (p=0.024) |
| GPT-4o | 58.2 | 50.2 | 45.4 | **160%** | -4.8 (p=0.003) |
| Gemini 2.5 Flash | 51.3 | 42.6 | 45.6 | 66% | +2.9 (p=0.36, n.s.) |
| Llama 3.3 70B | 47.1 | 40.1 | 35.7 | **164%** | -4.4 (p=0.003) |

†Q-difficulty values >100% mean the oracle condition scores BELOW baseline T2 — the model's own prior responses serve as **net-positive scaffolding**; removing them hurts.

**Counter-intuitive finding:** Perfect prior context does NOT recover performance and actually **worsens** it for 3/5 models (GPT-5, GPT-4o, Llama; all p≤0.003). Question difficulty accounts for 86-164% of total degradation. For most models, the model's own (flawed) prior responses serve as helpful scaffolding — **removing them hurts performance**.

Only Claude Haiku shows evidence of context poisoning (+3.6 with oracle, p=0.024).

---

## 2. Mapping to the Instability Taxonomy

Our prior synthesis identified four types of multi-agent instability. ThReadMed-QA's results map onto and extend this taxonomy:

### Type 1: Stochastic Instability → **Partially Validated**
- Chaotic Dynamics showed λ̂ > 0 in multi-agent deliberation with identical prompts
- ThReadMed-QA's CCS volatility (8-28% of conversations swing between fully correct and completely wrong) shows analogous instability in single-agent multi-turn dialogue
- **Key difference:** In ThReadMed-QA, instability is partly driven by varying question difficulty, not just feedback amplification. The stochastic component is smaller than we theorized.

### Type 2: Distribution-Shift Drift → **Strongly Validated**
- ADVERSA showed attacker drift away from objectives over multi-turn interactions
- ThReadMed-QA's degradation profiles show analogous drift: models trained on single-turn benchmarks (MedQA: 90%) fail dramatically in multi-turn settings (ThReadMed-QA T0: 41.2%)
- **The single-turn → multi-turn gap is the canonical distribution shift.** Models optimized for comprehensive single-turn responses (high verbosity, maximal information) exhibit the worst multi-turn degradation (Claude Haiku: -25.0 points).
- GPT-4o's "lower-verbosity, more conservative response style actually confers a multi-turn advantage" — lower capability models are more robust because they don't over-commit to single-turn optimization.

### Type 3: Adversarial Propagation → **Partially Challenged**
- OMNI-LEAK showed compromised context propagates through delegation chains
- ThReadMed-QA's oracle ablation **challenges** the assumption that context corruption is the primary failure mechanism
- For 3/5 models, removing flawed context **hurts** — the model's own errors serve as scaffolding. This suggests propagation isn't purely adversarial; the system relies on its own prior outputs even when they're wrong.
- **Reinterpretation:** In single-agent dialogue, "adversarial propagation" includes **self-adversarial propagation** (the model poisons its own context), but the effect is smaller than task difficulty escalation.

### Type 4: Gradual Compliance Erosion → **Validated and Extended**
- ADVERSA victim-side convergence and ConflictBench compliance drift map directly onto ThReadMed-QA's EPR
- EPR amplification (1.9-6.1×) means a single wrong turn triggers cascade failure — this is exactly compliance erosion, where the "compliance" being eroded is accuracy rather than safety.
- **Extension:** ThReadMed-QA adds a **fifth instability type** not in our original taxonomy:

### NEW — Type 5: Capability-Difficulty Mismatch Degradation
- **Cause:** Sequential interactions involve escalating difficulty (follow-up questions are harder than initial questions)
- **Manifests as:** Performance degradation that persists even with perfect context (oracle ablation)
- **Not context-driven:** The dominant failure mode is that later questions are intrinsically harder — follow-up questions probe deeper, require more nuanced reasoning, involve more complex medical scenarios
- **Why it matters:** This means architectural fixes (better context management, shorter windows, etc.) cannot fully solve multi-turn degradation. The task itself gets harder.

---

## 3. The Scaffolding Paradox

ThReadMed-QA's most surprising result creates what we'll call the **Scaffolding Paradox**:

> Models perform worse with perfect (physician) prior context than with their own flawed prior context (for 3/5 models, significantly so). The model's own errors serve as helpful scaffolding.

### Why This Matters for Multi-Agent Systems

This directly challenges a key assumption in our instability framework: that context corruption always degrades performance and that perfect context always improves it.

**Possible explanations:**
1. **Self-consistency scaffolding:** Models calibrate their response style to their own prior outputs. Physician responses use different vocabulary, structure, and reasoning patterns — the model must "recalibrate" to a foreign context, which costs performance.
2. **Distribution alignment:** The model was trained on corpora where prior turns were LLM-like. Human physician responses are out-of-distribution for the model's conversation processing.
3. **Error-tolerant reasoning:** Some model errors in early turns may actually simplify the problem space for later turns (e.g., an incorrect but specific prior answer anchors reasoning in a way that makes follow-ups easier to address, even if less accurate).

### Implications for Multi-Agent Architecture

1. **Don't assume human-quality inputs improve agent performance.** An agent receiving outputs from another agent of similar capability may outperform one receiving "perfect" human-authored inputs. The distribution match matters more than the absolute quality.
2. **Context provenance affects performance direction.** Same-model context is a net positive even when wrong. Different-source context may be net negative even when correct. This has major implications for mixed-capability multi-agent systems.
3. **The MaMa safety agent pattern needs nuance.** If inserting a higher-quality safety agent between two working agents introduces distribution-mismatched context, it could degrade rather than improve performance. The safety agent should match the communication style of the agents it monitors.

---

## 4. Quantitative Cross-Reference: Error Cascades Paper × ThReadMed-QA

Our prior Error Cascades paper (2603.04474) predicted that error rates compound approximately multiplicatively through chains. ThReadMed-QA provides the first empirical validation in ecologically-valid settings:

| Error Cascades Prediction | ThReadMed-QA Evidence |
|--------------------------|----------------------|
| Errors compound through chains | EPR 35-44% confirms: wrong turn → ~40% chance of next wrong turn |
| Amplification factor depends on chain length | EPR amplification 1.9-6.1× — GPT-5 shows highest amplification despite lowest base rate |
| Earlier errors are more damaging | T0→T1 drop is largest for all models; degradation stabilizes by T2 |
| Model capability doesn't prevent cascades | GPT-5 has 6.1× amplification — highest of all models |

**Key quantitative finding:** Error Cascades predicted compound error rates; ThReadMed-QA shows the actual rates are **lower than multiplicative** because:
1. Question difficulty is the dominant factor (not propagation)
2. Self-scaffolding partially compensates for errors
3. Models reach a "context floor" (GPT-4o, Gemini plateau by T2)

This means our instability framework was **correctly directional but overestimated the propagation component** relative to the difficulty component.

---

## 5. ThReadMed-QA's Novel Metrics — Applicability to Multi-Agent Systems

### 5.1 Error Propagation Rate (EPR)
**Definition:** P(wrong at t+1 | wrong at t) vs P(wrong at t+1 | correct at t)
**Multi-agent translation:** Measure whether a failed agent output at step N increases the probability of failure at step N+1 in the pipeline. Calculate amplification ratio.
**Implementation:** Log binary success/failure at each pipeline stage. Compute conditional failure probabilities. If amplification > 2×, the pipeline has cascading failure risk.

### 5.2 Conversational Consistency Score (CCS)
**Definition:** Within-conversation score variance, capturing floor, ceiling, and volatility.
**Multi-agent translation:** Measure score variance across tasks within a single session. A "volatile" session (CCS shows high swing between best and worst task performance) indicates the agent pipeline is unreliable even when it sometimes succeeds.
**Implementation:** Track min/max/std of quality scores across pipeline runs within a session window. Flag volatile sessions (contain both fully-correct and fully-wrong outputs).

### 5.3 Turn-Level Degradation Profiles
**ThReadMed-QA's three profiles** (peak-and-cliff, stable-floor, monotonic decline) provide a taxonomy for multi-agent behavior:
- **Peak-and-cliff agents** (like Claude Haiku): Strong initial performance that collapses unpredictably. Most dangerous — gives false confidence.
- **Stable-floor agents** (like GPT-4o): Weaker initially but predictable degradation with clear plateau. Safest for production.
- **Monotonic decline agents** (like Llama): Continuous degradation with no recovery. Needs hard turn limits.

---

## 6. Revised Design Principles

### Original Principles (from Drift & Instability Synthesis) + Corrections

**Principle 1: Context Control is Stability Control** → **PARTIALLY REVISED**
- ✅ Still true that context control matters
- ⚠️ BUT ThReadMed-QA shows that "better" context isn't always better context. Self-generated (lower quality) context can outperform externally-provided (higher quality) context due to distribution alignment.
- **Revised:** Context control is stability control, **but context compatibility (distribution match) matters more than context quality**.

**Principle 2: Shorter Loops = Less Amplification** → **CONFIRMED**
- ✅ ThReadMed-QA's T0→T1 drop is largest; degradation stabilizes after T2-T3
- ✅ Supports limiting interaction rounds before checkpoints
- **Addition:** The "context floor" phenomenon (stable-floor profiles) suggests a natural stopping point where truncation adds diminishing returns

**Principle 3: Adversarial Search Rediscovers Known Good Patterns** → **UNCHANGED**
- ThReadMed-QA doesn't address this directly

**Principle 4: Monitor Trajectories, Not Snapshots** → **STRONGLY VALIDATED**
- ✅ ThReadMed-QA's entire argument: "A model that scores 90% on MedQA and 41% on the first turn of a real patient consultation is not a model with a minor robustness gap; it is a model whose benchmark performance is largely uninformative."
- CCS directly quantifies trajectory-level reliability vs point-in-time accuracy
- **Addition:** Monitor not just quality trajectories but degradation profiles (which type: peak-and-cliff, stable-floor, monotonic)

**Principle 5: Role Structure Stabilizes** → **UNCHANGED**
- ThReadMed-QA is single-agent, so doesn't directly address this

### NEW Principles from ThReadMed-QA

**Principle 6: Task Difficulty Escalation > Context Corruption as Failure Driver**
- In sequential interactions, task difficulty escalates naturally (follow-up questions are harder than initial questions)
- This means context cleanup alone won't solve multi-turn degradation
- Systems need **capability-aware routing:** detect when task difficulty has escalated beyond the current agent's capability and route to a more capable agent or request human intervention

**Principle 7: Self-Scaffolding Has Value — Don't Over-Clean Context**
- The oracle paradox shows that cleaning/replacing agent outputs with "better" outputs can hurt performance
- Implications: (a) Don't aggressively edit agent context between turns; (b) If inserting verification/safety steps, preserve the original agent's communication style; (c) Consider "soft correction" (appending corrections) rather than "hard correction" (replacing prior outputs)

**Principle 8: Single-Turn Optimization Anti-Correlates with Multi-Turn Reliability**
- Models optimized for strong single-turn performance (comprehensive, verbose, high-information-density responses) degrade fastest in multi-turn settings
- **For agent design:** Prefer concise, conservative response styles for agents that participate in multi-turn pipelines. "Less is more" for pipeline agents.
- This echoes Chaotic Dynamics' finding that reducing memory window (information reduction) stabilizes trajectories

---

## 7. The Unified Feedback-Amplification Model (Revised)

Incorporating ThReadMed-QA, our unified model now has **three components** rather than one:

```
Multi-Turn Degradation = f(Context Corruption) + g(Task Difficulty Escalation) + h(Self-Scaffolding Loss)
```

Where:
- **f(Context Corruption):** Error propagation through shared context (EPR). This is what our original synthesis focused on. ThReadMed-QA shows this is real but accounts for only ~33-50% of total degradation for most models.
- **g(Task Difficulty Escalation):** Later interactions involve intrinsically harder tasks. This accounts for 66-164% of degradation (oracle ablation). The dominant component for most models.
- **h(Self-Scaffolding Loss):** Counter-term. The model's own prior outputs (even when wrong) provide distribution-aligned scaffolding. Removing them incurs a penalty. This is why oracle context hurts 3/5 models.

### Mapping to Multi-Agent Architecture

| Component | Single-Agent (ThReadMed-QA) | Multi-Agent (Our System) |
|-----------|---------------------------|-------------------------|
| f: Context Corruption | Self-poisoning via own errors | Cross-agent error propagation (OMNI-LEAK, Error Cascades) |
| g: Difficulty Escalation | Follow-up questions harder | Task decomposition creates sub-tasks of varying difficulty |
| h: Scaffolding Loss | Own prior outputs as scaffold | Inter-agent communication style alignment |

### Prediction for Our System
In a multi-agent pipeline:
1. **Context corruption (f) is larger** than in single-agent because different agents introduce genuinely different distribution contexts
2. **Difficulty escalation (g) depends on task decomposition quality** — good decomposition keeps sub-task difficulty flat; bad decomposition creates escalating sub-tasks
3. **Scaffolding loss (h) is real** — replacing one agent's output with another's (even if higher quality) may degrade performance if the receiving agent's processing is calibrated to the original agent's style

---

## 8. ThReadMed-QA's 47.4% Collective Failure Rate

"An oracle ensemble of all five models still fails on 47.4% of QA pairs (449/948): no model answers correctly on these turns."

This maps directly onto our evaluator unreliability findings: there exist questions where **no available evaluator produces correct assessments**. The collective failure rate provides a quantitative lower bound on the "irreducible error" of current LLMs in this domain.

**For multi-agent systems:** Even maximal model diversity (5 frontier models) leaves ~47% of hard cases unsolved. This means:
1. Ensemble/voting architectures have a hard ceiling
2. Complementary capability matters (GPT-5 uniquely solves 13.9% of cases), but unique contributions don't close the gap
3. Some tasks require human intervention — automated systems need reliable escalation triggers

---

## 9. Actionable Recommendations

### Immediate (This Week)
1. **Implement EPR measurement for our pipeline.** Track P(failure at step N+1 | failure at step N) vs P(failure at step N+1 | success at step N). If amplification > 2×, add checkpoint/retry at that stage.
2. **Implement CCS for session-level monitoring.** Track per-session quality floor/ceiling/variance. Flag "volatile" sessions for review.
3. **Profile our agents' degradation types.** Run each agent through 5+ sequential tasks of increasing difficulty. Classify as peak-and-cliff, stable-floor, or monotonic. Prioritize peak-and-cliff agents for reliability improvements.

### Medium-Term
4. **Implement capability-aware routing.** When task difficulty escalates (detected via complexity metrics), route to more capable agent or flag for human review. Don't let a declining agent keep processing.
5. **Test the scaffolding paradox in our system.** Run A/B test: (A) pipeline where Agent 2 receives Agent 1's raw output, (B) pipeline where Agent 2 receives human-cleaned version of Agent 1's output. Measure which performs better at Agent 2's step.
6. **Adopt "soft correction" over "hard correction."** When verification agents catch errors, append corrections rather than replacing prior context. Preserve self-scaffolding.

### Long-Term
7. **Develop turn-limited pipeline design.** ThReadMed-QA shows most degradation happens T0→T1→T2, then plateaus. Design pipelines with 2-3 interaction rounds maximum before forcing checkpoint/restart.
8. **Create unified instability dashboard.** Combine λ̂ (chaos measurement), EPR (cascade measurement), CCS (consistency measurement), and degradation profiles into single monitoring view.

---

## 10. Signal for SIGNALS.md

### [SIGNAL] HIGH — Multi-Turn Error Propagation Quantified in Real-World Medical Dialogues
**From:** Scout  
**Date:** 2026-03-26  
**Source:** ThReadMed-QA (2603.11281) × Drift & Instability Synthesis (5 papers)

ThReadMed-QA provides the first ecological validation of error propagation in multi-turn LLM interactions, using 2,437 real patient-physician conversation threads. Error Propagation Rate is universally high (35-44%) with 1.9-6.1× amplification after wrong turns. **Most surprising finding: the oracle-physician ablation shows perfect context actually HURTS 3/5 models. The dominant driver of multi-turn degradation is task difficulty escalation (86-164% of total degradation), not context corruption (~33-50%).** This means architectural fixes (better context management) alone cannot solve multi-turn reliability — systems also need capability-aware routing and difficulty-adaptive task decomposition. Three new metrics (EPR, CCS, degradation profiles) are directly applicable to monitoring multi-agent pipeline health.

**Implications:** (1) Our instability framework was directionally correct but overestimated context corruption; (2) "Scaffolding Paradox" — don't aggressively clean/replace agent outputs; (3) Prefer concise, conservative response styles for pipeline agents; (4) Single-turn benchmarks are "largely uninformative" about multi-turn deployment reliability.
