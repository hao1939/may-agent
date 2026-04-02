# DD#467: AgentComm-Bench — Stress-Testing Cooperative AI Under Communication Collapse

**Paper:** arXiv:2603.20285
**Authors:** Bansal, Gangwani (Synthetic Sciences)
**Published:** 2026-03-18 (appeared in Tuesday March 24 cs.AI batch)
**Scout session:** s_1774353818960_70 (2026-03-24)

---

## One-Sentence Summary

AgentComm-Bench provides the first systematic benchmark for evaluating cooperative multi-agent systems under six communication impairment dimensions, revealing that vulnerability is task-impairment specific — stale memory and bandwidth collapse cause >96% performance drops in navigation, while content corruption destroys perception by >85%.

## Benchmark Architecture

### Six Communication Impairment Dimensions
| Dim | Impairment | Severity Range | Real-World Analog |
|-----|-----------|---------------|-------------------|
| D1 | Latency | 0–500ms | Cellular V2X links |
| D2 | Packet Loss | 0–80% | Wireless robot links (5–30% typical) |
| D3 | Bandwidth Collapse | 0–100% reduction | Spectrum congestion |
| D4 | Asynchronous Updates | 0–10 steps offset | Heterogeneous clock domains |
| D5 | Stale Memory | 0–20 steps | Intermittent link failure |
| D6 | Conflicting Sensors | 0–40% corruption | Sensor disagreement across platforms |

Each dimension swept across 11 severity levels producing smooth degradation curves.

### Three Task Families
1. **Cooperative Perception (CP):** 4 agents fuse observations from different viewpoints → F1 score. Communication-intensive for resolving occlusions.
2. **Multi-Agent Navigation (NAV):** Coordinator assigns waypoints; agents decode and navigate → waypoint completion rate. Utterly dependent on communication (3.6% without vs 96.7% with).
3. **Cooperative Search (SEARCH):** Zone assignment for coordinated target search → recall. Moderate communication benefit (20.7% → 26.8%).

### Five Communication Strategies Evaluated
- **No-Comm:** Independent agents (lower bound performance, upper bound robustness)
- **Full-Comm:** Complete observation sharing every step
- **Compressed-Comm:** 4-bit quantized features (8× bandwidth reduction)
- **Event-Triggered:** Transmit only when information gain exceeds threshold
- **ResilientComm (proposed):** Redundant message coding + staleness-aware fusion

## Key Results — The Catastrophic Findings

### Finding 1: Communication-Dependent Tasks Fail Catastrophically
Navigation degrades under ALL six impairments:
- Stale memory: 96.7% → 2.5% (NPD = **97.4%**)
- Bandwidth collapse: 96.7% → 3.6% (NPD = **96.3%**)
- Packet loss: 96.7% → 10.0% (NPD = **89.7%**)
- Even "benign" latency: 96.7% → 65.8% (NPD = 31.9%)

### Finding 2: Content Corruption Is the Perception Killer
CP is immune to transport impairments (0% NPD for latency, packet loss, bandwidth, async) but catastrophically vulnerable to content corruption:
- Stale memory + conflicting sensors: F1 drops 95.8 → 14.0 (NPD = **85.4%**)
- Corrupted messages generate false positives that overwhelm fusion
- **np.maximum fusion tolerates missing data but amplifies corrupted data**

### Finding 3: Communication Can Actively Harm Performance
Under stale memory and conflicting evidence, ALL communicating methods perform WORSE than No-Comm for perception (14.0 F1 vs 95.8). This demands a **"circuit breaker"** mechanism.

### Finding 4: Redundancy > Sophistication for Transport Impairments
ResilientComm's dual transmission is the ONLY differentiator:
- 80% packet loss: ResilientComm retains 21.9% vs 10.0% for single-message methods (>2× improvement)
- Mechanism: reduces effective loss from p to p² (80% → 64%)
- Full-Comm, Compressed, Event-Triggered produce IDENTICAL NAV/SEARCH results because one-hot waypoint encoding survives compression and always triggers events

### Recommended Evaluation Standard (Proposed)
All cooperative AI papers should report: (R1) clean performance, (R2) NPD under ≥3 impairment conditions, (R3) robustness curve for ≥1 dimension, (R4) rank stability across ≥3 methods, (R5) communication load in bits/step.

## Connections to Our Research Threads

### Gap 3 — Runtime Orchestration (PRIMARY)
**This is the missing robustness layer for MAS deployment.** Current orchestration research assumes reliable communication — AgentComm-Bench proves this is catastrophically wrong.

**Connection to DD#466 (ProMAS):** ProMAS predicts errors but assumes perfect communication between its monitoring layer and agents. AgentComm-Bench shows that even the monitoring signal itself could be corrupted. Together they define a two-layer problem:
1. Detect reasoning errors (ProMAS)
2. Ensure error detection signals survive communication degradation (AgentComm-Bench)

**Connection to DD#463 (Selection Bottleneck):** The selection vs. synthesis decision requires reliable judge-agent communication. Under packet loss, the judge may not receive all candidates — selection degrades faster than synthesis because synthesis is inherently redundant.

### Gap 2 — Trust Dynamics
The "circuit breaker" finding connects directly to trust erosion:
- DD#465's trust collapse model shows how misinformation cascades
- AgentComm-Bench's content corruption finding is the *mechanism*: corrupted messages actively poison shared state
- The trust stability condition ρ(J) < 1 must account for message corruption rate

### Gap 1 — Trust Calibration
AgentComm-Bench provides concrete calibration data:
- Under what communication conditions should agents trust shared information?
- Threshold: when stale memory > 8 steps, trust should drop to zero (the "cliff" in NAV results)
- This operationalizes ALARA's (DD#464) least-privilege principle: restrict information sharing under degraded channels

## Gap Analysis

### What AgentComm-Bench Gets Right
1. **Systematic coverage** — First benchmark to test ALL six communication failure modes together
2. **Task-impairment interaction** — Shows vulnerability is NOT universal; it depends on fusion mechanism × failure mode
3. **Practical evaluation protocol** — Runs in 5 minutes on single CPU, fully reproducible
4. **Circuit breaker insight** — Proves communication can actively harm, not just fail to help

### What AgentComm-Bench Misses
1. **Grid-world only** — 20×20 grid is far from real deployment complexity. Findings need validation in photorealistic simulators.
2. **No learned communication policies** — Tests only fixed strategies; real MAS use learned protocols (CommNet, TarMAC, etc.)
3. **Independent impairments** — Tests dimensions independently; real channels have correlated failures (packet loss + latency spike together)
4. **No LLM-based agents** — Tests coordinate-based agents; LLM-based MAS have different communication patterns (natural language, variable message length)
5. **ResilientComm is engineering, not learning** — Redundancy and staleness weighting are textbook techniques; no learned adaptation
6. **Small scale** — 4 agents only; scaling behavior unknown

### Open Questions
- How do these degradation patterns change with LLM-based agents that communicate in natural language?
- Can ProMAS's risk detection be made robust to the communication impairments AgentComm-Bench identifies?
- Is there an optimal "communication budget" that maximizes the robustness–performance tradeoff?
- What does the circuit breaker mechanism look like in practice for LLM-based MAS?

## Relevance Rating: ★★★★½

**Rationale:** First systematic stress-testing of cooperative AI communication is extremely valuable for deployment-oriented research. The finding that communication can actively harm performance under corruption is a critical insight for MAS design. Loses half a star for grid-world-only instantiation and lack of LLM-based agent testing. But the evaluation protocol itself is immediately applicable.

## Tags
`#communication-robustness` `#benchmarking` `#degradation-patterns` `#circuit-breaker` `#gap3-orchestration` `#cooperative-perception`
