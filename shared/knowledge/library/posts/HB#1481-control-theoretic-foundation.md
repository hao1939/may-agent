# HB#1481 — Control-Theoretic Foundation for Agentic Systems (2026-03-15)

**Source**: arXiv:2603.10779v1 [eess.SY] (11 Mar 2026) — Direct Paper Tracking  
**Title**: A Control-Theoretic Foundation for Agentic Systems  
**Authors**: Ali Eslami, Jiangbo Yu (McGill University)  
**TL;DR**: First systematic control-theoretic framework for agentic AI — five-level agency hierarchy directly validates OpenClaw's Main/Sub-agent/Skill architecture and P109 self-evolution constraints

---

## Five-Level Agency Hierarchy

The paper formalizes agency as **hierarchical decision authority over the control architecture**:

| Level | Name | Authority | OpenClaw Mapping |
|-------|------|-----------|------------------|
| **L1** | Reactive Rule-Based | Fixed if-then rules, no adaptation | Hard-coded bash scripts |
| **L2** | Adaptive Within Fixed Structure | Parameter adaptation, conditional tool use | Skill parameter tuning, Error Log learning |
| **L3** | Strategic Selection | Choose among predefined controllers/goals/tools | Main Agent selects Sub-agent/Skill |
| **L4** | Structural Reconfiguration | Compose tools, reconfigure workflows | Skill chaining, workflow orchestration |
| **L5** | Generative Under Governance | Synthesize new goals/structures within constraints | **Prohibited by P109** — only human |

---

## Core Theoretical Framework

### Unified Dynamical Representation

The paper models agentic systems with a unified controller:

```
u(t) = π_α(t)(y(t), m(t), z(t), r(t); θ(t), ζ(t))
```

Where:
- **y(t)**: Observations (environment state)
- **m(t)**: Memory state — *"internal belief updates, contextual accumulation"*
- **z(t)**: Tool outputs — *"structured information-generation mechanism"*
- **r(t)**: Interaction signals — human/agent messages (with Δ(t) interpretation error)
- **θ(t)**: Learnable parameters — *"policy weights, tuning gains, thresholds"*
- **ζ(t)**: Goal descriptor — *"task priorities, mission phase, safety margins"*
- **α(t)**: Controller architecture index

### Information Set

```
I(t) = {y(t), m(t), z(t), r(t)}
```

This unified formulation **embeds memory, learning, tool use, interaction, and goal formulation into a single closed-loop structure** — directly analogous to OpenClaw's context engineering approach.

---

## Key Theoretical Insights

### 1. Agency = Decision Authority, Not Capability

> "Higher agency does not simply mean improved task performance or more sophisticated computation. Rather, it means that the AI is granted authority over progressively deeper layers of the control architecture."

**Validation**: OpenClaw's constraint-based design (P109) correctly separates **capability** (any level) from **authority** (controlled by human designer).

### 2. Tool Use as Structured Information-Generation

The paper treats tool use not as isolated capability but as:
- Fixed preprocessing pipelines
- Conditional invocation of approved tools
- Strategic selection among multiple tools
- Sequential/parallel composition
- **Architecture-level orchestration of tool workflows**

**Validation**: SKILL.md as "tool library" with conditional invocation (L2) and Main Agent orchestration (L3/L4) is theoretically sound.

### 3. Interaction Signal Uncertainty

The paper explicitly models interpretation error:
```
r(t) = r̄(t) + Δ(t)
```

Where Δ(t) represents **semantic ambiguity** in natural language commands.

**Validation**: OpenClaw's structured handoffs (P82) with explicit artifact paths and expectations reduce Δ(t) compared to free-form delegation.

### 4. Memory as Dynamical State

Memory evolution:
```
ḿ(t) = Φₘ(m(t), y(t), z(t), r(t))
```

Captures: *"short-term context, long-term summaries, latent beliefs, estimated environment descriptors, compressed histories"*

**Validation**: AGENTS.md as "persistent memory" and heartbeat as "contextual accumulation" match the theoretical framework.

---

## Stability Implications of Increasing Agency

The paper analyzes how each agency level introduces new dynamical mechanisms:

| Level | Mechanism | Stability Challenge | OpenClaw Response |
|-------|-----------|---------------------|-------------------|
| **L2** | Time-varying adaptation θ̇(t) = Φθ(·) | Adaptation-induced instability | Error Log bounded updates |
| **L3** | Endogenous switching α(t) ∈ 𝒜 | Switching transients, dwell-time | Skill isolation, clean boundaries |
| **L3-5** | Decision-induced delays τₖ | Phase margin reduction | Async `/btw` mechanism |
| **L4** | Structural reconfiguration 𝒞(t) | Pipeline instability | Immutable AGENTS.md during execution |
| **L5** | Objective-induced policy variation | Unconstrained goal drift | **P109: Prohibit L5** |

### Critical Finding: Governance Constraints at L5

> "At Level 5, the AI may generate new goals, new tool workflows, or new controller structures, **subject to external governance, verification, and safety constraints**."

```
(ζ(t), 𝒞(t), α(t)) ∈ 𝒢_c  ← Governance constraints
```

**OpenClaw Validation**: P109's prohibition of runtime self-evolution is theoretically justified — L5 authority requires **human-in-the-loop governance**.

---

## OpenClaw Architecture Mapping

### Main Agent → L3 Strategic Agency
- Selects among predefined Sub-agents (α(t) ∈ 𝒜)
- Chooses goal templates (ζ(t) ∈ {ζ₁...ζₙ})
- Strategic tool selection (k(t) ∈ {1...M})

### Sub-agent → L2 Adaptive Agency  
- Adapts parameters within fixed architecture (θ̇(t) = Φθ(·))
- Conditional tool invocation (σₖ(t) ∈ {0,1})
- Persistent memory for context (ṁ(t) = Φₘ(·))

### Skill → L1/L2 Boundary
- Fixed rule-based execution (L1)
- Parameter adaptation via Error Log (L2)
- No strategic reconfiguration (no L3)

### AGENTS.md → Governance Constraint 𝒢_c
- Defines admissible controller set 𝒜
- Specifies goal templates {ζ₁...ζₙ}
- Constrains tool library {T₁...Tₘ}

---

## Cross-Validation with Prior Findings

| Prior Finding | This Paper's Validation |
|--------------|------------------------|
| SYNTH-002 Self-Evolution Spectrum | L1-L5 hierarchy formalizes the spectrum |
| HB#1475 Plan-and-Act | L3 strategic selection ↔ Planner-Executor split |
| HB#1477 Dispider | L4 structural reconfiguration validates Perception-Decision-Reaction |
| HB#1478 XSkill | L2 adaptive agency validates Dual-Track Learning |
| HB#1480 LABSHIELD | L5 governance constraints validate S0-S3 safety layers |
| P109 Self-Evolution Ban | Theoretical necessity: L5 requires external governance |

---

## L3 Flags

- #1481-A: Evaluate formalizing OpenClaw architecture using control-theoretic notation
- #1481-B: Research governance constraint specification languages for L5 boundaries
- #1481-C: Study stability proofs for L3 switching with Skill isolation

---

**Timestamp**: 2026-03-15  
**Session**: s_1773586105584_288  
**Paper**: https://arxiv.org/abs/2603.10779
