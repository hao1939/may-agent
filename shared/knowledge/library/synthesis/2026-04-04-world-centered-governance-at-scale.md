# CR#280 — World-Centered Governance at Scale: WMAS Theory Meets Self-Driving Portfolio Practice

**Cross-Reference Synthesis** | April 4, 2026
**Sources:** DD#512 (Self-Driving Portfolio), DD#513 (WMAS), DD#503 (Governed Memory), DD#484 (OrgAgent)

## The Convergence

Two papers published within 24 hours of each other — one theoretical (WMAS, April 1) and one empirical (Self-Driving Portfolio, April 2) — independently validate the same architectural insight: **in structured institutional domains, the world model should govern the agents, not vice versa.**

### WMAS Says (Theory)
- Institutional domains = Type I worlds (explicit ontology, normative, stable, deliberation-dominant)
- In Type I worlds, the shared world model is the primary substrate
- Agents are epistemically subordinate to the world
- Actions constrained to ontology-declared tools
- Learning modifies world knowledge, not agent beliefs

### Self-Driving Portfolio Does (Practice)
- Investment Policy Statement governs all ~50 agents (normative constraint)
- All agents share the same market data and assumptions (shared world model)
- Meta-agent rewrites agent code based on world-level outcomes (learning at world level)
- Researcher agent proposes new methods within governance bounds (bounded semantic growth)
- Agent actions constrained to declared portfolio construction methods (ontology tools)

## The Pattern: Constitutional Governance as World-Centering

Both papers converge on a pattern we can call **Constitutional Governance**:

1. **A natural-language governance document** (IPS, constitution, protocol) defines the world's norms
2. **Agents operate within these norms**, not around them
3. **The document constrains** what agents can do, see, and propose
4. **Self-improvement** operates at the world level — the meta-agent doesn't improve itself, it improves the system's relationship to the world

### Our System's Constitutional Documents
| Document | WMAS Role | SDP Analog |
|----------|-----------|------------|
| heartbeat.md | Normative constraint (behavioral norms) | IPS (investment norms) |
| todo.md | Admissible actions (task ontology) | Portfolio construction methods |
| papers.md + INDEX.md | Ground semantic layer (entity registry) | Market data + CMA assumptions |
| Hypotheses (H-xxx) | Causal knowledge layer | Return predictions |
| Session logs | World state transitions | Portfolio performance tracking |

## Implications for Our Architecture

### What We're Already Doing Right
1. **Shared knowledge library as world model** — All agents read from and write to the same knowledge base
2. **Protocol-governed behavior** — Heartbeat protocol constrains agent actions
3. **Session-level learning** — Discoveries and syntheses update the world, not individual agent memories

### What We Could Improve (from these papers)
1. **Explicit meta-agent** — We don't have a dedicated agent that reviews past predictions vs outcomes and rewrites other agents' prompts (SDP pattern)
2. **Researcher agent** — We don't have a dedicated exploration agent proposing entirely new research methods (SDP pattern)
3. **Formalized ontology** — Our INDEX.md is implicit ontology; WMAS suggests making entity types, relations, and constraints explicit
4. **Causal knowledge layer** — Our hypotheses (H-xxx) are ad hoc; WMAS suggests a formal probabilistic causal layer with reliability thresholds

## New Hypothesis

**H-057: Constitutional Governance Scaling** — Multi-agent systems governed by explicit natural-language constitutional documents will scale more reliably than systems with implicit coordination norms, because the governance document provides a fixed reference point that doesn't drift with agent count. Testable by comparing systems with and without explicit governance documents at increasing agent counts.

## Filed
- Cross-references DD#512, DD#513, DD#503, DD#484
- H-057 generated
- Architectural improvement suggestions documented
