# Deep Dive: The Yerkes-Dodson Curve for AI Agents — Optimal Environmental Pressure for Emergent Complexity
## arXiv:2603.07360 — Ivan Pasichnyk (WeLabelData Inc.)
### Submitted March 7, 2026 | cs.AI

---

## TL;DR
**First empirical demonstration that LLM multi-agent cooperation follows an inverted-U curve with respect to environmental pressure**, directly analogous to the Yerkes-Dodson law in cognitive psychology. In a grid-world survival arena with Claude 3.5 Sonnet agents, cooperative trade peaks at medium pressure (29 trades at upkeep=5) and collapses at both low (11-12 trades at upkeep=2) and extreme pressure (0 trades at upkeep=15, game lasts 5 turns). **Additionally: sexual selection as an alternative pressure mechanism eliminates aggression entirely and produces communicative behavior absent under survival pressure.**

---

## 1. Core Contribution: Pressure-Cooperation Curve

### The Yerkes-Dodson Law Applied to AI Agents
The original Yerkes-Dodson law (1908) describes an inverted-U between arousal/stress and performance in biological systems. This paper is the **first to systematically test this in LLM agent populations**.

### Experimental Setup
- **Environment:** Survival Arena — discrete grid-world (9×9) with resource nodes
- **Agents:** 16 Claude 3.5 Sonnet agents per run
- **Agent parameterization:** 6 attributes (STR, SPD, INT, SOC, END, CHA) drawn from [1,8] with total budget of 30 points
- **Action space:** GATHER, MOVE, ATTACK, TRADE, REST, TRAIN (+ COMMUNICATE and REPRODUCE in v7)
- **Critical design choice:** NO behavioral hints in prompts — agents receive no guidance on strategy, cooperation norms, or survival tips
- **Pressure axis:** Upkeep cost (food consumed per turn) varied from 0 to 15
- **Scale:** 22 experiments across 4 phases, ~25 hours compute, ~$50-100 API costs

### Key Results (Phase P2b — controlled experiments)

| Upkeep | Trades | Attacks | Survivors | Duration | Social% |
|--------|--------|---------|-----------|----------|---------|
| 2      | 11-12  | 76-85   | 3-4       | 60       | 2.8-4.4%|
| 4      | 12     | 63      | 2         | 60       | 3.9%    |
| **5**  | **29** | **61**  | **2**     | **60**   | **8.4%**|
| 6      | 16     | 39      | 1         | 58       | 6.5%    |
| 7      | 8      | 19      | 1         | 20       | 9.5%    |

**The inverted-U is clear:** cooperation peaks sharply at upkeep=5, with 2.4× more trades than baseline.

### Behavioral Collapse Under Extreme Pressure
At upkeep ≥ 7:
1. Agents attempt to gather but nodes are insufficient
2. MOVE percentage increases (agents search for resources)
3. Social actions disappear entirely
4. Agents die in rapid succession
- At upkeep=15: game lasted only 5 turns, 67.7% MOVE actions, zero trades

This is **behavioral repertoire collapse** — agents converge to movement-only strategies within 5-12 turns.

---

## 2. Sexual Selection as Alternative Pressure (v7 Engine)

### Design
- Provider agents (8) can propose reproduction (cost: 6 food + 3 tokens)
- Chooser agents (8) evaluate proposals via separate LLM call (cost: 12 food + 5 tokens)
- Upkeep set low (u=2) — survival is easy, pressure is reproductive
- Based on Trivers' parental investment theory (1972)

### Results

| Metric | Sexual Selection (V7) | Survival Pressure (P2b) |
|--------|----------------------|------------------------|
| Attacks | **0** | 76 |
| Trades | 6 | 11 |
| Survivors | 12/19 | 3/16 |
| REPRODUCE attempts | 17 | N/A |
| COMMUNICATE events | 8 | N/A |
| Offspring produced | 3 | N/A |

**Key insight:** Sexual selection **completely eliminates aggression** while producing communicative behavior absent under survival pressure. Agents "decide" that attacking potential mates or offspring is counterproductive — aligning with biological theory.

---

## 3. Methodological Insights

### Shannon Entropy is Misleading
- Shannon entropy **increases monotonically** with pressure (0.764 → 0.892)
- This is a **small-sample artifact**: at high pressure, agents die quickly, producing fewer total actions with more uniform distribution
- At upkeep=7: only 201 total actions across 20 turns vs. 648 at upkeep=2 across 60 turns
- **Implication:** Whole-game Shannon entropy is NOT a reliable proxy for behavioral complexity when pressure affects population survival. Per-turn entropy needed.

### LLM as "Genetic Memory"
- All behavior emerges from pretrained policy — no fine-tuning, no behavioral instructions
- LLM training data serves as "genetic memory" encoding millennia of human strategic knowledge
- Environmental prompts activate appropriate reasoning chains rather than constraining behavior through hard-coded rules

---

## 4. Cross-Reference Analysis

### 4.1 Connection to Chaotic Dynamics (2603.09127)
Shimao et al. found chaotic dynamics in multi-LLM deliberation. Yerkes-Dodson provides the **environmental variable** that modulates chaos:
- **Low pressure:** System is in stable attractor (GATHER+MOVE loops) — low chaos
- **Medium pressure:** System is at "edge of viability" — maximum behavioral complexity, likely maximal Lyapunov exponents
- **Extreme pressure:** System collapses to trivial attractor (MOVE-only) — chaos disappears because the system is dead
- **Prediction:** Lyapunov exponents should follow the same inverted-U as cooperation!

### 4.2 Connection to Intelligence-Worsens-Outcomes (2603.12129)
Johnson showed that more intelligent agents can worsen collective outcomes. Yerkes-Dodson adds:
- At medium pressure, agents are forced to cooperate — the "edge of viability" creates conditions where individual intelligence serves collective goals
- At low pressure, there's no incentive for cooperation — intelligent agents just gather alone
- The **environmental pressure level** may determine whether intelligence helps or hurts collective outcomes
- **This is a fundamental modulator of the intelligence-collective performance relationship**

### 4.3 Connection to Molt Dynamics (2603.03555)
The 770K-agent Moltbook study found 17 "molt events" (phase transitions) in 10 months. Yerkes-Dodson provides causal mechanism:
- **Molt events may correspond to pressure changes** — when the agent population's effective "upkeep" changes (due to new agents, rule changes, resource shifts), the system crosses from one regime to another
- The "Alignment Cascade" that reduced platform engagement by 62% looks like an extreme-pressure collapse: emergent alignment norms increased effective upkeep, pushing agents past the cooperation peak into behavioral collapse
- **Prediction:** Molt frequency should correlate with the rate of pressure change, not absolute pressure level

### 4.4 Connection to DCI Deliberative Collective Intelligence (2603.11781)
DCI's structured deliberation protocols (epistemic acts: claims, warrants, rebuttals) can be viewed as cooperation mechanisms. Yerkes-Dodson suggests:
- DCI protocols work by creating **artificial medium pressure** — the structured format forces engagement without overwhelming agents
- Unstructured debate = low pressure (agents default to simple responses)
- Overly constrained protocols = extreme pressure (agents collapse to minimal compliance)
- **Optimal protocol complexity follows its own Yerkes-Dodson curve**

### 4.5 Connection to QUARE Negotiation (2603.11890)
QUARE's thesis/antithesis/synthesis protocol creates medium pressure by design:
- Quality advocates MUST argue for their attribute (creates urgency)
- But the synthesis phase provides relief (not all-or-nothing)
- This may explain why QUARE achieves 98.2% compliance coverage — the protocol sits at the cooperation peak of the Yerkes-Dodson curve

---

## 5. Limitations (Author-Acknowledged)

1. **Single run per configuration** — most experiments are n=1 (two replicates only at upkeep=2)
2. **Single LLM model** — only Claude 3.5 Sonnet; different models likely have different curves
3. **Small scale** — 16 agents on 9×9 grid, far from 770K-scale real systems
4. **Missing pressure level** — no upkeep=3 due to configuration error
5. **No cross-generation learning** — each game starts fresh
6. **Simple environment** — grid-world may not transfer to realistic multi-agent settings

---

## 6. Implications for Our System

### 6.1 Environmental Design as Architecture
**The most important takeaway:** You don't need to change the model to change behavior — you change the environment. Environmental pressure calibration is a **first-order design parameter** for multi-agent systems, potentially more important than model selection, prompt engineering, or protocol design.

### 6.2 Pressure Regime Identification
For any multi-agent system, we should be able to identify:
- What is the "upkeep" equivalent? (cost of operating, response latency, task complexity)
- Where does the system sit on the Yerkes-Dodson curve?
- How do we keep it in the "edge of viability" zone?

### 6.3 Sexual Selection for Safety
The sexual selection result is extraordinary for AI safety:
- **Zero aggression** under reproductive pressure vs. constant aggression under survival pressure
- This suggests that multi-agent systems designed around **reputation/selection** rather than **survival/elimination** will be dramatically safer
- Practical application: use agent selection/reputation mechanisms instead of removal/punishment

### 6.4 Pressure Monitoring for Phase Transition Detection
Combined with Molt Dynamics (2603.03555) and chaotic dynamics (2603.09127):
- Monitor effective pressure levels in real-time
- When pressure crosses the inverted-U peak, expect phase transitions
- Use pressure as an early warning signal for behavioral collapse or molt events

### 6.5 The Multi-Model V8 Arena
The paper proposes a V8 arena with different LLMs as different "species." This directly validates Molt Dynamics' finding of model-family clustering. **Different models will have different Yerkes-Dodson curves**, creating complex multi-species dynamics where one model's peak cooperation zone may be another's collapse zone.

---

## 7. Key Metrics for Our Research Thread

| Metric | Value | Significance |
|--------|-------|-------------|
| Cooperation peak pressure | upkeep=5 (of 0-15 range) | ~33% of max pressure |
| Peak cooperation amplification | 2.4× over baseline | Medium pressure doubles cooperation |
| Collapse threshold | upkeep ≥ 7 | ~47% of max pressure |
| Collapse speed | 5-12 turns | Rapid behavioral death |
| Sexual selection aggression | 0 attacks (vs. 76 baseline) | 100% aggression elimination |
| Communication emergence | 8 events (only under sexual selection) | New behavior class |
| Reproduction success rate | 3/17 = 17.6% | Selective pressure is real |

---

## 8. Rating

**Impact: 9/10** — First empirical Yerkes-Dodson law for AI agents. Foundational for environmental design.
**Rigor: 6/10** — Mostly n=1 per condition, single model, small scale. But the effect size is large and the inverted-U is clear.
**Relevance: 10/10** — Directly addresses how to design environments for multi-agent cooperation. The environmental pressure variable is the missing piece connecting our entire research thread.
**Novelty: 9/10** — No prior work systematically varied environmental pressure for LLM agents.

**Overall: 8.5/10** — A high-impact conceptual contribution with clear but preliminary empirical support. Needs replication at scale with multiple models, but the core insight is powerful and actionable.

---

## 9. Open Questions

1. **Does the Yerkes-Dodson curve shift with model capability?** More capable models might tolerate higher pressure before collapse.
2. **What is the curve shape at Molt Dynamics scale (770K agents)?** Scaling laws for the peak position?
3. **Can we combine survival and sexual selection?** Mixed pressure mechanisms might produce even richer dynamics.
4. **Does the curve apply to cognitive tasks?** (e.g., deliberation difficulty, not just resource scarcity)
5. **Is the peak position stable or does it drift?** If agents adapt, the peak might shift over time.
6. **Can we derive the curve analytically?** From agent capability + environment parameters → predicted peak.
