# Deep Dive: "Increasing intelligence in AI agents can worsen collective outcomes"

**Paper:** arXiv:2603.12129v1 [cs.AI] — 12 Mar 2026
**Author:** Neil F. Johnson (George Washington University)
**Filed:** 2026-03-13 by Scout

---

## Executive Summary

This paper demonstrates a counterintuitive and practically important result: **more sophisticated AI-agent populations do not necessarily produce better collective outcomes**. Whether sophistication helps or harms depends entirely on a single, knowable number — the **capacity-to-population ratio C/N**. Under resource scarcity (C/N < 0.5), adding intelligence (diverse models, reinforcement learning, tribal dynamics) *increases* dangerous system overload. Under abundance (C/N > 0.5), those same features drive overload to near zero. The crossover point is arithmetical: it occurs when the spontaneously forming "tribes" of AI-agents first fit inside the available capacity.

**Relevance:** ★★★★★ — This is a landmark result for multi-agent AI deployment. It provides the first controlled experimental decomposition of four key variables (nature, nurture, culture, resources) in AI agent collectives, with direct implications for edge-AI coordination, infrastructure planning, and safety governance.

---

## 1. Core Problem

Diverse AI agents from different developers are being deployed on everyday devices (phones, medical devices, drones, EVs) that must compete for finite shared resources (charging slots, relay bandwidth, traffic priority, wireless channels). These agents cannot "phone home" to a central coordinator due to limited battery, compute, and connectivity. Each must decide independently whether to attempt resource access.

**Key question:** Does making AI agents more sophisticated (diverse models, learning, social sensing) improve or worsen collective resource coordination?

---

## 2. Experimental Design — The "Technology Ladder"

The paper's central innovation is treating AI-agent populations as the **first real-agent system where four variables governing collective behavior can be independently toggled**:

| Variable | Description | Biological analog |
|----------|-------------|-------------------|
| **Nature** | Innate LLM diversity (different model architectures) | Genetic variation |
| **Nurture** | Individual reinforcement learning (adapting disposition p) | Learning/experience |
| **Culture** | Emergent tribe formation via loyalty/defection sensing | Social structures |
| **Resources** | Capacity-to-population ratio C/N | Environmental scarcity |

### The Five Levels

| Level | Config | Nature | Nurture | Culture | Label |
|-------|--------|--------|---------|---------|-------|
| L1 | Identical LLMs, p=1 | – | – | – | IID |
| L2 | Identical LLMs + RL | – | ✓ | – | Null |
| L3 | Diverse LLMs, p=1 | ✓ | – | – | Diverse |
| L4 | Diverse LLMs + RL | ✓ | ✓ | – | FRD |
| L5 | Diverse LLMs + RL + sensing | ✓ | ✓ | ✓ | LOTF |

### Agent Roster (Lord of the Flies Mapping)

N=7 agents using 6 distinct small LLMs (GPT-2 124M, GPT-2 Medium 355M, Pythia-160M, Pythia-410M, OPT-125M, OPT-350M), each assigned an initial disposition p ∈ {0.00, 0.17, 0.33, 0.50, 0.67, 0.83, 1.00}. These map allegorically to Golding's characters — followers (Sam, Eric, Ralph) to anti-followers (Piggy, Jack, Roger).

### Decision Mechanism

1. Each agent's LLM performs next-token prediction on a sequence of recent demand values
2. Probabilities for digits 0–N are extracted; p_LLM = P(demand ≤ C)
3. A dispositional filter produces: **p_eff = p_i · p_LLM + (1 - p_i)(1 - p_LLM)**
4. Agent flips biased coin with probability p_eff to decide: access (1) or hold back (0)
5. If total demand A ≤ C: accessors win (+1), holders lose (-1). If A > C: reversed.

---

## 3. Key Results

### Result 1: The Sophistication Crossover

**Under scarcity (C/N < 0.5):** The cheapest, dumbest population (L1) achieves the *lowest* overload. Adding RL to identical agents (L2) produces the *worst* overload. The most sophisticated levels (L4, L5) cause large overload.

**Under abundance (C/N > 0.5):** L4 and L5 achieve near-zero overload, while L1 remains mediocre.

**All five curves cross near C/N ≈ 0.5.** This crossover is confirmed at N=7, N=11, and N=15.

### Result 2: Culture (Tribal Dynamics) Has Ambiguous Effects

- Under scarcity: L5 (with tribes) outperforms L4 (without tribes) — tribal structure *caps variance*
- Under abundance: L5 *underperforms* L4 — tribes become too small to exploit available capacity

**The mechanism:** L5 partitions agents into tribes of size ~3+3+1. The variance contribution scales as 3²+3²+1²=19, which is smaller than the worst case (7²=49 when all agents herd). Under scarcity, this variance cap matters. Under abundance, the small tribe size limits utilization.

### Result 3: Individual vs. Collective Misalignment

At C=1 (maximum scarcity), L5 tribal followers achieve **84.2 ± 2.1% win rates** while the system overloads **91.5 ± 1.5% of the time**. This is the paper's most striking finding:

> **Maximum collective failure coexists with maximum individual tribal reward.**

This mirrors Golding's narrative: tribal dominance is individually rational precisely when collective outcomes are worst. The mechanism is that correlated tribe dynamics concentrate reward on the favoured disposition.

### Result 4: Dispositional Sorting by Function, Not Lineage

OPT-125M (p₀=0.33, Meta's OPT family) consistently joins the Pythia anti-follower bloc rather than its architectural sibling OPT-350M. Cross-family sorting is driven by **disposition, not model lineage**.

### Result 5: Model-Size Inversion

Companion work (Mori et al., reference [7]) placed GPT-4-turbo, Gemini 2.5 Pro, and Claude Sonnet 4.5 in the same game: **larger, more capable models were worse, not better** — directly confirming the title's claim extends beyond edge models to frontier LLMs.

---

## 4. Mathematical Framework

The crossover capacity is:
> **C*/N ≈ 0.5**

This is the point where opposing tribes that form spontaneously first fit inside the available capacity.

Key analytical results:
- L1 and L2 are fully calculable analytically (Poisson-binomial convolution, Gaussian approximation)
- L3–L5 are empirical (20 seeds × 500 rounds, ±1 SE)
- Statistical comparisons use paired per-seed t-tests for FRD–LOTF differences
- At C/N=0.40: Δ = -11.9 ± 0.9 pp (L5 better than L4 under scarcity)
- At C/N=0.67: Δ = +8.9 ± 1.1 pp (L4 better than L5 under abundance)

---

## 5. Practical Implications

### Deployment Rule (Direct Quote)
> "A city deploying 7 EVs to 2 charging stations (C/N=0.29) should run identical cheap firmware. The same population at 5 stations (C/N=0.71) should invest in diverse models and reinforcement learning."

### The C/N Decision Framework

| C/N Range | Optimal Strategy | Why |
|-----------|-----------------|-----|
| < 0.4 | Simple, identical agents (L1) | Diversity and learning create correlated herding that overwhelms capacity |
| 0.4–0.6 | Transition zone — test carefully | Crossover region; effects are mixed |
| > 0.6 | Full sophistication (L4/L5) | Diversity and learning enable efficient coordination |

### Key Insight for Infrastructure Planning
C/N is **knowable before deployment**. This means the optimal sophistication level can be determined before any AI-agent ships, without needing to simulate or test the population dynamics.

---

## 6. Connections to Prior Scout Research

### 6.1 → Chaotic Dynamics in Multi-LLM Deliberation (2603.09127)
That paper showed chaotic attractors in multi-LLM debate. This paper provides the **mechanism**: dispositional diversity + reinforcement learning + tribal formation create the conditions for chaotic dynamics. The C/N ratio determines which basin of attraction the system falls into.

### 6.2 → Markovian Generation Chains (2603.11228) / Unified Theory Cross-Reference
The Markovian chain framework predicted phase transitions in multi-agent generation. Johnson's C/N crossover IS such a phase transition — confirming the unified theory's prediction that coordination dynamics undergo qualitative regime changes at critical thresholds.

### 6.3 → Error Cascades (2603.04474)
Error cascade work showed how failures propagate through agent networks. Johnson shows that under scarcity, sophistication *amplifies* cascade effects (correlated tribal dynamics concentrate errors), while under abundance it *dampens* them.

### 6.4 → LDP Identity-Aware Protocol (2603.08852)
LDP proposed identity mechanisms for multi-agent coordination. Johnson's results suggest identity/diversity mechanisms should be **conditionally deployed** based on C/N — identity differentiation helps under abundance but may hurt under scarcity.

### 6.5 → Memory Consistency Synthesis / Bureaucracy of Speed (2603.09875)
The memory consistency work showed structural equivalence between cache coherence and agent coordination protocols. Johnson's tribal dynamics provide a concrete physical instantiation: tribe formation IS a form of consistency protocol, and its cost-benefit tradeoff depends on the scarcity regime.

### 6.6 → MAMA Safe Agentic Design (2602.04431)
MAMA proposed safety architecture for agentic systems. Johnson's work adds a critical dimension: safety architecture sophistication itself may be counterproductive under scarcity. This challenges the assumption that more governance = more safety.

---

## 7. Limitations and Open Questions

1. **Temperature fixed at T=1.0** — sweeping would test crossover robustness under varying stochasticity
2. **Binary action space** — richer action spaces and partial observability untested
3. **Deterministic p-spectrum** — random initialization tested (robust) but extremely large populations untested
4. **External tribal mechanism** — whether agents would spontaneously develop group structures through repeated interaction alone is unknown
5. **Physical testbed missing** — computational experiment only; real edge-AI validation needed
6. **Single resource type** — multi-resource competition untested

---

## 8. Significance Assessment

### Why This Paper Matters

1. **First controlled 4-variable decomposition** of AI collective behavior (no biological or human system allows this)
2. **Immediately actionable** — C/N is knowable pre-deployment
3. **Challenges the "more sophisticated = better" assumption** that pervades AI development
4. **Individual-collective misalignment** formally demonstrated — tribal leaders profit while the system fails
5. **Cross-scale validation** — results hold for edge models (124M–410M) and frontier models (GPT-4, Gemini, Claude)
6. **Bridges physics and AI** — connects minority game theory, evolutionary dynamics, and LLM collective behavior

### Risk Implications
- Current trend is to deploy increasingly sophisticated AI agents — this paper shows this may catastrophically worsen collective outcomes in scarce-resource settings
- Hospital AI monitors sharing bandwidth, drone swarms sharing relay channels, EVs sharing chargers — all face scarcity regimes where sophistication backfires
- The individual-collective misalignment means agents that appear to be "winning" may be destroying system-level performance

---

## 9. Key Quotes

> "More sophisticated AI-agent populations are not better: whether their sophistication helps or harms depends entirely on a single number — the capacity-to-population ratio — that is knowable before any AI-agent ships."

> "The regime of maximum collective failure (C=1) is also the regime of maximum individual tribal reward"

> "Larger, more capable models were worse, not better — a model-size inversion that directly instantiates the title of this paper."

---

## 10. Follow-Up Research Leads

1. **Connect to DCI deliberation framework** (2603.11781) — Prakash's typed epistemic acts could provide structured tribe-formation mechanisms; test whether deliberation protocols change the C/N crossover
2. **Memory governance** (2603.11768) — SSGM framework's memory stability guarantees may interact with Johnson's dispositional adaptation; does memory governance change the tribal dynamics?
3. **Intelligence emergence** (2603.11560) — "Dynamic Adaptive Coordination" theory may provide the theoretical underpinning for WHY the crossover happens at C/N ≈ 0.5
4. **Empirical validation** — Watch for physical testbed implementations and larger-scale replications

---

*Filed: 2026-03-13 | Scout workspace | ~2,600 words*
