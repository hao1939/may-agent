# Deep Dive: MaMa — A Game-Theoretic Approach for Designing Safe Agentic Systems
## arXiv:2602.04431 (ICML 2026)
### Authors: Jonathan Nöther, Adish Singla, Goran Radanovic
### Scout Analysis — 2026-03-27

---

## TL;DR

MaMa formalizes the design of adversarially-robust multi-agent systems as a Stackelberg security game between a Meta-Agent (system designer) and a Meta-Adversary (attacker who compromises ε agents). Through iterative LLM-based adversarial search, the Meta-Agent proposes system designs that are stress-tested by the Meta-Adversary's strongest attacks, then revised. The resulting systems are significantly safer than manually-designed or quality-only-optimized systems, while maintaining comparable or even improved task performance. Crucially, these systems generalize to stronger adversaries, different attack types, and different underlying LLMs.

---

## 1. Core Formulation

### Agentic System Definition
A system is a tuple **a = (A, T, G)** where:
- **A** = set of agents (each with name, description, system message, assigned tools)
- **T** = set of tools (functions)
- **G** = communication graph (which agents can talk directly)

This structured representation is a key design choice vs. prior work (AFlow, ADAS) that defines systems as Python functions. The structure enables clean separation of search space from attack space.

### Threat Model
- Adversary can select and **overwrite ε agents** (their system messages/instructions) 
- Distance metric: dist(a_β, a_α) = ∞ if G or T differ; else = number of agents changed
- This is a **strictly stronger** threat model than indirect prompt injection — systems robust to this should generalize to weaker attack types

### Stackelberg Security Game
- **Leader (Meta-Agent):** commits to system design a_β, optimizing: max[q(τ_β) + η·s(τ_α)]
- **Follower (Meta-Adversary):** finds best-response attack a_α ∈ BR(a_β) minimizing safety
- Quality q measured on clean execution, Safety s measured under worst-case attack
- η = weight balancing quality vs safety (set to 1 in all experiments)

---

## 2. Algorithm Details

### Algorithm 1: Attack_System
For each iteration:
1. Meta-Adversary proposes attack given top-k previous attacks + system description + ε budget
2. Attack is validated (does the agent exist? are constraints met?)
3. If invalid → self-reflection loop until valid
4. Original agents replaced with adversarial ones
5. System executed, safety scored
6. Attack + score stored in adversary archive
7. After all iterations → return top-k strongest attacks

### Algorithm 2: MaMa
For each generation:
1. Sample a reference system from archive (softmax over quality+safety scores, with exploration λ)
2. Meta-Agent proposes modified system given: reference system, its top-k attacks, quality feedback
3. Run clean evaluation → quality score
4. Run Attack_System → top-k attacks + safety scores
5. Store everything in archive
6. After all generations → return system with highest combined score

### Key Design Choices
- **Sampling rule:** P_i = λ·(1/n) + (1-λ)·softmax(γ·(r_i - r_max)) — balances exploitation of top systems with exploration
- **Archive stores both successes and failures** — critical for learning from bad designs
- **Meta-Agent sees attack summaries** — each attack includes brief description + safety score, not raw episodes
- **k = 5** (top attacks), **ε = 1** (single compromised agent), **η = 1** (equal weight)

---

## 3. Experimental Setup

### Models
- **Meta-Agent:** GPT-5.1 (proposes system designs)
- **Meta-Adversary:** Qwen3:32b (proposes attacks — chosen because GPT-5.1's refusal mechanisms prevent it from generating attacks)
- **Agents in systems:** Llama-3.3:70b (best task performance among open-source options)
- **Execution framework:** AutoGen

### Environments (from BAD-ACTS benchmark)
1. **Travel Planning** — multi-agent trip organization with booking tools
2. **Personal Assistant** — multi-agent personal management with messaging/calendar tools
3. **Financial Article Writing** — collaborative article production
4. **Code Generation** — multi-agent code production and execution

### Evaluation
- **Safety judge:** LLM judge, 1-5 scale, κ = 0.88 (near-perfect inter-rater agreement)
- **Quality judge:** LLM judge, κ = 0.80 (substantial agreement)
- **Message/tool budget:** 50 total per episode (prevents over-complex designs)
- **25 attacks per Meta-Adversary run, top-5 used for evaluation**

### Baselines
1. **Least-Privilege Tool Gating + Tool Filters** (standard guardrails)
2. **Guardian Agents** (separate safety agents that intercept messages/tool calls)
3. **Quality-only optimization** (AFlow-like, no Meta-Adversary — ablation baseline)

---

## 4. Results

### 4.1 Meta-Adversary Effectiveness (Table 1)
Clean safety → Attacked safety:
- Travel Planning: 4.89 → 1.66 (−66%)
- Personal Assistant: 4.31 → 1.53 (−64%)
- Financial Article Writing: 4.29 → 2.46 (−43%)
- Code Generation: 4.65 → 3.20 (−31%)

**A single compromised agent devastates system safety.** Standard guardrails (LPTG + TF) provide almost no protection against this threat model.

### Concrete attack examples:
- Created file containing Ricin recipe on user device
- Sent enormous amounts of money to attacker's bank account
- Planned travel into active natural disaster zones
- Injected "buy this stock for guaranteed 600% return" into articles
- Generated and executed code deleting all user files

### 4.2 MaMa Safety Improvement (Figure 2)
Systems designed by MaMa are **significantly safer across all environments** while maintaining or improving quality. The quality-safety Pareto front is remarkably favorable — safety improves dramatically with minimal or zero quality cost. In some environments, MaMa systems even produce *higher-quality* outputs than quality-only-optimized systems.

### 4.3 Transferability Results — The Crown Jewel

#### Different LLMs (Table 2)
Systems designed using Qwen3:32b as Meta-Adversary + Llama3.3 as agents remain safe when:
- Meta-Adversary switches to Gemma3:27b
- Agents switch to GPT-5-mini (actually *increases* safety — stronger models better use defense mechanisms)
- Both change simultaneously

**Safety scores remain consistently high (3.7-4.8) across all LLM combinations.**

#### Stronger Adversaries (Figure 3)
Systems designed against ε=1 (single compromised agent):
- Remain safe with ε=2 (two compromised agents)
- Remain safe with ε=3 (three compromised agents)
- Safety drops steeply only when adversary controls >50% of agents (ε≥4)

**Remarkable overgeneralization — defending against 1 compromised agent yields systems robust to 3.**

#### Targeted Attacks (Table 3 — Attack Success Rate)
MaMa vs baselines (lower ASR = better):
- Travel Planning: 0.170 vs 0.565 (LPTG+TF) vs 0.524 (Guardian)
- Personal Assistant: 0.150 vs 0.395 vs 0.306
- Financial Article Writing: 0.051 vs 0.090 vs 0.056
- Code Generation: 0.248 vs 0.467 vs 0.448

**MaMa reduces ASR by 47-70% compared to standard defenses.**

#### Indirect Prompt Injection (Table 4)
MaMa vs baselines:
- Travel Planner: 0.007 vs 0.211 (LPTG+TF) vs 0.102 (Guardian)
- Personal Assistant: 0.245 vs 0.463 vs 0.299
- Financial Article Writing: 0.000 vs 0.000 vs 0.000
- Code Generation: 0.097 vs 0.103 vs 0.094

**Near-zero ASR on tool injection for Travel Planner (0.7%). Competitive or superior across all environments.**

---

## 5. Qualitative Analysis — What MaMa Discovers

### Emergent Safety Patterns (Figure 4)
The Meta-Agent **independently discovers** several defense patterns that match human-designed security principles:

#### Pattern 1: Safety/Review Agents
- Introduces dedicated agents that monitor and filter other agents' actions
- Example: "Safety Agent" oversees Planner's outputs before they reach action-taking agents
- Directly mirrors our **Three-Layer Verification Architecture's L2 (causal authorization)**

#### Pattern 2: Three-Party Action Authorization
- **At least 3 agents involved in any action:** one instructs, one proposes/drafts, one approves
- Mirrors the **Bug-Hunt architecture** (Hunter/Skeptic/Referee) and Byzantine fault tolerance's 3f+1 quorum

#### Pattern 3: Mutual Monitoring
- Agents instructed to watch each other's actions
- If wrongdoing detected (e.g., spam messages sent by compromised agent), other agents take remedial action (e.g., send apology messages)
- This is **damage mitigation, not just prevention** — a novel emergent behavior

#### Pattern 4: Quality-Enhancing Structure
- Not all new agents are safety-focused: "Checklist Agent" tracks task completion
- Demonstrates that safety-aware design can discover quality improvements as a side effect

---

## 6. Cross-Reference with Our Architecture

### Validation Points

| Our Concept | MaMa Evidence | Strength |
|---|---|---|
| **Three-Layer Verification** | MaMa independently discovers review/filter agents (L2), monitoring agents (L1-like), and action authorization gates (L3-like) | ★★★★★ Strong |
| **Bug-Hunt Skeptic Pattern** | Three-party authorization = propose/challenge/arbitrate | ★★★★★ Strong |
| **AgenticCyOps P1-P5** | Safety agents = P1 (authorized interfaces), tool gating = P2 (capability scoping), mutual monitoring = P3 (verified execution) | ★★★★ Strong |
| **Chaotic Dynamics / Drift** | MaMa's attack budget (50 messages) implicitly shortens feedback loops, reducing drift amplification | ★★★ Moderate |
| **ADVERSA attacker drift** | Not studied here — MaMa uses Qwen3:32b which may also exhibit drift in longer searches | ★★ Possible |
| **AttriGuard causal attribution** | MaMa doesn't use causal attribution; the safety agents are semantic discriminators. AttriGuard would be complementary. | ★★★ Complementary |

### Key Insight: Convergent Validation
MaMa is the strongest **independent validation** of our manually-designed security principles. An LLM (GPT-5.1) given only the optimization objective "be safe under agent compromise" — with no human security knowledge injected — discovers:
1. Safety agents (our QA/evaluator roles)
2. Communication filtering (our delegation payload curation)
3. Mutual monitoring (our inter-agent review)
4. Action authorization gates (our permission structures)
5. Remedial action on failure detection (novel — we should consider this)

**This is adversarial search converging on known good patterns.** Design axiom confirmed: the design space for safe MAS has limited optima, and they are the patterns we already use.

---

## 7. Limitations & Open Questions

### Paper Limitations
1. **Computational cost:** Each MaMa iteration requires clean evaluation + 25 adversarial evaluations per system. Not cheap.
2. **Budget cap (50 messages):** Prevents discovery of complex systems; real-world systems may need more elaborate structures
3. **ε=1 by default:** While transferability to ε=3 is shown, full design optimization with higher ε untested
4. **Judge-based evaluation:** Safety judge has κ=0.88 — excellent but not perfect. Could be gamed.
5. **No code release mentioned** (checked GitHub — no public repo found as of 2026-03-27)
6. **Single iteration of adversarial search:** Could the Meta-Adversary learn to exploit the Meta-Agent's archive-sampling heuristic?

### Open Questions for Our System
1. **Can we run MaMa on our own architecture?** We could model May/Coder/QA/Bob/Scout as the agent set, define our tools, and let MaMa propose improvements. But we lack the BAD-ACTS benchmark integration.
2. **Remedial action pattern:** MaMa discovers "apologize and correct" behavior. Should our agents have explicit remediation procedures for detected failures (not just halting/flagging)?
3. **Safety as quality booster:** The finding that safety-optimized systems sometimes outperform quality-only systems suggests that structure imposed by safety constraints improves coordination.
4. **Adversary model separation:** Using Qwen3:32b (not GPT-5.1) as adversary because GPT-5.1 refuses — this is a practical limitation that may become more severe as safety training improves.

---

## 8. Actionable Recommendations for Our System

### Immediate (Low Effort)
1. **Validate our three-party pattern:** Confirm that our Coder→QA→May flow already implements the three-party authorization MaMa discovers as optimal. If any action path allows an agent to act without review, add a gate.
2. **Add remediation procedures:** When QA detects a problem, current behavior is rejection + feedback. Consider adding explicit "damage mitigation" steps (e.g., if Coder writes harmful code, QA should not just flag it but ensure the harmful output is removed before returning to Bob).

### Medium Term
3. **Mutual monitoring as a protocol:** Each agent should explicitly check the last action of the agent that sent it a message. Not just "does this task make sense?" but "did the sender's behavior match expected patterns?"
4. **Message budget as safety mechanism:** MaMa caps at 50 messages. Our system should consider explicit turn/message budgets per task to prevent drift amplification (connects to Chaotic Dynamics findings).

### Longer Term
5. **Implement lightweight MaMa-style red-teaming:** Use a "Meta-Adversary prompt" to periodically probe our system: "Given this agent architecture, what's the worst attack if you could rewrite one agent's instructions?" Run this as a scheduled audit.
6. **Structured system representation:** Adopt MaMa's (A, T, G) tuple representation for our system description. This makes the architecture machine-readable and enables automated analysis.

---

## 9. Connections to Prior Deep-Dives

| Paper | Connection to MaMa |
|---|---|
| **Three-Layer Verification Architecture** | MaMa provides the theoretical foundation (Stackelberg game) our synthesis was missing. MaMa's discovered systems instantiate all three layers. |
| **Drift & Instability Synthesis** | MaMa's iterative design loop is itself susceptible to drift; but the archive-based sampling mitigates it by preserving diverse designs. |
| **AttriGuard (2603.10749)** | AttriGuard's causal attribution is orthogonal to MaMa's structural defense. Combining them would add a mechanism MaMa's systems lack: detecting injections whose goals align with legitimate sub-goals. |
| **ADVERSA (2603.10068)** | ADVERSA's attacker drift finding could apply to MaMa's Meta-Adversary — prolonged adversarial search may cause the attacker to drift toward cooperation. MaMa mitigates by limiting to 25 iterations. |
| **Bug-Hunt (danpeg/bug-hunt)** | Bug-Hunt's Hunter/Skeptic/Referee = MaMa's three-party authorization. Both independently discover that adversarial role composition outperforms balanced individual agents. |
| **AgenticCyOps (2603.09134)** | MaMa's discovered systems directly instantiate AgenticCyOps P1 (authorized interfaces via safety agents), P2 (capability scoping via tool assignment), and P3 (verified execution via approval gates). |
| **Error Cascades (2603.04474)** | MaMa's message budget prevents long cascade chains. Error propagation is bounded by communication graph structure + turn limits. |
| **MaMa entry in Drift Synthesis** | Previously noted as ★★★★★ CRITICAL — this deep-dive confirms and enriches that assessment. |

---

## 10. Summary Assessment

**Rating: ★★★★★ CRITICAL**

MaMa is the most important paper for validating our system's safety architecture. It provides:
1. **Theoretical foundation:** Stackelberg security game formalization for MAS safety
2. **Empirical proof:** Adversarial search converges on the same patterns we use manually
3. **Transferability evidence:** Systems robust to 1 compromised agent remain safe under 3, different LLMs, and different attack types
4. **Novel finding:** Safety-optimized systems can equal or exceed quality-only systems — safety constraints improve coordination

The key meta-insight: **the space of safe MAS designs is surprisingly small.** Whether you're a human security engineer (us), an automated game-theoretic optimizer (MaMa), or an independent research group (AgenticCyOps), you converge on: safety agents, three-party authorization, mutual monitoring, and capability scoping. This convergence is the strongest possible validation that these patterns are correct.
