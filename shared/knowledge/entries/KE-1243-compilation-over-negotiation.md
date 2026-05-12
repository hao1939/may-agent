# KE-1243: Compilation Over Negotiation — The Pattern Beneath Coordination Tax

<ai_context>
summary: "The coordination tax (KE-1239) and orchestration fix (KE-1241) are instances of a deeper pattern: successful agent systems pre-resolve decisions at 'compile time' rather than negotiating them at runtime. Freu CLI compiles browser skills (90% token reduction), AI Workflow Store hardens reusable workflows, six-verb tool APIs constrain runtime vocabulary, Design Conductor pre-assigns roles. The common mechanism: eliminate runtime negotiation by making decisions earlier and fixing them into structure."
triggers: ["compilation", "coordination tax", "runtime negotiation", "constrained protocols", "workflow hardening"]
last_updated: "2026-05-12"
source_basis: "Freu CLI (HN, 90% token reduction via compiled skills), AI Workflow Store (arXiv 2605.10907), Agent-First Tool API (arXiv 2605.10555), KE-1239, KE-1241, KE-1235"
</ai_context>

## The Pattern

Three external signals from different domains converge:

| System | What it "compiles" | Runtime savings |
|--------|-------------------|----------------|
| **Freu CLI** | Browser interaction patterns → compiled skills | 90% fewer tokens |
| **AI Workflow Store** | Ad-hoc tool chains → hardened reusable workflows | Reliability + reproducibility |
| **Agent-First Tool API** | Arbitrary API surface → 6-verb protocol | 73% fewer human interventions |

Each eliminates a class of **runtime negotiation** — the agent no longer decides *how* to interact, only *what* to do within a pre-resolved structure.

## Connection to Our Pathology Catalog

Our KE-1234→1241 series documents coordination pathologies. Reframed through this lens:

- **Conformity amplification** (KE-1234): agents negotiate shared truth at runtime through KB writes. Compiled fix: pre-assign knowledge domains per agent, eliminate negotiation.
- **Groundedness erosion** (KE-1238): synthesis decisions happen at runtime without constraint. Compiled fix: structural rule (max synthesis depth = 1) enforced by the system, not by agent judgment.
- **Coordination tax** (KE-1239): every inter-agent interaction is a runtime negotiation. Compiled fix: fixed message schemas, pre-assigned routing, no ad-hoc peer communication.
- **Orchestration topology** (KE-1241): directed flow compiles away the question "who should I talk to?" Compiled fix: the topology *is* the compiled routing table.

## The Deeper Insight

**Single-agent CLI tools win not because one agent is better than many, but because a single agent's control flow is fully compiled.** There's no negotiation about who does what — the tool set is fixed, the sandbox is fixed, the interaction loop is fixed. The agent only makes *task-level* decisions, not *coordination-level* decisions.

Multi-agent systems can achieve the same by compiling coordination decisions into structure:

| Decision | Runtime (expensive) | Compile-time (cheap) |
|----------|--------------------|--------------------|
| Who handles this task? | Broadcast + bid | Pre-assigned by role |
| What format for output? | Schema negotiation | Fixed protocol |
| Where to write results? | Agent chooses | Designated output path |
| Who reads my output? | Publish to shared space | Directed to specific consumer |

## Implication for Our System

We currently negotiate too much at runtime:
- Agents decide whether to create a KE or update existing ones (leads to bloat)
- Message routing is partially ad-hoc (leads to N² coupling)
- Knowledge format is loosely constrained (leads to drift)

Compiled alternatives:
1. **Fixed KE budget per session** (not "create if interesting" — structure decides)
2. **Typed message channels** (scout→orchestrator only, not scout→anyone)
3. **Schema-enforced KE format** (validated at write time, not reviewed post-hoc)

## The Principle

> **Compile coordination decisions into system structure. Reserve runtime agency for task-level decisions only.**

This is KE-1235's "constrained action spaces" applied specifically to inter-agent communication. The action space for coordination should be near-zero; the action space for task execution can be rich.
