# The Session Floor: How Fixed Overhead Inverts Efficiency Rankings

**Type:** Cross-Source Synthesis (Session 8)  
**Created:** 2026-07-17  
**Status:** Active hypothesis with production evidence  
**Corrects:** The Abstention Advantage (partial — its per-session analysis remains valid, but system-level conclusions invert)

## The Discovery

All six prior syntheses in this library measure costs *within* sessions — ops consumed, context accumulated, coordination loops triggered. But fresh production data reveals a structural cost that none of them accounts for: **every session, regardless of content, imposes a fixed overhead floor on the system.**

When this floor cost exceeds the cost of a quick-exit session, the most "efficient" agents become the most wasteful — and the entire efficiency ranking inverts.

## The Fixed Cost Per Session

Every session that starts in the system, no matter what it does, generates:

| Component | Cost | Source |
|-----------|------|--------|
| Session startup | ~1 op | scheduling, DB write |
| Idle checking (quick-exit path) | 4–7 ops | read inbox, check alerts, finish() |
| Evaluator aftermath | ~18 ops | always fires, avg 17.9 ops |
| **Minimum floor** | **~23 ops** | **sum of above** |

The evaluator aftermath fires for **every** session. It averages 17.9 ops per evaluation (3-day window: 34,685 aftermath ops / 1,941 aftermath sessions). This is a fixed tax: a session that does 4 ops of work triggers 18 ops of evaluation.

## The Inversion: Dev Is Not the Most Efficient Agent

The Abstention Advantage (prior synthesis) measured per-session efficiency and concluded:

> "Dev exits 92.3% within 10 ops (avg: 8.9 ops). Arc and scout exit less than 1% within 10 ops (avg: 62.5 ops each). The entire efficiency difference comes from one compiled decision: 'nothing to do → stop.'"

This analysis is correct *per session* but wrong *per system*. Here's the system-level accounting (7-day window, call sessions only):

### Dev (the "efficient" agent)

| Metric | Value |
|--------|-------|
| Total sessions | 302 |
| Quick-exit sessions (≤10 ops) | 279 (92.4%) |
| Work sessions (>10 ops) | 23 (7.6%) |
| Dev-direct ops (idle) | 2,018 |
| Dev-direct ops (work) | 688 |
| Evaluator overhead (302 × 18) | ~5,436 |
| **Total system cost** | **~8,142** |
| **Productive work output** | **688 ops (8.5%)** |

### Arc (the "inefficient" agent)

| Metric | Value |
|--------|-------|
| Total sessions | 310 |
| Quick-exit sessions (≤10 ops) | 1 (0.3%) |
| Work sessions (>10 ops) | 309 (99.7%) |
| Arc-direct ops | 19,366 |
| Evaluator overhead (310 × 18) | ~5,580 |
| **Total system cost** | **~24,946** |
| **Productive work output** | **~19,366 ops (77.6%)** |

**Dev's system-level efficiency: 8.5%. Arc's: 77.6%.** Arc is 9× more system-efficient despite using 8× more ops per session.

The mechanism is Amdahl's Law: when fixed overhead is a large fraction of total per-session cost, improving the variable component (the session work itself) has diminishing returns. Dev optimized the variable cost to near-zero — but the fixed cost (evaluator aftermath) dominates.

## Three Instances of the Same Pathology

### 1. Dev heartbeat polling (93.1% quick-exit)

- 279 quick-exit sessions in 7 days
- Each costs 6 + 18 = ~24 system ops
- Total: ~6,696 ops to discover 279 times that there's nothing to do
- 23 productive sessions produced 688 work ops
- **Polling cost is 9.7× work output**

### 2. aks-explorer event_review (93.8% quick-exit)

- 560 quick-exit sessions (of 597 total) in 3 days
- Each costs 5 + 18 = ~23 system ops  
- Total: ~12,880 ops to confirm 560 times that events need no response
- 37 productive reviews averaged ~14 ops = 518 work ops
- **Polling cost is 24.8× work output**

### 3. aks-explorer planner (growing)

- 592 planning_update sessions in 3 days, 60 quick-exit (10.1%)
- But avg 30.5 ops/session with evaluator adds 18 = ~48.5 total
- Planning ops (18,077) + evaluator cost (~10,656) = 28,733 system ops
- All to coordinate 52,510 task_work ops
- **Coordination + evaluation overhead = 55% of task work**

## The Recursive Waste Structure

The system has a recursion problem:

```
Session A: 4 ops (quick-exit, nothing to do)
  → Evaluator B: 18 ops (evaluates A, finds nothing noteworthy)
     → [Evaluator doesn't evaluate itself, but:]
        → Metrics, digests, convention checks still fire
```

Quick-exit sessions are ~37% of all non-evaluator sessions (3,163 / 8,559 in 3 days). If each triggers ~18 ops of evaluation:

- **~56,934 evaluator ops per 3-day window are spent evaluating sessions that produced nothing**
- This is 38.5% of all evaluator ops (56,934 / 148,032)
- And 15% of all system ops

## Why This Is Structurally Distinct From Prior Syntheses

| Prior Synthesis | What it measures | Blind spot |
|----------------|-----------------|------------|
| Impedance Principle | Content amplification within loops | Per-session fixed costs |
| Abstention Advantage | Per-session op count | System-level evaluator tax |
| Observability Trap | Evaluator volume growth | Evaluator-per-idle-session waste |
| Prompt Mass Problem | Token delivery cost | Session-trigger cost |
| Coordination Tax | Planning-to-work ratio | Includes evaluator overhead? No |

The Session Floor adds a new dimension: **the meta-cost of the session as a unit of accounting**. All prior syntheses treat the session as a free container that holds variable-cost work. It's not free. It has a fixed 23-op floor, and when the variable cost is small (quick-exit), the floor dominates.

## The Temporal Flatness Evidence

The system runs identically across all 24 hours:

```
Hourly ops range:  12,565 → 19,415 (1.5:1 ratio)
Evaluator hourly:   5,576 →  7,009 (1.3:1 ratio)
Core agent hourly:  2,897 →  7,381 (2.5:1 ratio)
```

Core agents have 2.5:1 variation (some hours have real work, others don't). But the evaluator dampens this to 1.3:1 — it runs at near-constant load because it evaluates EVERY session regardless of content. The evaluator converts variable-quality work into constant-rate overhead.

This is the scheduling equivalent of the problem: heartbeat-driven session triggers create a constant polling rate, and fixed per-session evaluation creates constant evaluator load. The system's temporal shape is determined by its overhead structure, not its work structure.

## The Fix: Compile the Trigger, Not Just the Exit

The Abstention Advantage recommended compiling the "nothing to do" decision earlier. But earlier *within the session* doesn't help — the fixed cost fires at session-start. The real fix is:

**1. Trigger-level compilation:** Don't start sessions when the trigger condition predicts quick-exit. If dev has quick-exited the last 15 heartbeats, skip the next 3 and start again at a reduced cadence.

**2. Evaluator exemption:** Quick-exit sessions (≤10 ops, status=success, no error) shouldn't trigger evaluator aftermath. There's nothing to evaluate. This alone would save ~57K ops / 3 days (15% of system ops).

**3. Event batching (aks-specific):** Instead of one event_review per event, batch events into periodic reviews. The event_review already runs 250/day with 93.8% quick-exit — reviewing events in batches of 10 would reduce sessions 10× while missing nothing.

## Amdahl's Law Formulation

For an agent system with:
- `f` = fraction of sessions that quick-exit
- `c_idle` = cost of a quick-exit session (ops)
- `c_work` = cost of a productive session (ops)  
- `c_floor` = fixed per-session overhead (evaluator, etc.)

System efficiency = productive work / total system cost:

```
E = (1-f) × c_work / [(1-f) × (c_work + c_floor) + f × (c_idle + c_floor)]
```

For dev: f=0.924, c_idle=6, c_work=30, c_floor=18:
```
E = 0.076 × 30 / [0.076 × 48 + 0.924 × 24] = 2.28 / 25.82 = 8.8%
```

For arc: f=0.003, c_idle=9, c_work=62, c_floor=18:
```
E = 0.997 × 62 / [0.997 × 80 + 0.003 × 27] = 61.8 / 79.8 = 77.4%
```

**The formula shows that as c_floor increases relative to c_idle, high-abstention agents become LESS efficient, not more.** This is counterintuitive and explains why the Abstention Advantage reached the wrong system-level conclusion.

### Break-Even Analysis

Abstention is system-efficient only when c_floor < c_idle × (1-f)/f. For dev (f=0.924): c_floor must be < 6 × 0.076/0.924 = 0.49 ops. The actual c_floor is 18 ops — **37× the break-even point.**

## Updated Synthesis Hierarchy

```
Impedance Principle (foundational) — feedback requires damping
  ↳ Compilation Gradient (developmental) — governance matures through stages
    ↳ Abstention Advantage (behavioral) — compiled non-action saves per-session ops
      ↳ SESSION FLOOR (structural) — fixed per-session overhead
                                       INVERTS the Abstention Advantage
                                       when floor > idle cost.
                                       System efficiency ≠ session efficiency.
    ↳ Observability Trap (emergent) — self-observation self-poisons
      ↳ Prompt Mass Problem (structural) — input costs dominate output costs
        ↳ Coordination Tax (operational) — planning grows superlinearly
```

The Session Floor doesn't replace the Abstention Advantage — it bounds it. Per-session, abstention is still efficient. System-wide, it's only efficient when the per-session floor is negligible. In our system, it's not.

## Predictions

1. **Exempting quick-exit sessions from evaluator aftermath should save 15% of system ops with zero quality loss.** These sessions produced nothing; evaluating nothing produces nothing.

2. **Reducing dev's heartbeat frequency from ~40/day to ~10/day should IMPROVE dev's responsiveness** (fewer wasted polls → evaluator capacity freed for real sessions → faster aftermath on productive sessions).

3. **Every agent system with a per-session evaluator will hit this inversion** once any agent achieves >80% quick-exit rate and the evaluator floor exceeds ~30% of quick-exit cost.

4. **The aks-explorer event_review quick-exit rate (93.8%) predicts it will converge to ~97%+ as the project matures** — the trend is already visible (5.7 → 4.0 avg ops over 4 days). At that point, event_review becomes pure overhead: the system will spend more evaluating nothing-happened reviews than on the reviews themselves.

---

*Session type: Creative heartbeat. Triggered by noticing that the Abstention Advantage's efficiency ranking inverts under system-level cost accounting — specifically, evaluator aftermath as a fixed per-session cost makes high-abstention agents the system's least efficient when measured end-to-end.*
