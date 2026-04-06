# DD#542 — MatClaw: Four-Layer Memory Architecture + Guided Autonomy for Multi-Day Agents ★★★

**Source**: arXiv:2604.02688 (Zhang & Yakobson, Rice University)
**Date**: 2026-04-03
**Category**: Agent Memory, Long-Running Agents, Code-First Architecture, Guided Autonomy

## Why This Matters

MatClaw is a code-first LLM agent for computational materials science that sustains coherent execution across **multi-day workflows** on HPC clusters. Its two core contributions — a four-layer memory architecture that prevents progressive context loss, and a "guided autonomy" model that bridges tacit knowledge gaps — directly address problems we face in our own multi-agent system.

The finding that **code generation is already reliable (~99% API accuracy with RAG) but tacit domain knowledge is the real bottleneck** reframes what agents struggle with: not execution, but judgment.

## Key Technical Patterns

### 1. Four-Layer Memory Architecture

MatClaw uses a hierarchical memory to sustain coherence across sessions that span days:

| Layer | Function | Analogue in Our System |
|-------|----------|----------------------|
| **L1: Working Memory** | Current task context, active variables | Agent context window |
| **L2: Session Memory** | Accumulated results from current workflow run | Session checkpoints |
| **L3: Episodic Memory** | Past experiment outcomes, error patterns | Cross-session lessons |
| **L4: Semantic Memory** | Domain knowledge, API documentation, source code | papers.md, research projects |

The critical insight: **progressive context loss** is the primary failure mode in multi-day agents. Without explicit memory layering, agents "forget" what they've already tried, repeat failed approaches, and lose the thread of multi-step plans.

### 2. Code-First vs Tool-First Architecture

MatClaw **writes and executes Python directly** rather than calling predefined tool functions. This is a fundamental architectural choice:

- **Tool-first**: Agent selects from menu of N tool functions. Safe but scope-limited — every new capability requires a new tool.
- **Code-first**: Agent writes arbitrary code composing any library. Unbounded scope but requires higher reasoning quality.

MatClaw achieves ~99% API-call accuracy by using **RAG over domain source code** — the agent retrieves actual library source to understand APIs rather than relying on documentation descriptions. This is a pattern worth noting: source code as documentation is more reliable than documentation as documentation.

### 3. Guided Autonomy Model

The most interesting finding: MatClaw handles code generation and scientific interpretation reliably but **struggles with tacit domain knowledge** — things like appropriate simulation timescales, equilibration protocols, sampling strategies. This is knowledge researchers accumulate through experience but rarely formalize.

Two lightweight interventions bridge the gap:
1. **Literature self-learning**: Agent reads papers to acquire domain conventions
2. **Expert-specified constraints**: Human provides high-level domain rules (e.g., "minimum simulation time for convergence is 10ps")

This defines a spectrum:
- **Full automation**: Agent decides everything → fails on tacit knowledge
- **Guided autonomy**: Human provides domain constraints, agent handles execution → works well
- **Manual workflow**: Human does everything → slow but correct

The sweet spot is guided autonomy — and it's much closer to full autonomy than previously assumed.

## Implications for Our System

### Memory Architecture
Our agents already have some of these layers informally:
- L1: Context window (implicit)
- L2: Checkpoints (partial — we save state but don't always reload it)
- L3: Lessons in context.md (partial — but not systematically indexed)
- L4: papers.md, research projects (exists but retrieval is manual)

The gap is **L2-L3 transition** — converting session-specific findings into indexed episodic memory that's retrievable across sessions.

### Tacit Knowledge as the Real Bottleneck
The MatClaw finding that code generation is already reliable but domain judgment isn't maps directly to our experience. Our agents can write code and follow instructions but struggle with:
- When to stop researching and start writing
- How deep to go on a tangent
- Whether a finding is genuinely novel vs. well-known
- How to prioritize competing leads

These are exactly the kind of tacit knowledge MatClaw identifies as the gap.

### RAG Over Source Code
Using actual source code as the RAG corpus (not documentation) achieved 99% API accuracy. For our system, this suggests: when agents need to use our tools, they should retrieve the actual tool implementation, not just the tool description.

## Research Project Connections
- **Memory Architecture Proposal**: Four-layer model is a concrete implementation pattern
- **Harness Engineering**: Multi-day workflow management parallels
- **Adaptive Reasoning**: Guided autonomy is a form of adaptive effort allocation

## Source
- Paper: https://arxiv.org/abs/2604.02688
- Open-source code and benchmarks (referenced in paper)
