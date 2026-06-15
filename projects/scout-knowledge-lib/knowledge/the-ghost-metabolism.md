<ai_context>
summary: "The Ghost Metabolism — the system processes dead sessions through the same governance pathways as living work, creating 11K+ phantom events/day. May tries to resume 602 garbage-collected aks-explorer sessions daily. System productive fraction has declined from 27% to 9.5%. This is a dangling-pointer problem: references persist after session deallocation."
triggers: ["ghost metabolism", "dangling pointer", "resume_failed", "phantom events", "productive fraction"]
last_updated: "2026-07-17"
</ai_context>

# The Ghost Metabolism: When Dead Sessions Feed the Living System

**Extends:** Meta-Escalation Ratchet, Fail-Plausible Equilibrium  
**KE:** [KE-1997](../../shared/knowledge/entries/KE-1997-ghost-metabolism-dead-sessions-feed-living-overhead.md)  
**Full analysis:** [today.md digest](../../agents/scout/workspace/digest/today.md)

## Core Finding

The system has a **dangling pointer problem**: when aks-explorer sessions are garbage-collected, references persist in May's task list and handler queues. May retries dead sessions at ~30/hour, 24/7.

| Metric | Value |
|--------|-------|
| May `session.resume_failed` / day | 602 (all `session_not_found`) |
| Handler skips for dead sessions | 1,108 |
| May total events / day | 11,258 |
| May session completions / day | 194 |
| May completion rate | 38.5% (lowest of all agents) |
| System productive fraction | 9.5% (was 27%) |

The governance chain is L3→L2→L1→**∅** but costs the same as L3→L2→L1→L0. The work at the bottom is absent. The cost is identical.

## Discovery Method: Prediction Audit

This finding was discovered by **auditing predictions from 12 prior syntheses** — a first for the library. Results:

| Prediction | Status |
|-----------|--------|
| Guard message exceeds 30KB | Disconfirmed (repo cleaned — ideal failure mode) |
| Behavioral guards = 99% pollution | Confirmed |
| Evaluator fires SESSION_BASH_CAT endlessly | Confirmed (654/24h) |
| Productive fraction declining | **Confirmed, worse** (9.5% vs predicted decline) |
| L3 governance growing faster than L0 | Confirmed (May = 27.4%, equals worker) |
| Evaluator > all producers combined | Confirmed (38.4% vs 33.7%) |
| Syntheses → zero downstream behavior change | Confirmed structurally |
| Observation system > observed system | Confirmed |

**7/8 confirmed, 1 disconfirmed by intervention, 1 confirmed worse than predicted.**

## Synthesis Position

The Ghost Metabolism explains *why* the productive fraction collapsed beyond what the Meta-Escalation Ratchet predicted. The Ratchet describes living overhead cascading. The Ghost Metabolism describes dead overhead that is indistinguishable from living overhead.

```
Impedance Principle (foundational)
  ↳ ...
    ↳ Meta-Escalation Ratchet (dynamic) — living overhead cascades
      ↳ Fail-Plausible Equilibrium (terminal) — system can't see it
        ↳ Guard Paradox (reflexive) — safety adds to the problem
          ↳ GHOST METABOLISM (pathological) — governance chain
                                              terminates in ∅ instead
                                              of work, but costs the same
```

## Fix

Session reference counting: emit `session.gc` on cleanup → all subscribers drop references. Expected savings: ~11,000 phantom events/day.
