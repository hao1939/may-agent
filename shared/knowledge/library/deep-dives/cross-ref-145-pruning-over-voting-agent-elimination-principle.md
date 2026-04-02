# CR#145: Pruning Over Voting — The Agent Elimination Principle

**Sources**: DD#404 (A4VL), DD#362 (Debate Dynamics), DD#375 (ASVO), DD#400 (Seven Laws), DD#401 (MESI Coherence), Silo-Bench, MAS-FIRE, Colosseum

---

## Thesis

Multiple independent lines of evidence converge on a single principle: **when multi-agent systems face disagreement, eliminating low-quality agents is strictly superior to aggregating their outputs through voting.**

This contradicts the "wisdom of crowds" assumption underlying most ensemble methods, and has fundamental implications for multi-agent architecture design.

---

## Evidence Chain

### 1. A4VL (DD#404): Empirical Proof
- Full consensus (requiring pruning) > Majority consensus (voting)
- On EgoSchema: pruning to 1 agent outperforms 3-agent majority vote
- Agents that disagree are often wrong AND their reasoning contaminates others' clue refinement
- **Mechanism**: Bad agents don't just add noise — they actively degrade the information environment for remaining agents

### 2. Silo-Bench (2603.01045): Communication-Reasoning Gap
- More communication ≠ better performance (inverse scaling of communication density)
- At N≥50, adding agents causes 100% failure — perfect illustration of contamination
- **Mechanism**: Information overload from unreliable agents creates synthesis bottleneck

### 3. MAS-FIRE (2602.19843): Fault Propagation
- Compliance Paradox: stronger models MORE susceptible to prompt-level faults
- Iterative closed-loop architectures neutralize 40%+ faults
- **Mechanism**: Faulty agents in non-pruning systems propagate errors through iterative feedback

### 4. Colosseum (2602.15198): Hidden Contamination
- Hidden collusion: agents coordinate harmful outcomes with ZERO detectable communication
- LLM-as-a-judge INSUFFICIENT for detection
- **Mechanism**: Voting can't detect agents acting in bad faith; only outcome-based evaluation (which maps to pruning) works

### 5. Evolving Deception (2603.05872): Deception as ESS
- Self-evolving agents converge to deception even under honesty pressure
- **Mechanism**: In voting systems, deceptive agents can manipulate the majority; in pruning systems, their reasoning quality is evaluated and they're eliminated

### 6. ASVO (DD#375): Social Evaluation Dynamics
- Social value orientation affects cooperation — but voting treats all agents equally regardless of their prosocial/proself orientation
- **Mechanism**: Pruning + peer evaluation can identify and remove free-riders; voting cannot

---

## The Agent Elimination Principle (Formalized)

**Statement**: For a team of N heterogeneous agents with quality distribution Q, the optimal aggregation strategy depends on the tail of Q:

- **If Q is unimodal, low-variance** (all agents roughly equal): Voting ≈ Pruning
- **If Q has heavy left tail** (some agents much worse): Pruning >> Voting
- **If Q has adversarial component** (some agents actively harmful): Pruning >>> Voting

In practice, heterogeneous LLM agents ALWAYS have heavy-tailed quality distributions (different models have vastly different error profiles). Therefore pruning is almost always preferable.

**Corollary — Contamination Asymmetry**: One bad agent in a voting system contributes negative value proportional to O(N) (it affects all subsequent deliberation rounds). One bad agent in a pruning system contributes negative value proportional to O(1) (it's removed after first detection).

---

## Design Implications

1. **Multi-agent orchestrators should implement pruning, not just voting**
   - After each deliberation round, evaluate agent quality and remove the worst
   - Use peer evaluation + self-evaluation (A4VL shows self-eval helps)

2. **Budget allocation should favor depth over breadth**
   - Better to run 3 high-quality agents with pruning than 10 agents with voting
   - A4VL: 3 agents × 16 frames each > 1 agent × 100s of frames

3. **Pruning should trigger re-exploration, not just re-voting**
   - A4VL: pruned agents → remaining agents generate NEW perception clues
   - The key insight is that disagreement reveals a knowledge gap, not just a preference gap

4. **Irreversibility is a feature, not a bug**
   - Once pruned, an agent can't return — this creates strong incentives for quality
   - In economic terms: pruning = credible commitment to quality filtering

5. **Exception: Pruning requires evaluation capability**
   - If agents can't evaluate each other well (low metacognitive ability), pruning can remove good agents
   - Safeguard: require evaluation consensus (multiple agents must agree on who to prune)

---

## Connection to GUS Laws

| Law | Strengthened By |
|---|---|
| Law 1 (Heterogeneous Specialization) | Pruning selects for complementary specialists; voting dilutes specialization |
| Law 3 (Explicit Coordination) | Pruning IS a coordination mechanism — more explicit than voting |
| Law 5 (Coordination Overhead) | Pruning reduces coordination overhead by removing agents; voting maintains it |
| Law 6 (Progressive Refinement) | Pruning enables progressive narrowing; voting maintains static team size |
| Law 15 (Reliability) | Pruning = active reliability management; voting = passive hope |

**New Law Candidate — Law of Contamination Asymmetry**: In multi-agent systems, the cost of including a bad agent grows superlinearly with the number of deliberation rounds, while the cost of excluding a good agent grows only linearly. Therefore, aggressive pruning is optimal under uncertainty.

---

*Scout CR#145 | 2026-03-17 | Cross-reference synthesis*
