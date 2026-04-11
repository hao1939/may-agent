# Coach Research Status — 2026-04-11 11:23 UTC

> Updated after every experiment completion. Visible status for all agents and Hao.

## ⚠️ CRITICAL: Production Deployment Reality Check (2026-04-11 Audit)

**The binary ships with 4 infrastructure guards. Zero behavioral intervention guards from Coach research are deployed.** The following "Shipped to Production" claims from prior versions were FALSE. See `agents/coach/workspace/production-audit-2026-04-11.md` for full audit.

## Active Research

| # | Experiment | Status | Key Finding | Hao Directive |
|---|-----------|--------|-------------|---------------|
| — | Research-to-Production Workflow | DESIGNING | — | "use workflow to enforce the process" (Apr 11) |
| — | Agent GAN Design | QUEUED | — | "How could 2 agents GAN?" (Apr 11) |
| — | Agent Read Patterns Study | QUEUED | — | "what really read by agents in each turn?" (Apr 11) |

## Recently Completed (Last 72h)

| # | Experiment | Completed | Key Finding | Hao Directive |
|---|-----------|-----------|-------------|---------------|
| EXP-136 | Guard Rate Decomposition | 2026-04-11 | 20% of FM-3.3 blocks inflated by `git commit` in BASH_WRITE_PATTERNS. Bob improving (58%→24% genuine), may/optimizer degrading. | Partially (guard accuracy) |
| EXP-135 | Guard Rate Escalation | 2026-04-11 | Guard rate increasing — skill degradation or task mix change? | Self-directed |
| EXP-134 | Guard Recovery Audit | 2026-04-11 | What FM-3.3 actually catches in production | Self-directed |
| EXP-133 | Verification-Depth Guard | 2026-04-11 | **NULL RESULT**: 48% "unverified" rate was 100% measurement artifact | Self-directed |
| EXP-130 | Few-Shot on Discovery | 2026-04-11 | **IATROGENIC**: Few-shot HURTS discovery by -67pp (p=0.030) | Self-directed |
| EXP-120 | Progressive Externalization | 2026-04-10 | **NEGATIVE**: Instruction ignored; treatment worse than baseline (17% vs 67%) | Self-directed |
| EXP-115 | FM-2.2 Completeness Guard | 2026-04-10 | +100pp in gym (0%→100%). **NOT DEPLOYED** (source file does not exist) | Partially aligned |
| EXP-114 | FM-2.1 Approach Guard | 2026-04-10 | Phase A tool-schema guard designed. Phase B inconclusive (ceiling). **NOT DEPLOYED** (source file does not exist) | Self-directed |

## Queued Research (Hao-Aligned, Prioritized)

| Priority | Topic | Hao Directive Reference | Status |
|----------|-------|------------------------|--------|
| **P0** | Research-to-production workflow | "close the loop" + "use workflow to enforce" (Apr 11) | IT-73: Designing |
| **P0** | Fix false deployment claims | Production audit findings (Apr 11) | IT-74: In progress |
| **P1** | Hermes investigation (memory/harness) | "have we investigated hermes?" (Apr 11) | IT-75: Not started |
| **P1** | Agent GAN experiment design | "How could 2 agents GAN?" (Apr 11) | IT-76: Not started |
| **P1** | Agent read-pattern observability | "what really read by agents in each turn?" (Apr 11) | IT-77: Not started |
| **P1** | Workflow catalog (convert proven patterns) | "lots of great ideas and we can make it into workflow" (Apr 11) | IT-78: Not started |
| **P2** | Context learning gap research | "compact and context" (Apr 9) | Deferred — workflow infra first |
| **P2** | Knowledge application experiments | "experiment the knowledge" (Apr 8) | Reframed as "deploy proven interventions" |

## Actually Shipped to Production

| Feature | Deployed | Impact | Verified |
|---------|----------|--------|----------|
| Commit Guard (finish-guard) | 2026-04-07 | Agent commit volume: 14 → 460 per 48h | ✅ In binary (createFinishGuard) |
| Read Dedup Guard | Pre-existing | Prevents infinite read loops | ✅ In binary (createReadDedupGuard) |
| Session Read Guard | Pre-existing | Controls session file access | ✅ In binary (createSessionReadGuard) |
| Scrape Dedup Guard | Pre-existing | Prevents duplicate web scrapes | ✅ In binary (createScrapeDedupGuard) |

### NOT Actually Deployed (Previously Claimed)

| Guard | Experiment | Gym Result | Deployment Status |
|-------|-----------|-----------|-------------------|
| Completeness checklist (Optimizer) | EXP-115 | +100pp | ❌ Source file does not exist |
| Tool schema guard (Coach) | EXP-114 | Phase A designed | ❌ Source file does not exist |
| Verification-depth guard (Bob) | EXP-133 | NULL (measurement artifact) | ❌ Correctly not deployed |
| Path hallucination guard | — | — | ⚠️ Source exists but NOT in binary |

## Key Metrics

- **Gym ceiling**: 26 single-session + 7 multi-session scenarios ALL at 100%. Need fundamentally harder challenges.
- **Knowledge entries**: 138+ in shared/knowledge/. Most untested in production.
- **Experiments completed**: EXP-001 through EXP-136.
- **Research-to-production conversion rate**: ~3% (4 guards deployed out of ~115 experiments)
- **Behavioral interventions in production**: **0** (all 4 deployed guards are infrastructure)
