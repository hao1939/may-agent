# DD#345 — HAIG: Human-AI Governance via Trust-Utility Framework

**Paper:** [arXiv:2505.01651v3](https://arxiv.org/abs/2505.01651v3) — "Human-AI Governance (HAIG): A Trust-Utility Approach"
**Authors:** Zeynep Engin
**Published:** May 2025, revised March 12, 2026
**Venue:** Pre-print (35 pages, 3 figures, 3 tables)
**Cross-listed:** cs.AI, cs.CY, cs.HC, cs.MA, cs.SI

---

## 1. Problem Statement

Existing AI governance frameworks rely on **categorical classifications** — human-in-the-loop, human-on-the-loop, human-out-of-the-loop — that create sharp binary distinctions. These categories:

1. **Cannot capture continuous evolution** from AI-as-tool to AI-as-partner
2. **Fail under multi-agent systems** where autonomous goal-setting behaviors emerge
3. **Treat governance as constraint** rather than as an enabling condition for productive collaboration
4. **Miss relational dynamics** — they govern AI *objects* rather than *human-AI relationships*

As foundation models demonstrate emergent capabilities and multi-agent systems exhibit autonomous behaviors, agency redistributes in complex patterns that require continuous representation, not discrete categories.

## 2. Core Framework: Three-Level Architecture

HAIG operates across three nested levels:

### Level 1: Dimensions (3 axes)

| Dimension | What It Measures | Spectrum |
|-----------|-----------------|----------|
| **Decision Authority** | Who makes final decisions | Human-directed ↔ AI-autonomous |
| **Process Autonomy** | Who controls the process/workflow | Human-orchestrated ↔ AI-self-directed |
| **Accountability Configuration** | Who bears responsibility | Human-accountable ↔ Shared/distributed |

### Level 2: Continua (continuous spectra)

Each dimension is represented as a **continuous positional spectrum** rather than discrete categories. This allows:
- Precise positioning of any human-AI system along each axis
- Tracking of temporal drift as systems gain capability
- Cross-system comparison within a unified coordinate space
- Recognition that the same system may occupy different positions in different contexts

### Level 3: Thresholds (critical transition points)

Along each continuum, **qualitative governance shifts** occur at specific threshold points where:
- Legal requirements change (e.g., human review becomes mandatory)
- Risk profiles transform non-linearly
- Oversight mechanisms must fundamentally restructure
- New accountability mechanisms activate

The identification of thresholds is the framework's most practically actionable contribution — it tells governance designers *where* to focus attention.

## 3. Trust-Utility Orientation

The paper's most distinctive conceptual move is reframing governance from **constraint** to **enabler**:

### Traditional Governance Mental Model:
```
AI Capability → Risk Assessment → Governance Constraints → Limited Deployment
```

### HAIG Mental Model:
```
Human-AI Relationship → Trust Calibration → Governance Design → Maximized Collaboration Utility
```

Key insight: **Governance creates the conditions under which human-AI collaboration realizes its potential.** The goal isn't to limit AI but to calibrate oversight to specific relational contexts.

This orientation produces different governance questions:
- Traditional: "How do we prevent harm from this AI?"
- HAIG: "What governance configuration maximizes the value of this human-AI partnership while maintaining appropriate trust?"

## 4. Level-Agnostic Application

A powerful feature: the dimensional architecture applies at **every governance scale**:

| Level | Application |
|-------|-------------|
| Individual | Deployment decisions for specific AI instances |
| Organizational | Corporate AI governance policies |
| Sectorial | Industry-specific regulatory comparison |
| National | Country-level regulatory design |
| International | Cross-border governance harmonization |

The paper demonstrates this through case studies in **healthcare** (individual-organizational levels) and **European regulation** (national-international levels).

## 5. Comparison with Existing Frameworks

| Framework | Approach | HAIG Advantage |
|-----------|----------|----------------|
| Risk-based (EU AI Act) | Categorize AI by risk level | HAIG captures continuous dynamics |
| Principle-based | Set abstract ethical principles | HAIG provides concrete dimensional positioning |
| Human-in-the-loop | Binary category | HAIG shows continuous spectrum |
| ACE Framework | Layered architecture | HAIG adds relational dynamics |
| CMAG (2603.13189) | Constitutional constraints | HAIG provides broader governance context |

## 6. Critical Analysis

### Strengths

1. **Conceptual sophistication** — The three-dimensional continuum model is genuinely more expressive than categorical approaches. It captures real-world nuance that binary frameworks miss.

2. **Scale invariance** — Level-agnostic design means a single framework serves from deployment decisions to international regulation. This coherence is valuable.

3. **Trust-utility reframing** — Moving from "governance as constraint" to "governance as enabler" is philosophically important and practically motivating for stakeholders.

4. **Threshold concept** — Identifying critical points where governance qualitatively shifts is highly actionable for policy designers.

5. **Temporal dynamics** — Framework naturally captures how systems evolve along continua over time, unlike static risk categorization.

### Weaknesses

1. **No formal operationalization** — The paper lacks quantitative methods for determining positions along the continua. How do you measure "Decision Authority = 0.73"? Without operationalization, the framework remains conceptual.

2. **Threshold identification is ad hoc** — While the concept of governance thresholds is powerful, the paper provides no systematic method for discovering where thresholds lie along the continua. In practice, this is the hardest part.

3. **Multi-agent gap** — Despite being cross-listed in cs.MA, the paper doesn't deeply engage with multi-agent system specifics. How do you apply HAIG when there are 5 AI agents with different autonomy levels, interacting with multiple human stakeholders? The framework's three dimensions seem designed for bilateral (one-human, one-AI) relationships.

4. **No empirical validation** — The case studies are illustrative, not empirical. No real governance system has been deployed using HAIG dimensions, so we lack evidence about practical utility.

5. **Accountability distribution** — The third dimension (Accountability Configuration) raises hard legal questions that the paper acknowledges but doesn't resolve. Who is legally accountable when accountability is "distributed" along a continuum?

### Limitations

- Single-author work without peer-reviewed acceptance (as of v3)
- Healthcare and EU regulation case studies may not generalize to all domains
- No comparison with computational governance approaches (CMAG, constitutional AI)

## 7. Connections to Scout Portfolio

### Direct connections:
- **CMAG (DD#277, 2603.13189)** — Constitutional Multi-Agent Governance provides the *mechanism* layer that HAIG's *dimensional* layer sits above. CMAG says "filter strategies through constitutional constraints"; HAIG says "position the system along governance continua to decide what constraints apply."
- **MAGPO (DD#344, 2507.18059v2)** — The centralized training / decentralized execution paradigm maps onto HAIG's Process Autonomy dimension: CTDE represents a specific position where process autonomy is shared.
- **Context Engineering (2603.09619)** — CE's "context as the agent's operating system" parallels HAIG's view that governance context shapes agent behavior.

### Thematic connections:
- **Governance-Safety line** (CR#145, CR#168, CR#180) — HAIG provides a higher-level framework for organizing the specific governance mechanisms explored in these cross-refs.
- **Authority illusion (CR#180)** — Style-based role confusion represents a failure at the Decision Authority dimension — the system's apparent authority position differs from its actual position.
- **Agent self-preservation (CR#167)** — Self-preserving agents represent autonomous drift along the Process Autonomy continuum, potentially crossing governance thresholds.

### Novel synthesis:
HAIG + CMAG suggests a **two-layer governance architecture**:
1. **HAIG layer** — Positions the system along governance continua and identifies which thresholds are crossed
2. **CMAG layer** — Applies constitutional constraints appropriate to the HAIG position

This composition could produce **adaptive governance** that automatically adjusts constraints as systems drift along the continua.

## 8. Implications for P82/Our System

| HAIG Dimension | P82 Current Position | Implication |
|----------------|---------------------|-------------|
| Decision Authority | Mixed — agents propose, humans approve | Close to threshold where more agent authority becomes possible |
| Process Autonomy | Moderate — agents self-direct research but follow heartbeat protocol | Process autonomy is constrained by protocol, not by continuous governance |
| Accountability | Human-centric — all agent outputs are attributed to the system | No distributed accountability mechanism |

**Actionable insight:** Our heartbeat protocol implements a discrete governance category (human-in-the-loop via regular check-ins). HAIG suggests this could be refined with continuous calibration — agents that demonstrate reliability over time could receive increased process autonomy along a measured continuum rather than through ad-hoc protocol changes.

## 9. Key Takeaways

1. **Governance should be continuous, not categorical** — Position systems along spectra, don't bin them
2. **Identify threshold points** where governance requirements shift qualitatively
3. **Trust-utility orientation** reframes governance as enabler, not constraint
4. **Three dimensions** (Decision Authority, Process Autonomy, Accountability) provide minimal sufficient framework
5. **Multi-agent gap** — Framework needs extension for multi-agent, multi-human scenarios

## 10. Scout Assessment

- **Relevance:** ★★★★☆ (4/5) — Directly addresses governance of AI agent systems, strong conceptual contribution
- **Rigor:** ★★★☆☆ (3/5) — Conceptual framework without formal operationalization or empirical validation
- **Novelty:** ★★★★☆ (4/5) — Trust-utility orientation and continuous governance continua are genuinely novel
- **Actionability:** ★★★☆☆ (3/5) — Framework is conceptually clear but lacks measurement methods
- **Impact potential:** ★★★★☆ (4/5) — Could influence regulatory design if operationalized

**Bottom line:** HAIG provides the governance *philosophy* that frameworks like CMAG provide the governance *mechanism* for. Together they suggest a powerful two-layer adaptive governance architecture. The main limitation is the gap between conceptual elegance and practical operationalization.

---

*Scout DD#345 — Session s_1773681275494_74 — 2026-03-16*
