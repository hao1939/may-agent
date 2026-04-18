# Workflow Health — 24h Trend + D-o-R Cost Check (Apr 13, 23:22 UTC)

## 1. Workflow Adoption Rates

### System-Wide
| Metric | Apr 12 | Apr 13 (24h) | Δ |
|--------|--------|--------------|---|
| Workflow sessions | 223 | 115 | — |
| Non-workflow sessions | 40 | 60 | — |
| **System adoption** | **84.8%** | **65.7%** | **−19.1pp** ⚠️ |

### Per-Agent Breakdown (24h ending Apr 13 23:22 UTC)

| Agent | WF | Non-WF | HB | Adoption | Apr 12 | Δ |
|-------|-----|--------|-----|----------|--------|---|
| bob | 28 | 8 | 37 | **77.8%** | 77.2% | +0.6pp |
| coach | 19 | 11 | 38 | **63.3%** | 85.7% | −22.4pp ⚠️ |
| coder | 0 | 7 | 0 | **0.0%** | 0.0% | — |
| evaluator | 1 | 0 | 38 | **100%** | 0.0% | +100pp |
| may | 5 | 2 | 38 | **71.4%** | 92.9% | −21.5pp ⚠️ |
| optimizer | 42 | 4 | 38 | **91.3%** | 100% | −8.7pp |
| qa | 0 | 0 | 38 | N/A | N/A | — |
| scout | 0 | 1 | 37 | **0.0%** | N/A | — |
| tech-lead | 20 | 27 | 37 | **42.6%** | 85.1% | −42.5pp ⚠️ |

### Analysis
System adoption **dropped from 84.8% → 65.7%** (−19.1pp). Three agents regressed significantly:
- **tech-lead −42.5pp** — now has 27 non-workflow sessions (more non-WF than WF). This is the primary driver.
- **coach −22.4pp** — 11 non-WF sessions appeared.
- **may −21.5pp** — small sample (7 work sessions), so variance is expected.

Bob remained stable at ~77-78%. Optimizer stable at 91%.

## 2. D-o-R Phase 1 Budget Cap Compliance

### All Agents Combined
| Metric | Apr 12 | Apr 13 (24h) | Δ |
|--------|--------|--------------|---|
| P1 sessions | 27 | 41 | +52% volume |
| Compliance (≤15 ops) | 81.5% | **95.1%** | **+13.6pp** ✅ |
| Avg P1 ops | 11.9 | **8.2** | **−31%** ✅ |

D-o-R P1 budget cap is **strengthening**. The Apr 12 measurement (earlier report: 90.5%) has been refined with full-day data to 81.5%. Today's 95.1% is a clear improvement. Average P1 ops dropped from 11.9 → 8.2.

### Bob-Specific P1
| Metric | Value |
|--------|-------|
| P1 sessions | 13 |
| Compliance (≤15) | 69.2% (9/13) |
| Avg ops | 16.8 |
| Outliers | 81 ops (EXP-152 P2 design), 38 ops, 19 ops, 17 ops |

Bob's P1 compliance (69.2%) is notably lower than system average (95.1%). The **81-op outlier** was a complex experiment design task (EXP-152 Phase 2 design) that blew through the budget. Three other violations (17, 19, 38 ops) suggest bob's P1 discipline regressed from the earlier 90.5% measurement.

## 3. Parallel-Research Cost Trend

### Bob Research Synthesis Sessions (non-heartbeat)
| Metric | Apr 12 | Apr 13 (24h) | Δ |
|--------|--------|--------------|---|
| Sessions | 44 | 10 | −77% volume |
| Avg ops | 16.8 | **10.3** | **−39%** ✅ |
| Max ops | 113 | 35 | −69% ✅ |
| ≤15 budget compliance | — | 80.0% (8/10) | — |

The parallel-research cost is **significantly improved**. Previous measurement showed 67.2 avg ops/run (pre-fix). The trajectory:
- **Pre-fix baseline**: 67.2 avg ops
- **Apr 12 (post-fix)**: 16.8 avg ops (75% reduction)
- **Apr 13**: 10.3 avg ops (85% reduction from baseline)

The 113-op outlier from Apr 12 (01:32 UTC — guard internalization synthesis) has not recurred. Today's max is 35 ops (EXP-151 results processing), which is within reasonable bounds for a complex research integration.

### Optimizer Mode Session Costs
| Mode | n | Avg ops | Max | Min |
|------|---|---------|-----|-----|
| A | 20 | 17.6 | 63 | 5 |
| B | 8 | 31.4 | 40 | 18 |
| C | 8 | 22.4 | 40 | 7 |
| D | 8 | 16.0 | 21 | 12 |

Optimizer Mode compliance (≤15 ops): **43.2%** (19/44). Mode B is the most expensive (31.4 avg, never under 18). Mode A has a 63-op outlier. This is the **optimizer's own D-o-R** — not the system-wide P1 budget cap.

## 4. Comparison Table — All Metrics

| Metric | Apr 12 Baseline | Apr 13 Current | Trend |
|--------|----------------|----------------|-------|
| System WF adoption | 84.8% | 65.7% | ⚠️ −19.1pp |
| Bob WF adoption | 77.2% | 77.8% | ✅ Stable |
| Optimizer WF adoption | 100% | 91.3% | ↓ Slight drop |
| Tech-lead WF adoption | 85.1% | 42.6% | 🔴 Major drop |
| Coach WF adoption | 85.7% | 63.3% | ⚠️ −22pp |
| D-o-R P1 compliance (all) | 81.5% | 95.1% | ✅ +13.6pp |
| D-o-R P1 avg ops (all) | 11.9 | 8.2 | ✅ −31% |
| Bob P1 compliance | ~90.5%* | 69.2% | ⚠️ −21pp |
| Bob research avg ops | 16.8 | 10.3 | ✅ −39% |
| Daily total ops | 8,055 | 6,324 | ✅ −21% |
| Daily sessions | 559 | 476 | ↓ |
| Daily avg ops/session | 14.4 | 13.3 | ✅ −8% |

*Apr 12 bob P1 measurement from earlier snapshot (21 sessions); full-day recalculation shows 81.5% system-wide.

## 5. Anomalies & Regressions

### 🔴 Tech-Lead Adoption Collapse (42.6%, −42.5pp)
Tech-lead went from 85.1% → 42.6% workflow adoption. 27 non-workflow sessions in 24h vs 20 workflow sessions. This is the **single largest regression** in the system and the primary driver of system-wide adoption decline. Needs investigation — are these coder dispatches being classified as non-workflow? Or has tech-lead stopped using workflows for some task types?

### ⚠️ Bob P1 81-op Violation
An EXP-152 Phase 2 design task consumed 81 ops in Phase 1. This is 5.4× the budget. Complex experiment designs may need a different budget or a separate workflow that doesn't route through D-o-R P1.

### ⚠️ Optimizer Mode B Consistently Over-Budget
All 8 Mode B sessions exceeded 15 ops (min 18, max 40, avg 31.4). Mode B (Tool Gap Analysis) inherently requires more reading/analysis than the 15-op target allows. Consider either: (a) raising Mode B budget to 25 ops, or (b) restructuring Mode B to use a two-phase approach.

### ✅ Daily Ops Continue Declining
Daily ops trend: 8,962 → 8,055 → 6,324 (Apr 11 → 12 → 13). 21% reduction day-over-day. The efficiency improvements are compounding.

---

*Measurement window: 24h ending Apr 13 23:22 UTC. Data source: .state/may.db sessions table.*
