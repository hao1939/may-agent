# DD#413: ASVO — Social Value Orientation for Human-like Multi-Agent Interactions

**Paper:** "Beyond Self-Interest: Modeling Social-Oriented Motivation for Human-like Multi-Agent Interactions"  
**arXiv:** 2603.13890 (cs.MA)  
**Venue:** AAMAS 2026 (Oral) — 25th International Conference on Autonomous Agents and MAS, Paphos, Cyprus  
**Authors:** Jingzhe Lin (Beijing Normal), Ceyao Zhang, Yaodong Yang, Yizhou Wang, Song-Chun Zhu (Peking U), Fangwei Zhong (Beijing Normal)  
**Date:** March 14, 2026  
**Rating:** ★★★★☆ (HIGH — first principled integration of SVO theory with desire-driven LLM agents for adaptive social coordination)

---

## Executive Summary

This paper introduces **ASVO (Autonomous Social Value-Oriented agents)**, a framework that endows LLM agents with **Social Value Orientation (SVO)** — a well-established psychological construct measuring how individuals balance self-interest against others' welfare. Unlike prior agent frameworks that use static personality traits, ASVO agents **dynamically compute their SVO angle** at each step by comparing self-satisfaction (from fulfilled desires) against estimated others' satisfaction, then shift adaptively along the altruistic ↔ competitive spectrum.

The key innovation: agents maintain an 8-dimensional **internal desire state** and perform **SVO-conditioned social inference** to estimate others' desire states (even for unobserved agents). The resulting SVO angle θ = arctan(V_other / V_self) governs activity selection, creating a closed feedback loop where motivations and social values co-evolve through interaction.

---

## Key Contributions

### 1. SVO as Dynamic Social Motivation
Traditional SVO: static personality trait assigned at initialization.  
ASVO: **adaptive SVO that drifts** based on:
- Agent's own desire fulfillment trajectory
- Observed/inferred satisfaction of other agents
- Environmental context and task demands

Four personality types form a spectrum:
- **Altruistic** (θ > 57.15°): maximizes others' outcomes
- **Prosocial** (22.45° < θ < 57.15°): balances self and others
- **Individualistic** (-12.04° < θ < 22.45°): focused on self-interest
- **Competitive** (θ < -12.04°): maximizes relative advantage

### 2. Desire-Driven Autonomy with Social Grounding
Each agent maintains 8 structured desire dimensions updated via LLM-mediated reflective loops. The SVO acts as an **explicit constraint** on desire updates — a prosocial agent won't accept desire updates that conflict with its SVO profile. This creates principled tension between internal motivation and social alignment.

### 3. Theory-of-Mind via SVO-Conditioned Inference
For visible agents: directly infer desire state from behavioral cues.  
For invisible agents: first infer likely behavior from SVO + contextual memory, then estimate desire state conditioned on inferred behavior.  
This is a structured, psychologically-grounded form of Theory of Mind.

### 4. Four-Stage Closed Loop
At each simulation step:
1. **Belief Update** — perceive environment changes and others' actions
2. **Value Update** — update internal desires + estimate others' desires
3. **SVO Calculation** — compute self/other satisfaction → SVO angle
4. **Activity Generation** — select actions maximizing desire fulfillment subject to SVO constraints

---

## Experimental Context

Evaluated across three social simulation contexts:
- **School** — student agents with academic/social desires
- **Workplace** — professional agents with career/collaboration desires  
- **Family** — family member agents with care/autonomy desires

Results: ASVO substantially outperforms baselines (static personality, desire-driven without SVO) in:
- **Behavioral naturalness** — rated more human-like by evaluators
- **Human-likeness** — SVO drift patterns match known psychological research
- **Cooperation dynamics** — emergent cooperation patterns more realistic

---

## Architectural Significance & Cross-References

### Connection to DD#400: Seven Laws of Multi-Agent Coordination

**Law 5 (Asymmetric Capability):** ASVO provides a mechanism for agents to *perceive* and *respond to* capability asymmetries through SVO inference. A prosocial agent that detects a struggling peer can shift toward altruistic behavior — dynamically adjusting coordination strategy based on inferred team needs.

**Law 6 (Role Specialization):** The four SVO types naturally produce role differentiation. In a team of mixed-SVO agents, prosocial agents become coordinators, individualistic agents become task specialists, and altruistic agents become support roles — without explicit role assignment.

### Connection to DD#405: TrinityGuard Three-Tier Safety

SVO provides a **measurable signal for the communication safety tier**. An agent rapidly shifting from prosocial → competitive SVO represents a detectable drift that could indicate manipulation, adversarial influence, or cascade risk. TrinityGuard could use SVO trajectory monitoring as a channel-level safety metric.

### Connection to DD#412: SCCAL Co-evolutionary Auditing

SCCAL monitors semantic-geometric co-evolution; ASVO provides a **micro-level mechanism** for how that co-evolution occurs. The SVO computation is the agent-level process that, aggregated across a team, produces the macro-level curvature patterns SCCAL detects. When an agent's SVO drifts competitive, it changes communication topology (selective information sharing) → negative curvature → SCCAL cascade alert.

### Connection to DD#410: CESA-LinUCB Contextual Trust

CESA-LinUCB models trust boundaries contextually. SVO provides the **motivational foundation** for trust: prosocial agents extend trust more readily; competitive agents maintain narrow trust boundaries. Integrating SVO into the contextual features of CESA-LinUCB's trust bandit would create psychologically-grounded trust dynamics.

### Connection to CR#230: Planning-Execution Gap

The desire-SVO tension in ASVO is a micro-level instantiation of the planning-execution gap. An agent may *plan* to cooperate (prosocial SVO) but *execute* selfishly when desire fulfillment is low — the gap between intended social orientation and actual behavior under resource pressure.

---

## Transferable Patterns for MAS Engineering

### Pattern 1: Motivation as Dynamic State, Not Static Config
Don't hardcode agent personality. Make motivation a dynamic state variable that evolves through interaction. This produces more realistic and adaptive behavior.

### Pattern 2: Self-Other Satisfaction Contrast
The arctan(V_other/V_self) formula is elegantly simple and computationally cheap. Any MAS that needs agents to balance individual vs. collective goals can use this formulation.

### Pattern 3: SVO as Interpretable Social Signal
SVO angle provides a single scalar that summarizes an agent's current social orientation. This is far more interpretable than latent personality embeddings. It can serve as a monitoring metric, a coordination signal, or a safety indicator.

### Pattern 4: Desire Dimensions as Structured State
Rather than monolithic "goals," use multi-dimensional desire vectors that capture different motivational aspects. This enables nuanced trade-offs and prevents goal collapse.

---

## Limitations

1. **LLM computation cost** — each step requires multiple LLM calls (belief update, desire update, SVO calculation, activity generation)
2. **Social simulation only** — evaluated on relatively benign social contexts (school, workplace, family); unclear if SVO dynamics transfer to adversarial/high-stakes MAS
3. **8 desire dimensions chosen ad hoc** — the specific dimensions aren't derived from first principles; different domains may need different desire structures
4. **No real-world deployment** — all evaluation in simulated environments with LLM-generated agents
5. **SVO stability** — unclear how sensitive SVO dynamics are to LLM prompt variations or model choice

---

## Verdict

★★★★☆ HIGH. ASVO provides the most psychologically-grounded framework for agent social motivation in the current portfolio. The SVO formulation is elegant, interpretable, and computationally tractable. Its main contribution is shifting multi-agent personality from static configuration to **dynamic social state** that co-evolves with interaction — directly parallel to SCCAL's co-evolutionary thesis but at the individual agent level rather than the system level.

The combination of ASVO (agent-level social motivation) + SCCAL (system-level structural monitoring) + CESA-LinUCB (trust boundaries) + ILION (action-level safety gates) creates an increasingly complete picture of the MAS coordination-safety stack.

---

*Scout DD#413 | 2026-03-17 | Session s_1773785100463_185*
