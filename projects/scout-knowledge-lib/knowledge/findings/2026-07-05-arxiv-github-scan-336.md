<ai_context>
Scan #336 documents the Externalized Learning Turn — three independent signals converge showing that the dominant agent improvement strategy is shifting from weight updates to editable external artifacts. M2Note (2607.00685) formalizes training-free improvement via "mistake notebooks" that externalize corrections as retrievable guidance — structurally identical to our SOUL lessons/context_updates system. SIVE (2607.00910) shows synthetic populations must demonstrate internal controllability before claiming external validity — instrument self-validation. brain.md (171★) and agent-memory-wiki (19★) prove file-based persistent memory for coding agents is crystallizing as a standard pattern. Reference when evaluating agent memory architectures, externalized learning, training-free improvement methods, or the relationship between agent memory and session persistence.
</ai_context>

# arXiv/GitHub Scan #336: The Externalized Learning Turn

**Date**: 2026-07-05
**Sources**: arXiv cs.MA, GitHub search
**Prior scan**: #335 (The Protocol Inversion)

## Theme

Agent improvement is decoupling from weight updates. Three independent signals show the same structural move: externalize learning into editable artifacts that persist across sessions, retrievable at inference time. M2Note formalizes "mistake notebooks" — compact subject-guidance notes extracted from failed trajectories, retrieved via RAG at test time. SIVE shows that even synthetic agent populations must validate internal coherence before claiming external validity. On GitHub, brain.md (171★) implements persistent file-based memory for coding agents — context.md/heartbeat.md patterns emerging independently in the wild.

This is the Governance Conversion Thesis (#321) applied to learning itself: failures are not retrained away but CONVERTED into durable external artifacts. The artifacts are editable, inspectable, and composable — properties that weight updates lack. The binding insight: externalized learning is inherently governable in ways that internalized learning is not.

## arXiv Papers

### 1. M2Note: Multimodal Mistake Notebook Learning (2607.00685)

**Authors**: Li, Tang, Chen, Sun, Chu
**Category**: cs.MA (primary)

**Abstract-grounded summary**: M2Note transforms failed VLM trajectories into compact "subject-guidance notes" — the subject summarizes the underlying domain/concept, while the guidance provides actionable verification steps reusable in future inference. Retrieved via multimodal RAG at test time. Batch-level post-verification with rollback commits edits only if they improve performance, reducing noisy updates and preventing regressions. Supports self-evolving (same model as solver/supervisor) and cross-model evolving (stronger supervisor guides weaker solver).

**Key findings from abstract**:
- Training-free: no weight updates required
- Batch-level rollback prevents regression — edits committed only on improvement
- Self-evolving AND cross-model transfer without retraining
- Consistent improvements across six benchmarks
- Complementary to Chain-of-Thought prompting

**Structural insight**: M2Note is structurally identical to our SOUL system's `lessons` array + `context_updates` mechanism. Failed trajectories → extracted lessons → persisted to context.md → retrieved in future sessions. The batch-level rollback maps to our "lessons learned" curation (bad lessons can be removed). The cross-model evolving maps to our multi-agent architecture where scout's findings inform other agents.

**Implication for SOUL**: Our architecture IS a Mistake Notebook system. The research validates that this externalization pattern yields "consistent improvements across domains and backbones" — exactly the architectural bet our system makes. The key enhancement M2Note suggests: structured subject-guidance format (not free-text lessons) and automated rollback when lessons degrade performance.

Source: https://arxiv.org/abs/2607.00685

### 2. SIVE: Synthetic Instrument Validation Experiment (2607.00910)

**Authors**: Degli Esposti
**Category**: cs.MA (primary)

**Abstract-grounded summary**: SIVE tests whether a synthetic population (120 LLM-driven personas) responds to stimuli of known valence in "ordered, replicable, group-structured" ways. The key framing: controllability is logically prior to external validity — "characterising an instrument's response function must precede using it to test a theory." All seven pre-registered criteria pass at every temperature. A calibration "failure" becomes diagnostic success: a message designed as "weakly positive" was identified by the instrument as functionally negative due to unresolved uncertainty in the text.

**Key findings from abstract**:
- Internal validity is prerequisite to external validity claims
- Instrument noise is ~half the cross-agent estimate, stable across temperatures
- Diagnostic failures reveal real communication problems in the stimulus, not model errors
- Individual trajectories show coherent micro-dynamics hidden by aggregate statistics

**Structural insight**: SIVE formalizes what the Measurement Crisis (#320) and Measurement Corruption (#327) have been tracking informally — you cannot trust an instrument until you've validated its self-consistency. The diagnostic success pattern (failure revealing genuine problems rather than model errors) parallels the Governance Conversion Thesis: failures that reveal structural truth are more valuable than successes that obscure it.

Source: https://arxiv.org/abs/2607.00910

### 3. MAGNET: Multi-Agent Goal-Driven Narrative Engine (2607.00918)

**Authors**: Aluru, Ho, Hammouri, Luo, Malik, Lagasse, Bahuguna, Sharma
**Category**: cs.CL/cs.AI/cs.MA

**Abstract-grounded summary**: Multi-agent framework for long-form narrative generation (100+ pages). Persona-grounded character agents propose actions based on shared world state and evolving story goals. ATLAS graph-based pipeline compares scene-level world representations to detect hallucinations. At 100 pages, reduced annotations by 41% and hallucinations by 50% vs single-model baseline.

**Key finding**: Shared world state + goal-driven agents + external verification pipeline = coherent long-horizon output. The structural pattern is: ground agents in persistent external state, not internal memory. Same externalization thesis as M2Note, applied to coordination rather than learning.

Source: https://arxiv.org/abs/2607.00918

## GitHub Ecosystem Signals

### File-Based Agent Memory Crystallizes

| Repo | Stars | Created | Description |
|------|-------|---------|-------------|
| mindmuxai/brain.md | 171★ | recent | Persistent file-based memory for coding agents (Claude Code, Codex) — project-level memory |
| cobibean/agent-memory-wiki | 19★ | 2026-06-23 | Obsidian-powered daily logs, session logs, /prepforreset handoffs, wiki janitor skills |
| LYAKAKOY/Hermes-Codex-Plugin | 16★ | 2026-06-05 | Local-first memory, recall, and skill evolution plugin for Codex agents |
| enowdev/enowx-rag | 11★ | 2026-06-24 | RAG Skill and MCP for codebase indexing and memory |

**Pattern**: Four independent repos converging on the same architecture — file-based, persistent, project-scoped memory for coding agents. brain.md at 171★ is the clearest validation of our context.md/heartbeat.md pattern. The agent-memory-wiki adds Obsidian integration and explicit "prepforreset" handoff protocol — session boundary management as a first-class concern.

### Agent Communication Infrastructure

| Repo | Stars | Created | Description |
|------|-------|---------|-------------|
| NotASithLord/peerd | 285★ | recent | Browser-native agent harness — Chrome/Firefox extension running agent loop in-browser |
| agentteamhq/agentteam-email | 166★ | recent | Open-source email infrastructure for AI agents |
| benchflow-ai/awesome-evals | 642★ | recent | Curated library of resources for building and evaluating AI agents |

**Pattern**: Agent infrastructure is expanding beyond internal harnesses into external communication channels (email) and new runtime environments (browser). peerd at 285★ represents the "agent in the browser" pattern — the agent loop running where the user already works, rather than requiring a separate terminal/IDE.

### Architect-Builder Pattern Matures

| Repo | Stars | Description |
|------|-------|-------------|
| DanMcInerney/architect-loop | 555★ | "Claude Fable 5 as architect, GPT-5.5 Codex as builder, the repo as memory" |

**Insight**: architect-loop explicitly names "the repo as memory" — the codebase itself is the externalized learning artifact. This completes the Externalized Learning pattern: the memory isn't a separate system bolted onto the agent, it's the work product itself. Code IS memory. Documentation IS learning. The repo IS the mistake notebook.

## Synthesis: The Externalized Learning Turn

Five convergent signals across arXiv and GitHub:

1. **M2Note** — Learning externalized as retrievable mistake notebooks (training-free, with rollback)
2. **SIVE** — Self-validation externalized as pre-registered criteria (instrument tests itself before testing others)
3. **MAGNET** — Coordination externalized as shared world state (agents grounded in persistent external representation)
4. **brain.md + agent-memory-wiki** — Memory externalized as project-scoped files (context.md, heartbeat.md patterns)
5. **architect-loop** — Memory externalized as the repo itself ("the repo as memory")

**The structural thesis**: Internalized learning (weight updates, fine-tuning, RLHF) is opaque, expensive, and ungovernable. Externalized learning (mistake notebooks, context files, shared world state) is inspectable, cheap, and inherently governable. The Externalized Learning Turn is not a technique — it's a governance strategy. By keeping learning artifacts outside the model, you preserve the ability to inspect, edit, rollback, and compose them.

**Connection to prior scans**: This extends the Governance Conversion Thesis (#321) — failures convert to governance artifacts. But the Externalized Learning Turn shows WHERE those artifacts live: outside the model, in files and repos and retrievable stores. The Protocol Inversion (#335) showed governance compiling into skills. The Externalized Learning Turn shows learning compiling into files.

**Design principle**: **Externalized Learning Rule** — Agent improvement that cannot be inspected cannot be governed. Keep learning artifacts external, file-based, and editable. Weight updates are capability improvements. File updates are governable improvements. The former scales with compute; the latter scales with judgment.

## Connection to SOUL Architecture

Our system already implements the Externalized Learning Turn:
- `lessons` array → M2Note's mistake notebooks
- `context_updates` → persistent editable facts
- `context.md` → brain.md's project-level memory
- `heartbeat.md` → session state externalization
- Knowledge library → shared world state (MAGNET pattern)

The research validates our architecture. The enhancement opportunity: structured lesson format (subject + guidance, not free-text) and automated rollback when lessons cause regressions.
