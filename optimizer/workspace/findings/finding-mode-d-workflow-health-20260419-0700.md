# Mode D Finding: Workflow Health — 6h Scan (2026-04-19 07:00 UTC)

## Summary

53 workflow sessions across 31 workflow runs in the last 6 hours (01:04–07:04 UTC). Coach adoption **recovered dramatically** (4% → 45%). Scout still near-zero. Bob dipped slightly. Overall work-agent adoption improved from 46% to 44% (flat, but composition shifted positively).

## Adoption Rates

| Agent | WF Sessions | Total Sessions | WF Adoption % | Prior (01:00) |
|-------|-------------|----------------|---------------|---------------|
| bob | 17 | 27 | 63% | 74% ↓ |
| optimizer | 10 | 20 | 50% | 50% = |
| tech-lead | 8 | 17 | 47% | 52% ↓ |
| coach | 17 | 38 | 45% | 4% ↑↑↑ |
| scout | 1 | 10 | 10% | 0% ↑ |
| evaluator | 0 | 90 | 0% | 0% |
| may | 0 | 9 | 0% | 0% |
| qa | 0 | 9 | 0% | 0% |
| coder | 0 | 1 | 0% | n/a |

**Total work-agent adoption** (excl evaluator/may): 53/122 = **43%** (prior: 46%).

## Notable Changes from Prior (01:00 baseline)

1. **Coach adoption recovered** (4% → 45%): Massive recovery — 17 WF sessions out of 38 total. One large growth-cycle run (wr_1776579986373, 12 sessions, 49 ops) plus a smaller 4-session run. Coach is actively using workflows again.

2. **Scout marginally recovered** (0% → 10%): 1 WF session out of 10. A single 19-op workflow run. Still low but no longer zero.

3. **Bob dipped** (74% → 63%): 17/27 sessions used workflows. 3 WF sessions were interrupted. Bob had fewer parallel-research runs this window but still the second-highest absolute WF count.

4. **Optimizer steady at 50%**: 10 WF sessions across 8 runs. Consistent verify-wrap usage for Mode A-D scans.

5. **Tech-lead slightly down** (52% → 47%): 8/17 sessions. Still consistent lens investigation pattern.

## High-Op Workflow Sessions

| Agent | Ops | Session | Notes |
|-------|-----|---------|-------|
| bob | 35 | s_1776576874869_14 | Interrupted — single-session WF run |
| optimizer | 23 | s_1776562571972_797 | Mode B tool gap analysis |
| optimizer | 21 | s_1776578664116_9 | Investigation + fix workflow |
| scout | 19 | s_1776576880534_15 | Single WF run |
| coach | 16 | s_1776580257234_37 | Part of 12-session growth-cycle |

## Workflow Run Patterns

- **31 total workflow runs** (up from ~35 prior — similar volume)
- **28 completed (done), 3 interrupted** — 90% completion rate
- **Largest run**: Coach growth-cycle wr_1776579986373 (12 sessions, 49 ops) — this is a healthy multi-step coaching workflow
- **Bob's parallel-research**: Multiple runs (4+ visible), typically 3-4 sessions each, 20-31 ops per run
- **deliver-or-report**: Still no usage detected in this window (3rd consecutive Mode D finding)

## Trends (3 data points)

| Metric | Apr 18 19:00 | Apr 19 01:00 | Apr 19 07:00 | Trend |
|--------|-------------|-------------|-------------|-------|
| WF sessions | ~65 | 47 | 53 | ↑ recovering |
| Work-agent adoption | 65% | 46% | 43% | ↓ slow decline |
| Coach adoption | 19% | 4% | 45% | ↑↑ recovered |
| Scout adoption | 29% | 0% | 10% | ↑ marginal |
| Bob adoption | 73% | 74% | 63% | ↓ slight dip |

## Key Observations

1. **Coach recovery is the headline**: Whatever caused the 19%→4% collapse has resolved. The growth-cycle workflow is being used actively again with large multi-session runs. This is the most positive signal this window.

2. **deliver-or-report is dead**: Three consecutive 6h windows with zero usage. Recommend either removing it from workflow registry or investigating why no agent triggers it.

3. **Bob's interruptions**: 3/17 WF sessions interrupted (18%). Worth monitoring — could indicate timeout issues or task complexity problems with parallel-research.

4. **Overall adoption plateau at ~43-46%**: Work-agent adoption has stabilized but isn't growing. The non-WF sessions from coach (21), bob (10), tech-lead (9), scout (9) represent potential workflow candidates if tasks suit structured execution.
