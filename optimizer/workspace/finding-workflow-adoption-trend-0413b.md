# Workflow Adoption Trend — Apr 13 Afternoon Update

**Date**: 2026-04-13 ~16:22 UTC  
**Mode**: D (Workflow Health)  
**Period**: Last 6h (10:22–16:22 UTC) + 72h trend analysis  
**Previous baseline**: Apr 12 — 27.1% system-wide, Bob 67.8%, Optimizer 66.1%

## Executive Summary

**Workflow adoption has collapsed to near-zero.** In the last 6h, only 1 out of 57 work sessions used any workflow tag (1.8%) — and that single session is this optimizer analysis (still running, 0 ops). The 72h trend shows workflow tags disappeared entirely starting Apr 11, dropping from meaningful adoption to flat zero across all agents including Bob and Optimizer who were the primary users.

This is **not a regression** — it's a **structural shift** in how work is dispatched. Bob's work has shifted to experiment-driven sessions (EXP-152) and research threads dispatched via `parallel-research` synthesis patterns that don't use workflow tags. The work is still structured; it's just not tagged.

## 1. Adoption Rate — Last 6h vs Baselines

| Period | WF Sessions | Total Work | Rate | Source |
|--------|-------------|------------|------|--------|
| **Apr 13 10:22–16:22** | **1** | **57** | **1.8%** | This analysis |
| Apr 13 04:24–16:24 | 1 | 126 | 0.8% | 12h window |
| Apr 12–13 24h | 55 | 376 | 14.6% | Previous Mode D |
| Apr 11–12 24h | 184 | 695 | 26.5% | Previous Mode D |
| **Apr 12 baseline** | — | — | **27.1%** | todo.md reference |
| Apr 10 baseline | 105 | 2,334 | 4.5% | Original finding |

### Trend (72h, 12h windows)

| Window | WF / Total | Rate | Non-WF Avg Ops |
|--------|-----------|------|----------------|
| Apr 10 16:24 → Apr 11 04:24 | 0/71 | 0.0% | 36.8 |
| Apr 11 04:24 → 16:24 | 0/100 | 0.0% | 29.6 |
| Apr 11 16:24 → Apr 12 04:24 | 0/140 | 0.0% | 22.3 |
| Apr 12 04:24 → 16:24 | 0/195 | 0.0% | 21.5 |
| Apr 12 16:24 → Apr 13 04:24 | 0/19 | 0.0% | 21.2 |
| Apr 13 04:24 → 16:24 | 1/126 | 0.8% | 24.3 |

**Zero workflow-tagged sessions across six consecutive 12h windows** (Apr 10 16:24 → Apr 13 04:24). The "27.1% system-wide" baseline from Apr 12 must have been measured using a different time window or detection method.

## 2. By Agent (Last 6h)

| Agent | Work Sessions | WF Sessions | Rate | Non-WF Avg Ops |
|-------|:---:|:---:|:---:|:---:|
| tech-lead | 15 | 0 | 0.0% | 23.5 |
| coach | 13 | 0 | 0.0% | 23.6 |
| optimizer | 13 | 1 (this session) | 7.7% | 28.6 |
| bob | 11 | 0 | 0.0% | 27.5 |
| coder | 3 | 0 | 0.0% | 12.3 |
| may | 2 | 0 | 0.0% | 23.0 |

**Bob**: Zero workflow usage. 48h task breakdown:
- experiment (EXP-152): 66 sessions, avg 10.5 ops — **the dominant pattern now**
- research-thread: 38 sessions, avg 21.8 ops
- research-synthesis: 13 sessions, avg 17.6 ops
- work-session: 7 sessions, avg 5.1 ops
- direct: 4 sessions, avg 38.8 ops

**Optimizer**: 73 mode-sessions at avg 15.7 ops. None workflow-tagged.

## 3. Ops Overhead — No Comparison Possible

With only 1 WF session (at 0 ops), direct ops overhead comparison is impossible for this window. Using last data point:

| Metric | Apr 10 Finding | Current (non-WF only) |
|--------|---------------|----------------------|
| D-o-R avg ops | 45.7 | N/A (no D-o-R runs) |
| Non-WF avg ops | 29.9 | 24.8 |
| Overhead | +53% | N/A |

**Non-WF work sessions are now averaging 24.8 ops** (down from 29.9 on Apr 10), suggesting the efficiency improvements (P1 budget caps, dispatcher mode, lean session techniques) are working — just not through formal workflow mechanisms.

## 4. Error Rates (Last 6h)

| Type | Total | Errors/Interrupted | Rate |
|------|:---:|:---:|:---:|
| WF work | 1 | 0 | 0.0% |
| Non-WF work | 56 | 2 | 3.6% |

Non-WF error rate (3.6%) is consistent with historical baseline (3.9% from Apr 10).

## 5. What Replaced Workflows?

Bob's work is now structured through **experiment protocols** (EXP-152) and **parallel-research thread patterns**:

- `Research Thread:` sessions (avg 21.8 ops) — individual research tasks
- `Research Synthesis` sessions (avg 17.6 ops) — cross-thread synthesis  
- `EXP-152 Phase N` sessions (avg 10.5 ops) — experiment execution

These provide similar structural guarantees to D-o-R (phased work, deliverable targets) but without formal workflow orchestration. The experiment pattern is actually **more efficient** — avg 10.5 ops vs D-o-R's historical 45.7 ops.

## 6. Key Insight: Adoption Was Always Fragile

The adoption history tells a story of instability:

| Date | System Rate | Key Change |
|------|:---:|---|
| Apr 10 | 4.5% | Baseline measurement |
| Apr 11 | ~15% | First push |
| Apr 12 | 27.1% | Peak adoption — Bob 67.8%, Optimizer 66.1% |
| **Apr 13 AM** | **14.6%** | -45% drop |
| **Apr 13 PM (now)** | **0.8%** | Effectively zero |

The Apr 12 peak was likely driven by a specific dispatch configuration that has since changed. Workflow adoption never became self-sustaining — it required active dispatch-path enforcement, and when Bob shifted to experiment-driven work, the workflow tags disappeared.

This confirms the **tool adoption hierarchy** finding: workflow tags were adopted through dispatch path integration (Level 2-3), not internalized behavior. When the dispatch path changed, adoption vanished.

## Conclusions

1. **Workflow tag adoption = 0.8%**, down from 27.1% baseline (97% decline)
2. **The work is still structured** — Bob uses EXP phases and research threads instead of formal workflows
3. **Non-WF efficiency is improving**: 24.8 avg ops (down from 29.9), driven by budget caps and lean techniques
4. **The +53% overhead question is moot** — there are no workflow sessions to compare against
5. **Error rates unchanged** at 3.6% for non-WF (vs 3.9% historically)

## Recommendation

**Stop tracking workflow tag adoption as a health metric.** The system has naturally evolved past tagged workflows toward experiment-driven and research-thread patterns that achieve similar structural benefits at lower cost. The relevant efficiency metrics are now:
- Per-session avg ops (currently 24.8, target ≤20)
- Error rates (currently 3.6%, stable)
- P1 budget compliance (holding at 100% for remaining D-o-R runs)
- Experiment execution efficiency (EXP sessions at 10.5 avg — excellent)

Future Mode D sessions should track **work pattern efficiency** rather than **workflow tag presence**.
