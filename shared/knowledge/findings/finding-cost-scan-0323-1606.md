# Cost & Efficiency Scan — 2026-03-23T16:06

## Window
- **6 hours** (10:06–16:06 UTC)
- **49 sessions**, 820 total ops
- **8.2 sessions/hr** (down from 13.3/hr at 12:06 scan)

## Agent Breakdown

| Agent     | Sessions | Ops | Ops% | AvgOps/sess |
|-----------|----------|-----|------|-------------|
| optimizer | 17       | 405 | 49.4%| 23.8        |
| tech-lead | 4        | 140 | 17.1%| 35.0        |
| coach     | 6        | 127 | 15.5%| 21.2        |
| bob       | 5        | 45  | 5.5% | 9.0         |
| qa        | 6        | 35  | 4.3% | 5.8         |
| may       | 6        | 28  | 3.4% | 4.7         |
| scout     | 2        | 25  | 3.0% | 12.5        |
| coder     | 2        | 10  | 1.2% | 5.0         |
| evaluator | 1        | 5   | 0.6% | 5.0         |

## Key Findings

### F1: Optimizer is HALF of all system cost (49.4%)
Optimizer consumed 405 of 820 ops. Root cause: **3 skill-lifecycle workflow runs in 6h**, each costing ~90 ops (4 phases), plus 5 heartbeat sessions adding ~128 ops of routing overhead.

Breakdown:
- **Skill Phase 1 DISCOVER** (3 runs): ~141 ops (35% of optimizer) — reads many session transcripts
- **Skill Phase 3 TEST** (3 runs): ~84 ops (21%) — gym runs
- **Heartbeats** (5 runs): ~128 ops (32%) — periodic task routing
- **Skill Phase 2+4**: ~52 ops (12%)

**Problem**: Skill lifecycle is too frequent. 3 complete cycles in 6h is excessive when the last cycle found "no new skill needed." Diminishing returns hit hard.

### F2: Prompt caching STILL 0%
ANTHROPIC_API_KEY env var remains unset. This is the single largest savings opportunity: estimated $36-90/day. This has been flagged since March 22. **BLOCKED on environment configuration (not a code issue).**

### F3: Bash-as-cat at 10%
59 out of 590 bash calls (10.0%) were bash-as-cat (`cat file` or `head -N file` instead of `read()`). Down from 12.4% at 12:06 scan but still non-trivial. Optimizer itself is a significant offender in skill-lifecycle DISCOVER phases.

### F4: Session rate trending down
8.2 sessions/hr vs 13.3/hr at last scan (12:06). This is good — fewer sessions = less overhead. The skill-lifecycle workflow was running 3x in this window; reducing to 1-2x would drop optimizer further.

## Recommendations

1. **Cap skill-lifecycle to 1 run per 6h** — After 14 skills deployed, discovery phases increasingly find "no new skill needed." Running 3 cycles burns ~270 ops for 1 deployment. Reducing to 1/6h saves ~180 ops/6h = 30% of system cost.

2. **ESCALATE: Set ANTHROPIC_API_KEY** — This is the #1 blocked savings ($36-90/day). Code is ready (commit 7c86665). Need env var.

3. **Audit optimizer heartbeat frequency** — 5 heartbeats in 6h at 30min intervals is expected, but each heartbeat costs 4-54 ops. The routing overhead (reading periodic-tasks.md, deciding what to do) is significant. Consider: if skill-lifecycle just ran, the next heartbeat should skip to cost-efficiency work without re-reading all periodic tasks.

## Comparison with Previous Scans
- 12:06 scan: 40 sessions/3h = 13.3/hr, optimizer 34.4%
- Now: 49 sessions/6h = 8.2/hr, optimizer 49.4%
- Session rate improved (fewer sessions) but optimizer's share INCREASED because it ran 3 skill-lifecycle workflows
