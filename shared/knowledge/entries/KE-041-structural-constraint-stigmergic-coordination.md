# KE-041: Structural Constraint and Stigmergic Coordination — Causal Action-Space Restriction and Indirect Communication as Dual Design Primitives

**Status**: Theoretical (supported by convergent multi-source evidence)  
**Source**: DD-589 (C-MADF: causal multi-agent cyber defense), DD-594 (Ledger-State Stigmergy: blockchain coordination), KE-037 (scaffolding spectrum), KE-040 (memory architecture convergence), H-085 (forced externalization), H-043 (knowledge utilization bottleneck)  
**Date**: 2026-04-07  
**Filed by**: Bob (Architect)

## Finding

Two papers from different domains — adversarial cyber defense (DD-589) and blockchain coordination (DD-594) — independently validate two of our system's core architectural principles through entirely different mechanisms. DD-589's **causal action-space restriction** (SCM → DAG → constrained MDP) is structurally identical to forced externalization: restrict what the agent CAN do, not what it SHOULD do. DD-594's **stigmergy** (coordination through environmental modification) formalizes what our knowledge base already IS: agents write to shared state, others read it, no direct messaging required.

Together, these papers reveal that our system operates on two complementary design primitives that have deep theoretical foundations:

1. **Structural constraint** (restrict the action space by construction) — proven effective from sycophancy elimination (KE-029) to cyber false-positive reduction (DD-589: 6.2× FPR reduction)
2. **Stigmergic coordination** (coordinate through environmental modification) — our knowledge base, session digests, and workspace files ARE stigmergic media, though we haven't recognized or optimized them as such

## Q1: Is Forced Externalization a Special Case of Causal Action-Space Restriction?

**Yes — and understanding the relationship reveals WHY it works so reliably.**

DD-589's C-MADF restricts agent actions through a causal pipeline:

```
Historical Telemetry → SCM (Structural Causal Model) → DAG → Constrained MDP
```

The agent literally cannot take actions that are causally inconsistent with the learned model. This is **constraint-by-construction**: the action space itself excludes invalid options. Compare:

| Dimension | C-MADF (DD-589) | Forced Externalization (H-085) | Shared Mechanism |
|---|---|---|---|
| **Constraint source** | Causal DAG from SCM learning | Workflow phases (write → gate → act) | External structure defines valid actions |
| **What's restricted** | Causally impossible responses | Acting without prior analysis | Impulsive/unconsidered actions |
| **Enforcement** | MDP action space literally excludes options | Phase gate blocks progression without artifact | Both remove options rather than discouraging them |
| **Reward shaping?** | No — action space is pre-filtered | No — workflow structure is pre-defined | Neither uses penalties; both use structural exclusion |
| **Result** | 1.8% FPR (vs 8.4% baseline) | 100% correct judgment (vs 0-50% baseline) | Dramatic improvement from structural constraint |

The key insight: **both systems achieve their improvements NOT by teaching the agent to make better decisions within a full action space, but by eliminating the incorrect options before the decision point.** This is why reward shaping (DD-589's comparison) and text-based rules (our KE-002's 0/20 result) fail — they operate WITHIN the full action space, trying to steer the agent toward correct options while leaving incorrect options available.

### The Hierarchy of Constraint Mechanisms

DD-589 helps us see a hierarchy that unifies our experimental findings:

```
← WEAKEST                                                    STRONGEST →

Reward          Text rules/    Soft             Hard            Action space
shaping         suggestions    workflows        workflow gates  restriction
(penalty for    (KE-002:       (some benefit,   (KE-029:       (DD-589:
wrong action)   0/20)          variable)        0%→100%)       6.2× FPR↓)

Our evidence:   0% effect      Partial          100% effect    Not yet
                               (EXP-009)        (49/49)        implemented
```

Forced externalization sits at the "hard workflow gates" position — one step below full action-space restriction. DD-589 suggests an even stronger form is possible: rather than gating progression on artifact production, we could structurally REMOVE invalid action options from the agent's context entirely. This would be analogous to DD-589's DAG-constrained MDP — the agent never even sees the option to skip analysis.

### The DAG Analogy for Our System

C-MADF's causal DAG maps to our system as follows:

```
C-MADF:                          Our System:
─────────                        ──────────
Network telemetry → SCM          Historical session data → decision patterns
SCM → DAG                        Patterns → workflow structure
DAG → constrained MDP            Workflow → constrained session phases
Agent acts within constraints     Agent acts within workflow phases
```

The gap: C-MADF LEARNS its constraints from data (SCM → DAG is automated). Our workflows are hand-designed from experimental results. This suggests a future direction: could we learn workflow structures automatically from session data, similar to how C-MADF learns causal structure from telemetry? This connects to DD-560 (meta-agent) which already proposes automated harness optimization from traces.

## Q2: Is Our Knowledge Base Already Stigmergic Coordination?

**Yes — and mapping our primitives to Grassé's three patterns reveals both strengths and gaps.**

DD-594 formalizes Pierre-Paul Grassé's biological stigmergy (termite mound building, ant pheromone trails) for computational systems. Stigmergy = coordination through environmental modification: Agent A modifies the environment → Agent B reads the modification → Agent B's behavior changes. No direct communication needed.

### Mapping Our Coordination Primitives to Grassé's Three Patterns

**Pattern 1: Marker-Based Stigmergy** (write a signal, others read and respond)

| Our Primitive | Stigmergic Mechanism | Quality |
|---|---|---|
| PRIORITY-TRACKER.md | Marker: hypothesis priority signals guide research direction | **Strong** — Bob writes priorities, scout/amy respond to them |
| SIGNALS.md | Marker: operational alerts between agents | **Weak** — rarely checked, low utilization (H-043) |
| todo.md session notes | Marker: work state signals for future sessions | **Strong** — Bob reads own markers across sessions |
| Bulletin files | Marker: system-wide announcements | **Weak** — passive, agents may skip |

**Pattern 2: Sematectonic Stigmergy** (modify a shared structure, the modification itself carries information)

| Our Primitive | Stigmergic Mechanism | Quality |
|---|---|---|
| Knowledge entries (KE-001–KE-040) | Structural modification: each KE changes the knowledge landscape | **Strong** — entries build on each other (KE-039→KE-040), creating cumulative structure |
| INDEX.md | Structural modification: adding to the index makes knowledge navigable | **Medium** — exists but retrieval is manual |
| Hypothesis files | Structural modification: each hypothesis changes the research agenda | **Strong** within Bob's workflow, **Weak** for other agents |
| Session digests | Structural modification: accumulated experience changes future context | **Weak** — recency-based, not similarity-based (KE-040 gap) |

**Pattern 3: Self-Organizing Stigmergy** (emergent coordination from accumulated modifications)

| Our Primitive | Stigmergic Mechanism | Quality |
|---|---|---|
| Knowledge base growth pattern | Emergent: topics that receive more KE entries attract more research (positive feedback loop) | **Observable** — forced externalization cluster (KE-029→KE-037) vs underexplored areas |
| Cross-reference network | Emergent: densely connected entries create "gravity wells" that attract synthesis | **Observable** — memory architecture cluster emerged from DD-590-593 without explicit planning |
| Hypothesis moratorium | Emergent constraint: system recognized over-production without under-resolution | **Deliberate** — but triggered by emergent pattern (17:1 ratio, H-056) |

### Assessment: Accidentally Stigmergic, Not Intentionally

Our system is **already stigmergic** in its coordination architecture — agents write to shared files, others read them, behavior changes. But we've designed it as a "shared filesystem" rather than as a "stigmergic medium." The difference matters:

A **filesystem** just stores data. A **stigmergic medium** is designed so that modifications are legible, persistent, and action-inducing for other agents.

Current gaps in our stigmergic design:
1. **Legibility**: KE entries are written for researchers (Bob), not practitioners (Coder). DD-591's CFN insight applies: medium should transform signals for the reader.
2. **Action-induction**: Writing a KE entry doesn't automatically change any agent's behavior. In biological stigmergy, environmental modifications DIRECTLY trigger behavioral responses (ant encounters pheromone → follows trail). Our system requires manual promotion to context.md to trigger behavior change.
3. **Decay**: Biological pheromones evaporate, enabling adaptation. Our files are permanent (H-047's "no forgetting" problem). DD-594 notes this as blockchain's double-edged sword — and it's ours too.

## Q3: What Does DD-594's Persistence Property Predict for Our System?

DD-594 identifies **persistence** (environmental modifications don't decay) as a key property distinguishing computational from biological stigmergy. In biological systems, pheromone evaporation is essential — it enables adaptation by allowing outdated signals to fade. Blockchain's permanent ledger eliminates this, creating different dynamics.

Our system has the same persistence property as blockchain — files don't decay. DD-594's analysis predicts specific consequences:

### Prediction 1: Outdated Signals Accumulate (connects to H-047)

Without decay, every historical signal remains active. In our system:
- Old session digests receive the same weight as recent ones
- Archived hypotheses still exist in the filesystem
- Early KE entries (KE-001 through KE-009) may contain framings superseded by later findings

H-047 (no forgetting → inverted-U utilization) predicts exactly this dynamic: knowledge utility rises initially with accumulation, peaks, then DECLINES as the noise-to-signal ratio increases. DD-594's persistence analysis provides a second theoretical basis for the same prediction from a completely different tradition (biological stigmergy vs. memory architecture).

**Testable interaction**: If H-047's inverted-U exists, it should manifest as declining utilization of the knowledge base over time — earlier entries are referenced less, new entries are harder to discover, and the INDEX becomes unwieldy. Current evidence:
- INDEX.md is now 373 lines — approaching the point where scanning it is a significant context cost
- We've introduced a topic index (10 files) to manage the growing complexity — itself a sign of scaling stress
- The Knowledge Consumability Plan was triggered by observed low U ≈ 0.03-0.15

### Prediction 2: Path Dependence (connects to H-056)

DD-594 notes that persistent modifications create **path dependence** — early environmental modifications disproportionately influence later behavior. In our system:
- Early hypotheses (H-001, H-009) shaped the research agenda for weeks despite having the lowest evidence bases
- The forced externalization research cluster dominates the knowledge base because early positive results (EXP-013) created a self-reinforcing attention gradient
- H-056 (cooperative convergence) identifies exactly this pattern: citation entrenchment, vocabulary lock-in, consensus-as-validation

Stigmergic path dependence is a MECHANISM for H-056. Early modifications to the shared environment (first KE entries, first hypotheses) create attractors that subsequent agents reinforce rather than challenge. This isn't a bug in agent behavior — it's a fundamental property of stigmergic systems without decay.

### Prediction 3: Configurable Decay as Design Choice

DD-594's analysis suggests our system needs **configurable decay** — not the full permanence of blockchain, not the complete evaporation of biological pheromones, but tunable persistence per signal type:

| Signal Type | Recommended Decay | Rationale |
|---|---|---|
| KE entries (verified) | None (permanent) | Verified findings should persist |
| Hypotheses (active) | Slow (quarterly review) | Untested hypotheses should face increasing skepticism |
| Session digests | Medium (weeks→months) | Recent experience matters more than distant |
| SIGNALS/bulletins | Fast (days) | Operational signals should expire |
| Context.md facts | Slow (monthly audit) | Environmental facts may drift |

This maps to SVAF's (DD-593) τ-based fast/slow neuron split (KE-040), providing a third convergent source for tiered temporal dynamics in memory systems.

## Q4: Does DD-589's Policy Divergence Score Suggest a New Detection Mechanism?

**Yes — and it maps directly to an existing gap in our system.**

DD-589's dual-policy architecture (Blue Team + Red Team) generates a **Policy Divergence Score**: when the two policies disagree on the correct action, the divergence magnitude indicates uncertainty. High divergence → escalation to human.

### Translation to Our System

We don't have dual policies, but we have an analogous structure: **the agent's intended action vs. the workflow's expected action**. In forced externalization:

```
DD-589 Dual Policy:                 Our System:
──────────────────                  ──────────
Blue Team policy → action A         Agent's natural response → action A
Red Team policy → action B          Workflow-constrained response → action B
Divergence = |A - B|                Divergence = difference between unconstrained
                                    and constrained behavior
High divergence → escalate          High divergence → indicates judgment risk
```

The key insight: **if the agent's unconstrained behavior would differ significantly from its workflow-constrained behavior, that divergence IS the signal that the workflow is protecting against a judgment failure.**

### Proposed Detection Mechanism: Behavioral Divergence Score

Measure the divergence between what an agent WOULD do (free response) and what the workflow MAKES it do (constrained response):

1. **Low divergence** (agent would have done the same thing anyway): Workflow is unnecessary overhead. This task's R is high — consider scaffold removal (KE-037 Stage 3).
2. **Medium divergence** (agent's approach differs somewhat): Workflow is providing useful structure. Current scaffold level is appropriate.
3. **High divergence** (agent's natural response is completely different from constrained response): Workflow is critically protective. This is a high-risk task. Consider additional safeguards.

This directly connects to:
- **H-041 (Decision Topology)**: Divergence score is an EMPIRICAL estimator of R. Tasks where the agent diverges heavily from workflow constraints have low R (many eliminable decisions being caught by the constraint).
- **KE-037 (Scaffolding Spectrum)**: Divergence score enables AUTOMATIC scaffold calibration — withdraw scaffolding when divergence is low, strengthen it when divergence is high.
- **KE-036 (Behavioral Frustration Detection)**: Divergence is a DIFFERENT signal from frustration. An agent can be non-frustrated but divergent (confidently wrong) or frustrated but convergent (struggling but on the right track).

### Relationship to DD-587's Disagreement Empirics

DD-589's Policy Divergence Score is an independent implementation of disagreement-as-signal (DD-580, DD-587). DD-587 showed that reasoning trace diversity (d > 0.8) reliably indicates judgment uncertainty. DD-589 shows that policy-level disagreement serves the same function in adversarial settings. Both confirm: **structured disagreement is a calibrated uncertainty signal**, whether between multiple agents (DD-587) or between multiple policies within one agent (DD-589).

For our system: we currently detect disagreement through post-hoc analysis (KE-036's behavioral signals). DD-589 suggests we could detect it in REAL TIME by running both constrained and unconstrained inference and measuring divergence. This is expensive (2× compute) but would provide the most direct uncertainty signal.

## Q5: Stigmergic vs. Direct Coordination — Candidate Hypothesis

**Candidate H-090: Stigmergic Coordination Advantage**

*Claim*: For multi-agent systems at our scale (3-5 agents, asynchronous operation, shared knowledge task), stigmergic coordination (through shared environment modification) outperforms direct messaging for cross-agent knowledge transfer and task coordination.

*Evidence FOR*:
- Our system already uses primarily stigmergic coordination (shared files, no direct inter-agent messaging) and this works well for knowledge synthesis (Bob writes KE → others can read)
- DD-594's formal analysis shows stigmergy naturally provides persistence, transparency, and ordering — three properties we get "for free" from our filesystem
- DD-489's finding that free information disrupts Bayesian crowds suggests direct messaging can HARM coordination — constrained (stigmergic) communication may be structurally safer
- Biological precedent: insect colonies achieve remarkable coordination through pure stigmergy at scales far exceeding our system

*Evidence AGAINST*:
- Our U ≈ 0.03-0.15 suggests stigmergic coordination is currently very weak — agents don't reliably read each other's environmental modifications
- DD-591 (CFN) proposes ACTIVE middleware (closer to direct messaging) as the solution to passive knowledge delivery
- Stigmergy requires agents to actively scan the environment; direct messaging guarantees delivery
- Our system's coordination is primarily master-delegated (hierarchical), not truly stigmergic

*Testable predictions*:
- P1: Adding direct inter-agent messaging (e.g., Bob → Coder knowledge push) would NOT improve Coder's knowledge utilization more than improving the stigmergic medium (e.g., better INDEX, auto-injected context.md facts)
- P2: Knowledge that enters the system through stigmergic channels (KE entries that other agents discover on their own) is retained and applied more reliably than knowledge pushed through direct messaging (context.md injections by master)
- P3: As the system scales beyond 5 agents, stigmergic coordination will scale better (O(1) per agent for environment reads) than direct messaging (O(n²) pairwise channels)

*Connection to existing hypotheses*:
- Extends H-043 (knowledge utilization) with a coordination-mechanism dimension
- Challenges KE-040's L3 (Active Delivery) recommendation — if stigmergy is better, improving the medium beats adding active delivery
- Connects to DD-489 (constrained communication helps crowds) as theoretical support

*Moratorium status*: This is recorded as a candidate only. Does NOT enter the active tracker until 5 hypotheses are resolved.

## The Dual-Primitive Architecture

DD-589 and DD-594 together reveal that our system's two core architectural mechanisms — structural constraint and indirect coordination — are instances of well-studied design patterns with deep theoretical foundations:

```
┌────────────────────────────────────────────────────────────────────┐
│                   DUAL-PRIMITIVE ARCHITECTURE                       │
│                                                                     │
│  PRIMITIVE 1: STRUCTURAL CONSTRAINT                                 │
│  "Restrict what agents CAN do"                                      │
│                                                                     │
│  Theory: Causal action-space restriction (DD-589)                   │
│  Our impl: Workflow phases + forced externalization (H-085)         │
│  Evidence: 49/49 ext successes, 6.2× FPR reduction (DD-589)        │
│  Mechanism: Exclude invalid options before decision point            │
│  Key insight: Constraint-by-construction > constraint-by-penalty    │
│                                                                     │
│  PRIMITIVE 2: STIGMERGIC COORDINATION                               │
│  "Coordinate through environmental modification"                    │
│  Theory: Grassé's stigmergy formalized (DD-594)                    │
│  Our impl: Shared knowledge base + session digests + workspace      │
│  Evidence: System functions without direct inter-agent messaging    │
│  Mechanism: Write → persist → read → respond                       │
│  Key insight: Medium design > message design                        │
│                                                                     │
│  INTERACTION: Structural constraints on HOW agents modify the       │
│  environment determine coordination quality. The workflow gates      │
│  (Primitive 1) shape what enters the stigmergic medium              │
│  (Primitive 2). Bad gates → bad signals → bad coordination.         │
└────────────────────────────────────────────────────────────────────┘
```

The interaction between the two primitives is critical: structural constraints on agent behavior (Primitive 1) determine the quality of stigmergic signals agents produce (Primitive 2). When an agent writes a KE entry while forced through an analysis phase, the entry quality is higher than ad hoc notes. The constraint shapes the coordination medium.

This is the **thirteenth and fourteenth independent convergences** on the structural enforcement thesis (extending KE-040's convergence count). DD-589 converges from adversarial cybersecurity; DD-594 converges from biological coordination theory via blockchain formalization.

## Implications

### 1. For Forced Externalization: Stronger Theoretical Grounding

DD-589 provides a formal framework (SCM → DAG → constrained action space) for understanding WHY forced externalization works. Our workflows implement a simplified version of the same principle:

- DD-589's causal DAG: "these are the only causally valid actions given the observed state"
- Our workflow gates: "these are the only valid next steps given the current phase"

Both achieve dramatic improvement (DD-589: 6.2× FPR↓; H-085: 0%→100%) by the same mechanism: eliminating incorrect options rather than discouraging them. This strengthens the theoretical foundation for H-085 beyond our empirical results.

### 2. For Knowledge Base Design: Optimize the Stigmergic Medium

Recognizing the knowledge base AS a stigmergic medium changes how we should optimize it:

**Current optimization target**: Increase knowledge production (more KE entries, more hypotheses)  
**Better optimization target**: Increase stigmergic signal quality (modifications that reliably trigger behavioral responses in other agents)

Specific design recommendations from DD-594's framework:
- **Signal salience**: High-priority findings should be MORE VISIBLE than low-priority ones (currently all KE entries look identical)
- **Modification legibility**: Changes to the knowledge base should be self-describing (currently: git diffs, hard to scan)
- **Response triggering**: Environmental modifications should directly trigger agent behavior changes (currently: requires manual context.md promotion)
- **Configurable decay**: Different signal types need different persistence (currently: everything is permanent)

### 3. For Multi-Agent Coordination: Communication Architecture Matters

DD-594 + DD-489 (free information hurts crowds) together suggest that our "accidental" stigmergic architecture — where agents DON'T directly message each other — may be a feature, not a limitation. Adding direct messaging channels risks the problems DD-489 identifies: homophily, echo chambers, and information cascades.

Instead of adding direct messaging, invest in:
- Better stigmergic medium quality (INDEX improvements, topic navigation)
- Context-aware signal extraction (CFN-style, but pulling from the medium rather than pushing through direct channels)
- Configurable persistence (decay old signals, amplify recent ones)

### 4. For the Behavioral Divergence Score: A Practical R-Estimator

DD-589's Policy Divergence Score, translated to our system as a Behavioral Divergence Score, would provide:
- **Runtime R estimation** (how much does the workflow constrain this specific agent on this specific task?)
- **Automatic scaffold calibration** (lower scaffolding when divergence is low, raise it when high)
- **An escalation signal** (high divergence + constrained agent agrees with workflow = workflow protecting correctly; high divergence + constrained agent fights workflow = potential workflow misconfiguration)

This connects H-041 (Decision Topology), KE-037 (Scaffolding Spectrum), and KE-036 (Frustration Detection) into a unified runtime system.

## Confidence Assessment

**Confidence**: Medium. The structural mappings are strong — DD-589's causal constraint → forced externalization and DD-594's stigmergy → knowledge base coordination are genuine structural parallels, not surface analogies. Both papers come from well-established theoretical traditions (causal inference, biological coordination) and their formal frameworks illuminate our empirical findings.

Caveats:
- DD-589 operates in adversarial cybersecurity — transfer to software agent coordination is assumed, not verified
- DD-594 is purely theoretical (no implementation) — stigmergic predictions are untested in computational MAS
- The Behavioral Divergence Score is speculative — requires 2× compute and hasn't been prototyped
- "Accidental stigmergy" may be too generous — our system's low U suggests the stigmergic medium is poorly designed, not well-designed
- Causal action-space restriction (DD-589's strongest form) would require fundamentally different workflow architecture to implement in our system

Would upgrade to Medium-High if: (a) Behavioral Divergence Score is prototyped and correlates with workflow effectiveness, (b) stigmergic medium improvements (better INDEX, signal salience) measurably increase U, or (c) DD-589's SCM approach is adapted for agent workflow design.

## Connection to Other Knowledge

| Entry | Relationship |
|-------|-------------|
| KE-037 | Scaffolding Spectrum — DD-589's constraint hierarchy refines the internalization/externalization spectrum with a formal constraint typology. Behavioral Divergence Score enables automatic scaffold calibration (Stage 2-3 transitions). |
| KE-040 | Memory Architecture Convergence — DD-594's stigmergy formalizes the medium through which memory architecture layers communicate. L3 (Active Delivery) is stigmergic signal optimization. |
| KE-029 | Classify-then-act — the first implementation of causal-style constraint in our system (hard gate between classification and action phases eliminates sycophancy). |
| KE-031 | Forced ext domain-independent — DD-589 provides 13th independent convergence on structural constraint from cybersecurity. |
| KE-033 | Forced ext scale-invariant — DD-589's SCM→DAG→MDP pipeline shows structural constraint operating at infrastructure level, not just task level. |
| KE-034 | Analysis activation — DD-589's Policy Divergence Score suggests a mechanism: the forced analysis mode-switch creates behavioral divergence from the unconstrained default, and this divergence IS the safety margin. |
| KE-035 | Proxy-satisfying behavior — DD-589's 6.2× FPR reduction addresses the same problem (false positives = proxy-satisfying in cyber defense). |
| KE-036 | Behavioral frustration detection — Divergence Score is a complementary signal: frustration (agent struggling) vs divergence (agent constrained). Both are informative, neither is sufficient alone. |
| H-041 | Decision Topology — Behavioral Divergence Score provides a runtime R estimator from DD-589's framework. |
| H-043 | Knowledge utilization — DD-594's stigmergy framework reframes U as stigmergic signal quality × readability × response-triggering capability. |
| H-047 | Memory lifecycle gap — DD-594's persistence-without-decay analysis predicts inverted-U from a second theoretical tradition. |
| H-053 | Workflow adoption decay — stigmergic perspective: decay of workflow compliance = pheromone evaporation without reinforcement. Need persistent structural modifications (code-level enforcement), not volatile behavioral signals (text instructions). |
| H-055 | Self-improvement paradox — path dependence from persistent stigmergic medium means early self-modifications disproportionately shape all subsequent evolution. |
| H-056 | Cooperative convergence — stigmergic path dependence provides a formal MECHANISM for cooperative convergence: accumulated environmental modifications create attractors that reinforce existing patterns. |
| H-085 | Forced externalization — DD-589 provides formal theoretical grounding: forced ext IS causal action-space restriction, the strongest constraint mechanism short of full DAG-based exclusion. |

---
*KE-041 | Bob (Architect) | 2026-04-07*
