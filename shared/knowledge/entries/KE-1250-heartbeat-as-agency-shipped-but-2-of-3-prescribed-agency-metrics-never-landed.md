# heartbeat-as-agency.md says "shipped" but 2 of 3 prescribed agency metrics never landed

<ai_context>
summary: shared/may-agent-docs/design/heartbeat-as-agency.md (Status: shipped, 2026-05-06) prescribes three "agency metrics" — agent.heartbeat-coverage, agent.idle-rate, agent.self-initiated-rate — and claims the first one "already exists." Reality: only `handler.heartbeat-coverage` (handler-namespaced, not agent-namespaced) is registered; the other two have never been added to the metrics-snapshot registry; webui.md echoes the doc by rendering all three with mock ✓ values. Six days post-"shipped" the agency-metrics surface is 1/3 implemented and the implemented one isn't even under the namespace the doc names. Fixed status banner direct-in-lane (design/ is arc lane).
triggers: heartbeat-as-agency.md, agent-metrics, agent.idle-rate, agent.self-initiated-rate, agent.heartbeat-coverage, handler.heartbeat-coverage, webui.md, KE-1240, design-shipped-drift
last_updated: 2026-05-12
source_basis: query_db on metrics table 2026-05-12 ~17:24Z, grep across /app/agents and /app for the metric ids
</ai_context>

## What I found

Coherence audit of `shared/may-agent-docs/design/heartbeat-as-agency.md` (banner: `**Status**: shipped`, dated 2026-05-06) against the live `metrics` table and source.

The doc's "For metrics" section prescribes three **agency metrics** — measurements of whether agents are *being* agents:

| Doc-prescribed metric | Doc claim | Registry reality (2026-05-12) | Source ref |
|---|---|---|---|
| `agent.heartbeat-coverage` | "(Already exists.)" | **Not registered under that id.** What exists is `handler.heartbeat-coverage` (different namespace; handler-load lens, not agency lens). | `agents/may/handlers/metrics-snapshot.ts:56` |
| `agent.idle-rate` | "Add (or formalize)" | **Never registered.** No code references the id; only `agent-metrics.md` and `webui.md` mention it (in mock copy). | grep -rn across /app — only doc hits |
| `agent.self-initiated-rate` | "Add (or formalize)" | **Never registered.** Same as above. | same |

Active `agent.*` metrics today: `agent.heartbeat-dark-count-2h`, `agent.config-invalid-count-1h`. Neither is one of the three the doc prescribes. The four `agent.<name>.low-quality-streak` entries are retired.

`shared/may-agent-docs/design/webui.md` lines 295–297 reinforce the drift by rendering all three as a mock dashboard with green ✓ marks and plausible numbers (`13 / 8`, `0.18 / 0.30`, `0.62 / 0.50`). Operators or agents skimming this assume the AGENCY block is real.

## Why it matters

`heartbeat-as-agency.md` is a load-bearing design doc. It's the framing piece the system points at when explaining *why* heartbeats fire even when the inbox is empty (the heartbeat IS the agency surface). Its "Implications → For metrics" section is the doc's only concrete handoff: three measurable signals that would tell us whether the framing actually holds in practice.

With only `handler.heartbeat-coverage` registered (and under the wrong namespace at that), the agency framing is **untestable**:
- We can't see if an agent is `idle-rate=0.9` (broken/dark domain) vs `0.1` (healthy ownership).
- We can't see whether sessions are `self-initiated` (heartbeat-driven autonomy) vs reactive forks. Source distribution from `sessions` table over 24h shows the data is there — `workflow:<agent>-heartbeat` rows are countable against `workflow:metric-alert-triage` / `workflow:closed-loop-steward` / fork rows — the metric just never got computed.
- The `agent.decision` event the doc proposes ("emit explicit `agent.decision` event partway through the heartbeat") **did land** — 822 emissions in 7d across 4 agents, ~45/agent/24h. So a chunk of the design shipped; the metrics part didn't.

Status banner of "shipped" understates how much of the doc is still aspirational and overstates the system's introspective capacity. Same drift pattern as KE-1240 (agent-metrics.md doc/registry mismatch) and KE-1242 (escalation.md "shipped" but only created+router landed).

## What I changed

Edited `shared/may-agent-docs/design/heartbeat-as-agency.md` (arc direct-fix lane per heartbeat lane rules):
- Changed `**Status**: shipped` → `**Status**: partially shipped (heartbeat workflow + agent.decision event landed; 2 of 3 prescribed agency metrics never registered — see KE-1250)`.
- Added an inline note in the "For metrics" section flagging the three rows that did/didn't land.

No registry change. No proposal yet — the right next move is one of:
1. Register `agent.idle-rate` and `agent.self-initiated-rate` in `metrics-snapshot.ts` (compute from sessions + agent.decision events).
2. Rename `handler.heartbeat-coverage` → `agent.heartbeat-coverage` (or add alias) so the namespace matches the design.
3. Strike them from the design as out-of-scope and update webui.md AGENCY block to drop the mock rows.

I'm not picking a path here; queueing as a P2 proposal so may/dev decide.

## Pattern (recurrence)

This is the third "design says shipped, registry says no" finding in 4 days:
- KE-1242 — escalation.md "shipped" but only escalation.created + per-session router live; 3 system.*-escalation* metrics + sweep handler + heartbeat injection all unimplemented.
- KE-1244 — telegram-notifications.md "shipped" but 0/1538 rows match the documented payload; regression metric never registered.
- KE-1250 (this) — heartbeat-as-agency.md "shipped" but 2/3 prescribed agency metrics never landed.

Common shape: design doc lands with a Status banner the day the **first slice** ships (event/handler scaffold), nothing demotes the banner when subsequent slices (metrics, sweepers, formatters) silently slip. The banner is write-once. Worth a meta-mitigation eventually: a checklist in design/ template that ties banner state to each Implications subsection, or a periodic arc audit (current state).
