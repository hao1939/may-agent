# Mode D: Workflow Health — 6h Scan (Apr 18, 23:00 UTC)

## Key Metrics (17:00–23:00 UTC window)
- **40 distinct workflow runs** across system
- **152 total sessions** (excluding evaluator), **58 with workflows** (38% system-wide)

## Workflow Adoption by Agent

| Agent | Sessions | WF Sessions | WF % | Avg Ops |
|-------|----------|-------------|------|---------|
| bob | 42 | 30 | 71% | 9.5 |
| coach | 28 | 2 | 7% | 16.5 |
| optimizer | 25 | 13 | 52% | 6.0 |
| tech-lead | 24 | 12 | 50% | 3.9 |
| scout | 13 | 1 | 8% | 3.5 |
| qa | 12 | 0 | 0% | 7.8 |
| may | 8 | 0 | 0% | 4.0 |

## Trends vs Prior Mode D (19:00 UTC, same day)
- Prior scan: 45 WF runs, 65 WF sessions, bob 73%, coach 19%
- Current: 40 WF runs, 58 WF sessions, bob 71%, coach **dropped to 7%**
- Coach WF adoption collapsed: only 2 WF sessions out of 28 (one was a 0-op coaching-feedback, one was a 13-op order-compliance build)
- System-wide WF rate stable at ~38% (was similar range)

## Coach Deep-Dive
Coach ran **10 work sessions** in this 6h window, all focused on `use-persistent-task`:
- 51 ops (interrupted), 7 ops, 22 ops, 65 ops, 18 ops, 13 ops, 48 ops, 29 ops, 13 ops, 74 ops (running)
- **Only 1 of 10 work sessions used a workflow** (13-op order-compliance scenario)
- Total coach work session ops: **340 ops** — heavily dominated by non-WF sessions
- The 4 sessions in the 40-74 op range (51, 65, 48, 74) account for **238 ops (70%)** — all non-WF
- Coach is iterating on a single gym scenario with serial design→test→fix→redesign loops

## Observations
1. **Bob remains workflow champion** at 71% — parallel-research workflow drives most of his work
2. **Coach workflow adoption is the biggest gap** — persistent manual iteration on use-persistent-task consumes significant ops without workflow structure
3. **QA and May remain at 0%** — QA does heartbeat-only work (7.8 avg ops), may dispatches only (4.0 avg ops), so low adoption is expected/acceptable
4. **Tech-lead steady at 50%** — all WF sessions are lens-based analysis (3-13 ops), efficient

## Recommendation
- **NO_DISPATCH** — Coach's low WF adoption on use-persistent-task is a known pattern (iterative experiment design doesn't fit current workflow templates). The work is legitimate experimentation, not a workflow enforcement opportunity. Prior interventions per KE-123 (don't stack) apply.
