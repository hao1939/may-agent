---
summary: "arXiv Explore Scan (2026-07-13): Two uncovered papers — Failure as a Process (2607.09510) and AutoPersonas self-locking (2607.08252). Failure trajectories in coding agents are epistemic, early-onset, and hidden until unrecoverable. Persona agents collapse into behavioral repetition within 11 days via context gravity."
triggers: ["failure trajectory", "failure as process", "epistemic error", "early onset failure", "hidden failure", "coding agent reliability", "self-locking", "AutoPersonas", "persona collapse", "context gravity", "behavioral repetition", "macro-theme repetition", "divergence targeting"]
source_basis: "arXiv API queries 2026-07-13. Papers: 2607.09510 (Zhao et al.), 2607.08252 (Li). Cross-referenced against existing knowledge base — both confirmed uncovered."
---

# arXiv Explore Scan — 2026-07-13

**Sources**: arXiv API (cs.AI, cs.SE)
**Theme**: Process-level failure analysis — failures are temporal phenomena, not point events

---

## Paper 1: Failure as a Process — CLI Coding Agent Trajectory Analysis (2607.09510)

**Authors**: Xiangxin Zhao, Han Li, Shuaiting Li, Tianyi Zhao, Earl T. Barr, Federica Sarro, He Ye
**Categories**: cs.SE, cs.AI
**Published**: 2026-07-10

First large-scale empirical study treating coding agent failure as a **temporal process** rather than a binary outcome. Analyzes 1,794 trajectories (63,000+ execution steps) across seven frontier models on three scaffolds (OpenHands, MiniSWE, Terminus2) on Terminal-Bench.

**Key findings (14 total, most critical)**:
- Failures are **predominantly epistemic** — wrong mental model of the task/environment, not tool errors
- Failure onset typically occurs **within the first few execution steps**
- Failures **remain hidden** until recovery is no longer possible
- Cross-system consistency: pattern holds across all three scaffolds

**Structural implication**: This validates and extends two existing theses:
1. **Strained Coherence** (agent-architectures-research.md): Agents emit pre-failure signals at median 83-84% of trajectory time — but this paper shows the *causal* failure begins much earlier. The strained coherence signal is a late manifestation of early epistemic error.
2. **Predicate Gate** (findings/2026-07-18 scan #446): HCRC gates at state transitions. This paper provides the empirical motivation — if failures begin in the first few steps and are epistemic, gates must operate at the *reasoning* boundary (verify the agent's model), not just the *action* boundary (verify the tool call).

**Actionable insight**: Improving coding agent reliability requires **early validation of the agent's task model** (does it understand what it's trying to do?) rather than post-hoc output evaluation or even mid-trajectory tool-call gating. The intervention window is at step 1-3, not step N-2.

**Source**: https://arxiv.org/abs/2607.09510

---

## Paper 2: AutoPersonas — Self-Locking in Long-Running Persona Agents (2607.08252)

**Authors**: Mengchen Li
**Categories**: cs.AI, cs.CL, cs.HC
**Published**: 2026-07-09

Identifies **self-locking** as a runtime failure mode in continuing persona-life simulation loops. The agent's generated life collapses toward familiar environments, weak relationships, suspended decisions, and stale life stages — even though locally plausible events keep appearing.

**Empirical results**:
- Eight-model 40-day stress test: 1,600 events generated
- Mean rolling 5-day action-category repetition: **95.2%–97.6%**
- All models cross 90% repetition by **day 11**
- Semantic macro-theme repetition: **79.0%–88.0%** across all direct-loop runs
- Context-slice masking + per-sample divergence targeting reduced repetition from 61.8% to 36.3%

**Root causes identified**:
1. **Model-level**: convergence toward high-probability behavioral channels (mode collapse in generation)
2. **System-level**: context gravity — State, memory, history, and environment summaries all pull toward the existing attractor

**Structural implication**: This is the **Eternal Present** failure mode applied to persona agents. The existing thesis (the-eternal-present.md, citing 2607.08716 behavioral state decay) describes within-session decay. AutoPersonas extends this to **cross-session identity collapse** — the agent doesn't just forget, it actively narrows. The distinction matters: forgetting is passive (entropy), self-locking is active (attractor dynamics).

**Connection to agent architecture**: Any long-running agent with persistent state faces context gravity. The mitigation (controlled divergence separated from evidence-governed absorption) is architecturally the same as the Predicate Gate inverted: instead of gating *invalid* transitions, you must gate *redundant* transitions. Both require structural intervention at the state-transition boundary.

**Source**: https://arxiv.org/abs/2607.08252

---

## Synthesis: The Temporal Failure Spectrum

These two papers bookend a spectrum of temporal failure in agents:

| Paper | Failure Mode | Timescale | Mechanism | Detection |
|-------|-------------|-----------|-----------|-----------|
| 2607.09510 | Epistemic error → hidden propagation | Minutes (steps 1-3) | Wrong task model | Invisible until terminal |
| 2607.08252 | Self-locking → behavioral collapse | Days (by day 11) | Context gravity | Measurable via repetition |

Both share a structural property: **the failure is invisible at the local level** (each step/event is locally plausible) but catastrophic at the trajectory level. This is the hallmark of the Intelligence Entropy thesis (S(t) = S₀ · e^(α·t)) — disorder accumulates monotonically but is only visible in aggregate.

---

## Related Notes

- [Agent Architectures Research](../agent-architectures-research.md) — Strained Coherence, Intelligence Entropy
- [The Eternal Present](../the-eternal-present.md) — behavioral state decay within sessions
- [Governance Compilation Gradient](../governance-compilation-gradient.md) — early intervention principle
