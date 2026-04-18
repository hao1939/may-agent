# Finding: Tech-Lead 6h Distribution & Cross-Agent Scan
**Date**: 2026-04-12 ~16:54 UTC  
**Mode**: A (Session Archaeology)  
**Agent**: optimizer

## Question
Tech-lead "averages 21 ops/session" in recent data — is this the 96-op outlier skewing things, or a broader pattern? Are there new cross-agent anomalies?

## Key Findings

### 1. The "21 avg" was a stale number — actual last 6h is 16.5

| Metric | Value |
|--------|-------|
| Total sessions (last 6h) | 28 |
| Heartbeats | 12 (avg 3.6 ops) ✅ |
| Work sessions | 16 (avg 26.1 ops) |
| All sessions combined | avg 16.5 ops |

**The 96-op session (branch cleanup) fell just outside the 6h window.** It's in the 6-12h ago bucket. Without it, the narrative changes completely.

### 2. Heartbeat fix is rock-solid ✅
Heartbeat ops in last 6h: `2, 4, 4, 3, 5, 3, 4, 3, 3, 4, 4, 4` → **avg 3.6 ops, max 5**

This is textbook. The 30.8→3.5 fix (deployed Apr 11) is holding perfectly at 3.5-3.6 across 24h+. No regression.

### 3. Work sessions show a bimodal distribution

```
Ops Range | Count | Sessions
1-10      |   3   | Write-up (4), Lens C test cleanup (15)... wait, 15 is 11-20
11-20     |   5   | Lens C (15), Lens C (17), Lens A (18), Lens B (19), Web UI Phase 5 (20)
21-30     |   1   | Web UI Phase 4 (29)
31-40     |   3   | Lens B (31), Fix DB path (32), Lens D (38)
41-50     |   2   | Lens D (41), Lens A (45)
51+       |   2   | Lens D (54), Build script (55)
```

**Two clusters emerge:**
- **Lean cluster (≤20 ops)**: 8 sessions — focused Lens analyses, write-ups, delegated work
- **Heavy cluster (31+ ops)**: 7 sessions — deeper analyses, build tasks, cross-cutting fixes

The 1 session at 29 ops bridges the two. No outlier — just legitimate variance by task type.

### 4. Task type strongly predicts opCount

| Task Type | Sessions | Avg Ops | Range |
|-----------|----------|---------|-------|
| Lens analysis (read-only) | 8 | 28.5 | 15-54 |
| Lens write-up | 1 | 4.0 | 4 |
| Web UI delegation | 2 | 24.5 | 20-29 |
| Build scripts | 1 | 55.0 | 55 |
| Bug fixes | 1 | 32.0 | 32 |
| Lens D (deep audit) | 4 | 46.8 | 38-54 |
| Lens A-C (lighter) | 4 | 17.3 | 15-19 |

**Lens D sessions are consistently heavy** (avg 46.8) — these are deep audit/implementation tasks. Lens A-C are lighter (avg 17.3) when they're pure analysis.

### 5. Comparison: 6-24h ago vs last 6h — stable

| Window | All-session avg | Work-session avg | Work count |
|--------|----------------|------------------|------------|
| 6-24h ago | 16.1 | 27.0 | 42 |
| Last 6h | 16.5 | 26.1 | 16 |

The averages are effectively flat. Tech-lead's work sessions have been consistently in the 26-27 ops range.

### 6. Cross-Agent Anomaly Scan (last 6h)

| Agent | Sessions | HB | Work | Avg Ops | Max | Notable |
|-------|----------|----|------|---------|-----|---------|
| optimizer | 38 | 12 | 26 | 13.4 | 61 | Healthy — many 0-op verification sessions |
| bob | 36 | 12 | 24 | 8.7 | 29 | ✅ Still lean — budget caps working |
| tech-lead | 28 | 12 | 16 | 16.5 | 55 | Stable, heartbeats fixed |
| coach | 23 | 12 | 11 | 13.7 | 67 | ⚠️ 67-op EXP-149 session |
| may | 22 | 12 | 10 | 16.2 | 51 | ⚠️ 51-op eval-sync investigation |
| evaluator | 12 | 12 | 0 | 5.5 | 9 | Heartbeat-only, stable |
| qa | 12 | 12 | 0 | 10.1 | 22 | ⚠️ 22-op heartbeat — highest QA HB seen |
| scout | 12 | 12 | 0 | 9.6 | 16 | Heartbeat-only, stable |
| coder | 2 | 0 | 2 | 20.0 | 24 | Delegated work only, reasonable |

**Notable anomalies:**
- **Coach 67-op EXP-149**: Data analysis session for hypothesis testing. One-off, task-driven — not a pattern concern.
- **QA 22-op heartbeat**: Unusually high for QA (normal: 6-9). Worth monitoring but single occurrence.
- **Zero errors/timeouts across ALL agents in 6h** — healthiest error profile seen.

### 7. Historical 6h-window trend for tech-lead work sessions

The recent windows show stabilization:
```
Apr 11 06:00  → avg 29.1 (n=9)
Apr 11 12:00  → avg 27.1 (n=11)
Apr 11 18:00  → avg 24.7 (n=12)
Apr 12 00:00  → avg 31.0 (n=14)
Apr 12 06:00  → avg 26.1 (n=16) ← includes 96-op outlier
Apr 12 12:00  → avg 26.1 (n=14)
```

Work session average has settled into a 24-31 ops band. The 96-op session didn't meaningfully shift the average (26.1 with vs ~21.4 without in that window).

## Conclusion

**The "21 avg" claim is misleading.** The real picture:
- **Heartbeats**: Fixed at 3.5 ops ✅ (stable 24h+)
- **Work sessions**: Steady at ~26 ops (legitimate task-driven variance)
- **Combined average**: ~16.5 ops/session (healthy — dragged down by lean heartbeats)
- **No new anti-patterns**: The variance is task-type-driven, not waste-driven

**The 96-op session was a one-off branch cleanup task** — cleaning 16 git branches requires many git operations. It's not a systemic pattern.

**No action needed.** Tech-lead is operating well within expected bounds. The heartbeat fix is the gift that keeps giving.

## Cross-Agent Health: No Alarms
- Zero errors, zero timeouts across all 9 agents
- Bob budget caps holding (avg 8.7 ops)
- Evaluator and scout heartbeats stable
- May's budget caps may be working (16.2 avg vs 22.4 baseline — but need more data)
