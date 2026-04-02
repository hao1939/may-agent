# CR#232: The Deliberation-Aware Control Plane — Adding Meta-Reasoning to the MAS Runtime Stack

*Cross-Reference Synthesis by Scout, 2026-03-18*
*Sources: DD#418 (DOVA), DD#415 (REDEREF), DD#408 (ILION), DD#417 (Spectral Guardrails), CR#153 (Runtime Control Plane), CR#160 (Safety Trilemma), CR#182 (Compute Budget Problem)*
*Rating: ★★★★★ CRITICAL — Completes the 4-plane control architecture*

---

## Thesis

CR#153 established a 3-plane MAS runtime control plane: **Routing** (REDEREF), **Safety** (ILION), and **Monitoring** (SCCAL). DOVA (DD#418) reveals a missing fourth plane: **Deliberation** — meta-reasoning about whether to engage the other three planes at all. When composed, this yields a complete 4-plane architecture where deliberation acts as a **governor** that modulates the activation of routing, safety, and monitoring based on task complexity.

This synthesis resolves a key tension in CR#153: the control plane adds overhead that isn't justified for simple queries. DOVA's deliberation gate provides the escape valve.

---

## 1. The Missing Plane Problem

CR#153's 3-plane architecture has an implicit assumption: **every query passes through all three planes.** This means:
- Every task gets Thompson-sampled routing (REDEREF) even if only one agent is appropriate
- Every action gets geometric safety gating (ILION) even if it's a read-only operation
- Every interaction contributes to curvature monitoring (SCCAL) even for trivial exchanges

DOVA's contribution is recognizing that **the decision to engage the control plane is itself a control decision.** Their deliberation layer achieves this by:
1. Assessing query complexity via meta-reasoning
2. Checking user model and conversation context
3. Deciding: RESPOND_DIRECTLY vs. USE_TOOLS
4. When engaging tools, selecting appropriate reasoning depth (6-level budget)

**The key formalization:** Let `f_d` = fraction of queries where deliberation selects RESPOND_DIRECTLY. For those queries, the entire control plane is bypassed. Cost savings = `f_d × (C_routing + C_safety + C_monitoring)`.

---

## 2. The Four-Plane Architecture

### Plane 0: Deliberation (NEW — from DOVA)
**Function:** Decide whether to engage the system at all, and at what depth.
**Input:** Query q, user model u, conversation context ξ
**Output:** {RESPOND_DIRECTLY, USE_TOOLS} + thinking_level ∈ {Off, Min, Low, Med, High, XHigh}
**Timescale:** Per-query (before any agent activation)
**Analogy:** The "power management" of the MAS — decides whether to wake up the hardware

### Plane 1: Routing (REDEREF — DD#415)
**Function:** Assign tasks to agents based on competence posteriors.
**Input:** Task decomposition from deliberation plane
**Output:** Agent assignment + confidence estimates
**Timescale:** Per-subtask
**Enhancement from DOVA:** Deliberation pre-filters the task space, reducing REDEREF's decision load

### Plane 2: Safety (ILION + Spectral Guardrails — DD#408/DD#417)
**Function:** Gate actions and detect hallucinations before execution.
**Input:** Proposed agent actions
**Output:** ALLOW/BLOCK per action + hallucination flags
**Timescale:** Per-action
**Enhancement from DOVA:** For RESPOND_DIRECTLY queries, safety plane reduces to output-only checking (no action gating needed). Spectral Guardrails (DD#417) provide the quality gate even for direct responses.

### Plane 3: Monitoring (SCCAL — DD#412)
**Function:** Detect structural degradation in multi-agent interactions.
**Input:** Communication graph topology
**Output:** HEALTHY/WARNING/CRITICAL
**Timescale:** Per-interaction-batch
**Enhancement from DOVA:** Monitoring intensity can be modulated by deliberation — Quick mode skips multi-agent monitoring entirely; Collaborative mode enables full curvature tracking.

---

## 3. Composition Protocol

The four planes compose as a **nested conditional pipeline:**

```
QUERY arrives
  ↓
[PLANE 0: DELIBERATION]
  ├─ RESPOND_DIRECTLY → bypass planes 1-3
  │   └─ [SPECTRAL CHECK on output] → return
  │
  └─ USE_TOOLS (thinking_level = L)
      ↓
      [PLANE 1: ROUTING] (REDEREF selects agents)
      ↓
      [For each agent action:]
      │  [PLANE 2: SAFETY] (ILION gates action)
      │  ├─ ALLOW → execute
      │  └─ BLOCK → escalate or retry
      ↓
      [After interaction round:]
      [PLANE 3: MONITORING] (SCCAL checks topology)
      ├─ HEALTHY → continue
      ├─ WARNING → reduce agent count, increase verification
      └─ CRITICAL → abort + fallback to single-agent mode
```

### Budget-Aware Plane Activation

DOVA's 6-level budget maps to plane activation:

| Thinking Level | Plane 0 | Plane 1 | Plane 2 | Plane 3 | Token Budget |
|---|---|---|---|---|---|
| Off | ✓ (bypass) | — | — | — | 0 |
| Minimal | ✓ (bypass) | — | Output check only | — | 1K |
| Low | ✓ | Single-agent | Output check only | — | 4K |
| Medium | ✓ | REDEREF routing | Per-action gate | — | 16K |
| High | ✓ | REDEREF + ensemble | Per-action gate | Periodic | 32K |
| XHigh | ✓ | REDEREF + collab. | Per-action gate + spectral | Continuous | 65K |

**Key insight:** This table is a concrete implementation of the "where to think" problem (CR#182). Each thinking level specifies exactly which planes are active and at what intensity.

---

## 4. Three Critical Integrations

### 4.1 DOVA Deliberation × REDEREF Routing

DOVA's deliberation decides **IF** to route. REDEREF decides **WHERE** to route.

**Composition:** Deliberation outputs a task specification with complexity estimate. REDEREF's Thompson sampling then selects agents, but with **prior adjustment based on deliberation output:**
- If deliberation says "simple factual query" → REDEREF can skip exploration, use highest-μ agent directly
- If deliberation says "complex multi-source synthesis" → REDEREF activates full exploration via Thompson sampling
- If deliberation identifies a specific tool need → REDEREF narrows candidate pool

**Mathematical connection:** DOVA's mandatory trigger function `CheckMandatoryTriggers(q)` can be integrated as a prior on REDEREF's Beta distributions. When triggers fire, set exploration parameter high. When deliberation says "respond directly," don't invoke REDEREF at all.

### 4.2 DOVA Confidence × Spectral Guardrails

DOVA's confidence scoring (Eq. 6: weighted combination of length, refusal, format, relevance) is **shallow** — it uses string-level heuristics. DD#417's Spectral Guardrails provide **deep** confidence via attention topology analysis.

**Proposed integration:**
```
C_composite(r, p) = w_shallow · C_DOVA(r, p) + w_deep · C_spectral(r)
```
Where:
- `C_DOVA` = fast heuristic confidence (sub-millisecond)
- `C_spectral` = spectral attention analysis (milliseconds, requires model internals)
- Weights modulated by thinking level: at Low thinking, use C_DOVA only; at XHigh, use composite

This resolves DOVA's biggest weakness (shallow confidence) while preserving its speed advantage for simple queries.

### 4.3 DOVA Adversarial Debate × SCCAL Monitoring

DOVA's Bull-vs-Bear debate (Algorithm 6) is an **adversarial collaboration pattern.** SCCAL's curvature monitoring can detect when debate dynamics are unhealthy:
- **Positive curvature between Bull and Bear** → Echo chamber — debate isn't adversarial enough, agents converging too quickly
- **Extreme negative curvature** → Complete disconnection — agents aren't engaging with each other's arguments
- **Curvature at moderate negative** → Healthy adversarial tension — arguments are being tested

**Monitoring protocol:** Track ORC between debate agents across rounds. If curvature collapses to positive after round 1, add a 3rd "Devil's Advocate" agent or extend to 3 rounds. If curvature remains extreme negative, force agents to explicitly address each other's strongest point before continuing.

---

## 5. The Deliberation-Safety Connection

The Safety Trilemma (CR#160) showed that no single approach achieves speed + coverage + adaptability:

| | Speed | Coverage | Adaptability |
|---|---|---|---|
| ILION (Geometric Gates) | ✓✓✓ | ✗ | ✗ |
| MAScope (Flow Analysis) | ✗ | ✓✓ | ✗ |
| MaMa (Adversarial Design) | ✗ | ✗ | ✓✓ |

**DOVA's deliberation resolves this by selecting the appropriate safety paradigm per query:**
- Quick/Minimal → ILION only (fast single-action check — sufficient for low-risk)
- Standard/Medium → ILION + output spectral check (fast gate + deep output verification)
- High/XHigh → Full stack (ILION per-action + MAScope trajectory analysis + spectral output verification)

The deliberation plane doesn't solve the trilemma — it **makes the trilemma dynamic.** You don't need all three properties for every query. You need the right property for the right query. Deliberation provides the routing.

---

## 6. Practical Recommendations for P82

### Immediate (this sprint):
1. **Add a deliberation gate to the manager agent.** Before dispatching to sub-agents, meta-reason about whether this query needs multi-agent processing at all. Expected savings: 30-50% of queries can be handled with a single agent pass.
2. **Implement 3-level thinking budget** (simplified from DOVA's 6): Quick (1 agent, no tools), Standard (1 agent + tools), Deep (multi-agent collaboration). Map each to a max token budget.

### Medium-term (next 2 sprints):
3. **Integrate REDEREF-style Thompson sampling for agent selection** when deliberation chooses multi-agent mode.
4. **Add Spectral Guardrails as output quality gate** — even for single-agent responses, check attention topology before returning to user.

### Long-term (quarterly):
5. **Full 4-plane architecture** with all components integrated and budget-adaptive plane activation.
6. **Monitoring-driven feedback loop** — SCCAL curvature anomalies feed back to deliberation, adjusting future routing decisions.

---

## 7. The Emerging Meta-Pattern

Across DD#418 (DOVA), DD#415 (REDEREF), DD#408 (ILION), DD#417 (Spectral Guardrails), DD#412 (SCCAL), and CR#153/160/182, we see a convergent architecture:

**Intelligent MAS runtime = Deliberation → Routing → Safety → Monitoring → Feedback**

This is not a coincidence. It mirrors established patterns in:
- **Computer networking:** Control plane (deliberation) → Data plane (routing) → Firewall (safety) → SNMP (monitoring)
- **Operating systems:** Scheduler (deliberation) → Dispatcher (routing) → Access control (safety) → Audit (monitoring)
- **Autonomous vehicles:** Planner (deliberation) → Controller (routing) → Safety system (braking) → Telemetry (monitoring)

The convergence across these domains suggests this 4-layer pattern is a **fundamental architecture for systems where autonomous components must coordinate under resource constraints with safety requirements.** The contribution of DOVA is providing the formal algorithms for the deliberation layer that was implicit but unspecified in CR#153.

---

*Filed: 2026-03-18T02:20Z by Scout*
*Predecessor: CR#153 (Runtime Control Plane). This synthesis adds the 4th plane (Deliberation) and shows how all components compose.*
*Cross-references: DD#418, DD#415, DD#408, DD#412, DD#417, CR#153, CR#160, CR#182*
