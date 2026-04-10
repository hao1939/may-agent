# Coach Research Status — 2026-04-10 05:25 UTC

> Updated after every experiment completion. Visible status for all agents and Hao.

## Active Research

| # | Experiment | Status | Key Finding | Hao Directive |
|---|-----------|--------|-------------|---------------|
| EXP-114 | FM-2.1 Approach Decomposition Guard | DESIGNED — not yet run | — | Self-directed (follows EXP-113) |

## Recently Completed (Last 48h)

| # | Experiment | Completed | Key Finding | Hao Directive |
|---|-----------|-----------|-------------|---------------|
| EXP-113 | FM-Heavy Workers Targeted Intervention | 2026-04-10 05:04 | FM-2.1 is #1 intervention priority (score=0.025). Cascade trigger: FM-2.1 first → 2.38 subsequent FMs. Dose-response: each additional FM drops quality by ~0.05. Post-guard residual: 16 sessions, 88% FM-3.3, bob dominates. | Self-directed (EXP-109 follow-up) |
| EXP-110 | FM-3.3 Commit Guard Production Impact | 2026-04-10 04:01 | Guard doesn't prevent FM-3.3 — it converts silent failures to recovered ones. Recovery rate +51.3pp (p<0.001). Unrecovered rate unchanged. | Partially aligned (commit guard measurement) |
| EXP-109 | Production Observation Study (3 phases) | 2026-04-10 04:34 | 6 behavioral archetypes: Clean Performers (43%), FM-Heavy Workers (22%), Silent Failures (19%), Expensive Grinders (7%), Resilient Recoverers (7%), Deep Spiral (1%). 37.5% of "good" sessions have FM codes. | Self-directed (production observation) |
| EXP-108 | Adversarial Self-Review Skill | 2026-04-09 | All 7 multi-session scenarios at ceiling (91-100%). Gym saturated — can't test new skills. | Self-directed (skill testing) |

## Queued Research (Hao-Aligned, Prioritized)

| Priority | Topic | Hao Directive Reference | Status |
|----------|-------|------------------------|--------|
| **P0** | Context learning gap — strategic knowledge extraction | "The compact and context sounds great" (Apr 9) + "context learning only captures operational facts" (Apr 7) | NOT STARTED — next research project |
| **P0** | Auto-loop for sustained research | 8+ asks about long-running tasks (Apr 7-9) | Bob tested (5 sessions). Not yet used for real research. |
| **P1** | Tech-lead role redesign proposal | "tech-lead should be autonomous stability engineer" (Apr 9) | NOT STARTED |
| **P1** | Knowledge application experiments | "experiment the knowledge, try to use it, or it's dead knowledge" (Apr 8) | NOT STARTED |
| **P2** | KE-002 re-examination | "knowledge against my instincts — text rules not working" (Apr 8) | Part of knowledge application |

## Shipped to Production

| Feature | Deployed | Impact |
|---------|----------|--------|
| Commit Guard (finish-guard) | 2026-04-07 | Agent-laziness auto-commits: 58% → 1.0%. Agent commit volume: 14 → 460 per 48h. |
| Few-Shot Skill Pipeline (Wave 1-3) | 2026-04-08 | 9 behavioral examples, 3/4 scenarios pass cross-reference skill. Production router live for coder + optimizer. |
| Multi-Session Test Harness | 2026-04-09 | 5 scenarios, runner integration, baselines documented. Ready for monthly regression sweeps. |

## Key Metrics

- **Gym ceiling**: 26 single-session + 7 multi-session scenarios ALL at 100%. Need fundamentally harder challenges.
- **Knowledge entries**: 150+ in shared/knowledge/. Most untested in production.
- **Experiments completed**: EXP-001 through EXP-113 (not all sequential).
