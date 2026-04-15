# Finding: Workflow Health Check — Apr 15, 2026

**Date**: 2026-04-15  
**Mode**: D (Workflow Health)  
**Analyst**: optimizer  

## Executive Summary

Workflow adoption (measured by `workflowRunId` presence) is **9.7% system-wide (48h)** — a significant regression from the Apr 12 peak of **27.3%**. The previous Apr 14 report claiming "70% adoption" used a different, inflated metric. This finding corrects the measurement methodology and establishes accurate baselines.

## ⚠️ Measurement Methodology Correction

**Previous reports (Apr 14) claimed 60-70% workflow adoption.** This was based on an inflated definition — likely counting any session with `kind` set (which is 100% of sessions, since all are `job` or `call`). The accurate metric is `workflowRunId IS NOT NULL`, which tracks sessions actually spawned by `workflow.run()`.

| Metric | Apr 13 Value | Correct Interpretation |
|--------|-------------|----------------------|
| `kind IS NOT NULL` | 506/506 = 100% | Every session has a kind — meaningless |
| `[WORK SESSION]` tag | 307/506 = 61% | Task formatting convention, not workflow usage |
| `workflowRunId` present | 34/506 = **6.7%** | **Actual workflow-managed sessions** |

**Conclusion**: Previous "70% adoption" reports were measurement artifacts. Real adoption never exceeded ~27%.

## True Workflow Adoption Trend (7-day)

| Date | Workflow Sessions | Total | Rate | Notes |
|------|------------------|-------|------|-------|
| Apr 08 | 0 | 231 | 0.0% | Pre-workflow |
| Apr 09 | 60 | 575 | 10.4% | Initial deployment |
| Apr 10 | 45 | 528 | 8.5% | Slight dip |
| Apr 11 | 87 | 581 | **15.0%** | Enforcement push |
| Apr 12 | 157 | 576 | **27.3%** | Peak adoption |
| Apr 13 | 34 | 506 | **6.7%** | Sharp regression |
| Apr 14 | 80 | 604 | 13.2% | Partial recovery |
| Apr 15 | 10 | 66 | 15.2% | Early data |

**Pattern**: Apr 12 surge was likely driven by a specific deployment/enforcement event. Apr 13 drop suggests it wasn't sustained organically. Apr 14-15 settling around 13-15%.

## 24h Trend (Last 24h vs Previous 24h)

| Period | Workflow | Total | Rate |
|--------|----------|-------|------|
| Last 24h | 79 | 473 | **16.7%** |
| Previous 24h | 26 | 614 | **4.2%** |

The last 24h shows improvement over previous 24h, suggesting partial recovery.

## Per-Agent Adoption (Last 48h)

| Agent | Total | Workflow | Rate | Trend |
|-------|-------|----------|------|-------|
| **Coder** | 18 | 13 | **72.2%** | ✅ Highest — coder sessions are mostly workflow-spawned |
| **Bob** | 147 | 35 | **23.8%** | 🟡 Down from Apr 12 peak (~68%) |
| **Optimizer** | 154 | 33 | **21.4%** | 🟡 Stable |
| **Coach** | 168 | 19 | **11.3%** | 🟡 Low but improving (was 0% pre-Apr 14) |
| **Scout** | 90 | 3 | **3.3%** | 🔴 Near zero |
| **QA** | 78 | 2 | **2.6%** | 🔴 Near zero |
| **Tech-lead** | 152 | 0 | **0.0%** | 🔴 Zero despite being D-o-R target |
| **Evaluator** | 187 | 0 | **0.0%** | ⚪ By design (evaluator doesn't use workflows) |
| **May** | 93 | 0 | **0.0%** | ⚪ By design (orchestrator) |

### Key Findings
- **Tech-lead at 0%**: Despite D-o-R deployment effort, tech-lead has zero workflowRunId sessions. Its Lens sessions (199 in 72h, avg 13.9 ops) run as direct forks, not workflow-managed. This confirms KE-020: "building a feature doesn't mean agents will use it."
- **Coach newly adopted**: 19 workflow sessions in 48h — all appear to be coach-specific workflows (EXP design, coaching feedback).
- **Bob is the heaviest workflow user** by absolute count (35 sessions), mostly research thread workflows.

## Op Count Analysis

### Workflow vs Non-Workflow (done sessions, 48h)

| Type | Count | Avg Ops | Min | Max |
|------|-------|---------|-----|-----|
| Workflow | 100 | **21.8** | 2 | 93 |
| Non-workflow | 883 | **10.8** | 0 | 182 |

Workflow sessions average 2x the ops of non-workflow. This is a **selection effect** — workflows are used for complex tasks — not overhead.

### System-wide Op Percentiles (done sessions, 48h)

| P50 | P75 | P90 | P95 | Max |
|-----|-----|-----|-----|-----|
| 7 | 14 | 29 | 39 | 182 |

## Verify-Wrap Adoption

33 verify-wrap sessions in 48h across: coach (9), coder (8), optimizer (7), bob (5), qa (1), scout (1). Average ops: ~13. This is the most consistently used workflow pattern.

## Error & Interruption Health

| Status | Count (48h) |
|--------|-------------|
| Done | 983 (90.4%) |
| Interrupted | 99 (9.1%) |
| Error | 2 (0.2%) |
| Running | 2 |

- Only 2 errors — both auth token expiry (transient infra), not workflow-related.
- Interruption rate (9.1%) is normal — mainly QA (21), May (20), Coach (20).

## D-o-R Budget Cap Assessment

Cannot directly measure P1 budget caps — `kind='p1'` returns 0 sessions in 48h, suggesting D-o-R priority tagging is not being applied. The D-o-R workflow was deployed but the priority classification isn't flowing through to session metadata.

## Conclusions & Recommendations

1. **Measurement correction needed**: Previous "70% adoption" was inflated. Real adoption is ~15%. All future reports should use `workflowRunId` as the canonical metric.
2. **Apr 12 peak was not sustained**: Adoption dropped from 27.3% → 6.7% → 13.2%. The initial surge was likely driven by explicit enforcement, not organic adoption.
3. **Tech-lead wiring gap**: Zero workflow sessions despite D-o-R deployment. The Lens sessions dispatch via `agents.fork`, bypassing workflow tracking. Needs explicit wiring fix.
4. **Verify-wrap is the success story**: 33 sessions across 6 agents — this is the most adopted workflow pattern and should be the model for future workflow design.
5. **D-o-R priority tagging not flowing**: P1 kind tag not appearing in session metadata. Either the tagging isn't deployed or it's being overwritten.

## Action Items

- [ ] Fix tech-lead Lens session dispatch to use `workflow.run()` instead of `agents.fork()` — this alone would add ~60+ workflow sessions/day
- [ ] Correct measurement methodology in future Mode D reports — use `workflowRunId` only
- [ ] Investigate why D-o-R priority tagging (`kind='p1'`) isn't appearing in session metadata
- [ ] Consider verify-wrap as the template for new workflow patterns (small, focused, high adoption)
