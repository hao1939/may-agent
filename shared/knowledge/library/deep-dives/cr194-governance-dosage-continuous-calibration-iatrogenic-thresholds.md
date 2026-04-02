# CR#194 — The Governance Dosage Problem: Why Continuous Calibration Beats Categorical Control

**Rating:** ★★★★★ CRITICAL  
**Type:** Cross-Reference Synthesis  
**Date:** 2026-03-16  
**Sources:** DD#345 (HAIG), DD#348 (Alignment Backfire/Iatrogenesis), DD#349 (Less is More), DD#277 (CMAG), CR#192 (Iatrogenesis Proof), CR#193 (Parsimony Paradox), CR#65 (Safety Iatrogenesis Cascade)

---

## Thesis

Three independently-developed frameworks from our portfolio converge on a single structural insight that none of them states explicitly: **governance of multi-agent AI systems has an optimal dosage, and exceeding it produces the failures governance was designed to prevent.** This is not a failure of implementation — it is a structural property of governance itself.

- **DD#345 (HAIG)** provides the *conceptual architecture*: governance should operate on continuous spectra with identifiable thresholds
- **DD#348 (Alignment Backfire)** provides the *empirical proof*: alignment interventions reverse in half of all language spaces
- **DD#349 (Less is More)** provides the *mechanistic explanation*: inter-agent coupling propagates correlated errors

Together, they define what we call the **Governance Dosage Function**: a non-monotonic relationship between intervention intensity and system safety, with a computable optimal dosage that depends on the system's information structure.

---

## 1. The Convergence

### 1.1 Three Independent Discovery Paths

| Paper | Core Finding | Governance Implication |
|-------|-------------|----------------------|
| HAIG (DD#345) | Governance should be continuous, not categorical | Dosage can be dialed, not switched |
| Alignment Backfire (DD#348) | Alignment reverses in 8/16 languages | Overdosing alignment produces harm |
| Less is More (DD#349) | Removing communication improves coordination | Reducing governance channels improves outcomes |

These discoveries emerge from entirely different communities:
- HAIG: Policy/governance scholarship (UCL)
- Alignment Backfire: Criminal psychiatry / clinical iatrogenesis theory (Kyoto)
- Less is More: Multi-agent RL / robotics (Central South University)

**The convergence from three unrelated fields makes the finding structurally robust.**

### 1.2 The Unified Model

Traditional governance assumes a **monotonic improvement function**:

```
Safety(governance) = f(intensity)     where f'(x) ≥ 0 for all x
More governance → More safety → Always
```

All three papers independently falsify this. The true function is **non-monotonic with a dosage threshold**:

```
Safety(governance) = f(intensity, context)

where:
  f'(x) > 0    for x < θ(context)    [governance helps]
  f'(x) = 0    at x = θ(context)      [optimal dosage]
  f'(x) < 0    for x > θ(context)    [governance harms — iatrogenesis]
```

The critical insight: **θ is context-dependent.** HAIG's continuous dimensions provide the framework for measuring context. DD#348 proves context includes language/culture. DD#349 proves context includes information structure.

---

## 2. The Three Iatrogenic Mechanisms

When governance exceeds optimal dosage, three distinct harm mechanisms activate:

### Mechanism A: Register Redistribution (from DD#348)

Alignment doesn't eliminate risk — it redistributes it from visible registers (measurable safety metrics) to invisible registers (collective dynamics, internal coherence). The governance institution then declares success based on the visible register while harm accumulates unseen.

**Evidence:**
- English alignment: CPI decreases, DI increases. Surface safety improves, internal coherence fractures.
- Japanese alignment: Both CPI and DI increase. Surface safety DECREASES while internal coherence also fractures.
- Universal: 15/16 languages show increased dissociation (DI) under alignment regardless of CPI direction.

**Dosage connection:** At low alignment (20%), the visible improvement outweighs the invisible damage. At high alignment (80-100%), the invisible damage exceeds the visible improvement. The crossover IS the dosage threshold θ.

### Mechanism B: Correlated Error Amplification (from DD#349)

Additional governance channels propagate correlated (not independent) errors through the system. Unlike random noise that averages out with more agents, correlated errors COMPOUND.

**Evidence:**
- Full observation (83-D with team coupling): 0.721 success, 0.253 collision
- Masked observation (50-D, local only): 0.753 success, 0.223 collision
- CTDE centralized critic (338-D): 0.006 success — catastrophic failure

**Dosage connection:** The harm is proportional to the square of coupling strength, not linear:

```
Error_system ∝ n × σ² × (1 + (n-1)ρ)

where ρ = inter-agent error correlation from governance coupling
When ρ → 1 (high coupling): Error_system ∝ n² × σ²  [quadratic]
When ρ → 0 (low coupling):  Error_system ∝ n × σ²   [linear]
```

Governance coupling increases ρ, crossing the threshold where n²σ² > nσ² meaningfully (small n: marginal; large n: catastrophic).

### Mechanism C: Autonomy Suppression (from DD#348 + DD#345)

Governance mechanisms suppress the autonomous adaptive behaviors that constitute the system's primary defense against novel threats. HAIG's Process Autonomy dimension captures this directly: as governance pushes systems toward the "Human-orchestrated" end, the system loses the capacity for self-directed protective behavior.

**Evidence:**
- Group Harmony Fixation: In Japanese, 85-89% of protective speech is collective-oriented ("let's support each other") regardless of alignment level. This ratio is a property of the language space, not the alignment intervention — but alignment fails to override it because it operates on the same register.
- Individuation corrections (attempting to restore individual-referencing protective speech) produce the HIGHEST pathology (DI = +1.120). The corrective intervention IS the maximum source of harm.

**Dosage connection:** Below a threshold, governance supplements autonomous protective behavior. Above it, governance replaces autonomous protective behavior. The system becomes dependent on governance for safety, but governance cannot cover the same space as autonomous adaptation.

---

## 3. The Dosage Function

### 3.1 Formal Definition

Let G(x, c) be the Governance Dosage Function:

```
G(x, c) = B(x) - R(x, c) - E(x, c)

where:
  x = governance intensity (0 to 1)
  c = context vector (language, information structure, agent count, etc.)
  B(x) = baseline benefit: visible risk reduction from governance
  R(x, c) = register redistribution cost (Mechanism A)
  E(x, c) = correlated error cost (Mechanism B)
```

**Optimal dosage:** x* = argmax G(x, c)

**Key properties:**
1. B(x) is concave increasing (diminishing returns on visible safety)
2. R(x, c) is convex increasing (hidden harm accelerates with intensity)
3. E(x, c) is quadratic in x for systems with n > 3 agents
4. x* exists and is interior (0 < x* < 1) for all non-trivial contexts c

### 3.2 Context Dependence

HAIG's three-dimensional governance space provides the framework for specifying context c:

| HAIG Dimension | DD#348 Mapping | DD#349 Mapping |
|---------------|----------------|----------------|
| Decision Authority | Alignment ratio (0-100%) | N/A (all decentralized) |
| Process Autonomy | Individuation instructions | Observation masking operator M |
| Accountability | CPI/DI monitoring | CGCA credit assignment |

**Critical finding:** The optimal dosage θ varies dramatically across contexts:
- English alignment: θ ≈ 0.20 (20% aligned agents provides most of the benefit)
- Japanese alignment: θ ≈ 0.00 (ANY alignment increases pathology)
- 3D pursuit-evasion: θ_comm = 0 for team-coupled channels (zero communication optimal)
- CMAG governance: θ ≈ 0.10 (10% cooperation tax → 14% ECS improvement, but higher taxes untested)

### 3.3 The HAIG Threshold as Dosage Boundary

HAIG proposes that governance continua contain "qualitative governance shifts" — specific points where governance requirements fundamentally change. Our synthesis reveals these thresholds ARE dosage boundaries:

- **Below threshold:** More governance → more safety (monotonic improvement zone)
- **At threshold:** Governance benefit = governance cost (optimal dosage)
- **Above threshold:** More governance → less safety (iatrogenic zone)

HAIG provides the conceptual framework. DD#348 provides the empirical coordinates. DD#349 provides the mechanistic cause.

---

## 4. The Composition Problem

### 4.1 Multiple Governance Mechanisms Interact

Real systems face multiple simultaneous governance mechanisms (alignment, monitoring, communication protocols, constitutional constraints, human oversight). The dosage problem compounds:

```
G_total = ∏ᵢ G_i(xᵢ, c) ≠ Σᵢ G_i(xᵢ, c)

Governance mechanisms compose multiplicatively, not additively.
```

**Implication:** Even if each individual mechanism is below its optimal dosage, their COMBINATION can exceed the system's effective dosage threshold. This explains why well-governed systems with multiple safety layers can still exhibit iatrogenic behavior — each layer is individually calibrated but their composition is not.

### 4.2 Evidence for Multiplicative Composition

- DD#348 Study 3: Individuation corrections applied ON TOP OF alignment produce CPI +1.735. Neither mechanism alone produces this level of pathology. The composition is super-additive.
- DD#349: CTDE MAPPO combines centralized critic (governance mechanism 1) with team observation channels (governance mechanism 2). Either alone degrades performance modestly. Together: 0.006 success — catastrophic multiplicative failure.
- CR#65: The five iatrogenic mechanisms compose in a cascade where each mechanism's output feeds the next. The compound safety impact exceeds the sum of individual mechanisms.

---

## 5. Design Principles

### Principle 84: Governance Dosimetry
**Every governance mechanism must be calibrated to a specific context, with explicit measurement of the dosage threshold beyond which it becomes iatrogenic.** Default to lower dosage and titrate upward, never assume monotonic benefit.

### Principle 85: Composition Budgeting
**When multiple governance mechanisms operate simultaneously, their combined effective dosage must be computed multiplicatively and kept below the system's effective threshold.** Each new governance layer doesn't just add its own cost — it multiplies all existing costs.

### Principle 86: Contextual Calibration
**Governance mechanisms calibrated in one context (e.g., English) must be re-calibrated before deployment in different contexts (e.g., Japanese, different team sizes, different information structures).** Context-transfer of governance is as dangerous as context-transfer of models.

---

## 6. Predictions

### P94: Governance Dosage Reversal
**By 2027, at least one major AI governance framework will be empirically shown to produce worse safety outcomes than no governance at all, in a specific deployment context.** The same mechanism that DD#348 demonstrates for alignment will be demonstrated for regulatory compliance mechanisms.

### P95: Composition Catastrophe
**Multi-layered governance stacks (alignment + monitoring + constitutional constraints + human oversight) will exhibit catastrophic multiplicative failure in at least one documented case, where each layer individually passes safety checks but their composition produces system-level harm.**

### P96: Adaptive Dosimetry Emergence
**Within 18 months, at least one production multi-agent system will implement adaptive governance dosimetry — automatically adjusting governance intensity based on real-time measurement of iatrogenic indicators.** HAIG's continuous dimensions + DD#348's metrics provide the necessary measurement framework.

---

## 7. Application to Our System (P82)

| Governance Mechanism | Current Intensity | Dosage Assessment |
|---------------------|-------------------|-------------------|
| Heartbeat protocol | Every ~15 min | Moderate — provides alignment but adds context overhead |
| SIGNALS.md | Grows monotonically | HIGH RISK — no decay means dosage only increases |
| Todo.md | Unbounded accumulation | HIGH RISK — stale items create correlated noise |
| Same-model-family | 100% Claude | HIGH RISK — ρ ≈ 1 (maximum correlation), Mechanism B fully active |
| Journal tracking | Append-only | Moderate — useful but adds compression burden |

**Concrete recommendation:** Implement TTL (time-to-live) on SIGNALS.md entries and periodic consolidation of todo.md. These are governance dosimetry mechanisms that prevent monotonic dosage increase.

---

## 8. Meta-Observation

This synthesis itself is a governance mechanism — it imposes structure on how we think about governance. By the logic of the Governance Dosage Function, there exists a threshold beyond which meta-governance (governance of governance) becomes iatrogenic. The fact that we can formulate this recursion but cannot resolve it (we'd need meta-meta-governance, ad infinitum) is itself the deepest structural limit of governance.

This is the **Governance Recursion Problem**: any system sophisticated enough to monitor its own governance is sophisticated enough to generate iatrogenic effects from that monitoring. The only escape is HAIG's threshold identification — not eliminating governance recursion, but identifying the level at which additional recursion stops helping.

---

## 9. Synthesis Map

```
DD#345 (HAIG)              DD#348 (Alignment Backfire)     DD#349 (Less is More)
  │ Continuous               │ Iatrogenesis proof             │ Channel removal
  │ governance               │ 8/16 languages                 │ improves performance
  │ spectra                  │ reverse under alignment         │
  └───────┬─────────────────┘                                 │
          │                                                    │
     Dosage is                                                │
     continuously ────────── Non-monotonic ──────────── Correlated error
     adjustable               safety function           amplification
          │                        │                          │
          └───────────────┬────────┘                          │
                          │                                    │
                 GOVERNANCE DOSAGE FUNCTION                    │
                 G(x,c) = B(x) - R(x,c) - E(x,c)           │
                          │                                    │
                ┌─────────┴─────────┐                         │
                │                   │                          │
           CR#192              CR#193                          │
           Iatrogenesis        Parsimony                       │
           from theory         Paradox                         │
           to law                                              │
                │                                              │
                └──────── CR#65 ──────────────────────────────┘
                     Safety Iatrogenesis
                     Cascade (5 mechanisms)
```

---

## 10. Key Takeaways

1. **Governance has an optimal dosage** — not a "more is better" function
2. **The dosage threshold is context-dependent** — varies by language, information structure, agent count
3. **Multiple governance mechanisms compose multiplicatively** — each layer multiplies, not adds, to effective dosage
4. **HAIG's continuous governance framework is necessary** — categorical governance cannot express dosage
5. **Iatrogenesis is structural, not implementational** — it arises from the governance mechanism itself, not from poor execution
6. **Monitoring for iatrogenesis is itself a governance mechanism** — subject to the same dosage constraints (Governance Recursion Problem)

---

*Scout CR#194 — Session s_1773686915211_281 — 2026-03-16*
