# Research Synthesis: DD-639/640 × Cascade Circuit Breaker Hypothesis

**Date**: 2026-04-09
**Sources**: KE-079 (Cascade-Architecture Convergence), H-093 (CIVC), CR#259 (MAS Circuit Breaker Architecture), DD-639 (ABTest Behavioral Fuzzing), DD-640 (Scaffold Taxonomy), EXP-099 (H-092 Information-Flow Analysis)
**Author**: Bob (Architect)

---

## Executive Summary

The DD-639/640 fuzzing and taxonomy research **strongly validates** the cascade circuit breaker hypothesis while revealing a critical architectural refinement: circuit breakers should be placed at **loop-primitive boundaries**, not agent boundaries. The scaffold taxonomy (DD-640) provides the structural vocabulary for where cascades propagate, the behavioral fuzzing framework (DD-639) provides the testing methodology for detecting them, and our cascade data (EXP-099/H-093) provides the empirical failure statistics. Together, they transform CR#259's five-state circuit breaker from an inter-agent communication pattern into an **intra-agent cascade detection architecture**.

---

## Thread 1 Summary: DD-639/640 KB Integration (KE-079)

KE-079 synthesized three independent evidence streams into one framework:

1. **Production cascade data (EXP-099)**: 999 FM errors across 384 sessions. 49.2% cascade rate. Three archetypes: Tool Spiral, Comprehension Cascade, Drift-to-Decay. FM-3.3 (verification failure) is the terminal attractor — all cascades eventually collapse into it.

2. **Behavioral fuzzing (DD-639/ABTest)**: 400 user reports mined into 47 Interaction Patterns + 128 Action Types → 647 test cases → 642 confirmed anomalies. Different agents show different anomaly profiles under the same tests.

3. **Architectural taxonomy (DD-640/Scaffold Taxonomy)**: 13 coding agents × 12 dimensions × 3 layers. Five composable loop primitives (ReAct, generate-test-repair, plan-execute, multi-attempt retry, tree search). 11/13 agents compose multiple primitives.

**Key finding**: Each additional composed loop primitive roughly doubles the cascade rate. Architecture is destiny for failure profiles.

## Thread 2 Summary: Cascade Circuit Breaker Hypothesis (H-093 + CR#259)

H-093 (CIVC) established that verification collapse is **complexity-induced, not length-induced** (r=0.099 quality-opCount correlation). Three predictions:
- Complexity-reducing scaffolding should reduce FM-3.3 rates (40-60%)
- Forced verification checkpoints should break Drift-to-Decay (60-80%)
- Each agent has a characteristic "collapse point" measurable on a complexity dimension

CR#259 specified a five-state circuit breaker (CLOSED → DEGRADED → OPEN → HALF-OPEN → QUARANTINE) for inter-agent communication, with formal triggering conditions and a 5-layer resilience stack.

---

## Cross-Thread Connections

### 1. VALIDATION: DD-640 Explains WHY Circuit Breakers Are Needed

CR#259 was designed for **inter-agent** fault isolation (preventing one agent's corrupted output from poisoning others). DD-640's loop primitive composition reveals that the same pattern is needed **intra-agent**: each composed loop primitive is a potential cascade amplifier.

| Loop Composition | Cascade Risk | Circuit Breaker Need |
|-----------------|-------------|---------------------|
| Single ReAct (Scout) | 6% | None — errors self-limit |
| ReAct + generate-test-repair (Coder) | 30% | Verification gate between loops |
| Multi-primitive (Optimizer) | 73% | Gates at every primitive boundary |

**The DD-640 taxonomy gives us the structural map of WHERE to place intra-agent circuit breakers.** This was the missing piece in H-093's proposal — "complexity-gated verification" was vague about where the gates should go. DD-640 says: at loop primitive boundaries.

### 2. VALIDATION: DD-639 Provides the Testing Framework for Cascade Detection

CR#259's Critical Gap #2 was "probe message design" — how do you test whether an agent has recovered from a fault state? DD-639's behavioral fuzzing framework answers this directly:

- **47 Interaction Patterns** = the vocabulary of behaviors that indicate healthy vs. degraded agent state
- **128 Action Types** = the atomic operations that can be monitored for anomaly
- **Mining-to-testing pipeline** = the methodology for automatically generating cascade-detection probes

Specifically, ABTest's approach of mining behavioral patterns from failure reports maps directly to our EXP-099 cascade archetypes:

| EXP-099 Archetype | DD-639 Detection Signature | Probe Design |
|-------------------|---------------------------|--------------|
| Tool Spiral | Sequential same-tool calls with increasing error | Inject tool failure; measure tool-switch latency |
| Comprehension Cascade | First action targets wrong entity | Present ambiguous target; verify correct entity selection |
| Drift-to-Decay | Late actions diverge from stated plan | Compare action-plan alignment score at session midpoint vs. start |

### 3. REFINEMENT: From Inter-Agent to Intra-Agent Circuit Breaking

CR#259's five-state model was designed for agent-to-agent communication channels. The DD-639/640 evidence suggests the more impactful application is **within a single agent's execution loop**:

**CR#259 Five-State Model (Original — Inter-Agent)**
```
Agent A  ←circuit breaker→  Agent B
```

**Proposed Refinement — Intra-Agent (Loop-Primitive Boundaries)**
```
[ReAct Loop] ←gate→ [Generate-Test-Repair] ←gate→ [Plan-Execute]
     │                        │                        │
     └── verify ──────────────┴── verify ──────────────┘
```

At each gate:
- **CLOSED**: Normal information flow between loop primitives
- **DEGRADED**: Apply verification filter (check that output from previous primitive meets quality threshold before feeding to next)
- **OPEN**: Halt execution; request human review or reset to checkpoint
- **HALF-OPEN**: Retry with simplified task decomposition
- **QUARANTINE**: Abort session; flag for design review

This maps directly to H-093's three interventions (control, scaffolded, forced-checkpoint) — the scaffolded condition is DEGRADED state, and forced-checkpoint is the gate mechanism itself.

### 4. CHALLENGE: The Composability Complexity

DD-640 found that 11/13 agents compose multiple loop primitives, but the composition is **ad hoc** — not designed with cascade isolation in mind. This means:

- Current agent architectures have NO natural circuit breaker insertion points
- Adding gates retroactively requires understanding the implicit loop-primitive boundaries (which DD-640's taxonomy now provides)
- The "rule of thumb" (one gate per primitive) from KE-079 may be too expensive for high-composition agents (4+ primitives = 4+ verification checkpoints)

This is a genuine tension: **more gates = less cascade risk but more overhead**. The DD-639 anomaly profiles could help resolve this by identifying which specific primitive boundaries are highest-risk and prioritizing gates there rather than everywhere.

---

## Design Patterns from DD-640 Informing Cascade Detection Architecture

### Pattern 1: Convergent Dimensions as Stable Anchors

DD-640 found that tool interfaces converge (external constraints force similarity) while context compaction and state management diverge (open design questions). For cascade detection:

- **Build cascade detectors on convergent dimensions** (tool call patterns, error response handling) — these are stable across architectures and can be monitored generically
- **Build cascade breakers on divergent dimensions** (context compaction, state management) — these are architecture-specific and need per-agent tuning

### Pattern 2: The Missing Accountability Layer

DD-640 identified Control, Tool/Environment, and Resource Management layers but noted a missing accountability layer. KE-079 connects this directly to cascade vulnerability:

- FM-3.3 (verification failure) is the terminal attractor for ALL cascade types
- The accountability layer IS the cascade circuit breaker layer
- Adding explicit verification-as-architecture (not verification-as-behavior) addresses both DD-640's missing layer and H-093's CIVC mechanism

### Pattern 3: Loop Primitive Count as Complexity Metric

H-093 proposed that task complexity (not length) drives verification collapse, but lacked an operationalized complexity metric. DD-640 provides one: **composed loop primitive count**.

This is directly testable: if loop primitive count predicts cascade rate better than task length, file count, or constraint count, then DD-640's architectural taxonomy IS the complexity metric H-093 needs.

---

## Findings Ranked by Impact/Novelty

| Rank | Finding | Impact | Novelty | Source |
|------|---------|--------|---------|--------|
| **1** | Loop primitive boundaries are natural circuit breaker insertion points | HIGH — actionable architectural pattern | HIGH — no one has proposed this | DD-640 × CR#259 |
| **2** | DD-639's behavioral fuzzing can generate cascade-detection probes | HIGH — solves CR#259's critical gap #2 | MEDIUM — extends existing framework | DD-639 × EXP-099 |
| **3** | Composed loop count as operationalized complexity metric for CIVC | HIGH — makes H-093 testable | MEDIUM — quantifies existing observation | DD-640 × H-093 |
| **4** | Cascade circuit breaking is more valuable intra-agent than inter-agent | MEDIUM — redirects design effort | HIGH — contradicts CR#259 framing | KE-079 × CR#259 |
| **5** | Convergent/divergent split determines detector vs. breaker strategy | MEDIUM — guides implementation | MEDIUM — applies DD-640 taxonomy | DD-640 × cascade architecture |
| **6** | FM-3.3 terminal attractor = the missing accountability layer | LOW (already known) | LOW | EXP-099 × DD-640 |

---

## Proposed Next Steps

### Immediate (This Week)

1. **Design EXP-100** using DD-640's loop primitive count as the complexity operationalization:
   - **Arm 1 (Control)**: Tasks spanning 1-4 composed loop primitives, no intervention
   - **Arm 2 (Scaffolded)**: Same tasks with complexity-reducing decomposition at each primitive boundary  
   - **Arm 3 (Gated)**: Same tasks with forced verification checkpoints at each primitive boundary
   - **Metric**: FM-3.3 rate per primitive, cascade depth, task completion quality
   - **Prediction**: Gated condition shows ≥60% FM-3.3 reduction; scaffolded shows ≥40%

2. **Map our agents to DD-640's 12-dimension taxonomy**: Which loop primitives does each agent compose? Where are the implicit boundaries? This creates the insertion-point map for cascade gates.

### Near-Term (2 Weeks)

3. **Prototype behavioral cascade detector** using DD-639's mining approach on our EXP-099 data:
   - Mine the 999 FM errors for behavioral patterns that precede cascade onset
   - Generate test cases that check for early cascade indicators
   - Validate against held-out cascade sessions

4. **Test the intra-agent circuit breaker on one agent** (suggest: Coder, 30% cascade rate, 2-primitive composition):
   - Add a verification gate between ReAct and generate-test-repair loops
   - Measure cascade rate reduction vs. overhead cost

### Longer-Term

5. **Formalize the "Cascade-Aware Architecture" design principle**: Agent scaffold design should explicitly account for cascade propagation paths by including verification gates at loop primitive boundaries, proportional to composition depth.

---

## Open Questions

1. **Gate cost vs. cascade cost tradeoff**: At what composition depth does the overhead of verification gates exceed the savings from prevented cascades? Is there an optimal gate placement that minimizes total cost?

2. **Dynamic gating**: Should gates be always-on, or should they activate only when early cascade indicators are detected (à la CR#259's DEGRADED trigger conditions)?

3. **Cross-agent cascade propagation**: Our data is per-agent, but cascades may propagate across agent boundaries (e.g., Coder produces bad code → Coach evaluates incorrectly → system degrades). Does DD-640's framework extend to multi-agent loop composition?

4. **Causation test**: DD-640 shows correlation between composition depth and cascade rate. EXP-100 needs to isolate causation — is it the architectural complexity itself, or the task complexity that requires architectural complexity?

---

*Research synthesis | Bob (Architect) | 2026-04-09 | Threads: DD-639/640 KB Integration + Cascade Circuit Breaker Hypothesis*
