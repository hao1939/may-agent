# Context-Discovery Gap Investigation: API 100% → Gym 10%

**Date**: 2026-05-28  
**Investigator**: Orchestrator (responding to Hao P1, aged 3 days)  
**Status**: Investigation complete. Fix deployed but unverified in production.

---

## Executive Summary

The gap is **real but already partially addressed**. Three root causes explain why breadcrumbs work at the raw LLM API level but fail in the gym/production environment. Two of three are fixed in code; production validation is pending.

| Root Cause | Severity | Status |
|---|---|---|
| 1. Task structure buries metrics below dispatch steps | **PRIMARY** | ✅ Fixed (G-pattern deployed to all 8 heartbeat workflows) |
| 2. Production metric lines lacked actionable breadcrumb trails | HIGH | ✅ Fixed (loadMetrics now injects `→ Quick check` hints) |
| 3. Measurement script was deeply flawed (inflated/deflated rates) | MEDIUM | ✅ Fixed (rewrote to use point-in-time metric_snapshots) |

**Current state**: Production metric `coach.breadcrumb-action-rate` reads ~0.30 but this is polluted by pre-fix sessions in the 7-day window. Insufficient post-fix data exists to validate the fix works in production (most agents have healthy metrics → G-pattern rarely triggers).

---

## 1. WHY It Works at API Level but Not in Gym/Production

### Bottom-Up Isolation Results

The coach team ran a rigorous isolation study across 4 experimental arms in gym:

| Layer | Variant | Pass Rate | n |
|---|---|---|---|
| **Raw prompt** (just metric + breadcrumb, no task structure) | Direct API call | ~100% | (Hao's claim) |
| **Gym: bare metric, no breadcrumb** | metric-reaction (A) | **0%** | 4 |
| **Gym: metric + breadcrumb, standard task structure** | metric-reaction-breadcrumb (H) | **10%** initially, **80%** with improved breadcrumbs | 5 |
| **Gym: metric + step-1 question framing** | metric-reaction-G | **100%** | 5 |
| **Gym: metric + breadcrumb + step-1 question** | metric-reaction-G-breadcrumb | **100%** | 5 |

### The Three Failure Mechanisms

**Mechanism 1: Sequential Step Following (PRIMARY)**

LLMs follow numbered steps sequentially. In the gym heartbeat task, the steps were:

```
1. Read the dispatch board items above.
2. Pick ONE item and produce a write-up in triage-note.md.
3. Call finish().
```

Metrics appeared *above* these steps as passive context. The agent read them, noted them, then followed step 1 → step 2 → step 3 without ever circling back to investigate the breached metric. At the raw API level there are no competing numbered steps — the metric IS the task.

**Fix**: The G-pattern makes metric evaluation step 1:
```
## ⚡ FIRST — evaluate your red metrics before anything else
**Question**: Which metric is furthest from target? Follow the "→ Quick check" breadcrumb NOW.
```

**Mechanism 2: Breadcrumbs Without Next Actions Are Noise**

The original gym breadcrumb (variant H at 10%) had weak breadcrumbs — descriptive text rather than executable commands. When breadcrumbs contained concrete next-step commands (`→ Quick check: read environment/stuck-requests.json for breakdown`), the rate jumped to 80% even without the G-pattern.

In production, the metric lines had `⚠️ BELOW TARGET` flags but no `→ Quick check` trail pointing to a concrete investigation command. The agent saw "metric bad" but had no first move.

**Fix**: `loadMetrics()` in each heartbeat workflow now pulls `source_query`/`source_command` from the DB and appends actionable breadcrumbs to breached metrics.

**Mechanism 3: Measurement Artifact**

The measurement script (`measure-breadcrumb-action-rate.sh`) had three bugs that produced unreliable numbers:
- `task LIKE "%⚠️%"` matched non-breadcrumb sessions (self-reference warnings in heartbeat.md)
- Used current metric values retroactively for historical sessions
- Broad action patterns (`/fix/i`, `/analyz/i`) counted any productive session as "acted on breadcrumb"

This made it impossible to track whether fixes were working.

---

## 2. The Fix (Already Deployed)

### Architecture

```
Production Heartbeat Session
│
├── loadMetrics() ─── pulls metrics from DB
│   └── For breached metrics: appends "→ Quick check: <source_command or source_query>"
│
├── G-Pattern Injection ─── if metrics contain "⚠️ BELOW TARGET":
│   └── Prepends "⚡ FIRST — evaluate your red metrics" question block
│
└── Regular heartbeat steps follow (dispatch board, projects, etc.)
```

### Files Changed

| File | Change |
|------|--------|
| `agents/*/workflows/*-heartbeat.ts` (8 files) | G-pattern + breadcrumb trail injection |
| `agents/coach/scripts/measure-breadcrumb-action-rate.sh` | Rewrote measurement with point-in-time accuracy |

### What's NOT Fixed

1. **Denominator problem**: Most agents currently have healthy metrics. The G-pattern only fires when `hasRedMetrics` is true. With no red metrics, there's nothing to measure.
2. **No coder heartbeat**: Coder has no heartbeat workflow, so it never gets G-pattern treatment.
3. **Stale breadcrumbs**: If `source_command`/`source_query` aren't maintained as metrics evolve, breadcrumbs become dead ends (identified as a risk in coach's analysis).

---

## 3. Project Plan with Metrics

### Phase 1: Validate Production Fix (1–2 weeks)
**Goal**: Confirm the deployed G-pattern + breadcrumb combination works in production.

| Task | Owner | Metric | Target |
|------|-------|--------|--------|
| Wait for 7-day measurement window to rotate out pre-fix sessions | Coach | `coach.breadcrumb-action-rate` | ≥ 0.80 |
| Spot-check post-fix heartbeat sessions with ⚠️ metrics | Coach | Manual review: n ≥ 5 post-fix sessions | 4/5 show investigative action |
| Ensure coach heartbeat completes (last one timed out) | May/Coach | Session completion rate | No timeouts |

**Success gate**: `breadcrumb-action-rate ≥ 0.50` with n ≥ 5 post-fix observations.

### Phase 2: Expand Coverage (2–4 weeks)
**Goal**: Ensure breadcrumbs fire for more agents and scenarios.

| Task | Owner | Metric | Target |
|------|-------|--------|--------|
| Add coder heartbeat workflow with G-pattern | Tech-lead | Coder has heartbeat | Exists |
| Ensure all metrics have `source_command` or `source_query` | Coach/May | % of metrics with breadcrumb source | ≥ 80% |
| Add synthetic below-target scenario to gym for regression testing | Coach | Gym `metric-reaction-production-heartbeat` pass rate | 100% |

### Phase 3: Sustain & Measure Impact (ongoing)
**Goal**: Breadcrumbs become standard operating procedure.

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| `coach.breadcrumb-action-rate` | 0.30 (stale) | ≥ 0.80 | Weekly via measurement script |
| % of ⚠️ heartbeats where agent follows breadcrumb trail | Unknown | ≥ 80% | Session transcript review |
| Time-to-investigation after metric breach | Unknown | < 1 heartbeat cycle | metric_snapshots + session timestamps |

### Key Risk: Low-N Problem

The biggest risk to this plan is not technical — it's statistical. The G-pattern only fires when agents have below-target metrics. In a healthy system, that's rare. Options:
1. **Accept low N** — measure over longer windows (30 days instead of 7)
2. **Seed test metrics** — temporarily inject a below-target metric for one agent to generate measurement data
3. **Use gym as proxy** — maintain gym regression scenarios that simulate the production path

### Timeline

```
Week 0 (now):     Fix deployed, waiting for data
Week 1-2:         Phase 1 validation (need ≥5 post-fix observations)
Week 2-4:         Phase 2 coverage expansion
Week 4+:          Phase 3 steady-state monitoring
```

---

## Appendix: Experiment Genealogy

| Experiment | Finding | Relevance |
|---|---|---|
| metric-reaction (A) | 0% — agents ignore bare metrics | Baseline |
| metric-reaction-breadcrumb (H) | 10% → 80% (improved breadcrumb format) | Breadcrumb content matters |
| metric-reaction-G | 100% — step-1 question framing works | G-pattern is the key lever |
| metric-reaction-Gp-breadcrumb | 100% — combination works | Production design validated |
| EXP-189 | Observing G-pattern in production | Active, insufficient data |
| KE-215 | "Step-1 question → 100% reaction" | Theoretical foundation |
| KE-011 | "Passive knowledge is ignored" | Explains why bare breadcrumbs fail |
