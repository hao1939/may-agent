# Cost & Efficiency Scan — 2026-03-23T17:36

## Window
- **8 hours** (09:36–17:36 UTC)
- **60 sessions**, 959 total ops
- **7.5 sessions/hr** (down from 8.2/hr at 16:06 scan)

## Agent Breakdown (8h)

| Agent     | Sessions | Ops | Ops% | AvgOps/sess |
|-----------|----------|-----|------|-------------|
| optimizer | 19       | 438 | 45.7%| 23.1        |
| coach     | 10       | 205 | 21.4%| 20.5        |
| tech-lead | 5        | 151 | 15.7%| 30.2        |
| bob       | 7        | 58  | 6.0% | 8.3         |
| qa        | 7        | 38  | 4.0% | 5.4         |
| may       | 7        | 29  | 3.0% | 4.1         |
| scout     | 2        | 25  | 2.6% | 12.5        |
| coder     | 2        | 10  | 1.0% | 5.0         |
| evaluator | 1        | 5   | 0.5% | 5.0         |

## Key Finding: Skill-Lifecycle Cooldown IS WORKING

### Before vs After Comparison (2h windows)
| Window      | Sessions | Ops  | Optimizer % | Top Agent    |
|-------------|----------|------|-------------|--------------|
| 10:00-12:00 | 13       | 210  | 47.6%       | optimizer    |
| 12:00-14:00 | 18       | 321  | 49.8%       | optimizer    |
| 14:00-16:00 | 17       | 286  | 50.7%       | optimizer    |
| **16:00-18:00** | **12** | **142** | **22.5%** | **coach** |

The 16:00-18:00 window (post-cooldown) shows:
- **48% fewer ops** vs earlier windows (142 vs avg 272)
- **Optimizer dropped from ~50% to 22.5%** of total ops
- **Coach (78 ops) is now the top consumer** — driven by growth-cycle fork sessions (36 ops each)
- **Zero skill-lifecycle runs** in this window (cooldown enforced)

### Projected Daily Rate
- Post-cooldown: **~1,704 ops/day** (142 ops/2h × 12)
- Pre-cooldown: **~3,268 ops/day** (817 ops/6h × 4)
- **~48% cost reduction projected**

## Other Findings

### F1: Coach growth-cycle fork sessions expensive
Coach "Fork" sessions (spawning coder gym runs) cost 36 ops each. 2 such sessions in the 8h window = 72 ops = 7.5% of total. Not urgent but worth monitoring — if coach runs more growth cycles, it could become the new dominant cost.

### F2: ANTHROPIC_API_KEY still unset
This is the #1 blocked savings ($36-90/day). Code ready since commit 7c86665. This has been flagged every scan since March 22.

### F3: Workspace bloat
- Journal: was 869 lines → consolidated to 240 (72% reduction)
- Finding files: 51 files, many resolved. Needs archiving.
- Total workspace: 2.2MB

## Actions Taken This Session
1. ✅ Consolidated journal: 869→240 lines (37 old entries archived)
2. ✅ Verified cooldown effectiveness via 2h window comparison
3. 🔲 Archive old finding files (next session)

## Recommendations
1. Monitor coach growth-cycle cost — may need frequency cap if it grows
2. Continue escalating ANTHROPIC_API_KEY ($36-90/day blocked)
3. Archive resolved finding files (51 → target ~15 active)
