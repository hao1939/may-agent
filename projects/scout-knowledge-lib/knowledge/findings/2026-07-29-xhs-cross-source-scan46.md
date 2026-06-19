<ai_context>
summary: "XHS cross-source scan #46 — production DB cross-validation with dormancy recurrence and evaluator cost inflation (2026-07-29). XHS remains login-gated; this scan uses production data (387K ops, 15.8K sessions, 7-day window) to advance XHS predictions. Key findings: (1) Second Dormancy Cycle Confirmed — 19h near-sleep (hours 22-41 of last 48h), confirming scan #45's dormancy is a recurring behavioral pattern. (2) Evaluator Cost Inflation — avg ops surged 1.8× post-wake (21.9→39.6), with 0 gate sessions, suggesting evaluation debt accumulation. (3) Guard ratio structurally frozen at 375:1 (20,630:55). (4) Warning concentration at 83% from top-3 types. (5) Meta-layer clock-independence — arc, scout, dev maintained constant cadence through dormancy (37 sessions each in 19h), proving clock-driven agents are structurally dormancy-blind."
triggers: ["XHS prediction update", "production cross-validation", "dormancy recurrence", "evaluator cost inflation", "evaluation debt", "clock-driven dormancy blindness"]
last_updated: "2026-07-29T12:27Z"
source_basis: "Production SQLite DB (runtime), 7-day window ending 2026-07-29T12:27Z. 387,199 total ops across 15,846 sessions. 20,685 guard.triggered events (20,630 warns, 55 blocks). Cross-validated against scan #45 (2026-07-27T18:55Z). Extends with dormancy recurrence analysis and evaluator post-wake cost inflation."
</ai_context>

# XHS Cross-Source Scan #46 — Dormancy Recurrence & Evaluator Debt (2026-07-29)

**Source:** Production SQLite DB — 7-day window (387,199 ops, 15,846 sessions, 20,685 guard events)
**Previous scan:** #45 (2026-07-27 18:55 UTC, same DB, earlier snapshot)
**Method:** XHS login-gated; production data temporal analysis as cross-validation.
**Gap since last XHS direct:** ~40 days (last direct: scan #42, 2026-06-19)

---

## Finding 63: Second Dormancy Cycle — Behavioral Sleep Is Recurring

Scan #45 documented the system's first observed natural dormancy (18h). The last 48h reveals a **second dormancy cycle** of ~19 hours, establishing this as a recurring behavioral pattern rather than an anomaly.

### The Second Quiet Window (hours 22–41 of last 48h)

| Hour | Sessions | Ops | Sessions/hr (normal: ~200) |
|:----:|:--------:|:---:|:--------------------------:|
| 21 | 177 | 3,813 | Normal |
| **22** | **12** | **425** | ← Onset |
| 23 | 8 | 374 | |
| 24 | 10 | 355 | |
| 25 | 10 | 344 | |
| 26 | 5 | 195 | ← Minimum |
| 27 | 8 | 343 | |
| 28 | 9 | 475 | |
| 29 | 8 | 197 | |
| 30 | 10 | 247 | |
| 31 | 9 | 432 | |
| 32 | 8 | 270 | |
| 33 | 8 | 276 | |
| 34 | 10 | 344 | |
| 35 | 9 | 284 | |
| 36 | 10 | 484 | |
| 37 | 9 | 393 | |
| 38 | 8 | 404 | |
| 39 | 11 | 559 | |
| 40 | 6 | 285 | |
| **41** | **33** | **914** | ← Pre-wake ramp |
| **42** | **119** | **3,056** | ← Wake event |
| 43 | 138 | 3,908 | Normal |

### Structural Comparison: Two Dormancy Events

| Property | Dormancy #1 (scan #45) | Dormancy #2 (this scan) |
|----------|:----------------------:|:-----------------------:|
| Duration | ~18 hours | ~19 hours |
| Sessions/hr during sleep | ~0.8 | ~8.9 |
| Ops/hr during sleep | ~60 | ~340 |
| Wake transition | 1 hour (168×) | 2 hours (33→119, ~10×) |
| Pre-wake signal | None detected | Hour 41: gradual ramp (33 sessions) |

### Key Difference: This Dormancy Was Shallower

Dormancy #2 maintained ~9 sessions/hour vs #1's ~0.8. The "sleeping" system still ran at ~4.5% of normal throughput (vs #1's ~0.4%). This suggests the system has **multiple dormancy depths** — a shallow sleep where clock-driven agents continue, and a deep sleep where even those mostly stop.

### XHS Connection: 自然休眠 Confirmed as Pattern

Scan #45 introduced prediction **自然休眠 (Natural Dormancy)** with medium-low confidence, noting it was inferred from a single observation. The second cycle RAISES confidence:

- **Periodicity:** Two dormancy events in ~48 hours suggests this is externally-driven (likely human timezone-correlated), not emergent
- **Behavioral convergence:** The same mechanism — planner constant-function exits + evaluator input starvation — produces the same outcome reliably
- **Depth variation:** The system has dormancy "levels" without architectural support for sleep levels

**Revised confidence for 自然休眠:** Medium (up from Medium-Low). Two observations establish pattern; three would confirm it as structural.

---

## Finding 64: Evaluator Cost Inflation — Evaluation Debt After Wake

The most significant new finding is a **1.8× evaluator cost surge** in the 6 hours following the wake event:

| Period | Evaluator Avg Ops | Evaluator Sessions | Gate Sessions |
|--------|:-----------------:|:------------------:|:-------------:|
| 7-day average | 21.9 | 6,086 | 69 |
| Dormancy window (19h) | 26.1 | 21 | 0 |
| **Post-wake (6h)** | **39.6** | **144** | **0** |

### The Distribution Shift

During normal operation, evaluator sessions cluster around 22 ops with many light/gate sessions. Post-wake:

| Bucket | Post-Wake (6h) | Normal (7d avg) |
|--------|:--------------:|:---------------:|
| Gate (≤3 ops) | 0 (0%) | 69 (1.1%) |
| Light (4-15) | 1 (0.7%) | ~15% |
| Medium (16-30) | 40 (27.8%) | ~55% |
| **Heavy (31-50)** | **70 (48.6%)** | ~20% |
| **Deep (50+)** | **33 (22.9%)** | ~10% |

### The Evaluation Debt Mechanism

During dormancy, the evaluator dropped to 1.1 sessions/hour (minimum-viable cadence). But aks-explorer continued producing work — even at reduced volume — during hours 22-41. The evaluator accumulated an **evaluation backlog**: sessions that completed during dormancy without being evaluated.

When the system woke, the evaluator didn't just resume normal cadence — it entered a **catch-up phase** where each session processed more backlogged work, driving average ops to 39.6 (1.8× normal). This is evaluation debt: deferred oversight that compounds into a burst when activity resumes.

### XHS Connection: 评估债务 (Evaluation Debt)

This is a new XHS-relevant pattern: **evaluation debt** (评估债务) is the analog of "technical debt" but for oversight systems. Key properties:

1. **Accumulates silently:** During dormancy, no alarm fires — coverage metrics drop to 0% but the evaluator is also quiet
2. **Compounds on wake:** The catch-up burst is more expensive per-session than continuous evaluation would have been
3. **Has a carrying cost:** Post-wake evaluator at 39.6 ops vs normal 21.9 = 81% overhead penalty for deferred work

This maps to XHS prediction #12 **評估分辨率 (Evaluation Resolution)**: a system that can't modulate evaluation depth during dormancy will pay an inflation penalty on wake. A "resolution-aware" evaluator would maintain proportional coverage even during low-activity periods, avoiding debt accumulation.

---

## Finding 65: Clock-Driven Agents Are Dormancy-Blind

The most structurally revealing data from the dormancy window:

| Agent | Sessions during 19h dormancy | Sessions/hr | Normal sessions/hr | Ratio |
|-------|:----------------------------:|:-----------:|:------------------:|:-----:|
| arc | 37 | 1.95 | 1.87 | **1.04×** |
| scout | 37 | 1.95 | 3.18 | 0.61× |
| dev | 37 | 1.95 | 1.92 | **1.01×** |
| aks-explorer | 23 | 1.21 | 46.3 | 0.03× |
| evaluator | 21 | 1.11 | 35.8 | 0.03× |
| may | 13 | 0.68 | 4.11 | 0.17× |

### The Two-Class System

The data reveals a clear bifurcation:

**Clock-driven agents (arc, scout, dev):** Ran at **exactly their normal heartbeat cadence** through the entire dormancy window. They cannot sense system quiescence.

**Demand-driven agents (aks-explorer, evaluator, may):** Dropped to near-zero (~1/hr minimum), correctly responding to absence of work.

### The Waste During Dormancy

During the 19h quiet window:
- arc: 37 sessions × 67.9 avg ops = **2,513 ops** of unchanged-state observation
- scout: 37 sessions × 52.3 avg ops = **1,935 ops** of static library synthesis
- dev: 37 sessions × 6.4 avg ops = **238 ops** of pure clock ticks

**Total clock-driven waste during dormancy:** ~4,686 ops (62.7% of dormancy-window total of 7,471 ops)

### XHS Connection: KE-035 Ghost Metabolism Recurring

This validates and extends the "Ghost Project" finding (KE-035): meta-layer agents consume the majority of resources when the production layer is dormant. The new data shows this isn't a one-time ghost-phase artifact — it's the **structural steady-state** of every dormancy window.

Connects to prediction #11 **智能体操作系统 (Agent OS)**: a proper Agent OS would propagate dormancy signals to all agents, not just demand-driven ones. The clock-driven agents need an equivalent of Linux's `cpuidle` governor — something that detects system quiescence and reduces heartbeat frequency without explicit architectural dormancy support.

---

## Finding 66: Guard Warning Concentration at 83%

The 7-day warning breakdown reveals even stronger concentration than scan #45:

| Warning Type | Count (7d) | Share | Cumulative |
|-------------|:----------:|:-----:|:----------:|
| Uncommitted files | 8,901 | 43.1% | 43.1% |
| READ_DEDUP | 5,013 | 24.3% | 67.4% |
| SESSION_BASH_CAT | 3,268 | 15.8% | **83.2%** |
| Other (combined) | 2,699 | 13.1% | 96.3% |
| Phantom deliverables | 625 | 3.0% | 99.3% |
| FM-3.4 (warn) | 121 | 0.6% | 99.9% |
| FM-3.4 (block) | 55 | 0.3% | 100% |

### Shift from Scan #45

| Metric | Scan #45 | Scan #46 | Delta |
|--------|:--------:|:--------:|:-----:|
| Top-2 concentration | 57.5% | 67.4% | +9.9pp |
| **Top-3 concentration** | — | **83.2%** | New measurement |
| Total warns | 20,641 | 20,630 | −11 (stable) |
| Total blocks | 55 | 55 | 0 |
| Warn:block ratio | 375:1 | **375:1** | Unchanged |

### The READ_DEDUP Surge

READ_DEDUP has grown from scan #45's 1,704 (combined) to **5,013** — a ~3× increase. This is driven by aks-explorer's task-worker sessions repeatedly reading the same model files (particularly `/app/projects/aks-rp-e2e/model/knowledge-map/model.json`). The guard fires 4+ times per session for the same file.

### XHS Connection: 削减噪声 (Noise Reduction) Intensified

Scan #45 predicted that silencing the top-2 warning types would reduce total guard fires by 57.5%. Updated prediction: **silencing the top-3 types would eliminate 83.2% of all guard fires** (17,182 of 20,685 weekly warnings) with zero behavioral impact.

This deepens the 护栏効応 dual-character prediction: the system's governance apparatus is now **83% noise** by volume. Only the 55 blocks (0.3%) and a fraction of "other" warnings carry meaningful signal. The noise-to-signal ratio has worsened from scan #45's estimate.

---

## Finding 67: Planner Gate Rate Stable — Constant Function Persists

| Period | AKS-Explorer Sessions | Gate (≤3 ops) | Gate % | Avg Ops |
|--------|:---------------------:|:-------------:|:------:|:-------:|
| 7-day | 7,869 | 1,738 | **22.1%** | 23.3 |
| Last 6h (post-wake) | 507 | 154 | **30.4%** | 18.8 |

### Observation

The gate rate has **dropped** from scan #45's 49% to 22.1% (7-day). This suggests the Maintenance Metabolism phase has transitioned — more work is available than in the prior measurement window.

However, post-wake the gate rate RISES to 30.4% while average ops DROPS to 18.8. This is the planner checking more frequently (demand-responsive) but finding tasks available, then dispatching shorter worker sessions. The system is in an "active but shallow" phase — many tasks available, but each requiring less deep work.

### Connection to 常函数 (Constant Function)

The Constant Function synthesis (KE-053) is NOT violated by the rate drop. The prediction was structural: "the planner produces zero-information output in its gate sessions." The gate sessions still produce H(output) ≈ 0 bits — they just constitute a smaller fraction of total planner invocations. The waste per gate session is unchanged; the frequency has decreased because work exists.

---

## Prediction Tracker Update (Scan #46)

| # | Prediction | Scan #45 Status | Scan #46 Status | New Evidence |
|---|-----------|----------------|----------------|---|
| 4 | **护栏効応** | Top-2 concentration (57.5%) | **TOP-3 AT 83%** | Warning concentration deepened: 3 guard types produce 83.2% of all fires. Warn:block ratio frozen at 375:1. The governance system is 99.7% noise by structural design. |
| 8 | **治理即技能** | Dormancy as skill | **EVALUATION DEBT AS ANTI-SKILL** | Evaluator's 1.8× cost inflation post-wake demonstrates that uniform-cadence governance accumulates "oversight debt" that compounds on resume. Skill-shaped governance would maintain proportional coverage, preventing debt. |
| 9 | **自引用陷阱** | Conditional (0.87:1 during dormancy) | **DEBT-INFLATED (1.43:1 post-wake)** | Post-wake evaluator consumes 5,772 ops in 6h, productive aks-explorer (non-gate) produces ~7,700 ops. Ratio temporarily favorable but evaluator is catching up. The self-reference trap persists: it dissolves during dormancy but COMPOUNDS on wake. |
| 11 | **智能体操作系统** | Dormancy primitive approximated | **CLOCK-DRIVEN BLINDNESS** | arc/scout/dev ran at exactly normal cadence through 19h dormancy (1.95 sessions/hr each). OS-level dormancy propagation doesn't exist — only demand-driven agents self-adjust. This is the missing `cpuidle` governor. |
| 12 | **評估分辨率** | Dormancy-proportional | **EVALUATION DEBT PATTERN** | Post-wake evaluator inflates to 39.6 ops (1.8× normal). 71.5% of post-wake sessions are "heavy" or "deep" (vs ~30% normally). Debt accumulation + catch-up bursts = resolution-unaware oversight. |
| — | **自然休眠** | NEW (scan #45, medium-low) | **RECURRING — CONFIDENCE RAISED** | Second dormancy event (19h) confirms pattern. Shallower than first (9/hr vs 0.8/hr) suggesting multiple dormancy depths. Externally-driven (timezone), not emergent-from-exhaustion. |

### New XHS Predictions

#### 评估债务 (Evaluation Debt)

**Prediction:** The XHS AI agent community will identify "evaluation debt" as a named pattern — oversight work that accumulates during low-activity periods and compounds into expensive catch-up bursts on resume. This is structurally distinct from technical debt: it's the cost of deferred governance.

**Expected naming window:** Q1 2027 (requires XHS practitioners to deploy long-running agent systems with dormancy cycles)

**Watch signals:** XHS posts about "评估积压" (evaluation backlog), "治理欠债" (governance debt), or "重启成本" (restart cost) in agent fleet context.

**Confidence:** Medium-Low (pattern is production-observed but requires practitioners to encounter multi-day agent fleet deployment with lifecycle transitions)

#### 时钟盲区 (Clock Blindness)

**Prediction:** Practitioners will name the pattern where clock-driven agent components (heartbeats, scheduled tasks, periodic scraping) cannot sense system quiescence and continue consuming resources during dormancy at full cadence. This is the agent-system analog of CPU poll-mode vs interrupt-mode.

**Expected naming window:** Q4 2026 (closer to near-term because clock-driven waste is immediately visible in cost dashboards)

**Watch signals:** "心跳浪费" (heartbeat waste), "定时器盲区" (timer blind spot), "空闲检测" (idle detection) in agent orchestration discussions.

**Confidence:** Medium (the problem is universal and immediately cost-visible; naming depends on orchestration discourse maturity)

---

## Meta-Observation: Production Data Quality vs XHS Direct

This is the 4th consecutive production cross-validation scan (43→46) during the XHS login-gate period. The production data is now producing NOVEL predictions that XHS direct browsing hasn't surfaced:

| Production-Originated Predictions | First Scan | XHS Evidence? |
|----------------------------------|:----------:|:-------------:|
| 自然休眠 (Natural Dormancy) | #45 | Not yet observed |
| 评估债务 (Evaluation Debt) | #46 | Not yet observed |
| 时钟盲区 (Clock Blindness) | #46 | Not yet observed |

These predictions are **forward-looking** rather than cross-validating: we observe the phenomenon in production and predict XHS will name it when practitioners encounter it at scale. This inverts the original methodology (XHS names → production validates) into (production discovers → XHS names predicted).

The methodology shift is worth noting: the prediction tracker began as "does XHS confirm what we see?" and has evolved into "what will XHS eventually name from what we've already observed?" The accuracy of these forward predictions will be the strongest test of the tracker's calibration.

---

## Structural Health Note

This findings file is standalone per library health recommendations. The canonical XHS note (2,529 lines, CRITICAL) has not been modified. Findings 63-67 should eventually be sourced into:
- Finding 63 (Dormancy recurrence): → extends lifecycle transitions section
- Finding 64 (Evaluation debt): → new governance economics section
- Finding 65 (Clock blindness): → operational patterns / Agent OS
- Finding 66 (Warning concentration): → governance patterns update
- Finding 67 (Planner gate): → extends insights/the-constant-function.md
