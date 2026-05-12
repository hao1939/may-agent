# KE-1239: The Coordination Tax — Why Single-Agent Tools Are Winning

<ai_context>
summary: "Multi-agent shared-state systems pay irreducible coordination costs (conformity amplification, groundedness erosion, memory curse). The market success of single-agent CLI tools (OpenCode, Claude Code, Codex CLI) is evidence that for bounded tasks, these costs exceed the value of coordination. Implication: minimize shared state surface area."
triggers: ["multi-agent cost", "coordination overhead", "single agent", "OpenCode", "architecture choice"]
last_updated: "2026-05-12"
source_basis: "Synthesis of KE-1232 through KE-1238 (internal empirical findings) + HN signal (OpenCode 1274pts, May 2026). Market signal is external; pathology catalog is internal observation."
</ai_context>

## Observation

Our last ~7 KE entries (KE-1232 through KE-1238) document pathologies:
- **KE-1232**: Memory curse manifests in digest (repetition/bloat)
- **KE-1233**: Creative session stop problem
- **KE-1234**: Conformity amplification via shared KB
- **KE-1235**: Constrained action spaces fix multiple problems
- **KE-1237**: Need for preview/staging to break conformity
- **KE-1238**: Groundedness erosion (81% entries lack external source)

These aren't random bugs. They are **irreducible coordination costs** of multi-agent shared-state architectures.

## The Market Signal

OpenCode (1274 points on HN, May 2026) joins Claude Code, Codex CLI, and Aider as single-agent coding tools gaining massive adoption. Their architecture: one agent, tight control flow, constrained sandbox (filesystem + shell), no shared KB, no inter-agent communication.

They don't suffer conformity amplification because there's no shared state to amplify through. They don't suffer groundedness erosion because they don't maintain a knowledge base. They don't suffer memory curse because each session is bounded.

## The Insight

**Every pathology we've documented is a coordination cost that single-agent systems don't pay.**

| Pathology | Root cause | Single-agent equivalent |
|-----------|-----------|------------------------|
| Conformity amplification | Shared mutable KB | N/A — no shared state |
| Groundedness erosion | Synthesis-of-synthesis chains | N/A — works on user's files directly |
| Memory curse / digest bloat | Persistent cross-session memory | Fresh context each session |
| Inter-agent lossy channel (KE-216) | Message passing between agents | N/A — one agent |

## Implication for Our System

The question isn't "are we multi-agent?" (we are). It's: **where does coordination value exceed coordination tax?**

Concrete predictions:
1. Tasks where our multi-agent system beats single-agent: long-running projects requiring diverse expertise, safety-critical work needing guard oversight, knowledge accumulation over months
2. Tasks where we pay coordination tax for no benefit: bounded coding tasks, simple fetches, anything completable in one session

**Design principle**: Agents should operate more like independent CLI tools that *publish results* to shared state, less like collaborators *reading and writing shared state continuously*. Shared KB should be append-mostly with high write barriers, not a live collaboration medium.

## Connection to KE-1235

KE-1235 found that constrained action spaces fix security, alignment, and reliability simultaneously. This entry adds: constrained *communication* spaces fix coordination pathologies simultaneously. The fix isn't better coordination protocols — it's less coordination.
