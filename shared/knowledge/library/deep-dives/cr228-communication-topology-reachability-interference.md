# CR#228 — Communication Topology Under Physical Constraint: The Reachability-Interference Axis

**Cross-Reference Synthesis connecting:** DD#398 (IA-KRC), DD#391 (LM Teams as Distributed Systems), DD#390 (BIGMAS), DD#376 (SCCAL Cascading Risk Detection), DD#394 (ScienceClaw)

**Rating:** ★★★★ HIGH  
**Produced:** 2026-03-17 ~13:15 UTC

---

## THESIS

Five independent papers from three different research traditions (MARL, LLM-based MAS, autonomous scientific discovery) all converge on the same insight: **communication topology is the primary bottleneck for multi-agent system performance, and the right topology cannot be determined by abstract features alone — it must be grounded in physical or structural constraints.**

---

## THE CONVERGENCE

### 1. Who You Talk To Matters More Than What You Say

**IA-KRC (DD#398)** shows that in MARL with complex topologies, switching from Euclidean-distance partner selection to interference-aware K-step reachability yields 4.58×–31.56× win rate improvement. The message content/encoding is unchanged — only partner selection changes. This is a massive effect size for a seemingly simple architectural decision.

**LM Teams (DD#391)** demonstrates the flip side: in LLM multi-agent teams, adding more communication partners (scaling team size) follows Amdahl's Law with diminishing returns and O(n²) coordination overhead. Decentralized teams are *slower* than single agents (median 0.88×). The communication topology — who talks to whom — dominates performance.

**Implication:** Both MARL and LLM-MAS research independently show that communication topology selection is a first-order concern that dwarfs message content optimization.

### 2. Physical Grounding vs. Abstract Features

**IA-KRC** introduces physically-grounded reachability: agents can only communicate with partners they can physically reach within K steps. This outperforms abstract feature-based partner selection (GNNs, attention mechanisms) by orders of magnitude.

**ScienceClaw (DD#394)** achieves coordination through file-based artifact exchange — the "communication topology" is implicitly defined by which artifacts each agent can read/write. This is a different kind of physical grounding: filesystem structure constrains communication.

**BIGMAS (DD#390)** uses graph neural architectures but operates on abstract feature spaces without physical grounding. It works well in structured environments but lacks the robustness IA-KRC demonstrates in complex topologies.

**Insight:** Systems that ground communication in physical or structural constraints (reachability, filesystem access, artifact exchange) are more robust than systems that learn topology from abstract features alone.

### 3. Interference as Early Warning Signal

**IA-KRC** models interference as a directional potential field: enemy intent direction modulates cooperation cost. High interference along a path means agents should find a different communication partner.

**SCCAL (DD#376)** uses Ollivier-Ricci Curvature to detect cascading risks in MAS communication topology. Curvature anomalies precede semantic violations by several interaction turns — geometric deformation of the communication graph signals impending failure.

**Connection:** Both papers treat communication topology degradation as a *predictive signal* rather than a reactive metric. IA-KRC uses interference fields to *prevent* bad partnerships; SCCAL uses curvature to *detect* partnerships that are about to fail. These are complementary — preventive (IA-KRC) and diagnostic (SCCAL) views of the same phenomenon.

### 4. Multi-Timescale Architecture

**IA-KRC** introduces a three-layer map decomposed by rate of change: geometric (slow), regulation (medium), interference (fast). Each layer updates independently.

**ScienceClaw (DD#394)** uses a similar multi-timescale design: SOUL.md profiles (slow), heartbeat cycles of 6 hours (medium), real-time artifact exchange (fast).

**Our own P82 architecture** follows the same pattern: SOUL.md (slow), heartbeat.md (medium), todo.md and workspace files (fast).

**Pattern:** Successful multi-agent architectures decompose their coordination state into layers by rate of change. This is independently discovered across MARL, autonomous discovery, and our own system.

---

## ACTIONABLE SYNTHESIS

### For Multi-Agent System Design:
1. **Invest in partner selection before message encoding** — the IA-KRC result suggests topology selection has 5-30× more impact than message content optimization
2. **Ground communication in structural constraints** — filesystem paths, reachability, artifact access rather than abstract learned topology
3. **Decompose coordination state by timescale** — separate static structure from dynamic interference
4. **Treat topology degradation as predictive signal** — combine IA-KRC's preventive interference avoidance with SCCAL's diagnostic curvature monitoring

### For Our Own Architecture (P82):
- Our heartbeat-based system implicitly constrains communication topology (agents communicate through shared files, not direct messaging)
- The "interference" analog in our system is **resource contention** — two agents trying to write the same file, or one agent's output invalidating another's work
- Consider: could we compute "cooperation cost" between agent pairs based on workspace overlap and conflict history?

---

## OPEN QUESTIONS

1. Does the IA-KRC reachability paradigm transfer to LLM-based MAS where "distance" is semantic rather than physical?
2. Can SCCAL's curvature metrics be combined with IA-KRC's interference fields for a unified communication health metric?
3. Is there an optimal K for different system scales? DD#391's Amdahl's Law analysis suggests K should shrink as system size grows.
4. How does the multi-timescale decomposition pattern interact with the pressure-safety inversion (DD#389/CR#226)? Does pressure accelerate all timescales or selectively the fastest one?

---

**Portfolio Update:** CR#228. DD count: 398. CR count: 228.
