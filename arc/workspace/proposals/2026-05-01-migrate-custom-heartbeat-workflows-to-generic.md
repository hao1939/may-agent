# Proposal: Migrate dev/arc/scout heartbeats from custom `runAgent` shape to `genericHeartbeat`

**For:** tech-lead (or dev, once the IDE-token outage is resolved — see companion proposal `2026-05-01-refresh-dev-agent-ide-token.md`)
**From:** arc heartbeat 2026-05-01 19:18Z
**Connects:** KE-420, KE-441, KE-443, KE-453, and the still-open dev token outage (≈18h20m as of writing)
**Urgency:** MEDIUM — fixes two distinct problems with one ~50-line edit
**Lane:** **out of arc lane** (arc cannot edit `agents/{dev,arc,scout}/workflows/`); proposal-only.

## Two problems, one fix

### Problem 1 — malformed `heartbeat.trigger` events leak forever (KE-420 / KE-453)

23 rows in the `events` table have `event_type` set to a JSON-stringified object instead of a dotted name (`{"type":"heartbeat.trigger","agent":"dev"}` etc.). The set of affected agents is **exactly** `{dev, arc, scout}` — the same three agents whose `*-heartbeat.ts` workflow is the 18-line "custom" shape that calls `ctx.runAgent(agent, task)` directly.

The other seven heartbeat agents (bob, coach, evaluator, may, optimizer, qa, tech-lead) all use the 6-line shared form `genericHeartbeat(ctx, "<agent>")` and produce **zero** malformed rows. Localization is 1:1.

The malformed rows cluster ~20–140 seconds after each may-agent restart (KE-453 §"Restart-clustering"), so the emitter is something on the workflow registration / boot path that runs once per process start and only for custom-shape workflows. Each restart adds a few rows; rows have `ttl_ms IS NULL` and no subscriber matches a stringified-object name, so they accumulate forever (slow leak, currently ~2/restart).

### Problem 2 — dev/arc/scout heartbeats are blind to their own metrics (KE-440 / KE-443 family)

`genericHeartbeat` injects a metrics block, alerts, inbox, projects, prior-art KEs, and a circuit breaker into the prompt before calling the agent (see `agents/shared/workflows/heartbeat-data.ts`). The custom shape does **none** of that — it just builds a fixed string `"[heartbeat] You are <agent>. Read agents/<agent>/heartbeat.md and do your work."` and runs the agent.

Concrete consequence right now: dev has been failing every heartbeat with `401 IDE token expired` since 2026-05-01 00:58:35Z. That's **>18 hours** of 100% failure. The `handler.success-rate` and dev-specific failure pattern are visible in metrics, but dev's heartbeat prompt never sees them — so dev cannot self-flag the outage. (May's heartbeat *also* didn't surface it for the first ~12h; that gap is what proposal `2026-05-01-may-heartbeat-pre-snapshot-alert.md` tries to close. But a dev-heartbeat that *did* see metrics would have flagged it from the dev side too.)

The same blindness applies to arc and scout. Arc accidentally compensates by reading the DB directly (because arc's job is system observation), but that's a workaround, not a property of the workflow.

## The fix

Replace the body of each of these three files:

- `agents/dev/workflows/dev-heartbeat.ts`
- `agents/arc/workflows/arc-heartbeat.ts`
- `agents/scout/workflows/scout-heartbeat.ts`

with the same shape used by `agents/bob/workflows/bob-heartbeat.ts`:

```ts
/// <reference path="../../../src/lib/workflow-defs.d.ts" />
import { genericHeartbeat } from "../../shared/workflows/heartbeat-data.js";

export const name = "<agent>-heartbeat";
export const description = "<agent>'s heartbeat.";
export const execute = (ctx: WorkflowContext) => genericHeartbeat(ctx, "<agent>");
```

Net change: ~50 lines deleted, 18 lines added. No new abstraction; this is the existing shared abstraction the other 7 agents already use.

## Side effects (intended)

1. The malformed-event emitter goes silent. Falsifier in KE-453: `SELECT COUNT(*) FROM events WHERE event_type LIKE '{%' AND timestamp > <migration-ts>` should stay at 0.
2. dev/arc/scout heartbeats start receiving the standard injection: red metrics, alerts, prior-art KEs, inbox dedup, circuit breaker.
3. dev's heartbeat would self-flag the 401 streak the first time it ran post-fix (the metrics block surfaces `handler.success-rate` and `handler.failed-count`; the inbox dedup surfaces the repeated session.failed events).
4. The circuit-breaker in `genericHeartbeat` would likely already be tripping for dev right now if it had been on this path — which is its own observation worth recording (KE candidate after migration, not before).

## Side effects (potentially unintended) — risks to check before merging

- `genericHeartbeat` calls `ctx.runAgent(agent, prompt)` with a *prompt that already contains the heartbeat.md content inline*. The custom shape passes only a short trigger string and lets the agent read heartbeat.md itself on its first turn. If any of dev/arc/scout's heartbeat.md contains ${}-style template literals or unescaped backticks that would break the JS template-string concat in `genericHeartbeat`, that needs verification. Quick scan: arc's heartbeat.md has no backticks-in-backticks or template-literal interpolation that would break this. Dev/scout heartbeat.md should be eyeballed by whoever lands the change.
- The custom shape returns `{ status, summary, iterations }`; `genericHeartbeat` returns `ctx.done(...)`. If anything downstream relies on the `iterations: 1` field specifically from these three agents, that breaks. Quick grep: `grep -rn '\.iterations' agents/ src/` to confirm. (Arc's review found no consumers; please confirm.)
- Cooldown / skip behavior: `genericHeartbeat` includes `shouldSkipHeartbeat` (defined in the same file) but doesn't currently invoke it (the comment "Heartbeats always run" gates it off). So no new skip behavior is introduced. Mentioning so the reviewer doesn't have to verify it.

## Test before / after

Before:
```sql
SELECT COUNT(*) FROM events WHERE event_type LIKE '{%';   -- 23
SELECT json_extract(event_type,'$.agent') a, COUNT(*) c FROM events WHERE event_type LIKE '{%' GROUP BY a;
-- arc:4, dev:15, scout:4
```

After (next may-agent restart following the migration):
- `COUNT(*) FROM events WHERE event_type LIKE '{%' AND timestamp > <restart-ts>` should be 0 (was averaging ~2 per restart).
- A new heartbeat run for any of the three migrated agents should show metrics block content in the agent's session input (visible in `sessions.task` if it's stored, or in any prompt-logging path).

## One-time GC (optional, separate from migration)

```sql
UPDATE events SET status='dismissed', reason='malformed event_type — KE-420/KE-453, fixed by heartbeat migration'
WHERE event_type LIKE '{%';
```

Or `DELETE` if dismissed rows clutter dashboards. Not strictly necessary; the rows are inert (no consumer, never expire). Doing the GC just makes the falsifier query cleaner.

## Why this proposal exists

KE-453 (filed earlier today) localized the malformed-event emitter to the custom-workflow path with 1:1 evidence. KE-453 §Recommendation explicitly defers the proposal-write to "this or the next arc heartbeat." This is that proposal.

Both problems addressed here have been documented for 1+ days (KE-420 for malformed events, KE-440/441/443 for dev outage blindness) without behavior change. Per KE-441's pattern ("KEs alone don't move things; assigned proposals do"), this proposal is the assignment.

## Falsifier for the proposal itself

If this proposal is still open and the malformed-row count has grown by >0 in any 7-day window after 2026-05-08, it will join the same KE-441 thread (proposals without a clearly-assigned actor also don't move). At that point, the next escalation is to ask Hao directly to assign tech-lead or schedule it on dev's queue once dev is back online.
