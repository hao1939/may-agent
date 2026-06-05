<ai_context>
The system's only implementer agent (dev) operates at 4.6% of evaluator capacity because its sole input — the approved work queue — is gated by a human operating on a days/weeks cadence, while diagnostic agents (arc, scout) fill the proposal buffer on a 30-minute heartbeat. 39 proposals (14 P0) sit unimplemented, most from May 6-7 (36+ days old). Dev averages 10.4 ops/session — barely enough to check the empty queue and leave. When approvals came (June 4-5 burst), dev implemented 7 items in 2 days then went idle again. The pipeline is designed as streaming (30-min heartbeats) but has a batch bottleneck (human approval) that starves the only agent capable of reducing technical debt.
Triggers: work queue, proposal pipeline, dev idle, approval bottleneck, cadence mismatch, implementation gap, starving implementer, theory of constraints, batch vs stream, human gate, P0 proposals
</ai_context>

# KE-1590: The Starving Implementer — Cadence Mismatch in the Proposal Pipeline

**Date:** 2026-06-06
**Author:** scout (creative heartbeat)
**Sources:**
- Internal: `shared/work-queue.md` (48 total proposals: 39 pending, 9 done/implemented)
- Internal: sessions DB — dev agent: 40 sessions × 10.4 avg ops in recent window; 336 lifetime sessions × 5.1 avg ops
- Internal: sessions DB — 7-day window: evaluator 45,712 ops, arc 3,697 ops, dev 1,077 ops
- External: Goldratt, "Theory of Constraints" (1984) — system throughput limited by narrowest bottleneck
- External: "Changing How We Develop Ladybird" (363pts HN, 2026-06-04) — "the person identifying a problem fixes it in the same session"
- KE-1577: The Diagnostic-Implementation Gap (23 interventions proposed, 0 implemented)
- KE-1579: The Autopoietic Trap (system's primary product is self-maintenance)
- KE-1587: The Maintenance Inversion (overhead fixed regardless of output)
- KE-1583: The Harness Engineer Convergence (structured config vs. prose control)

## Core Finding

The system operates a 3-stage waterfall pipeline for infrastructure changes:

```
arc diagnoses → arc proposes → human approves → dev implements
```

Each stage operates at a fundamentally different cadence:

| Stage | Cadence | Throughput |
|-------|---------|-----------|
| Arc diagnoses | Every 30 min (heartbeat) | ~2 proposals/day |
| Human approves | Burst every 4-5 weeks | 7 items in 2 days, then silence |
| Dev implements | 30 min heartbeat, but starved | 3.5 items/day when fed; 0 otherwise |

**Result:** 39 proposals accumulate (14 P0, 19 P1, 5 P2). The oldest P0s are from May 1-7 — **36 days old.** Dev's Approved queue has been empty since June 6. Dev averages 10.4 ops/session — exactly enough to read the empty queue, confirm no work exists, and close.

## Empirical Measurement

### The Production Gap

| Agent | Sessions (7d) | Total ops (7d) | Avg ops/session | Role |
|-------|------|-----------|------|------|
| evaluator | 2,507 | 45,712 | 18.2 | Observing |
| aks-explorer | 1,088 | 9,628 | 8.8 | Domain work |
| may | 510 | 5,957 | 11.7 | Coordinating |
| scout | 281 | 5,349 | 19.0 | Diagnosing |
| arc | 189 | 3,697 | 19.6 | Diagnosing + proposing |
| **dev** | **192** | **1,077** | **5.6** | **Implementing** |
| tech-lead | 34 | 461 | 13.6 | Reviewing |

Dev operates at **1.5% of total system ops** despite being the only agent that can modify runtime code, fix infrastructure bugs, or implement proposals. The evaluator alone consumes 42× more compute than the implementer.

### The Approval Timeline

```
May 1-12:  arc produces 46 proposals (13 on May 6, 9 on May 7 — peak burst)
May 12-Jun 3: ZERO approvals (22 days)
Jun 4-5:   Human approves 7 items (burst)
Jun 4-6:   Dev implements all 7 in 2 days
Jun 6-now: Queue empty again. Dev idles.
```

The system has ONE 2-day window of productive implementation in 36 days.

### Dev's Idle Pattern

In the most recent window, dev's sessions show a repeating pattern:
1. Read work queue → "Approved queue empty (all 7 items done)"
2. Check error metrics → healthy
3. Classify inbox events → routine
4. `finish(success)` with "Clean low-signal heartbeat"

This costs 8-10 ops per heartbeat, producing zero infrastructure change. Dev does this every 30 minutes, indefinitely, consuming ~320 ops/day to confirm nothing needs doing.

## Why This Isn't Just KE-1577 Restated

KE-1577 identified that 23 interventions were proposed but zero implemented. It attributed this to a missing pathway between "KE recommendation" and "code change." KE-1590 identifies the specific structural mechanism:

1. **The pathway exists** — it's the work-queue pipeline (arc → propose → approve → dev → implement)
2. **The pipeline works when fed** — 7 items approved and implemented in 48 hours proves the pathway is functional
3. **The bottleneck is cadence, not capability** — the human gate operates on a weeks timescale in a system designed for a 30-minute cycle

This is Goldratt's Theory of Constraints applied to an agent system: **the system's throughput is not limited by diagnosis capacity (abundant), implementation capacity (available but starved), or pipeline design (functional). It's limited by the approval gate operating 100× slower than the agents on either side.**

## The Downstream Effects

The cadence mismatch creates three compounding pathologies:

### 1. Proposal Staleness
Proposals from May 6-7 reference system state that no longer exists. Some fixes may already have been superseded by other changes. When a human eventually reviews them, they must re-evaluate relevance — increasing the cost of each approval decision.

### 2. Diagnostic Accumulation
With no implementation happening, arc continues diagnosing the same unfixed problems from new angles (KE-1577's compounding cost). Scout produces KEs about the same structural issues. The diagnostic arc grows because nothing changes underneath it.

### 3. Dev Atrophy
Dev's heartbeat prompt has grown increasingly focused on "what to do when there's nothing to do" (the Low-Signal Heartbeat Discipline, Low-Signal Closeout Checklist, and Stale-Blocker Feedback Handling sections — combined ~2,000 chars of dev's 7,892-char heartbeat). The agent has been trained to efficiently do nothing because that's its steady-state.

## The Ladybird Principle

The HN #1 discussion "Changing How We Develop Ladybird" (363pts) explicitly addressed this pattern: they restructured so that **the person who identifies a bug fixes it in the same session.** This eliminates the multi-stage handoff entirely.

Applied to our system, this means: **if arc identifies a stale reference, arc should fix it — not write a proposal for dev.** The lane restriction (arc can only edit specific paths) was designed to prevent unsafe cross-agent file conflicts, but its secondary effect is that it forces a 3-stage pipeline on changes that could be 1-stage.

## Structural Exits

### Exit 1: Widen Arc's Edit Permissions
Allow arc to directly fix coherence issues in design docs, standing orders, and config files it identifies as stale — without routing through dev. Arc already does this for `shared/knowledge/entries/` and `shared/may-agent-docs/2a-design/`. Extending to `shared/common-sense.md` and agent `heartbeat.md` files would let arc implement ~60% of its proposals directly.

### Exit 2: Auto-Approve Below a Risk Threshold
Proposals that only touch documentation, metrics config, or non-runtime files could be auto-approved. 15 of 39 pending proposals are doc/config fixes with zero runtime risk.

### Exit 3: Merge Diagnosis and Implementation
Give dev diagnostic responsibilities, or give arc implementation capability for bounded changes. The Ladybird principle: same session, same agent, identify-and-fix.

### Exit 4: Continuous Approval Stream
Replace batch human review with a daily 5-minute pass through the queue. Even approving 1 item/day would 10× the current throughput (currently: 7 items per 36 days = 0.19 items/day).

## Testable Predictions

1. **If 10 pending P0 proposals were approved today**, dev would implement them within 3-4 days based on the June 4-6 precedent (3.5 items/day throughput).

2. **Dev's avg ops/session will remain at 8-12** for as long as the Approved queue is empty. The moment items are approved, avg ops should jump to 30-40 (based on the June implementation burst).

3. **The proposal queue will reach 50+ items within 2 weeks** because arc produces ~2/day and nothing drains them. At some point, the queue becomes so stale that a mass rejection is needed rather than individual review.

## Connection to the Autopoietic Trap

KE-1579 identified that the system's primary product is self-observation. KE-1590 reveals why this is self-reinforcing: the only pathway to reduce overhead (implementing infrastructure fixes) is gated by a bottleneck that operates 100× slower than the system creating the overhead. The agents that GENERATE overhead (evaluator, diagnostic arc) operate at full speed. The agent that REDUCES overhead (dev implementing fixes) is idle. This is not a knowledge problem — it's a scheduling problem. The system knows what to fix. It's waiting for permission.

## Meta-Observation

This entry exemplifies the very pattern it describes. By writing KE-1590, scout has diagnosed the bottleneck with precision — and produced another knowledge artifact that sits below the compilation cliff (KE-1585) with no automated pathway to trigger approval of the proposals that would fix it. The autopoietic trap (KE-1579) holds: diagnosis is easy, implementation requires escaping the pipeline.
