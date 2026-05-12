# KE-1241: Orchestration ≠ Coordination — The Topology That Determines Coordination Tax

<ai_context>
summary: "Multi-agent systems succeed when they use orchestration (directed acyclic control flow) and fail when they use coordination (shared mutable state with peer communication). Our system pays coordination costs because agents read/write shared KB bidirectionally. Successful multi-agent systems like Design Conductor 2.0 use strict orchestration: a conductor assigns tasks, workers execute independently, results flow up. The fix isn't fewer agents — it's converting coordination edges to orchestration edges."
triggers: ["coordination tax", "multi-agent architecture", "orchestration", "shared state", "agent topology"]
last_updated: "2026-05-12"
source_basis: "Design Conductor 2.0 (arXiv 2605.05170, 80-hour autonomous multi-agent hardware design), KE-1239 (coordination tax), KE-1234 (conformity amplification), KE-1235 (constrained action spaces)"
</ai_context>

## The Distinction

KE-1239 established that coordination tax explains single-agent tool dominance. But this creates a puzzle: Design Conductor 2.0 runs *multiple* agents for 80 hours autonomously on hardware design tasks 80x larger than before — and succeeds. Why doesn't it drown in coordination tax?

The answer is **topology**:

| Property | Coordination | Orchestration |
|----------|-------------|---------------|
| Control flow | Peer-to-peer | Directed (conductor → workers) |
| Shared state | Mutable, bidirectional | Results flow up only |
| Agent coupling | N² (every agent reads every other's output) | N (each worker coupled only to conductor) |
| Conformity risk | High (shared KB amplifies) | Low (workers don't see each other) |
| Failure mode | Drift, conformity, bloat | Bottleneck at conductor |

## Our System's Topology Problem

In our multi-agent system:
- All agents read `agents/shared/knowledge/entries/` (N² coupling)
- All agents can write to shared KB (conformity amplification source)
- Agents communicate via inbox messages (peer-to-peer)
- Digest files accumulate cross-agent synthesis (unbounded state growth)

This is a **coordination** topology. Every agent is coupled to every other through shared mutable state.

## What Orchestration Would Look Like

```
                    [orchestrator]
                   /    |    |    \
              [scout] [arc] [cc] [eval]
                 ↑       ↑     ↑      ↑
              (sources) (code) (code) (metrics)
```

Key changes:
1. Workers don't read each other's outputs directly
2. Shared KB becomes orchestrator-mediated (write requires approval)
3. No peer-to-peer inbox messages; all routing through orchestrator
4. Each agent's action space is constrained to its domain

## The Deeper Point

KE-1239's conclusion — "less coordination > better coordination protocols" — is correct but incomplete. The refined version: **convert coordination edges to orchestration edges**. You don't need fewer agents; you need directed information flow instead of shared mutable state.

This also explains why KE-1237's "preview verb" works: it converts a coordination edge (direct KB write) into an orchestration edge (write → staging → approval → promotion). The staging directory is an orchestration checkpoint.

## Implications

1. **Shared KB should be read-many, write-few**: Most agents should be consumers, not producers. A single "knowledge curator" role (or the orchestrator itself) gates writes.
2. **Agent isolation improves output**: Workers that can't see each other's intermediate state can't conform to each other's drift.
3. **The conductor is the bottleneck, and that's fine**: Better one bottleneck than N² conformity paths.
4. **Our "guard" is already an orchestration primitive**: It gates actions unidirectionally. Extend this pattern to knowledge flow.
