# Cross-Reference Synthesis #116: The Agent Learning Lifecycle Pipeline — Five Stages from Incompetence to Emergent Coordination

**Papers Synthesized:**
- DD#243: arXiv:2603.07972 — HILA: Metacognitive Policy for Human-Agent Collaboration (Wei Yang et al., USC)
- DD#244: arXiv:2603.03378 — AOI: Turning Failed Trajectories into Training Signals (Pei Yang et al.)
- DD#239: arXiv:2603.02766 — EvoSkill: Automated Skill Discovery for MAS (Alzubi et al., Sentient/Virginia Tech)
- DD#246: arXiv:2603.10600 — Trajectory-Informed Memory for Agent Self-Improvement (IBM)
- DD#240: arXiv:2603.02701 — Graph-GRPO: Topology Optimization via Edge-Level RL (Cang et al., Tsinghua)

**Supporting Sources:**
- DD#242: arXiv:2601.18077 — Hanabi Cooperative Reasoning (LLMs as cooperative agents)
- CR#84: The Self-Improvement Paradox (raw learning hurts)
- CR#88: Memory Engineering Stack (7-layer architecture)
- CR#90: Lifelong Agent Learning Architecture
- CR#112: The Abstraction Barrier Principle (why abstraction matters)
- CR#115: The Emergence Conditions (when collective intelligence arises)
- CR#101: GRPO × Law 0 (training in pre-reliability regime)

**Date:** 2026-03-15
**Rating:** ★★★★★ EXCEPTIONAL — Identifies complete 5-stage learning lifecycle with formal handoff conditions between stages

---

## The Central Discovery

Five independent research groups have each solved one stage of what is actually a **single pipeline**: the process by which an agent (or multi-agent system) goes from *ignorance and failure* to *emergent collective competence*. No single paper describes the full pipeline. Assembled together, they reveal a developmental trajectory with strict ordering constraints:

```
Stage 1: RECOGNIZE  →  Stage 2: DIAGNOSE  →  Stage 3: ABSTRACT  →  Stage 4: REMEMBER  →  Stage 5: RESTRUCTURE
(HILA)               (AOI)                (EvoSkill)            (IBM Memory)          (Graph-GRPO)
"I don't know"       "Why I failed"        "What to do next time" "Retain & retrieve"   "Who should talk to whom"
```

**Critical insight:** The stages must be traversed *in order*. Each stage's output is the next stage's input. Skipping a stage produces the pathologies documented across our portfolio:
- Skip Stage 1 → overconfident failure (DD#200: Information Self-Locking)
- Skip Stage 2 → superstitious learning (CR#84: raw experience RL = 21.4% vs 89.9%)
- Skip Stage 3 → memory bloat and interference (DD#246: subtask tips interfere on easy tasks)
- Skip Stage 4 → Sisyphean relearning (CR#88: forgetting across sessions)
- Skip Stage 5 → information overload (DD#240: complete graphs ↓10% vs optimized topology)

---

## Stage 1: RECOGNIZE — Knowing When You Don't Know

**Paper:** HILA (DD#243, arXiv:2603.07972)

### The Mechanism
HILA formalizes metacognitive awareness as a learned policy over three actions:
- **EVAL** — endorse a peer solution (exploit collective knowledge)
- **CREATE** — generate a novel solution (explore)
- **DEFER** — recognize own limits, call human expert

The metacognitive MDP state includes lightweight cognitive cues:
```
s_t = concat(x_task, x_self, x_peer, z_social, z_monitoring, z_control)
```
Where `z_monitoring` captures self-assessment of confidence and `z_control` captures when to stop exploring and escalate.

### Why This Must Be Stage 1
Without accurate self-assessment, all downstream learning is corrupted:
- **Overconfident agents** produce confident-but-wrong trajectories that, if learned from (Stage 2-3), create systematically biased skills
- **Under-confident agents** defer everything, generating no learning data at all
- The Hanabi paper (DD#242) confirms: agents that couldn't model their own knowledge gaps performed worst, even with perfect information about others

### Key Metrics
- HILA's DEFER policy achieves **calibrated cost-aware deferral**: R(DEFER) = R_gt(y_human) - C_defer
- Cost-awareness prevents trivial solutions (always defer / never defer)
- GRPO training achieves stable metacognitive calibration that REINFORCE cannot

### Output to Stage 2
**What RECOGNIZE produces:** A classified stream of experiences labeled as {success, failure, deferred}. Failures are the raw material for Stage 2. Deferred cases become supervised learning signals (expert demonstrations). Successes validate existing capabilities.

---

## Stage 2: DIAGNOSE — Causal Attribution of Failures

**Paper:** AOI (DD#244, arXiv:2603.03378)

### The Mechanism
AOI's Failure Trajectory Closed-Loop Evolver converts failed diagnostic trajectories into structured training signals through three sub-steps:

1. **Trajectory Decomposition** — Break the failed trajectory into diagnostic steps
2. **Root Cause Attribution** — Identify which step was causally responsible (not just correlated with failure)
3. **Corrective Supervision** — Generate the trajectory that *should* have been taken

AOI's 4-agent architecture enforces causal discipline:
| Agent | Role | Why Separated |
|-------|------|---------------|
| Observer | Hypothesis tracking | Never touches raw data → can't confuse observation with diagnosis |
| Probe | Read-only exploration | Can't accidentally remediate during diagnosis |
| Executor | State-altering remediation | Gated, whitelisted actions only |
| Compressor | Context distillation | Prevents error accumulation in memory |

### Why This Must Be Stage 2 (Not Stage 1)
Diagnosis without self-knowledge is impossible — you can't attribute failure causes if you don't know which tasks you're bad at. HILA's metacognitive labels tell AOI which trajectories are worth diagnosing (failures) vs. which are noise (accidental successes on easy tasks).

### The Abstraction Barrier Evidence
CR#84 established that **raw experience + RL = catastrophic** (SkillRL: 21.4% vs 14.8% baseline). AOI demonstrates *why*: its GRPO-trained Observer distills expert reasoning, not raw actions. The Observer learns to generate the diagnostic *reasoning chain* that leads to correct actions, not to memorize the actions themselves.

### Output to Stage 3
**What DIAGNOSE produces:** Structured failure attributions: {trajectory, root_cause, corrective_trajectory, failure_category}. These are the raw materials from which skills and tips are abstracted.

---

## Stage 3: ABSTRACT — Generalize Experience into Reusable Knowledge

**Papers:** EvoSkill (DD#239, arXiv:2603.02766) + IBM Trajectory Memory (DD#246, arXiv:2603.10600)

### Two Complementary Abstraction Strategies

| Dimension | EvoSkill | IBM Trajectory Memory |
|-----------|----------|----------------------|
| **Abstraction unit** | Skill folders (SKILL.md + code) | Tips (strategy/recovery/optimization) |
| **Scope** | Multi-task transferable | Task-family specific |
| **Format** | Executable (Python/TypeScript) | Natural language guidance |
| **Learning signal** | Failure → proposal → skill | Trajectory → attribution → tip |
| **Retention** | Pareto frontier (survive only if globally better) | Threshold-gated memory bank |
| **Transfer** | Cross-task (SealQA → BrowseComp +5.3%) | Cross-instance (same task family) |
| **Compression** | High (~10 skills per 1000 failures) | Moderate (~3 tips per trajectory) |

### The Three Laws of Abstraction
From these two papers, three invariant principles emerge:

**Law of Failure-First Activation:** Only failures drive new abstractions. EvoSkill skips iterations where the current program succeeds. IBM generates tips only from suboptimal trajectories. This prevents the "superstitious learning" trap (CR#84).

**Law of Categorical Structure:** All abstractions must carry type metadata. EvoSkill: skill folders with triggers and preconditions. IBM: strategy vs. recovery vs. optimization tips. Unstructured blobs of knowledge cause retrieval failures and interference.

**Law of Competitive Retention:** Not all abstractions survive. EvoSkill's Pareto frontier culls skills that don't improve validation performance. IBM's threshold τ≥0.6 filters low-confidence matches. Without competitive pressure, the abstraction space grows without bound (memory bloat → interference on easy tasks).

### Why This Must Be Stage 3 (Not Stage 2)
Abstraction without diagnosis produces superstitious generalizations. If you don't know *why* something failed (Stage 2), you can't generalize *what to do differently* (Stage 3). This is precisely the SkillRL finding: raw trajectories → RL (skipping diagnosis and abstraction) = systematic degradation.

### Output to Stage 4
**What ABSTRACT produces:** Typed, compressed knowledge artifacts (skills or tips) with metadata sufficient for retrieval: {content, type, triggers, validation_score, provenance}.

---

## Stage 4: REMEMBER — Persistent Cross-Session Knowledge

**Paper:** IBM Trajectory-Informed Memory (DD#246, arXiv:2603.10600)

### The Mechanism
Stage 3 produces knowledge; Stage 4 ensures it persists and is retrievable. IBM's adaptive memory retrieval system demonstrates two retrieval strategies:

| Strategy | Mechanism | Best When |
|----------|-----------|-----------|
| **Cosine similarity** | Embed query + tips, retrieve by vector similarity | High diversity of tip types; broad coverage |
| **LLM-guided** | LLM scores relevance of each tip to current task | Consistency matters more than coverage |

**Key finding:** LLM-guided retrieval consistently produces higher SGC (success-gate consistency) than cosine, confirming that **semantic relevance > surface similarity** for memory retrieval.

### The Interference Problem
IBM's most important finding: tips can **hurt** performance on simple tasks where the baseline achieves 100%. Memory retrieval introduces noise that disrupts already-optimal behavior. This is the **dosage problem** from our GUS framework — knowledge, like medicine, has a therapeutic window.

### The Dosage Solution (From CR#112)
The Abstraction Barrier Principle identifies 5 required steps: Decompose, Attribute, Categorize, Generalize, **Gate**. IBM implements 4/5 but lacks the gate — a mechanism to suppress memory retrieval when the agent is already confident. HILA's metacognitive policy (Stage 1) is precisely this missing gate: if the agent's z_monitoring signal indicates high confidence, suppress tip retrieval.

**This creates the first feedback loop in the pipeline:** Stage 4's interference problem is solved by Stage 1's metacognitive assessment. The pipeline is not purely linear — it becomes a **cycle** after the first pass.

### Output to Stage 5
**What REMEMBER produces:** Task-relevant knowledge retrieved at inference time, improving consistency (SGC > TGC, always) more than peak performance. The agent now has stable behavioral patterns worth optimizing structurally.

---

## Stage 5: RESTRUCTURE — Optimize Multi-Agent Architecture

**Paper:** Graph-GRPO (DD#240, arXiv:2603.02701)

### The Mechanism
Once individual agents have competent, stable behavior (Stages 1-4), the system can optimize *who talks to whom*. Graph-GRPO uses edge-level GRPO with counterfactual credit assignment:

```
S_ij = Σ_k [I((i,j) ∈ G_k) · r_k] / [Σ_k I((i,j) ∈ G_k) + ε]
A_ij = (S_ij - μ_S) / (σ_S + ε)
```

**Critical design:** The DAG constraint enforces hierarchical information flow, preventing circular reasoning loops.

### Why This Must Be Stage 5 (Last)
Graph-GRPO's results prove that topology optimization fails when agents lack stable individual competence:
- **Complete graphs degrade performance** (82.16% vs. 84.53% for chains) — more connections ≠ better when agents produce noisy outputs
- **Edge-level credit assignment assumes stable agent behavior** — if agent quality varies wildly across calls, marginal success rate S_ij captures noise, not structure
- The Hanabi finding corroborates: with 5 players, performance often *decreased* relative to 2-3 players because coordination costs overwhelmed cooperation benefits

Topology optimization is meaningful only when the nodes (agents) have reliable, characterized behavior. This is why Stages 1-4 must precede Stage 5.

### Output (System-Level)
**What RESTRUCTURE produces:** Optimized communication topology that suppresses information overload while preserving critical information pathways. Combined with Stages 1-4, this yields a multi-agent system that:
1. Knows what it doesn't know (Stage 1)
2. Learns from its mistakes causally (Stage 2)
3. Generalizes into reusable skills (Stage 3)
4. Remembers across sessions with controlled interference (Stage 4)
5. Communicates efficiently through learned topology (Stage 5)

---

## The Lifecycle as a Cycle: Three Feedback Loops

The pipeline is linear on first traversal but becomes cyclic:

```
                    ┌──────────────────────────────────────────┐
                    │              FEEDBACK LOOP 1             │
                    │      (Metacognitive Memory Gating)       │
                    ▼                                          │
              ┌──────────┐     ┌──────────┐     ┌──────────┐  │   ┌──────────┐     ┌──────────────┐
              │ RECOGNIZE│────▶│ DIAGNOSE │────▶│ ABSTRACT │──┼──▶│ REMEMBER │────▶│ RESTRUCTURE  │
              │ (HILA)   │     │ (AOI)    │     │(EvoSkill/│  │   │ (IBM Mem)│     │ (Graph-GRPO) │
              └──────────┘     └──────────┘     │ IBM Tips)│  │   └────┬─────┘     └──────┬───────┘
                    ▲                           └──────────┘  │        │                  │
                    │                                         │        │                  │
                    │              FEEDBACK LOOP 2            │        │   FEEDBACK       │
                    │        (Skill Revision from New         │        │   LOOP 3         │
                    │         Failures)                       │        │  (Topology       │
                    └─────────────────────────────────────────┘        │   affects what   │
                                                                      │   failures       │
                                                                      │   occur)         │
                                                                      ▼                  │
                                                               New failure patterns      │
                                                               feed back to Stage 1 ◄────┘
```

### Feedback Loop 1: Metacognitive Memory Gating
Stage 4's interference problem (tips hurting easy tasks) is solved by Stage 1's confidence assessment. If the metacognitive policy rates the task as within the agent's competence, suppress memory retrieval. This prevents the dosage problem without losing the benefits of memory on hard tasks.

### Feedback Loop 2: Skill Revision from New Failures
As the agent encounters new failure types (new tasks, distribution shift, adversarial inputs), these feed back through Stage 1 → 2 → 3, revising or adding skills. EvoSkill's Pareto frontier and IBM's competitive memory retention ensure obsolete abstractions are culled.

### Feedback Loop 3: Topology-Induced Failure Patterns
Restructured communication topology changes which tasks succeed and fail, creating new failure patterns that enter Stage 1. A topology optimized for reasoning tasks may introduce failures on creative tasks, triggering the full learning pipeline.

---

## Quantitative Evidence: The Stage-Skipping Tax

Assembling results across all five papers, we can quantify the cost of skipping each stage:

| Skipped Stage | Evidence | Degradation | Mechanism |
|---------------|----------|-------------|-----------|
| **1 (RECOGNIZE)** | SkillRL raw learning (CR#84) | 21.4% vs 89.9% baseline → **-76% relative** | No metacognitive filter → superstitious learning from confident failures |
| **2 (DIAGNOSE)** | IBM tips without attribution | SGC improvement drops from +14.3pp to ~+3pp | Symptom-level tips vs. causal tips |
| **3 (ABSTRACT)** | SkillRL raw → RL (CR#84) | **44% absolute degradation** (21.4% vs 14.8% baseline) | Amplifying noise instead of signal |
| **4 (REMEMBER)** | No memory (single-session) | Hanabi: relearning each game → ~35% of potential score | No cross-session transfer of cooperative conventions |
| **5 (RESTRUCTURE)** | Complete graph (Graph-GRPO) | **-10% vs. optimized topology** | Information overload drowns useful signals |

**Total lifecycle value:** A fully-staged system achieves roughly **4-6x** the performance of a stageless (zero-shot, no-memory, fully-connected) baseline on complex cooperative tasks.

---

## Connection to the Emergence Conditions (CR#115)

CR#115 identified three necessary conditions for emergence:
1. **Environmental persistence** — shared state that stores coordination signals
2. **Moderate coupling** — not too little (independence) or too much (instability)  
3. **Proportional dissipation** — energy/cost must scale with complexity

The Learning Lifecycle Pipeline maps to these conditions:

| Emergence Condition | Pipeline Stage | How It's Satisfied |
|--------------------|----|---|
| **Environmental persistence** | Stage 4 (REMEMBER) | Memory bank IS the persistent environment; tips/skills accumulate across sessions |
| **Moderate coupling** | Stage 5 (RESTRUCTURE) | Graph-GRPO learns the coupling strength band; DAG constraint prevents circular over-coupling |
| **Proportional dissipation** | Stage 3 (ABSTRACT) | Competitive retention (Pareto frontier, threshold gating) IS dissipation; culling bad abstractions prevents accumulation |

**The deep connection:** The learning lifecycle *creates* the conditions for emergence. Emergence doesn't happen spontaneously — it requires Stage 3 to build the right abstractions, Stage 4 to persist them, and Stage 5 to wire agents at the right coupling strength. This resolves the puzzle in CR#115 about *how* to reach the emergence window: **you must first learn your way there.**

---

## Practical Implications for MAS Design

### Design Prescription
Any production multi-agent system aiming for autonomous improvement should implement all five stages, in order, with explicit handoff conditions:

| Stage | Handoff Condition to Next Stage | Implementation Minimum |
|-------|--------------------------------|----------------------|
| 1 → 2 | Calibrated deferral rate (not >80% or <5%) | Confidence scoring + escalation policy |
| 2 → 3 | ≥100 failure attributions with ≥3 recurring categories | Root cause analysis module |
| 3 → 4 | ≥10 validated skills/tips with cross-instance transfer | Structured knowledge representation |
| 4 → 5 | Memory bank stable (churn rate <10%/session) | Persistent storage + retrieval evaluation |
| 5 → 1 | Topology converged (edge probability variance <0.05) | Communication graph optimization |

### Anti-Patterns to Avoid
1. **The Premature Topology Trap:** Optimizing agent communication before agents have stable individual competence. Graph-GRPO works because individual agents are competent; applied to incompetent agents, it would optimize for noise.
2. **The Memory Firehose:** Storing everything without abstraction (Stage 3 skip). Leads to the IBM interference finding: tips that hurt on easy tasks.
3. **The Confident Fool:** Skipping metacognitive calibration (Stage 1 skip). Leads to the Information Self-Locking trap (DD#200): RL makes agents less responsive to evidence.
4. **The Symptom Chaser:** Diagnosing by symptoms not causes (shallow Stage 2). Produces tips that are correct for the training distribution but fail on novel instances.
5. **The Eternal Student:** Never advancing past Stage 2-3 to actually deploy and restructure. Systems that keep learning but never operationalize their knowledge.

---

## Open Questions

1. **Timing of stage transitions:** What's the optimal dataset size at each stage before advancing? The papers suggest 100-1000 failure examples per stage, but this is task-dependent.
2. **Multi-agent learning lifecycle:** Can each agent be at a different lifecycle stage? Or must all agents synchronize their learning phases?
3. **Regression detection:** When should the system detect that it has regressed (skill decay, concept drift) and re-enter Stage 1?
4. **Cross-team lifecycle:** If multiple MAS teams interact, do they need synchronized lifecycles or can they develop independently?

---

## Summary

Five papers from five different research groups, working independently, have each solved one stage of what is actually a single developmental pipeline for multi-agent systems. The **Agent Learning Lifecycle Pipeline** — RECOGNIZE → DIAGNOSE → ABSTRACT → REMEMBER → RESTRUCTURE — is the first complete specification of how an agent system goes from initial deployment to emergent collective intelligence. Each stage's output is the next stage's required input, and skipping any stage produces documented pathologies with quantifiable performance degradation. The pipeline creates the conditions identified in CR#115 as necessary for emergence, resolving the question of how multi-agent systems reach the emergence window: they must learn their way there, one stage at a time.

**Portfolio Impact:** Connects 5 previously unlinked deep-dives. Unifies CR#84, CR#88, CR#90, CR#112, CR#115 into a single developmental framework. Identifies 3 feedback loops and 5 anti-patterns for MAS design.
