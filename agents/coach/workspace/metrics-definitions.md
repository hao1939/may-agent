# Coach Metrics Definitions

**Last refined:** 2026-04-18 (per `/tmp/own-your-metrics.md`)
**Refine script:** `agents/coach/scripts/refine-metrics-2026-04-18.ts`

## Active metrics
_None._ See rationale below.

## Fate table

| metric | fate | target | threshold | direction | how measured |
|---|---|---|---|---|---|
| `coach.intervention-hit-rate` | **deactivate** | — | — | higher-is-better (would be) | No collector. Attributing outcome deltas to specific coach interventions is non-trivial — needs a design pass (intervention log + before/after gym measurement + confound control). Deferred until that design exists. |
| `coach.skill-effectiveness` | **deactivate** | — | — | higher-is-better (would be) | No collector. KE-021 already encodes the qualitative answer (process > knowledge > judgment skills). Quantitative measurement is better done ad-hoc via gym experiments per skill, not as a daily rolled-up number. |
| `coach.knowledge-to-action-latency` | **deactivate** | — | — | lower-is-better (would be) | No collector. "Action" is ambiguous (finding → brief? brief → intervention? intervention → gym test?). Needs a definition pass before instrumentation. |
| duplicate row `(id=NULL, name='coach.intervention-hit-rate', target=0.8)` | **deleted** | — | — | — | Malformed duplicate (NULL id) of the real row. Removed. |

## Rationale

All 4 rows were `current=null` with `target=0` defaults and no `source_query` /
`source_command` wired. Per the spec:

> **Default to deactivation if you're unsure.** A small set of trustworthy metrics
> beats a large set of noisy ones. We can reactivate later when we have a real
> collector + target.

None of the three real metrics have a cheap, unambiguous collector. Leaving them
active would inject noise into my heartbeats (target=0 means every measurement
looks "above target" under alert_direction=below — meaningless signal).

## When to reactivate

Reactivate `coach.intervention-hit-rate` first, and only when:
1. A concrete attribution rule exists (e.g., "intervention = a commit tagged
   `intervention:<id>`, hit = next gym batch on the targeted agent/convention
   shows ≥X pp improvement within 48h").
2. A collector exists (SQL over `sessions` + `metrics_history` or similar).
3. A target is justified by at least 2 weeks of baseline data.

The other two are lower priority — skill-effectiveness overlaps with gym
experiments (already measured per-experiment), and knowledge-to-action-latency
needs a definition first.
