# Heuristic Overturn Analysis — 2026-05-10T17:40Z

## Problem
The "Reviewed good sessions overturned (24h)" metric is at **26.8%** vs 5% target.
89 of ~305 heuristic-good sessions were downgraded by LLM review in the last 24h.

## Breakdown by Agent (overturn rate of heuristic-good sessions)
| Agent | Heuristic Good | Overturned | Rate |
|-------|---------------|-----------|------|
| arc   | 37            | 18        | 48.6% |
| dev   | 43            | 18        | 41.9% |
| may   | 132           | 38        | 28.8% |
| scout | 94            | 17        | 18.1% |

Arc and dev are worst — nearly half their "good" heuristic verdicts get overturned.

## Root Cause: Weak Heuristic Signals

The heuristic v6 marks sessions "good" based on output signals (git commit, file write, project artifact, knowledge update). But **some signals are poor predictors of quality**:

| Route Reason | Total | Overturned | Rate |
|---|---|---|---|
| project artifact only | 15 | 13 | **86.7%** |
| knowledge update only | 27 | 13 | **48.1%** |
| project artifact + knowledge update | 7 | 6 | **85.7%** |
| file write + git commit | 61 | 20 | 32.8% |
| uncommitted friction self-repaired | 37 | 9 | 24.3% |
| git commit only | 48 | 7 | 14.6% |
| file write + git commit + knowledge update | 37 | 5 | 13.5% |
| file write + git commit + project artifact | 22 | 4 | 18.2% |

## Key Insights

1. **"project artifact" alone is almost useless as a quality signal** — 87% overturn rate. Sessions that only touched a project file without committing or writing other files are usually low-value (e.g., adding a boilerplate status line).

2. **"knowledge update" alone is weak** — 48% overturn. Knowledge entries without corresponding file edits or commits are often formulaic.

3. **Git commit + file write/edit together are the strongest signal** — 13-15% overturn rate when paired.

4. **The "friction self-repaired" lane needs quality gating** — 24% overturn. Just because a session recovered from uncommitted-changes friction doesn't mean it produced good output.

## Recommended Heuristic v7 Changes

1. **Downgrade "project artifact only" from `good` to `acceptable`** — or route to LLM review. This alone would prevent ~13 false-good verdicts/day.

2. **Downgrade "knowledge update only" to `acceptable`** — requires at least one other signal (file edit or git commit) to auto-pass as good.

3. **Add opCount/duration check for good verdicts** — shallow sessions (opCount ≤ 3) that happen to have a project artifact signal are almost always overturned.

4. **Weight composite signals** — sessions with 3+ output signals have ~15% overturn vs 50%+ for single-signal sessions.

Expected impact: Reducing false-good rate from 26.8% to ~15% by reclassifying ~30 sessions/day that currently get incorrectly auto-passed.
