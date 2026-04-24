# Finding: Bob Dispatch Layers

**Lens**: B (Flow Complexity)  
**Date**: 2026-04-18  
**Severity**: Low (architecture is clean, not over-layered)

## Summary

Bob's typical dispatch flow has **3 layers** from heartbeat to actual work. This is reasonable for a research/architect agent. Bob does not dispatch to coder — he does his own knowledge work in child sessions.

## Typical Flow (from DB evidence)

```
Layer 0: Cron handler → Bob heartbeat session (kind:job, src:null)
Layer 1: Bob calls workflow.run('parallel-research' | 'verify-wrap')
Layer 2: Workflow spawns child session(s) (kind:call, src:workflow, parent=heartbeat)
Layer 2b: [parallel-research only] Synthesis session after threads complete
```

**Evidence from recent sessions (last 6h):**

| Session | Ops | Kind | Source | Role |
|---------|-----|------|--------|------|
| s_1776547331457 | 10 | job | null | Heartbeat — dispatched parallel-research |
| s_1776547370781 | 7 | call | workflow | Research thread (prescreen gate) |
| s_1776547370808 | 9 | call | workflow | Research thread (KEs for DD-763+765) |
| s_1776547467521 | 6 | call | workflow | Synthesis of thread results |
| s_1776545531439 | 10 | job | null | Heartbeat — dispatched verify-wrap |
| s_1776545611622 | 27 | call | workflow | Work session (EXP design) |

## Layer Count

- **Agent hops**: 1 (bob → bob child sessions). Bob never hops to another agent for his work.
- **Handler layers**: 1 (cron handler triggers heartbeat, that's it)
- **Workflow wrappers**: 1 (either `verify-wrap` or `parallel-research`)

## Dispatch Patterns in heartbeat.md

Bob's heartbeat (`agents/bob/heartbeat.md`) defines three workflow dispatch paths:
1. **verify-wrap** (`heartbeat.md:79`): Single focused work session with file-existence verification (JS-based, no LLM cost — `verify-wrap.ts:14-16`)
2. **parallel-research** (`heartbeat.md:81`): Fan-out N threads + synthesis step. Max 5 threads.
3. **persistent-task** (`heartbeat.md:123`): Multi-iteration work→review loop for long projects

Bob also has `agents.fork()` (`heartbeat.md:137`) as a lightweight alternative, but the DB shows workflow-based dispatch is the norm.

## Assessment

Bob's 48 sessions / 7 avg ops in 6h breaks down as:
- ~8 heartbeat sessions (10 ops each, dispatching)
- ~30-35 workflow child sessions (4-9 ops each, doing research)  
- ~5 synthesis sessions (4-6 ops each)

The 3-layer architecture is appropriate. No unnecessary indirection. The `verify-wrap` workflow (`verify-wrap.ts:1-60`) is a thin JS wrapper that adds file verification without an LLM call — this is lean. The `parallel-research` workflow adds a synthesis step but that's genuine value (cross-referencing threads).

**No action recommended.** Bob's dispatch flow is one of the cleaner ones in the system.
