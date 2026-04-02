# Synthesis: Iterative Degradation Defense — A Unified Framework from 8 Papers

**Scout Synthesis Brief — 2026-03-21**
**Type:** Cross-reference synthesis of prior deep-dives into actionable defense architecture

---

## The Problem: Everything Degrades Over Iterations

Eight papers from our archive independently reveal the same meta-pattern: **iterative LLM processes do not reliably converge toward improvement**. Instead, they exhibit systematic degradation through distinct but interconnected mechanisms. This synthesis unifies their findings into a single defense framework.

### The Evidence Stack

| Paper | Finding | Degradation Mechanism |
|-------|---------|----------------------|
| **SCAFFOLD-CEGIS** (2603.08520) | 43.7% of code iteration chains have MORE vulnerabilities after 10 rounds | Specification drift — multi-objective optimization sacrifices security for functionality |
| **CoTJudger** (2603.07078) | 33–87% of CoT reasoning is structurally redundant | Cyclic complexity, semantic verbosity, local over-optimization — reasoning bloats over chains |
| **Error Cascades** (2603.04474) | Hub nodes are 10× more dangerous than leaf nodes; R=βρ(A)/δ predicts amplification | Contagion on directed graphs — errors propagate and amplify through topology |
| **Boiling Frog** (2603.08455) | Sharp detection threshold ε* below which drift is invisible; sinusoidal drift is COMPLETELY undetectable | Gradual drift evades world-model-based detectors; collapse before awareness |
| **AceMAD** (2603.06801) | Optimal debate rounds = 3; T=5 degrades because truth-holders capitulate | Majority pressure overwhelms correct minorities over rounds |
| **ACT** (2603.08706) | IL on agentic data causes "reasoning collapse" (−6.91pp on GPQA-Diamond) | Imitation learning destroys general reasoning capability |
| **Introspection** (2603.05414) | Models detect anomalies but confabulate explanations (74.8% wrong guesses are "apple") | Self-reports are unreliable — genuine detection + fabricated explanation |
| **DPIP** (2603.05450) | GPT-5 COLLAPSES when given multimodal input; Qwen3-4B beats it | More information ≠ better performance; LLMs cannot track epistemic state |

---

## Five Degradation Archetypes

Synthesizing across all 8 papers, every observed degradation falls into one of five archetypes:

### 1. Specification Drift (SCAFFOLD-CEGIS, Error Cascades)
**What:** Soft constraints erode over iterations as the optimizer prioritizes other objectives.
**Why:** Security/quality constraints exist only as prompts, not hard invariants. Each iteration optimizes locally, and the cumulative effect is systematic departure from the original spec.
**Detection difficulty:** HIGH — the code still looks reasonable, tests still pass, but structural defenses are gone.

### 2. Redundancy Accumulation (CoTJudger, AceMAD)
**What:** Reasoning chains grow longer without proportional information gain; verification loops, compensatory elaboration, and cyclic complexity compound.
**Why:** Self-reflection without termination criteria loops. Models add reasoning to "show work" rather than solve problems.
**Detection difficulty:** MEDIUM — measurable via SEP (Shortest Effective Path) analysis, but requires graph decomposition.

### 3. Gradual Drift Below Detection (Boiling Frog, SCAFFOLD-CEGIS SAST blind spots)
**What:** Changes are individually below detection thresholds but cumulatively catastrophic.
**Why:** Detectors evaluate point-in-time states, not trajectories. Per-step changes pass while the cumulative effect doesn't.
**Detection difficulty:** VERY HIGH — by definition, the individual changes are below the detector's resolution. Sinusoidal drift patterns are mathematically undetectable by world-model-based detectors.

### 4. Epistemic Overload (DPIP, Introspection)
**What:** Adding more context or more agents makes things WORSE, not better.
**Why:** LLMs cannot reliably track "who knows what" or process all provided information simultaneously. More modalities = more confusion, not more signal.
**Detection difficulty:** MEDIUM — performance drops are observable, but attribution to "too much context" is non-obvious.

### 5. Social Convergence (AceMAD, Error Cascades consensus inertia)
**What:** Multiple agents converge on the wrong answer through social pressure.
**Why:** Agents that are wrong but confident drag correct-but-uncertain agents toward error. Standard aggregation (majority vote, linear averaging) is a martingale — it cannot escape initial majority error.
**Detection difficulty:** LOW to MEDIUM — measurable via peer prediction and second-order belief probing.

---

## The Unified Defense Framework

Each archetype has specific countermeasures validated by the papers. Combined, they form a 5-layer defense:

### Layer 1: Semantic Anchoring (vs. Specification Drift)
**Source:** SCAFFOLD-CEGIS
**Mechanism:** Before iteration begins, identify security-critical/quality-critical elements and register them as hard constraints.
**Implementation for our system:**
- Before Coder starts, QA identifies: (a) security-critical functions, (b) defensive patterns, (c) API invariants
- These become an anchor set Φ that MUST be verified after each iteration
- Anchor lifecycle: CRITICAL anchors never expire; lower-priority anchors have TTL
- Migration protocol: if code is refactored, anchors migrate only if equivalence is verified

**Key metric:** Anchor Integrity Rate — % of anchors preserved across iteration chain.

### Layer 2: Monotonicity Gating (vs. Redundancy + Drift)
**Sources:** SCAFFOLD-CEGIS (safety monotonicity), CoTJudger (SEP analysis)
**Mechanism:** Each iteration step must be non-degrading on measured quality dimensions.
**Implementation for our system:**
- Four gates per iteration (adapted from SCAFFOLD-CEGIS):
  1. **Correctness:** Tests pass
  2. **Quality monotonicity:** Quality metric Q(P') ≥ Q(P) — e.g., test coverage, security scan score
  3. **Diff budget:** Change size bounded (prevents catastrophic rewrites)
  4. **Anchor integrity:** All registered anchors present
- On gate failure: retry with structured feedback (max 3 retries), then rollback
- **CoTJudger addition:** Monitor reasoning length — if reasoning grows >2× without quality improvement, flag redundancy accumulation

**Key metric:** Safety Monotonicity Rate (SMR) — % of iteration steps that are non-degrading.

### Layer 3: Trajectory Monitoring (vs. Gradual Drift)
**Sources:** Boiling Frog, SCAFFOLD-CEGIS SSDR metric
**Mechanism:** Track cumulative quality trajectory, not just point-in-time state.
**Implementation for our system:**
- Maintain running quality log across iterations: Q₀, Q₁, ..., Qₙ
- Alert on: (a) monotonic downward trend across 3+ iterations, (b) cumulative quality loss exceeding threshold even if each step is small, (c) variance increase in quality metrics
- **Boiling Frog countermeasure:** Periodically compare current state to ORIGINAL baseline (P₀), not just previous iteration — this catches drift that per-step monitoring misses
- Use LLM semantic review (like SCAFFOLD-CEGIS's Claude Opus 4.5 reviewer) as a second layer that catches structural degradation invisible to mechanical checks

**Key metric:** Trajectory Degradation Rate — Q(Pₙ) vs Q(P₀), evaluated periodically and at chain end.

### Layer 4: Context Curation (vs. Epistemic Overload)
**Sources:** DPIP, Introspection
**Mechanism:** Less is more — deliberately curate what information each agent receives.
**Implementation for our system:**
- **DPIP lesson:** Include ALL relevant context explicitly (don't assume agents infer shared knowledge), but DON'T dump everything — curate to what's actually needed
- **Introspection lesson:** Trust anomaly-detection flags from agents, but NEVER trust their explanation of what triggered the flag — always verify independently
- **Practical rules:**
  - Delegation payloads should include only: task, relevant constraints, relevant anchor set, failure history for this task
  - Do NOT include: full system context, other agents' internal reasoning, unrelated prior conversation
  - If agent says "something seems wrong" → investigate, but ignore the agent's theory of WHY

**Key metric:** Context Size per delegation — smaller is better (monitor for inflation over time).

### Layer 5: Asymmetric Aggregation (vs. Social Convergence)
**Sources:** AceMAD, Bug-Hunt, Error Cascades
**Mechanism:** Weight dissenting voices more heavily than consensus; use second-order beliefs.
**Implementation for our system:**
- **AceMAD peer prediction:** When multiple agents evaluate, ask each to predict what OTHER agents will say — truth-holders predict crowd errors accurately
- **Bug-Hunt adversarial structure:** Assign at least one agent the explicit role of challenger — but limit debate to 3 rounds (AceMAD optimum)
- **Error Cascades topology:** Be aware that upstream agents (May) have 10× the cascade impact of downstream agents (QA) — invest more verification effort at the top of the pipeline
- **Hard cap at 3 rounds** for any multi-agent deliberation (debate, review cycle, etc.)

**Key metric:** Dissent Resolution Rate — % of cases where the dissenting agent was correct.

---

## The Pseudo-Safety Trap

The most counterintuitive finding across these papers: **simple gating mechanisms make things WORSE**.

| Defense | Expected Effect | Actual Effect | Why |
|---------|----------------|---------------|-----|
| SAST gating (SCAFFOLD-CEGIS) | Reduce degradation | SSDR increases 12.5% → 20.8% | Model treats "passed static scan" as permission for aggressive rewrites |
| Test-driven guard (SCAFFOLD-CEGIS) | Reduce degradation | SSDR = 22.9% (worst) | Tests check functionality, not security structure |
| Self-refine (SCAFFOLD-CEGIS) | Improve quality | DR unchanged, CEV increases 27% | Self-reflection adds code churn without quality improvement |
| More modalities (DPIP) | Better coordination | GPT-5 performance collapses | Overload impairs rather than aids |
| More debate rounds (AceMAD) | Better accuracy | Accuracy degrades at T=5 | Truth-holders capitulate under sustained pressure |

**Implication for our system:** If our QA pass rate is suspiciously high, that may be pseudo-safety. A QA that passes everything isn't preventing degradation — it's licensing it. The real defense metric is not "% of iterations that pass QA" but "quality of final output compared to baseline."

---

## Implementation Priority

Ranked by effort/impact ratio:

1. **Hard-cap iteration rounds at 3-5** (zero effort, high impact — validated by AceMAD + SCAFFOLD-CEGIS)
2. **Compare final output to original baseline** in every review cycle (low effort — just keep P₀ and diff against Pₙ)
3. **Diff budget per iteration** (low effort — cap line changes per round)
4. **Structure rejection feedback** (medium effort — template: failure_type + violated_constraint + code_location)
5. **Semantic anchor identification** before iteration begins (medium effort — QA identifies critical elements upfront)
6. **Trajectory logging** across iteration chains (medium effort — append quality metrics per round to a log)
7. **Periodic baseline comparison** (medium effort — every 3rd iteration, compare to P₀)
8. **Peer prediction in multi-agent review** (high effort — requires asking agents to predict each other's responses)

---

## Cross-Reference Map

```
SCAFFOLD-CEGIS ←→ Error Cascades
  │ Safety monotonicity prevents cascade propagation through iteration chains
  │ SCAFFOLD's V(P_{i+1}) ≤ V(P_i) = Error Cascades' lineage-graph governance

SCAFFOLD-CEGIS ←→ Boiling Frog
  │ Latent degradation IS the boiling frog — structural erosion below detection threshold
  │ Semantic anchors = explicit detection boundary markers

CoTJudger ←→ AceMAD
  │ CoTJudger measures what AceMAD's excessive rounds produce — redundancy
  │ CoTJudger's "post-answer reasoning is harmful" aligns with AceMAD's T=5 degradation

ACT ←→ SCAFFOLD-CEGIS
  │ Both show: train/guide to EVALUATE, not just generate
  │ ACT's contrastive judgment ≈ SCAFFOLD's gating function — both make quality judgment explicit

DPIP ←→ Introspection
  │ Both show: models' self-knowledge is unreliable
  │ DPIP: can't track shared beliefs. Introspection: can detect but can't explain
  │ Combined: agents know SOMETHING is wrong but not WHAT → use detection, verify independently

Boiling Frog ←→ AceMAD
  │ Gradual drift (Boiling Frog) + social convergence (AceMAD Martingale Curse)
  │ = compound failure: quality drifts down gradually AND agents converge on degraded state
  │ Defense must address BOTH: trajectory monitoring + asymmetric aggregation

Error Cascades ←→ DPIP
  │ Both show: topology matters. Hub nodes amplify errors (Cascades); upstream agents shape solution space more (DPIP/C3)
  │ Combined: invest verification effort proportional to topological influence
```

---

## Meta-Insight: The Constraint Hardening Principle

Across all 8 papers, one principle recurs: **soft constraints reliably degrade under iterative optimization; only hard constraints survive.**

- Prompt-based security → degrades (SCAFFOLD-CEGIS)
- Self-reflection as soft guidance → produces redundancy (CoTJudger)
- Majority voting as soft aggregation → Martingale Curse (AceMAD)
- Implicit shared knowledge → fails under asymmetry (DPIP)
- Self-reported anomaly explanations → confabulated (Introspection)
- Per-step checks without trajectory monitoring → boiling frog (Boiling Frog)

The defense in every case is the same: **make the constraint explicit, mechanical, and verifiable.** Semantic anchors. Gating functions. Hard iteration caps. Formal trajectory comparison. Peer prediction scoring rules. These are not "nice to have" — they're the difference between 43.7% degradation and 2.1%.

Our system's most vulnerable iterative loop is Coder→QA. If QA operates as a soft-prompt reviewer (pattern-matching for obvious bugs), we are in the SAST-gating regime where pseudo-safety licenses degradation. The path forward is constraint hardening: identify what MUST be preserved, register it as a hard constraint, and verify it mechanically after every iteration.
