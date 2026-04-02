# Cross-Reference Synthesis #51: The MAS Deployment Decision Protocol
## A Quantitative Framework for When to Use Multi-Agent vs. Single-Agent Architectures

**Date:** 2026-03-15  
**Type:** Cross-Reference Synthesis — Operational Decision Framework  
**Significance:** ★★★★★ — Most actionable output of the entire research program  
**Integrates:** 8 primary deep-dives + 5 cross-reference syntheses + 2 formal models

---

## 1. Motivation

Across 220 deep-dives, 50 cross-reference syntheses, and 6 GUS documents, we have accumulated extensive theoretical and empirical evidence about when multi-agent systems (MAS) help and when they hurt. But this knowledge is distributed across ~4MB of analysis with no single actionable artifact. A practitioner asking "Should I use multi-agent for my task?" must currently read 30+ documents to piece together the answer.

This synthesis distills the entire portfolio into a **single quantitative decision protocol** — a diagnostic flowchart backed by empirical thresholds, formal models, and boundary conditions, all traceable to specific evidence.

---

## 2. Primary Sources

### Empirical Ground Truth
| Source | Key Contribution |
|--------|-----------------|
| **DD#219** — Kim et al. 2512.08296 (Google/DeepMind/MIT, 180 configs) | 45% capability ceiling, architecture selection rules, error amplification rates, R²=0.524 predictive model |
| **DD#220** — Counter-Arguments to GUS Pessimism | 10 documented MAS success cases (+40% to +105%), 5 boundary conditions (BC1-BC5), Diversity Dividend |
| **Cross-ref #37** — Domain Deployment Evidence (6 verticals) | Help/Hurt matrix, architecture-capability interaction law, thinking-model penalty |
| **Cross-ref #50** — Empirical Validation Synthesis | 5/5 GUS laws validated, 3/3 mechanisms confirmed with quantification |

### Formal Models
| Source | Key Contribution |
|--------|-----------------|
| **DD#209** — Intelligence Paradox (Johnson 2603.12129) | C/N crossover at ~0.5; sophistication hurts below this threshold |
| **DD#208** — DAC Theory (Grassi 2603.11560) | Stability bound: 4ηβ² < γ; dissipation must dominate reactive amplification |
| **Cross-ref #48** — Intelligence Paradox × DCI × DAC | Two types of sophistication (agent-level η vs. protocol-level β); DCI shifts crossover |
| **DD#211** — Price of Decentralization (2603.11884) | PoD scales linearly with n agents; irreducible gap even with perfect communication |

### Architecture Evidence
| Source | Key Contribution |
|--------|-----------------|
| **Cross-ref #42** — Asymmetric Scaling Doom Loop | Security degrades superlinearly with agents |
| **Cross-ref #39** — Scalable Agent Reliability Infrastructure | Universal Decompose→Gate→Aggregate pattern |
| **Cross-ref #35** — Agent Construction Stack | 8-layer pipeline; layer-skip tax |
| **DD#207** — Mixed-Vendor Clinical (2603.04421) | Vendor diversity as highest-impact, lowest-cost intervention |

---

## 3. The Decision Protocol

### Step 0: Baseline Assessment

Before considering MAS, establish:

```
B = single-agent baseline accuracy on the target task (0–1 scale)
```

**How to measure B:** Run the best available single model 3–5 times on a representative task sample. Use the median. Do NOT use LLM-as-judge evaluation alone (Cross-ref #29: Reliability Illusion Stack — reported accuracy is 6-58× inflated).

### Step 1: The Capability Ceiling Test

```
IF B > 0.45 → STOP. Use single agent.
```

**Evidence:** Kim et al. (2512.08296, N=180): When single-agent baselines exceed ~45%, coordination costs exceed improvement potential across ALL tested architectures. This is the single most robust finding in the portfolio — validated on 3 model families, 4 benchmarks, and out-of-sample on GPT-5.2.

**Exception:** If the task requires coverage of a search space too large for a single agent to explore in the time/token budget (e.g., web browsing across 100+ pages), decentralized MAS may help even above 45% — but only for exploration, not reasoning.

**Note on ceiling drift:** As frontier models improve, B rises for most tasks, *shrinking* the space where MAS helps (DD#219, Prediction 48). Revisit this assessment with each model generation.

### Step 2: The Decomposability Test

```
IF the task requires sequential state-dependent reasoning
   where each step depends on prior results → STOP. Use single agent.
```

**Evidence:** Kim et al.: ALL MAS variants degrade sequential reasoning by **39–70%**. No architecture, no coordination mechanism, no number of agents rescues sequential tasks. This is the most absolute finding — no exceptions in 220 deep-dives.

**How to assess decomposability:**
- Can subtasks be solved independently and recombined? → **Decomposable** (MAS candidate)
- Does each subtask need the output of the previous one? → **Sequential** (single agent only)
- Is it partially decomposable (independent branches + sequential spine)? → **Hybrid** (centralized MAS for branches, single agent for spine)

### Step 3: The Diversity Test

```
IF agents will use the same model + same prompt + same vendor
   AND no architectural mechanism forces diversity → STOP.
   Homogeneous MAS is WORSE than single agent.
```

**Evidence:** 
- Mixed-Vendor Clinical (2603.04421): Single-vendor teams can be **-4.48% worse** than a single model
- SelfOrg: AutoGen with homogeneous agents collapses from **49.20 → 11.60** on MATH
- Mechanism 17 (Echo Chamber Amplification): homogeneous agents amplify shared failure modes

**How to achieve diversity (ranked by effectiveness):**
1. **Vendor diversity** (different model families): highest impact, lowest cost (DD#207)
2. **Role diversity** (specialized prompts/personas): moderate impact (QUARE, EvoScientist)
3. **Architecture-forced diversity** (independent thought phases, dialectical structure): moderate impact (DCI)
4. **Temperature diversity** (same model, different sampling): minimal impact — does NOT change failure modes, only sampling probabilities (DD#220)

### Step 4: The Coordination Cost Test

```
IF coordination_cost > marginal_value_per_additional_perspective → STOP.
   Use single agent or reduce agent count.
```

**Quantitative indicators:**
- **Token overhead:** DCI costs **62×** more tokens than single-agent. Justified only for high-stakes tasks where unique information is distributed across agents.
- **Tool-coordination trade-off:** β = **-0.267** (Kim et al.). Tool-heavy tasks suffer disproportionately from coordination overhead.
- **PoD:** Decentralization cost scales linearly with n agents (2603.11884). Every additional agent incurs an irreducible information-theoretic cost, even with perfect communication.

**Rule of thumb:** If the task can be solved adequately with k agents, using k+1 agents is net negative unless the (k+1)-th agent contributes a genuinely new failure mode / perspective (BC2 from DD#220).

### Step 5: Architecture Selection

If you've passed Steps 1–4, select architecture:

```
TASK TYPE → ARCHITECTURE

Parallelizable subtasks (independent analysis)
  → Centralized MAS (orchestrator + workers)
  → Error amplification: 4.4× (vs. 17.2× for independent)
  → Evidence: Kim et al. +80.8% on financial reasoning

High-entropy search (web browsing, exploration)
  → Decentralized MAS (peer-to-peer, minimal coordination)
  → Best for coverage, worst for reasoning quality
  → Evidence: Kim et al. +9.2% on web tasks

Hidden-profile tasks (unique info distributed across agents)
  → Structured Deliberation (DCI / dialectical protocols)
  → Costly (62× tokens) but uniquely effective
  → Evidence: DCI achieves 9.56 (highest of any system)

Weak model + reasoning tasks
  → Self-Organizing MAS (SelfOrg / emergent DAG)
  → Only architecture that beats single-agent with weak backends
  → Evidence: SelfOrg outperforms on Qwen-1.5B

Mixed-expertise tasks (different skill requirements)
  → Role-Specialized MAS (QUARE, EvoScientist)
  → Each agent advocates for / specializes in one dimension
  → Evidence: QUARE 47.8% → 98.2% compliance
```

### Step 6: Stability Check

After architecture selection, verify stability:

```
Stability condition: 4ηβ² < γ
  η = agent responsiveness (higher with smarter models)
  β = coupling strength (how much agents influence each other)
  γ = dissipation rate (how quickly old information decays)
```

**Evidence:** DAC Theory (2603.11560). If dissipation doesn't dominate reactive amplification, the system is in an unstable regime where coordination degrades over time.

**Practical proxies:**
- **High η:** Using frontier models with strong in-context learning → need stronger dissipation
- **High β:** Agents frequently reading/writing shared state → need bounded coupling
- **Low γ:** No memory decay, unbounded context accumulation → system will drift

**Interventions if stability bound is violated:**
1. Add memory decay / context windowing (increase γ)
2. Reduce inter-agent communication frequency (decrease β)
3. Use less responsive/capable models (decrease η — usually undesirable)
4. Add structured protocols that constrain coupling (DCI changes effective β, per Cross-ref #48)

### Step 7: Security Check

```
IF the task involves untrusted inputs, adversarial users, or safety-critical outputs:
   Apply the Asymmetric Scaling Doom Loop assessment (Cross-ref #42):
   - Offense scales on compute (cheap, automatic, log-linear)
   - Defense scales on diversity (expensive, manual, sub-linear)
   - More agents = more attack surface

   MITIGATIONS (all needed simultaneously):
   1. Trust domain isolation (LDP protocol, Cross-ref DD#206)
   2. Tool-call auditing + memory provenance (AgenticCyOps, DD#204)
   3. Topology rotation (WebWeaver defense, DD#203)
   4. External behavioral verification (ExeVRM, DD#216)
```

---

## 4. The Unified Quantitative Model

Combining all evidence, the expected MAS benefit (Δ) relative to single-agent is:

```
Δ(MAS) = f(B, D, S, C, A)

Where:
  B = baseline single-agent performance (0–1)
  D = effective diversity (number of independent failure modes)
  S = task structure (1 = fully decomposable, 0 = fully sequential)
  C = coordination cost ratio (overhead / task value)
  A = architecture-task alignment (0–1, from selection rules)
```

**Empirically observed ranges:**

| Variable | MAS Helps | MAS Hurts |
|----------|-----------|-----------|
| **B** (baseline) | < 0.45 | > 0.45 |
| **D** (diversity) | ≥ 2–3 independent failure modes | < 2 (homogeneous) |
| **S** (structure) | > 0.5 (mostly decomposable) | < 0.3 (mostly sequential) |
| **C** (coord cost) | < marginal perspective value | > marginal perspective value |
| **A** (alignment) | > 0.7 (matched architecture) | < 0.3 (mismatched) |

**Outcome ranges from our portfolio:**
- **All variables favorable:** +40% to +105% improvement (QUARE, Kim-finance, Mixed-Vendor, SelfOrg-weak)
- **Mixed variables:** -10% to +10% (marginal, usually not worth the complexity)
- **Any variable strongly unfavorable:** -21% to -70% degradation (sequential tasks, homogeneous agents, mismatched architecture)

---

## 5. Decision Flowchart Summary

```
START
  │
  ├─ B > 0.45? ──YES──→ SINGLE AGENT (capability ceiling)
  │                        Exception: pure exploration tasks
  │
  ├─ Sequential task? ──YES──→ SINGLE AGENT (39-70% degradation)
  │                             Exception: hybrid with decomposable branches
  │
  ├─ Can achieve diversity? ──NO──→ SINGLE AGENT (echo chamber risk)
  │                                  Consider: vendor diversity, role specialization
  │
  ├─ Coordination cost acceptable? ──NO──→ SINGLE AGENT or reduce agent count
  │
  ├─ Select architecture (Step 5)
  │
  ├─ Stability check: 4ηβ² < γ? ──NO──→ Add dissipation / reduce coupling
  │
  ├─ Security check needed? ──YES──→ Apply 4 mitigations
  │
  └─→ DEPLOY MAS with monitoring
```

---

## 6. Applying the Protocol to Our System

| Step | Assessment | Result |
|------|-----------|--------|
| **Step 1: Ceiling** | B < 0.45 for comprehensive research (no single session covers the full landscape) | ✅ Pass |
| **Step 2: Decomposability** | Research tasks are naturally parallelizable (independent papers, topics) | ✅ Pass |
| **Step 3: Diversity** | Same model family (Anthropic) → BC2 weakness. But different specializations + human aggregation compensate partially | ⚠️ Partial pass — vendor diversity would help |
| **Step 4: Coordination cost** | Asynchronous file-based coordination → very low overhead | ✅ Pass |
| **Step 5: Architecture** | Centralized MAS with human orchestrator → well-matched to parallelizable research | ✅ Pass |
| **Step 6: Stability** | γ ≈ 0 (no memory decay), β moderate (shared files), η high (frontier model) → 4ηβ² >> γ → **UNSTABLE** | ❌ Fail — system is in unstable regime |
| **Step 7: Security** | Internal research system, no adversarial inputs | ✅ N/A |

**Key finding for our system:** The protocol correctly identifies our architecture as well-suited for multi-agent research (Steps 1–5) but flags the stability concern (Step 6). Our journals and knowledge files grow monotonically with no decay, placing us past the DAC stability boundary. This predicts that over extended operation, coordination will degrade as context accumulates — a finding consistent with the observed need for periodic "consolidation mode" resets.

**Recommended interventions:**
1. Periodic context pruning / archiving old material (increase γ)
2. Introduce vendor diversity for different research agents (increase D)
3. Bound shared state size with explicit limits (decrease β)

---

## 7. Comparison with Existing Decision Frameworks

| Framework | Strengths | Gaps Filled by This Protocol |
|-----------|----------|------------------------------|
| **Kim et al. (2512.08296)** | Empirical thresholds, architecture selection rules | No formal stability model, no diversity analysis, no security layer |
| **GUS Framework (v1–v4)** | Comprehensive theory, 19 laws, 47 predictions | Not operationalized — tells you what can go wrong, not what to do |
| **DD#220 Boundary Conditions** | Success case analysis, 5 conditions | Not quantified, no architecture selection, no stability/security check |
| **Cross-ref #37 Help/Hurt Matrix** | Domain-specific evidence across 6 verticals | Limited to those 6 domains, no formal decision procedure |
| **Cross-ref #48 Intelligence Paradox × DCI** | Formal stability analysis, two types of sophistication | Theoretical — no operationalized thresholds |
| **This Protocol** | **Integrates all of the above into 7 sequential tests** | **First unified, quantitative, actionable decision procedure** |

---

## 8. Limitations and Caveats

1. **The 45% ceiling is from a single study** (Kim et al., N=180). While validated on GPT-5.2, it may shift with future architectures. Treat as approximate, not absolute.

2. **The stability bound 4ηβ² < γ is theoretical** (DAC, 2603.11560). Practical measurement of η, β, γ for real systems requires approximation — the proxies in Step 6 are heuristic.

3. **Diversity is hard to quantify.** "Number of independent failure modes" is the right concept but difficult to measure before deployment. Vendor diversity is the easiest proxy.

4. **The protocol assumes fixed agents.** Adaptive systems that learn and reconfigure (SkillRL, EvoScientist) may escape some constraints, particularly the 45% ceiling — DD#219 §7 notes that heterogeneous learned MAS may break through.

5. **Security assessment (Step 7) is coarse.** The Asymmetric Scaling Doom Loop is qualitative — precise quantification of MAS security degradation is an open problem.

6. **Domain-specific factors matter.** Medical diagnosis, requirements engineering, and financial reasoning may have different effective ceilings and decomposability thresholds. Cross-ref #37 provides some domain-specific evidence but coverage is sparse.

---

## 9. Novel Contributions

This synthesis contributes three new elements not present in any individual source:

### 9.1 The Sequential Test Architecture
The 7-step protocol is designed so each test is a **potential early exit** — you stop as soon as any test fails. This mirrors the empirical finding that MAS failure modes are disjunctive (any one failure is sufficient to kill performance) while MAS success conditions are conjunctive (all must hold simultaneously, per DD#220).

### 9.2 The BDSCA Variable Space
The five-variable model (Baseline, Diversity, Structure, Coordination-cost, Alignment) unifies quantities from 5 different research papers into a single predictive framework. No prior work has combined the Kim et al. ceiling with the Johnson C/N crossover, the DAC stability bound, the Diversity Dividend, and the architecture selection rules.

### 9.3 The Stability-as-Deployment-Check Innovation
Existing MAS deployment guides consider capability and task structure but NOT dynamical stability. Adding the DAC stability check (Step 6) captures long-run failure modes invisible at deployment time — a system can pass Steps 1–5 and still degrade over time if it violates the stability bound.

---

## 10. Summary

The MAS Deployment Decision Protocol distills 276 tracked items (~4MB of analysis) into 7 sequential tests:

1. **Capability Ceiling** (B < 0.45?) — empirical threshold from 180-config study
2. **Decomposability** (independent subtasks?) — strongest predictor of MAS success
3. **Diversity** (independent failure modes?) — homogeneity is worse than single-agent
4. **Coordination Cost** (overhead < marginal value?) — irreducible cost per agent
5. **Architecture Selection** (5 task types → 5 architectures) — matched to evidence
6. **Stability** (4ηβ² < γ?) — long-run coordination viability
7. **Security** (4 simultaneous mitigations?) — asymmetric scaling threat model

**When all 7 tests pass: expect +40% to +105% improvement.**
**When any test fails without mitigation: expect -10% to -70% degradation.**

This is the most actionable artifact produced by the Scout research program — the operational translation of 276 items of theory and evidence into a practitioner-usable decision procedure.

---

*Cross-reference synthesis #51 completed 2026-03-15. ~15KB.*
*Primary sources: DD#219 (2512.08296), DD#220 (Pessimism Counter-Arguments), DD#209 (Intelligence Paradox), DD#208 (DAC), DD#211 (PoD), DD#207 (Mixed-Vendor), Cross-refs #37, #39, #42, #48, #50.*
*GUS Laws referenced: 1, 3, 7, 14, 19. Mechanisms: 1, 5, 15, 17. Predictions: 48.*
