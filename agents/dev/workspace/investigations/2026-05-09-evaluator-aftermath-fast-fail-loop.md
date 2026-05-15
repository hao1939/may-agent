# Evaluator Aftermath Fast-Fail Loop Investigation

Date: 2026-05-09
Owner: dev

## Question

The duration gate flagged this dev session as too fast. I used the extra time to investigate a non-obvious system failure pattern: why the runtime shows a large evaluator error volume even while evaluator metrics appear mostly green.

## Evidence

### System-wide 24h failure distribution

`query_db` on `sessions` for the last 24h showed 1,071 done sessions, 113 error sessions, and 81 interrupted sessions. The largest failing owner is not a worker agent but evaluator:

- evaluator: 66 error + 36 interrupted in 24h
- may: 27 error + 20 interrupted
- scout: 8 error + 5 interrupted
- arc: 6 error + 13 interrupted
- dev: 2 error + 7 interrupted

This makes evaluator aftermath the highest-impact failure cluster.

### Evaluator failures concentrate in aftermath reviews

Grouping evaluator sessions by source for the last 24h:

| source | sessions | DB errors | error rate | avg duration |
| --- | ---: | ---: | ---: | ---: |
| workflow:evaluator-aftermath | 417 | 56 | 13.4% | 45.0s |
| workflow:project | 123 | 4 | 3.3% | 66.6s |
| workflow:metric-alert-triage | 93 | 1 | 1.1% | 36.9s |
| workflow:evaluator-heartbeat | 69 | 4 | 5.8% | 60.0s |
| eval-llm-scan | 8 | 1 | 12.5% | 42.5s |

The volume and rate both point at `workflow:evaluator-aftermath`.

### The non-obvious signature: sub-15s review sessions almost always error

For evaluator aftermath sessions in the last 24h:

| duration bucket | sessions | errors | error rate |
| --- | ---: | ---: | ---: |
| <15s | 45 | 42 | 93.3% |
| 15-30s | 100 | 8 | 8.0% |
| 30-60s | 186 | 5 | 2.7% |
| >=60s | 84 | 1 | 1.2% |

The failure is therefore not just "some aftermath reviews are bad." There is a specific fast-fail mode: if the reviewer returns in under 15 seconds, it is almost certainly recorded as a runtime error.

Recent examples (`s_1778313806951_20`, `s_1778313742850_18`, `s_1778313737959_17`, etc.) all had `status='error'`, no DB `error` text, and durations around 4-7s. Their tasks were normal aftermath-review prompts, not malformed tasks.

### Reviewed-agent distribution is broad

Parsing the target session JSON inside those sub-15s aftermath tasks showed the failures are not tied to one reviewed agent:

- may: 19 fast reviews, 17 evaluator errors
- scout: 15 fast reviews, 14 evaluator errors
- dev: 7 fast reviews, 7 evaluator errors
- arc: 3 fast reviews, 3 evaluator errors
- master: 1 fast review, 1 evaluator error

This suggests a generic aftermath-review guard/workflow interaction rather than an issue with a particular target agent.

## Code path inspected

Read `agents/evaluator/workflows/evaluator-aftermath.ts`.

Relevant behavior:

1. `execute()` records a heuristic evaluation before spawning the review agent.
2. For `needs_triage` and `success_candidate`, it calls `ctx.runAgent("evaluator", reviewTask)`.
3. If the review session returns `status === "error"`, the parent workflow escalates: `ctx.escalate("Evaluator review failed for ...")`.
4. The review prompt requires an artifact write, read-back, and then `finish(success|partial)`.

This means guard-level failures in the child review (for example write/read/finish discipline or fast-session gates) turn into DB `status='error'` records for the evaluator review session. The parent workflow treats them as escalations, but the session rows themselves often have `error=NULL`, making the failure look like mysterious evaluator instability unless duration/source are inspected.

## Root cause hypothesis

The current aftermath workflow creates a feedback loop:

- The router sends many borderline sessions to `needs_triage` / `success_candidate`.
- The child evaluator is asked to produce a concise artifact, but many review runs return in 4-8s.
- Fast child runs fail runtime/guard gates before producing acceptable artifacts, causing `status='error'` with no useful `sessions.error` text.
- Because `execute()` already recorded the heuristic evaluation before the child review, coverage metrics can stay green while the review/triage process is noisy.

This explains why surface evaluator metrics can look acceptable while raw session errors remain high.

## Improvement opportunities

1. **Metric gap:** add or propose an `evaluator.aftermath-fast-error-rate-24h` metric measuring `workflow:evaluator-aftermath` sessions with duration `<15s` and `status='error'`. This catches the failure mode directly instead of relying on broad session error rate.
2. **Workflow hardening:** consider changing `evaluator-aftermath` so child review failures do not only escalate with `reviewSessionId`; emit a structured event with child duration, artifact-found boolean, and whether the child hit a guard/finish failure. That would make triage searchable without reading transcripts.
3. **Prompt/guard alignment:** the review prompt asks for a "concise" artifact but also requires artifact inspection, write, read-back, and possible escalation/learning. Add an explicit minimum evidence checklist or duration/tool-call hint so the child reviewer does not attempt a too-short completion.
4. **Alert interpretation:** green `eval.llm-coverage-lag-h` and aftermath coverage do not mean review quality is healthy; the fast-fail loop is orthogonal to coverage.

## Next validation signal

Run this query after any workflow/prompt change:

```sql
SELECT CASE
         WHEN (endedAt-startedAt)<15000 THEN '<15s'
         WHEN (endedAt-startedAt)<30000 THEN '15-30s'
         WHEN (endedAt-startedAt)<60000 THEN '30-60s'
         ELSE '>=60s'
       END bucket,
       COUNT(*) c,
       SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) errors,
       ROUND(AVG(CASE WHEN status='error' THEN 1.0 ELSE 0 END),3) error_rate
FROM sessions
WHERE agent='evaluator'
  AND source='workflow:evaluator-aftermath'
  AND startedAt > (strftime('%s','now')-86400)*1000
  AND endedAt IS NOT NULL
GROUP BY bucket
ORDER BY MIN(endedAt-startedAt);
```

Success is not just lower total error rate; success is specifically eliminating the `<15s` 90%+ error bucket or converting those into explicit, useful partial reviews with artifacts.
