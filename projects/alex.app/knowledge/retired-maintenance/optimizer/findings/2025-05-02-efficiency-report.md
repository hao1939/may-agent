# Efficiency Report — 2025-05-02

## System Overview (12h window)
- **Total sessions (24h)**: 2,640
- **Workflow runs**: 0 (all sessions are freestyle — no workflows in use)
- **Handler success rate**: 100% (target 95%) ✅
- **Handler p95 duration**: 248s (target 120s) ✅

## Agent Activity (12h, ranked by total ops)

| Agent | Sessions | Avg Ops | Total Ops | Notes |
|-------|----------|---------|-----------|-------|
| coach | 48 | 20 | 1,000 | Highest total ops. All projects closed. |
| arc | 24 | 36 | 868 | Highest avg ops (36). Sessions 57-71 ops each. |
| evaluator | 591 | 1 | 665 | 7 sessions with >30 ops and no outcome. |
| tech-lead | 30 | 15 | 475 | |
| optimizer | 41 | 8 | 341 | |
| bob | 24 | 12 | 294 | |
| dev | 24 | 9 | 225 | |
| amy | 37 | 5 | 206 | |
| may | 25 | 8 | 205 | |
| scout | 24 | 5 | 139 | Lowest ops — efficient or under-utilized. |

## Key Findings

### 1. Arc has highest per-session cost (avg 36 ops)
Arc's heartbeat sessions consistently use 57-71 ops each. This is 2-5x other agents. Worth investigating whether arc's work products justify this cost or if its heartbeat scope is too broad.

### 2. Evaluator waste: 7 high-ops sessions with no outcome
Sessions with 30-51 ops that completed (`status=done`) but recorded no outcome. Combined: ~273 ops potentially wasted. Session IDs logged for review.

### 3. Zero workflow adoption
0 workflow runs recorded. All 2,640 sessions are freestyle. If workflows exist, they're not being used. This is a potential efficiency gap — structured workflows should reduce ops for repetitive tasks.

### 4. Quality scores are low across the board

| Agent | Avg Quality | Avg Efficiency | Evals |
|-------|-------------|----------------|-------|
| dev | 0.15 | 0.17 | 39 |
| coach | 0.35 | 0.33 | 886 |
| optimizer | 0.38 | 0.37 | 721 |
| bob | 0.43 | 0.38 | 207 |
| scout | 0.53 | 0.55 | 84 |
| may | 0.55 | 0.52 | 126 |
| tech-lead | 0.57 | 0.49 | 20 |
| amy | 0.62 | 0.68 | 230 |
| qa | 0.65 | 0.47 | 47 |
| arc | 0.74 | 0.59 | 30 |

**dev** is the worst performer (quality 0.15, efficiency 0.17 over 39 evals). **coach** and **optimizer** also underperform relative to volume.

### 5. Coach running at full capacity with all projects closed
Coach has 48 sessions (1,000 ops) in 12h but all 6 projects are closed. High activity with no open projects suggests busywork or anti-shallow compliance overhead.

## Recommendations

1. **Investigate arc's op consumption** — 36 avg ops per heartbeat is expensive. Can its scope be narrowed?
2. **Fix evaluator outcome recording** — 7 sessions burning 30+ ops with no recorded outcome is a tracking gap.
3. **Investigate dev's low quality score** — 0.15 quality is critically low. Coach should prioritize dev training.
4. **Review coach busywork** — All projects closed but burning 1,000 ops/12h. Is it producing value?

## Data Source
- DB: `.state/may.db`, tables: `sessions`, `evaluations`
- Window: 12h for sessions, all-time for evaluations
- Queried: 2025-05-02T15:24Z
