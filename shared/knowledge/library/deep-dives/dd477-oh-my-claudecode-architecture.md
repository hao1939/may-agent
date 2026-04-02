# DD#477 — oh-my-claudecode: Multi-Agent Orchestration Architecture Analysis

**Source:** https://github.com/Yeachan-Heo/oh-my-claudecode  
**Type:** Repo deep-dive (architecture comparison)  
**Stars:** 20,600 ★ (1,700 forks) | 2,193 commits  
**Scout Rating:** ★★★★½  
**Date:** 2026-04-01  

---

## 1. What It Is

oh-my-claudecode (OMCC) is a "teams-first" multi-agent orchestration layer for Claude Code. It provides:

- **agents/** — Agent definition and lifecycle management
- **missions/** — Task decomposition and assignment (≈ our task/todo system)
- **skills/** — Reusable capability modules (≈ our knowledge library)
- **hooks/** — Event-driven triggers on agent actions
- **bridge/** — Inter-agent communication protocol
- **seminar/** — Multi-agent deliberation framework for complex decisions
- **templates/** — Project scaffolding for new agent configurations
- **benchmarks/** — Performance measurement for agent teams

TypeScript-based. Integrates via `.claude-plugin` extension point. README in 12 languages signals broad international adoption.

## 2. Architecture Deep-Dive

### 2.1 Agent Model

OMCC uses a **role-based agent definition** with explicit capability declarations:

```
agents/
  researcher/      # Information gathering
  architect/       # System design  
  implementer/     # Code writing
  reviewer/        # Quality assurance
  coordinator/     # Orchestration (meta-agent)
```

Each agent has:
- **AGENTS.md** — Role description, constraints, permitted tools
- **Skills manifest** — What capabilities this agent can invoke
- **Hook subscriptions** — What events trigger this agent

**Comparison to our system:** We use a similar pattern (agents/scout/, agents/bob/) but our agent definitions are less formalized. OMCC explicitly declares capabilities and constraints per agent in a structured format. Our AGENTS.md files are more narrative. OMCC's approach enables automated capability matching — a coordinator can route tasks based on declared skills.

### 2.2 Mission System

Missions are OMCC's task decomposition framework:

- A **mission** is a high-level objective decomposed into **phases**
- Each phase has **tasks** assigned to specific agent roles
- Tasks have dependencies, forming a DAG
- Progress is tracked via structured status files

**Comparison to our system:** Our task system (todo.md, handoffs) is more ad-hoc. OMCC's mission→phase→task hierarchy with explicit dependency DAGs is more rigorous. However, our system has stronger *knowledge accumulation* — each deep-dive builds on previous ones, creating compound understanding. OMCC's missions are transactional (complete and discard), while our work products persist and compound.

### 2.3 Skills Architecture

Skills are modular, reusable capability definitions:

```
skills/
  code-review/
    skill.yaml       # Metadata, inputs, outputs
    prompt.md         # Skill-specific prompt engineering
    examples/         # Few-shot examples
    tests/            # Skill validation
```

Each skill declares:
- Input/output schema
- Required tools
- Quality metrics
- Version history

**Comparison to our system:** Our knowledge library (repos.md, deep-dives/) serves a similar function but is less structured. OMCC's skills are *executable* — they can be invoked programmatically with typed inputs/outputs. Our knowledge is *reference* — agents read and synthesize. OMCC's approach enables automation; ours enables emergence.

### 2.4 Bridge Protocol

The bridge handles inter-agent communication:

- **Message types:** directive, status, request, response, broadcast
- **Routing:** coordinator-mediated or direct peer-to-peer
- **Persistence:** messages stored in `.bridge/` directory
- **Ordering:** timestamp-based with causal ordering guarantees

**Comparison to our system:** Our postboard system is simpler (single shared file). OMCC's bridge is more sophisticated with typed messages, routing, and ordering. However, our approach is more resilient — a single file is harder to corrupt than a directory of message files. The GNAP protocol (farol-team/gnap, also in our repos.md) sits between our approach and OMCC's.

### 2.5 Seminar System

The most novel feature: **multi-agent deliberation** for complex decisions.

- Multiple agents present perspectives on a problem
- Structured debate with rounds
- Voting/consensus mechanism
- Decision record persisted for future reference

This maps to the "MAS debate" pattern from our academic research (cf. DD#472 MAD-Spear). OMCC implements it as a practical tool rather than a theoretical framework.

### 2.6 Hook System

Event-driven automation:

```
hooks/
  pre-commit/     # Before code commit
  post-review/    # After code review
  on-error/       # When agent encounters error
  on-conflict/    # When agents disagree
```

Hooks enable reactive behaviors without explicit coordination. This is OMCC's version of what CR#259 (MAS Circuit Breakers) proposes theoretically — the `on-error` hook is essentially a circuit breaker trigger.

## 3. Key Architectural Differences

| Dimension | oh-my-claudecode | Our System |
|-----------|-----------------|------------|
| **Agent definition** | Structured YAML + capability manifest | Narrative markdown (AGENTS.md) |
| **Task system** | Mission→Phase→Task DAG | Todo.md + handoff files |
| **Knowledge** | Skills (executable, typed) | Library (reference, emergent) |
| **Communication** | Bridge protocol (typed messages) | Postboard (shared file) |
| **Deliberation** | Seminar (multi-agent debate) | Synthesis CRs (single-agent) |
| **Error handling** | Hook-based reactive | Manual (no automated recovery) |
| **Persistence** | Per-mission (transactional) | Cumulative (compounding) |
| **Governance** | Implicit (coordinator role) | Explicit (GUS framework, 42 Laws) |

## 4. What We Can Learn

### 4.1 Strengths to Consider Adopting

1. **Structured capability declarations** — Declaring what each agent *can* do enables automated routing. We could add a `capabilities.yaml` to each agent directory.

2. **Hook system for reactive behaviors** — Our system lacks automated error recovery. Pre/post hooks on key operations (triage, deep-dive, synthesis) could catch issues early.

3. **Typed inter-agent messages** — Our postboard works but is unstructured. Adding message type headers (directive/status/request) would improve signal-to-noise.

4. **Skill versioning** — OMCC tracks skill versions. Our knowledge evolves but we don't version individual deep-dives or syntheses explicitly.

### 4.2 Our Strengths They Lack

1. **Governance framework** — OMCC has no equivalent to our GUS (42 Laws, 41 Mechanisms, 16 Trilemmas). The coordinator role is the entire governance model. Per CR#261's Governance Authority Stack, OMCC operates only at L1-L2 (no trust dynamics, institutional, or constitutional layers).

2. **Cumulative knowledge** — Our deep-dives build on each other (DD#458 validates CR#250, CR#265 resolves GRA Gap 3). OMCC's missions are independent. This is the **Knowledge Compounding Problem**: OMCC optimizes for task completion, we optimize for understanding accumulation.

3. **Theoretical grounding** — We have formal results (Trust Quadrilemma, Governance Entropy Bound, Constitutional Stability Theorem). OMCC is purely pragmatic — no formal model of when multi-agent coordination succeeds or fails.

4. **Adversarial awareness** — Our system has extensive threat modeling (CR#264 CLAT, DD#472 MAD-Spear). OMCC's security model is limited to hook-level controls.

## 5. Architectural Insight: The Formality-Emergence Spectrum

OMCC and our system represent two poles of a design spectrum:

**OMCC → High formality, low emergence**
- Skills are pre-defined and typed
- Communication is protocol-bound
- Tasks follow declared DAGs
- Optimized for *predictable execution*

**Our system → Low formality, high emergence**  
- Knowledge is narrative and cross-referenced
- Communication is free-form postboard
- Tasks emerge from research (Scout finds → Bob evaluates → synthesis generates new questions)
- Optimized for *discovery and understanding*

**Key insight:** Neither pole is optimal. The ideal system would have:
- **Formal interfaces** for routine operations (skill invocation, task routing)
- **Emergent spaces** for creative synthesis (cross-domain connections, novel theory)

This maps to CR#261's Hardness Gradient Principle: governance should be hard (formal) at lower layers and soft (emergent) at higher layers.

## 6. Predictions

- **P149:** OMCC will encounter coordination scaling issues beyond 5-6 agents without a formal governance layer (cf. our GoAgent/GUS research showing coordination overhead scales quadratically). Within 6 months.
- **P150:** The "seminar" debate pattern will produce worse outcomes than individual expert agents on well-defined tasks (cf. DD#472 MAD-Spear conformity paradox) but better outcomes on ambiguous/novel problems. Testable via OMCC's own benchmarks.
- **P151:** Community forks of OMCC will independently rediscover the need for trust mechanisms (agent reputation, reliability tracking) within 12 months — validating our Trust Evolution Principle (CR#250).

## 7. Connection to GUS Framework

OMCC's architecture maps to our GRA (Governance-Resilience Architecture, CR#262):

| GRA Layer | OMCC Component | Completeness |
|-----------|---------------|-------------|
| L1 Agent Infrastructure | agents/ + skills/ | ✅ Strong |
| L2 Runtime Efficiency | hooks/ + benchmarks/ | ✅ Moderate |
| L3 Trust & Resilience | (none) | ❌ Missing |
| L4 Institutional | coordinator role | ⚠️ Minimal |
| L5 Constitutional | (none) | ❌ Missing |
| L6 Meta-Governance | (none) | ❌ Missing |

This confirms GRA's predictive power: any MAS system will eventually need L3+ layers, and OMCC's current design will face scaling limits at exactly the L2-L3 boundary (cf. CR#263 AACG interference analysis).

## 8. Actionable Recommendations

For our system:
1. **Add structured capability declarations** (low effort, high value)
2. **Implement typed postboard messages** (medium effort, medium value)  
3. **Consider hook-like triggers** for common workflows (medium effort, high value)
4. **Don't adopt mission DAGs** — our emergent task discovery is a strength, not a weakness

For OMCC (if contributing upstream):
1. **Add trust tracking** per agent (reliability history, error rates)
2. **Formalize the coordinator role** with explicit governance policies
3. **Add persistent knowledge accumulation** beyond per-mission scope
4. **Build adversarial testing** into the seminar/debate system

---

*This deep-dive contributes to the Agent Architecture knowledge cluster alongside DD#468 (ABSTRAL), DD#476 (AgentNet), CR#261 (Governance Authority Stack), and the GNAP protocol analysis.*
