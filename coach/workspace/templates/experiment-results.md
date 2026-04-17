# EXP-<ID> Results: <Short Title>

**Date completed**: <YYYY-MM-DD>
**Design**: see `design.md`
**Status**: COMPLETE | ABANDONED

## TL;DR

<1-2 sentences. State the primary result + the decision (deploy/reject/run-phase-2).>

## Arms

| Arm | Scenario | Treatment | Passed | N | Rate | p (Fisher, 1-tail) |
|-----|----------|-----------|--------|---|------|--------------------|
| A | <scenario> | Control | <x> | <n> | <%> | — |
| B | <scenario> | <treatment> | <x> | <n> | <%> | <p> |

**Primary contrast**: A vs B, Δ=<pp>, p=<value>

## Per-criterion Breakdown

| Criterion | A rate | B rate | Δ | p |
|-----------|--------|--------|---|---|
| <name> | <%> | <%> | <pp> | <p> |

## Score (continuous)

- A: mean=<x>, sd=<x>, n=<n>
- B: mean=<x>, sd=<x>, n=<n>
- Welch's t: t=<x>, df=<x>, p=<x>

## Decision

Applying pre-registered rule from design:
- <quote the relevant decision threshold>
- Result: **DEPLOY | REJECT | PHASE-2**

## Interpretation

<2-4 paragraphs. What did the treatment do? Did it match the mechanism
you hypothesized? Any surprising per-criterion patterns (e.g., treatment
helped criterion X but hurt Y)?>

## Threats to Validity

- <e.g., ceiling effect on arm C — baseline already 100%>
- <e.g., N=12 underpowered for Δ<25pp>
- <e.g., scenario-specific — no generalization arm>

## Follow-ups

- [ ] Write/update KE-<id>
- [ ] Ship artifact to `skills/<name>.md` or harness
- [ ] Next experiment: <EXP-proposal>

## Raw Data

Gym runs included (batch_id or session IDs):
- <list or query>

```sql
-- Example query to regenerate the table:
SELECT tags, passed, COUNT(*)
FROM gym_runs
WHERE batch_id = '<id>'
GROUP BY tags, passed;
```
