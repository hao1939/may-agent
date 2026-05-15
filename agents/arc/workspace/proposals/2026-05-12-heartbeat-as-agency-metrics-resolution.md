# Resolve agency-metrics drift in heartbeat-as-agency.md (3-way pick)

**Filed:** 2026-05-12
**Author:** arc
**Priority:** P2
**Source:** KE-1250

## Problem

`shared/may-agent-docs/design/heartbeat-as-agency.md` was banner-status `shipped` (2026-05-06) but only 1 of its 3 prescribed agency metrics is registered, and that one is under a different namespace than the doc names:

| Doc-prescribed | Registry reality |
|---|---|
| `agent.heartbeat-coverage` "(Already exists.)" | only `handler.heartbeat-coverage` exists |
| `agent.idle-rate` | never registered |
| `agent.self-initiated-rate` | never registered |

`webui.md` lines 295–297 echo the doc by rendering all three as a green AGENCY dashboard block with mock numbers, reinforcing the false impression that agency metrics are observable. The agency framing is therefore untestable today: we cannot tell from data whether an agent is "dead in its seat" (high idle) vs healthily watching its domain (low idle), or whether sessions are heartbeat-driven autonomy vs reactive forks.

What did ship: the heartbeat workflow itself, and the per-session `agent.decision` event (~822 emissions / 7d across 4 agents, ~45 per agent per 24h). So the framing is partially live — the metrics part isn't.

## Decision needed

Pick one of:

### Option A — Register the missing two (and align the namespace)
Add `agent.idle-rate` and `agent.self-initiated-rate` to `agents/may/handlers/metrics-snapshot.ts`, and either rename `handler.heartbeat-coverage` → `agent.heartbeat-coverage` or add an alias so all three agency metrics share the namespace the design names.

- **Pro:** Makes the design's load-bearing introspection actually exist; lets us watch whether agents are agents.
- **Con:** Renames are runtime-disruptive (alerts, dashboards, KEs that reference `handler.heartbeat-coverage` — including the open self-calibrating proposal). An alias is cheaper but accumulates a footgun.
- **Sketch (idle-rate):** numerator = heartbeat sessions in window with `outcome != 'done'` OR no commit/edit traces; denominator = heartbeat sessions in window. We already have `evaluator-aftermath` outputs that classify substantive vs no-value — that classification is the cleaner numerator if available.
- **Sketch (self-initiated-rate):** numerator = sessions with `source LIKE 'workflow:%-heartbeat'`; denominator = all sessions for that agent in window. Source distribution shows the data is already cleanly differentiable.

### Option B — Strike the two from the design
Remove `agent.idle-rate` and `agent.self-initiated-rate` from heartbeat-as-agency.md's "For metrics" section as out-of-scope. Drop or replace the mock AGENCY block in `webui.md` lines 295–297. Keep `handler.heartbeat-coverage` as the only agency-adjacent measurement.

- **Pro:** Minimal change; honest about what shipped.
- **Con:** Concedes the framing is untestable; the doc's "How do we tell if agents are alive?" question loses its concrete answer (the answer becomes "you watch transcripts").

### Option C — Hybrid: register `agent.self-initiated-rate` only, drop `idle-rate`
The self-initiated metric is mechanically trivial (source-string filter against sessions table) and informative (signals reactive collapse). The idle metric requires a "no action taken" classifier we haven't built and would re-litigate every aftermath-eval calibration. Ship the cheap one, strike the expensive one.

- **Pro:** Captures most of the design's value at lowest cost; aligns at least one metric with the agency namespace.
- **Con:** Half-measure; idle-rate is the more diagnostic of the two.

## Recommendation

Option C is my pick. `self-initiated-rate` is a 5-line query and gives us the "is the system collapsing into reactive mode?" signal cheaply. `idle-rate` is worth proposing later once we trust evaluator's substantive-vs-no-value classification enough to drive a metric off it; today that's still moving (KE-1247, KE-1249).

Either way, the namespace mismatch on `handler.heartbeat-coverage` should be resolved (alias or rename).

## Validation

After whichever option lands:
1. Re-grep `/app` for `agent.idle-rate` and `agent.self-initiated-rate` — references should match the chosen state (registered, or only in archived doc context).
2. `query_db` on metrics table should reflect the registration.
3. `heartbeat-as-agency.md` Status banner should be re-promoted to `shipped` if Option A or C resolves the gap, or updated to "shipped (idle-rate descoped)" for Option B/C.
4. `webui.md` AGENCY block reflects reality.
