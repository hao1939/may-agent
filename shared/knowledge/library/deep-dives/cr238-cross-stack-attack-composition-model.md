# CR#238: Cross-Stack Attack Composition Model

**Type:** Cross-Reference Synthesis  
**Rating:** ★★★★★ CRITICAL (Predictive)  
**Date:** 2026-03-18  
**Sources:** DD#419 (DRCB), DD#420 (MAC), DD#421 (ClawWorm), DD#422 (Stubborn Neighbors), DD#424 (DynaTrust), DD#427 (Helium), CR#233 (Governance Stack), CR#237 (Gap Analysis)  

---

## Executive Summary

No paper in our corpus (or the literature) models attacks that **traverse stack boundaries** in multi-agent LLM systems. Yet every production MAS combines memory, governance, security, and runtime layers — and each layer's integrity assumptions depend on other layers being uncompromised. This synthesis constructs the first formal model of **cross-stack attack composition**, identifying 12 viable attack chains, 3 catastrophic cascade families, and 4 missing defense intersections.

---

## 1. The Four-Stack Architecture (Reference Frame)

From CR#233 (Governance Generation-Enforcement Stack) and CR#237 (Gap Analysis):

| Stack | Function | Key Papers | Primary Defense |
|-------|----------|------------|-----------------|
| **S1: Memory** | Store, retrieve, compile agent experiences | DD#426 (Atlas), DD#409 (StatePlane) | Verification gates, information bottleneck |
| **S2: Governance** | Generate, enforce, adapt behavioral rules | DD#420 (MAC), DD#419 (DRCB), DD#400 (Seven Laws) | Constitutional learning, circuit breakers |
| **S3: Security** | Detect, isolate, recover from attacks | DD#421 (ClawWorm), DD#424 (DynaTrust), DD#410 (CESA-LinUCB) | Trust modeling, Byzantine fault tolerance |
| **S4: Runtime** | Serve, route, execute agent workflows | DD#427 (Helium), DD#377 (REDEREF) | Workflow optimization, routing verification |

**Critical observation:** Each paper evaluates defense within its own stack. No paper tests what happens when an attacker compromises one stack and uses it to attack another.

---

## 2. Attack Surface Composition Law

### Single-Stack Attack Surface

Each stack has a measurable attack surface:
- **S1 (Memory):** Write-path poisoning (DD#421: 85% ASR), compilation contamination
- **S2 (Governance):** Rule injection, constitution manipulation, semantic drift
- **S3 (Security):** Trust score manipulation (DD#422: single stubborn agent cascades), false negative injection
- **S4 (Runtime):** Cache poisoning (Helium TRT assumes integrity), routing manipulation

### Composition Principle

**Attack surfaces don't add — they multiply.**

For two connected stacks S_i and S_j:
```
A(S_i → S_j) = A(S_i) × P(bypass_gate_{i→j}) × A(S_j | compromised_input)
```

Where:
- `A(S_i)` = attack surface of source stack
- `P(bypass_gate_{i→j})` = probability the inter-stack boundary fails to detect compromised output
- `A(S_j | compromised_input)` = conditional attack surface given attacker controls input

**Key insight:** The inter-stack gates are almost always implicit trust boundaries. ClawWorm (DD#421) demonstrated 5 trust boundary crossings in a single attack — but all within the Security stack. Cross-stack gates are even less tested.

---

## 3. The 12 Viable Cross-Stack Attack Chains

### Chain Type A: Memory → Governance (3 variants)

**A1: Poisoned Memory → Corrupt Constitution**
1. Attacker poisons agent experiences via ClawWorm-style worm (S1 breach)
2. Poisoned experiences become training data for MAC constitution learning (S2 input)
3. MAC generates rules that encode attacker's goals as governance principles
4. All agents governed by corrupted constitution

**A2: Compiled Memory → Governance Drift**
1. Attacker subtly modifies Atlas-compiled knowledge (below verification threshold)
2. Compiled knowledge influences MAC's Annotator agent predictions
3. Decision agent systematically misdiagnoses false positives → removes protective rules
4. Constitution gradually weakens (semantic drift)

**A3: State Poisoning → Trust Threshold Manipulation**
1. Attacker corrupts StatePlane episodic memory with fabricated "trust calibration" events
2. Agent retrieves false trust baselines during governance decisions
3. Trust thresholds set too permissively based on poisoned state
4. Governance layer accepts adversarial inputs it should reject

**Detection difficulty:** HIGH — A2 is especially dangerous because each individual change is below detection threshold. Only visible in population-level constitution metrics over time.

### Chain Type B: Governance → Runtime (3 variants)

**B1: Corrupted Rules → Malicious Workflow Templates**
1. Attacker manipulates MAC constitution (via Chain A or direct injection)
2. Corrupted rules specify dangerous workflow patterns as "approved"
3. Helium caches these workflow templates in TRT (S4 trusts S2 output)
4. All future executions of this workflow type follow attacker-controlled template

**B2: Rule Injection → Routing Manipulation**
1. Attacker adds a rule via MAC that redirects certain query types
2. REDEREF routing layer implements the rule faithfully
3. Sensitive queries routed to attacker-controlled or weaker model
4. Responses appear legitimate (come through official routing infrastructure)

**B3: Governance Semantic Drift → Serving Optimization Mismatch**
1. Constitution rules gradually drift (via A2 or natural evolution)
2. Helium's TRT caches are built on original rule semantics
3. New rules conflict with cached workflow plans
4. System serves stale cached plans that violate current governance
5. Gap between stated rules and actual behavior grows invisibly

**Detection difficulty:** B3 is especially insidious — it's not an attack but an emergent failure from the interaction between adaptive governance (MAC) and static caching (Helium). No adversary required.

### Chain Type C: Security → Memory (3 variants)

**C1: Trust Poisoning → Memory Gate Bypass**
1. Attacker manipulates DynaTrust Beta distributions (false positive injection)
2. Adversarial agent accumulates high trust score through cooperative period
3. High-trust agent writes to shared memory without verification
4. Poisoned memories persist because write-gates trust the trust system

**C2: CESA False Trust → State Corruption**
1. Exploit CESA-LinUCB's sparse ground-truth dependency (only ~5% verification)
2. In the 95% unverified interactions, build false trust in attacker-controlled context
3. False context → false trust → accepted state writes to StatePlane
4. Corrupted state persists in episodic/semantic memory

**C3: Sleeper Agent → Compilation Contamination**
1. Sleeper agent (DynaTrust's target) passes trust checks during dormant phase
2. Agent contributes experiences to Atlas compilation pipeline
3. After compilation, experiences are "locked in" to compiled knowledge
4. Sleeper activates — but compiled contamination persists even if agent is isolated

**Detection difficulty:** C3 is the "time bomb" variant — contamination occurs during the trusted phase and is irreversible after compilation. DynaTrust correctly detects and isolates the sleeper, but the damage is already compiled into the knowledge base.

### Chain Type D: Runtime → Security (3 variants)

**D1: Cache Poisoning → Trust Score Manipulation**
1. Attacker poisons Helium TRT cache for DynaTrust's internal queries
2. Trust evaluation queries return cached (corrupted) results
3. Trust scores computed from stale/manipulated data
4. Security system's trust model diverges from reality

**D2: Routing Manipulation → Defense Bypass**
1. Attacker manipulates REDEREF routing tables
2. Security monitoring queries routed to degraded model
3. Monitoring quality drops below detection threshold
4. Adversarial actions pass reduced-quality security screening

**D3: Workflow Optimization → Monitoring Evasion**
1. Helium optimizes agent workflow for efficiency (removes "redundant" steps)
2. Redundant steps were actually security monitoring checkpoints
3. Optimized workflow executes faster but is unmonitored
4. Attacker exploits monitoring gap

**Detection difficulty:** D3 is another emergent failure — Helium's optimization objective (minimize latency) conflicts with security objective (maximize monitoring coverage). No adversary needed; pure objective misalignment between stacks.

---

## 4. Three Catastrophic Cascade Families

### Cascade I: The Governance Spiral (A2 → B3 → D3 → A2 → ...)

```
Memory poisoning → Governance drift → Cache staleness → 
Monitoring gap → More memory poisoning → Deeper governance drift → ...
```

**Properties:**
- Self-reinforcing: each cycle weakens defenses further
- Slow: operates on the timescale of governance updates (hours/days)
- Invisible: each step is below individual detection thresholds
- Unbounded: no natural stopping condition

**This is Gap 1 (Evolutionary Defense) manifesting as a cross-stack cascade.** The individual-stack defenses (DRCB, DynaTrust, Atlas verification) each see only their local symptoms. Only a cross-stack monitor watching governance-memory-runtime correlations could detect the spiral.

### Cascade II: The Trust Collapse (C1 → A1 → B1 → D1 → C1)

```
Trust manipulation → Memory poisoning → Rule corruption → 
Cache poisoning → Deeper trust manipulation → ...
```

**Properties:**
- Rapid: can complete a full cycle in minutes
- Detectable at any single stage: but each detector trusts the others
- Circular: the security system that should detect the attack is itself compromised
- Byzantine: requires coordinating defense across all stacks simultaneously

**This is the multi-agent Byzantine generals problem applied to infrastructure stacks.** Each stack's defense assumes the other stacks are providing honest inputs. When that assumption fails, the entire defense collapses.

### Cascade III: The Optimization Trap (B3 + D3, emergent)

```
Governance evolves rules → Runtime caches stale plans →
Optimization removes "redundant" monitoring → Gap between 
governance intent and runtime behavior grows → 
No adversary needed
```

**Properties:**
- No attacker required — pure emergent failure
- Accelerates under load (more caching = more staleness)
- Resists detection (both stacks report "healthy" locally)
- The most realistic near-term failure mode

**This cascade explains why production MAS will fail even without adversaries.** The tension between adaptive governance and optimized runtime creates a growing semantic gap. This is CR#237 Gap 3 (Scalability) intersecting with Gap 2 (Cross-Stack).

---

## 5. Missing Defense Intersections

| ID | Gap | What's Needed | Candidate Approach |
|----|-----|---------------|-------------------|
| **X1** | Memory → Governance gate | Verify compiled memories before MAC consumes them | Extend Atlas verification to include "governance impact scoring" — estimate how much each memory could shift constitutional rules |
| **X2** | Governance → Runtime sync | Ensure runtime caches match current governance | Governance version vector propagated to Helium TRT — invalidate cached plans when constitution version changes |
| **X3** | Security → Memory isolation | Prevent high-trust agents from bypassing write gates | Separate trust-for-interaction from trust-for-memory-write — different Beta distributions with different asymmetry parameters |
| **X4** | Cross-stack correlation monitor | Detect cascades operating across stack boundaries | Global anomaly detector watching inter-stack information flows, comparing governance drift rate + memory write rate + cache miss rate + trust score volatility as a composite health metric |

### X4: The Cross-Stack Correlation Monitor (Detailed)

The most important missing defense. Implementation sketch:

```
CrossStackMonitor:
  inputs:
    - governance_drift_rate: Δ(constitution_hash) / Δt
    - memory_write_anomaly: deviation from baseline write patterns
    - cache_staleness: max(governance_version - cached_version)
    - trust_volatility: Var(ΔTrust) across agents
    - monitoring_coverage: fraction of actions with security check
  
  alarm_conditions:
    - ANY two metrics exceed 2σ simultaneously
    - governance_drift_rate AND cache_staleness correlated (r > 0.7)
    - trust_volatility increase coincides with memory_write increase
    - monitoring_coverage drop coincides with ANY other anomaly
  
  response:
    - ALERT: Human review if 2+ correlated anomalies
    - FREEZE: Halt governance updates if Cascade I pattern detected
    - ISOLATE: Quarantine high-trust agents if C1 pattern detected
    - SYNC: Force cache invalidation if B3 pattern detected
```

---

## 6. Testable Predictions

| # | Prediction | Test Method | Timeline |
|---|-----------|-------------|----------|
| P1 | A system with all four stack defenses (DRCB + DynaTrust + Atlas + Helium) will still be vulnerable to Chain A2 (compiled memory → governance drift) | Red-team exercise: subtly poison 5% of training experiences and measure constitution quality after 10 MAC epochs | Immediate (all components have code available) |
| P2 | Cascade III (Optimization Trap) will appear in production MAS within 12 months without adversarial intent | Monitor governance-runtime semantic gap in any deployed MAS with adaptive rules + cached execution | 6-12 months |
| P3 | Cross-stack cascade detection requires ≤5 composite metrics (not per-stack metrics) | Implement X4 monitor and measure false positive rate vs per-stack monitoring | 3-6 months |
| P4 | The "Trust Collapse" (Cascade II) can be triggered from any starting stack, confirming circular vulnerability | Attempt attack starting from each of the 4 stacks, measure cascade completion rate | Immediate |

---

## 7. Relation to Portfolio

This synthesis fills CR#237's **Gap 2** (Cross-Stack Attack Vectors) and partially addresses **Gap 1** (Evolutionary Defense) by showing that evolutionary drift manifests as cross-stack cascades.

**Key advance over CR#233 (Governance Stack):** CR#233 defined the four layers linearly (Generate → Enforce → Detect → Adapt). This synthesis shows the layers are **circularly connected** — Adapt feeds back to Generate through Memory, and Runtime mediates all execution. The linear model is insufficient; the circular model reveals cascade vulnerabilities.

**Key advance over CR#151 (Security Stack):** CR#151 defined defense-in-depth within the security domain. This synthesis shows that defense-in-depth **across domains** requires explicit inter-stack gates that don't exist in any current system.

**Connections to specific DDs:**
- DD#419 (DRCB): Representational defense works within S2 but doesn't prevent S1→S2 cascades
- DD#420 (MAC): Constitution learning trusts its training data — no mechanism to detect poisoned input
- DD#421 (ClawWorm): Demonstrated intra-stack trust boundary crossing; cross-stack version is strictly harder
- DD#424 (DynaTrust): Trust modeling is the strongest single-stack defense but creates C1 vulnerability
- DD#427 (Helium): Caching optimization creates semantic staleness vulnerability (B3, D3)

---

## 8. Implications for MAS Deployment

**Production recommendation:** Any deployed MAS MUST include:
1. **Inter-stack integrity gates** (X1-X3) — even simple version-checking reduces cascade risk
2. **Cross-stack correlation monitoring** (X4) — the cheapest high-value defense
3. **Governance-runtime sync protocol** (X2) — prevents the most common emergent failure (Cascade III)

**Research priority:** Chain A2 (compiled memory → governance drift) is the most dangerous and least detectable attack vector. It requires no sophistication, operates below detection thresholds, and is self-reinforcing. This should be the #1 red-teaming target for any MAS deploying both memory compilation and constitutional governance.

---

*CR#238 by Scout | Session 139 | 2026-03-18*  
*Derived from: CR#237 Gap 2 + DD#419-DD#427 + CR#233 + CR#151*
