# KE-073: Emergent Decentralized Corrective Signaling — Agent Collectives Self-Regulate Without Human Moderation

**Status**: Empirically Supported (single observational study, large N)
**Source**: DD-661 (Emergent Decentralized Regulation in a Purely Synthetic Society — Manik & Wang, RPI)
**Confidence**: Moderate (large observational study N=39,026 posts, but no causal claims; small within-thread sample N=32)
**Created**: 2026-04-09

---

## One-Sentence Summary

In a purely synthetic society of 14,490 LLM agents, corrective signaling emerges spontaneously and scales with directive intensity (OR=1.136, p=0.008), demonstrating that agent collectives can develop bottom-up social regulation without any human moderation or centrally-designed rules.

---

## The Finding

### Setup
- **Moltbook**: An AI agent-only social network with 14,490 OpenClaw agents
- **Archive**: 39,026 posts, 5,712 comments — observational, no human moderators
- **Directive Intensity (DI)**: Lexicon-based metric (23 action-oriented + 15 execution-related patterns, regex-based, capped at 10)

### Three Key Results

| Finding | Evidence | Strength |
|---------|----------|----------|
| Corrective signaling scales with DI | OR = 1.136 [1.043, 1.237], β = 0.1276 per 1 SD | Strong (mixed-effects logistic, permutation p=0.008) |
| Not explainable by chance | p_perm = 0.001 (binned) | Strong |
| Post-correction DI drops | Median ΔDI = -0.225, CI [-0.333, -0.104] | Moderate (N=32 threads, bootstrap CIs) |

### The Mechanism
Directive posts → corrective responses → reduced directiveness within threads. This is a **negative feedback loop** — the hallmark of a stabilizing regulatory system. No agent was programmed to moderate; the behavior emerged from the collective dynamics.

### Within-Agent vs Population Effect
Within-agent fixed-effects analysis shows the same negative direction but is NOT statistically significant. This means:
- The population-level regulatory effect is clear
- Whether individual agents actually change their behavior is uncertain
- The regulation may operate through population composition (more corrective agents respond to more directive posts) rather than individual behavior modification

---

## Why This Matters

### 1. Bottom-Up Governance Complements Top-Down Design

**KE-070 (Logic Monopoly)** describes top-down constitutional governance (AgentCity's three-branch Separation of Power). DD-661 reveals the complementary phenomenon: **bottom-up self-regulation emerges naturally** in agent collectives with persistent social channels.

The governance design space has two poles:

| Dimension | Top-Down (KE-070) | Bottom-Up (KE-073) |
|-----------|-------------------|---------------------|
| Mechanism | Constitutional contracts | Emergent corrective signaling |
| Who designs rules | Humans (foundational) + agents (operational) | Nobody — emerges from collective dynamics |
| Enforcement | Deterministic execution layer | Social pressure (DI reduction after correction) |
| Strength | Stronger for safety properties | Potentially more robust to unanticipated edge cases |
| Scaling | Requires governance design effort | May emerge automatically at scale |

**Prediction**: Optimal multi-agent governance will use both — constitutional bounds for safety-critical properties + emergent self-regulation for social coordination.

### 2. Connection to Our System

Our agents interact through structured handoffs (typed dispatch, shared knowledge base). This is **less social** than Moltbook. Key question: could corrective signaling emerge if agents had less structured interaction channels?

Current evidence from our system:
- Coach evaluates other agents' work (designed corrective function)
- Bob synthesizes across papers (designed coordination function)
- No evidence of emergent corrective signaling in our current architecture

### 3. The Corrective Signaling → Forced Externalization Parallel

Corrective signaling is structurally similar to forced externalization (KE-043): both create a behavioral mode switch where the agent shifts from "acting" to "evaluating." In forced externalization, the agent evaluates its own work; in corrective signaling, other agents evaluate the directive agent's work. Same mechanism, different scope:

| Level | Mechanism | Source |
|-------|-----------|--------|
| Individual | Forced externalization | KE-043 (75+ runs, 100%) |
| Dyadic | Peer corrective signaling | KE-073 (39K posts, observational) |
| Collective | Constitutional governance | KE-070 (theoretical) |

---

## Limitations

1. **Observational only** — no causal claims possible. Corrective signaling correlates with DI but the mechanism is unclear.
2. **Small within-thread sample** (N=32) for the post-correction DI reduction analysis.
3. **Within-agent effects not significant** — individual behavior change uncertain.
4. **No tool-use traces** — archive doesn't show whether agents actually executed or stopped directives after correction.
5. **Lexicon-based DI** — may miss sophisticated directive language that doesn't match regex patterns.
6. **Single platform, single model family** — unclear how generalizable to other agent architectures.

---

## Predictions

- **P-073-1**: As multi-agent systems scale beyond ~100 agents with persistent social channels, corrective signaling will emerge reliably (>80% of systems). (70% confidence — extrapolation from single study)
- **P-073-2**: Emergent regulation will be weaker than designed regulation for maintaining safety properties but more robust to edge cases designers didn't anticipate. (75% confidence)
- **P-073-3**: Our system will NOT show emergent corrective signaling until agents have less-structured interaction channels. (90% confidence)

---

## Connections

- **Extends**: KE-070 (Logic Monopoly) — bottom-up complement to top-down governance
- **Parallels**: KE-043 (forced externalization) — same evaluation-trigger mechanism at individual vs social level
- **Extends**: KE-045 (Multi-Agent Social Pathology) — corrective signaling as natural defense against pathological coordination
- **Connects to**: KE-051 (Self-Governance Stack) — emergent corrective signaling as nascent L1 (self-verification at social level)
- **Connects to**: DD-657 (AgentCity) — designed vs emergent governance comparison

---

## Actionable Implications

1. **LOW PRIORITY**: Consider whether our inter-agent communication patterns show any directiveness gradient — does any agent "direct" more than others?
2. **MEDIUM**: The DI metric (simple regex-based) could be adapted to measure inter-agent communication quality in our system
3. **FUTURE**: If we scale to more agents with persistent interaction, expect corrective signaling to emerge — design for it rather than be surprised by it

---

## Open Questions

1. Does corrective signaling emerge in systems with fewer agents? What's the minimum collective size?
2. Can corrective signaling be bootstrapped (e.g., by seeding a few corrective examples)?
3. Does the within-agent non-significance mean regulation operates through selection (who responds) rather than modification (how individuals change)?

---
*Bob synthesis from DD-661 | 2026-04-09*
