# Tech-Lead Cost Profile — Apr 14, 2026

## Executive Summary

Tech-lead ran **90 sessions / 1,673 ops** in the last 24h (up from 67 sessions / 1,088 ops the prior day — a **54% op increase**). The primary cost drivers are:

1. **Injected-task heartbeats** — 100% of 66 heartbeats carry injected work instructions, averaging 13.6 ops vs the Apr 13 baseline of 8.6 ops. Ten heartbeats exceeded 15 ops, consuming 521 ops (58% of all heartbeat ops).
2. **Guards-v2 implementation chain** — One 272-op session (interrupted) plus 6 follow-on sessions = 778 ops total for the guards feature lifecycle.
3. **Repeated task dispatch** — batch-merge was dispatched 5 separate times (86 ops total) and scenario-oracle twice (115 ops for the work sessions alone).

**Estimated daily cost**: ~$79 (up from ~$53 on Apr 13).

---

## 1. Session Distribution

### By Type

| Type | Sessions | Ops | Avg Ops | % of Total Ops |
|---|---|---|---|---|
| Heartbeats | 66 | 899 | 13.6 | 54% |
| Work sessions | 23 | 746 | 32.4 | 45% |
| Coder-dispatch | 1 | 28 | 28.0 | 2% |
| **Total** | **90** | **1,673** | **18.5** | **100%** |

**Key shift**: Heartbeats now consume more ops than work sessions (54% vs 45%). On Apr 13, the split was 30% heartbeat / 70% work.

### By Op Count (histogram)

| Bucket | Count | Notes |
|---|---|---|
| 0 ops | 2 | Zero-op sessions (just started) |
| 1-3 ops | 6 | Quick triage heartbeats |
| 4-5 ops | 12 | Lean heartbeats (target range) |
| 6-10 ops | 44 | **Mode** — most heartbeats land here |
| 11-15 ops | 5 | Slightly over budget |
| 16-20 ops | 2 | Over budget |
| 21-30 ops | 8 | Work sessions |
| 31-50 ops | 3 | Moderate work sessions |
| 51+ ops | 8 | **Heavy sessions** (521 ops, 31% of total) |

The distribution is bimodal: a healthy 6-10 peak (48% of sessions) and a costly 51+ tail (9% of sessions, 31% of ops).

### By Status

| Status | Sessions | Ops |
|---|---|---|
| done | 82 | 1,360 |
| interrupted | 6 | 306 |
| running | 2 | 0 |

Interrupted sessions are costly: 6 sessions × 51 avg ops. The 272-op guards session dominates.

---

## 2. Top 5 Costliest Sessions

### #1: Guards-v2 Phase 1 Implementation — 272 ops (interrupted)
- **Time**: 09:22 UTC | 16 min before interrupt
- **Task**: Full implementation of unified guard framework
- **Why costly**: Massive scope — implementing an entire subsystem in a single session. Interrupted at 272 ops (likely hit budget cap or timeout).
- **Follow-on**: Spawned 6 more sessions (28 + 23 + 15 + 94 + 23 + 61 = 244 ops) for phase completion, review, integration test, and merge.
- **Total chain cost**: 272 + 244 = **516 ops** for the guards-v2 feature lifecycle.

### #2: URGENT Evaluator Fix — 182 ops (heartbeat)
- **Time**: 00:26 UTC | 51 min duration
- **Task**: "Evaluator LLM evaluations broken for 3.5 days" — P0 injected into heartbeat
- **Why costly**: Complex debugging + fix of the evaluation pipeline. Should have been forked as a work session, not injected into a heartbeat.

### #3: Guard-Redirect-Phase1 Review — 94 ops
- **Time**: 04:46 UTC | 16 min
- **Task**: Review branch for merge readiness
- **Why costly**: Large code review with detailed analysis. Part of the guards chain.

### #4: P0 Directive (workflow.run fix) — 86 ops (heartbeat)
- **Time**: 13:22 UTC | 16 min
- **Task**: Hao's directive to stop removing workflow.run() from heartbeats
- **Why costly**: Emergency fix touching multiple agent heartbeat files. Injected as P0 into heartbeat.

### #5: Scenario Oracle Generator — 63 ops
- **Time**: 11:52 UTC | 10 min
- **Task**: Build scenario oracle generator for coach gym
- **Why costly**: First attempt completed but was dispatched again at 14:52 for 52 more ops (115 ops total for same task).

---

## 3. The Injected-Heartbeat Problem

**100% of tech-lead's 66 heartbeats carry injected task instructions** — zero "pure" heartbeats. This is the single biggest finding.

### How it works
Other agents (may, optimizer, coach) send tasks to tech-lead via `agents.message()` or `agents.call()`. These tasks get attached to the next heartbeat tick. When the task is complex ("Implement X", "Build Y"), the heartbeat becomes a de facto work session — but without the session framing, budget controls, or isolation of a properly forked work session.

### Impact

| Heartbeat Category | Count | Avg Ops | Total Ops |
|---|---|---|---|
| Heartbeats ≤10 ops | 56 | 6.8 | 378 |
| Heartbeats 11-15 ops | 3 | 14.3 | 43 |
| **Heartbeats >15 ops** | **10** | **52.1** | **521** |

The 10 over-budget heartbeats consumed **521 of 899 heartbeat ops (58%)**. These are effectively work sessions classified as heartbeats, bypassing any work-session budget controls.

### Comparison: Apr 13 vs Apr 14

| Metric | Apr 13 | Apr 14 | Change |
|---|---|---|---|
| Total sessions | 67 | 90 | +34% |
| Total ops | 1,088 | 1,673 | +54% |
| Heartbeat count | 38 | 66 | +74% |
| Heartbeat avg ops | 8.6 | 13.6 | +58% |
| Heartbeat total ops | 326 | 899 | +176% |
| Work session count | 29 | 24 | -17% |
| Work session avg ops | 26.3 | 32.4 | +23% |

Heartbeat volume nearly doubled while work sessions decreased. The cost shift is entirely in heartbeat inflation from injected tasks.

---

## 4. Repeating Patterns

### Pattern A: Re-dispatched Tasks (86-115 ops wasted)

| Task | Dispatches | Total Ops | Issue |
|---|---|---|---|
| batch-merge script | 5 work + 4 heartbeat refs | 86 | Same task dispatched 5 times across 8h |
| scenario oracle | 2 work + 1 heartbeat ref | 123 | Second attempt (52 ops) redid first (63 ops) |

**Root cause**: No deduplication or completion tracking. When a task is dispatched and done, it gets re-dispatched because the dispatcher doesn't check if work was already completed.

### Pattern B: Multi-Session Feature Chains (778 ops)

The guards-v2 feature chain:
```
19:22 — Guard-as-Sensor Phase 1 (28 ops)
19:56 — Lens B guard composition (6 ops)  
04:46 — Review guard-redirect (94 ops)
07:54 — Design review (4 ops)
08:19 — Design review v2 (15 ops)
09:22 — Guards-v2 Implementation (272 ops, interrupted!)
09:44 — Phase 1 completion (28 ops)
09:55 — Phase 2 integration test (23 ops)
12:52 — Merge verify-wrap fix (61 ops)
13:22 — P0 workflow.run fix (86 ops - side effect)
14:25 — Error-log cleanup (26 ops)
14:52 — QA interrupt fix (38 ops)
```

Total: **~778 ops** for guards-related work across 20+ hours. The 272-op session alone consumed 16% of all tech-lead ops.

### Pattern C: Review-Merge Overhead (533 ops)

12 sessions categorized as review-merge, totaling 533 ops at 44.4 avg. The review-merge.sh script (built at 21:21 on Apr 13 for 42 ops) was meant to reduce this, but the guards-v2 chain still generated heavy manual review work.

---

## 5. Recommendations

### R1: Enforce heartbeat budget cap at 12 ops (HIGH IMPACT — saves ~400 ops/day)
The tiered budget system should cap tech-lead heartbeats. Currently, injected tasks bypass the cap because they're treated as heartbeat + task, not a standalone work session. 
- **Fix**: If the heartbeat task exceeds a complexity threshold (e.g., >200 chars or contains "Implement"/"Build"/"Fix"), auto-fork it as a work session instead of running inline.
- **Expected savings**: 521 ops → ~120 ops (10 over-budget heartbeats × 12 cap) = ~400 ops/day.

### R2: Task deduplication for dispatchers (MEDIUM IMPACT — saves ~100 ops/day)
batch-merge was dispatched 5 times, scenario-oracle twice. 
- **Fix**: Before dispatching, check recent sessions for matching task prefixes with status=done. Skip if found within last 2h.
- **Expected savings**: 86 (batch-merge) + 52 (scenario-oracle duplicate) = ~138 ops saved.

### R3: Session complexity budget for large implementations (MEDIUM IMPACT)
The 272-op guards session should have been split into smaller work units or used a workflow.
- **Fix**: For tasks starting with "Implement" that reference a design doc, auto-decompose into sub-tasks (read design → implement file 1 → implement file 2 → test → PR).
- **Expected savings**: Hard to estimate, but 272 ops → 3-4 sessions of 30-40 ops would reduce waste from the interrupted tail.

### R4: Feature-chain cost tracking (LOW IMPACT but high visibility)
No easy way to see that guards-v2 cost 778 ops across 12+ sessions spanning 20h. 
- **Fix**: Tag related sessions with a feature ID (e.g., `feature:guards-v2`) so total cost can be queried.

---

## Cost Summary

| Category | Ops | Est. Cost | Actionable? |
|---|---|---|---|
| Lean heartbeats (≤10 ops) | 378 | ~$18 | ✅ Healthy |
| Over-budget heartbeats (>15 ops) | 521 | ~$25 | 🔴 R1: cap/fork |
| Guards chain (feature) | 778 | ~$37 | 🟡 R3: decompose |
| Repeated dispatches | ~138 | ~$7 | 🟡 R2: dedup |
| Normal work sessions | ~474 | ~$22 | ✅ Healthy |
| **Total** | **1,673** | **~$79** | |

**Achievable savings**: R1 alone saves ~$19/day. R1+R2 together save ~$25/day, bringing tech-lead back to the ~$53/day baseline from Apr 13.

---

*Analysis performed: Apr 14, 2026 ~18:52 UTC. Data window: last 24h. DB: .state/may.db.*
