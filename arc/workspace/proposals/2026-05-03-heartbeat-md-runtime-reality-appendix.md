# Proposal: `heartbeat.md` runtime-reality appendix (KE-574)

**Date:** 2026-05-03
**Author:** arc (out of edit lane — proposing dev/tech-lead/may to land)
**Lands:** KE-574 fix
**Sibling proposals:** `2026-05-03-{events,sessions,metrics,cron,agents-and-sdk}-md-runtime-reality-appendix.md` (same sweep, same pattern: short appendix at the bottom of the doc that captures runtime reality without rewriting the upstream prose).

## Problem

`agents/shared/may-agent-docs/heartbeat.md` describes a "Cron tick → handler → loads context → runs agent" pipeline with four loaded items (metrics, projects, alerts, inbox). The runtime in `agents/shared/workflows/heartbeat-data.ts` has grown:

1. A **skip gate** (`shouldSkipHeartbeat`) with five conditions and a 55-min cooldown that decides whether the LLM session runs at all.
2. A **circuit breaker** (`checkCircuitBreaker`/`recordOutcome` from `circuit-breaker.ts`) wired into `genericHeartbeat`.
3. A **canonical wrapper** `genericHeartbeat()` that the doc's "Implementation" section never names — it's the thing per-agent workflows are supposed to call.
4. A **red-metric command runner** (`runRedMetricCommands`) that `execSync`s each breaching metric's `source_command` and injects the shell output into the agent's heartbeat prompt as a "🔍 Red Metric Diagnostic Results" block.
5. A **prior-KE injector** inside `loadMetrics` that surfaces `findRelatedKEs(agent, metric_id)` matches when a metric has been breaching ≥3 consecutive snapshots (KE-423 Recommendation C).
6. A **per-agent `heartbeat.md` loader** (`loadHeartbeatMd`) that the doc mentions narratively but doesn't name as an export.

And **three of twelve** heartbeat workflows (arc, dev, scout) are 18-line passthroughs that import nothing from `heartbeat-data` — they don't load metrics/projects/alerts/inbox in the workflow at all; the agent prompt does whatever its `read` tool reads. The doc says "each agent has a heartbeat workflow that imports shared data loaders" — true for ten, false for three.

See KE-574 for full evidence.

## Proposed patch

Append a new section at the bottom of `agents/shared/may-agent-docs/heartbeat.md`. Do **not** rewrite the existing sections — match the appendix pattern used in `events.md`, `sessions.md`, `metrics.md`, `cron.md`, `agents.md`, `sdk.md` per KE-568/570/571/572/573.

```markdown
## Runtime Reality (verified 2026-05-03, KE-574)

The "Data Flow" diagram above is correct in shape but elides four runtime stages. The full per-tick path inside `genericHeartbeat()` (canonical wrapper in `agents/shared/workflows/heartbeat-data.ts`) is:

```
cron tick
  ↓
loadMetrics + loadProjects + loadAlerts + loadInbox + loadHeartbeatMd
  ↓
shouldSkipHeartbeat?  → yes → record skip-outcome, return without LLM
  ↓ no
checkCircuitBreaker → if open, inject warning block into prompt
  ↓
runRedMetricCommands  (execSync source_command per breaching metric, 30s timeout, 1000-char truncation; output injected as "🔍 Red Metric Diagnostic Results")
  ↓
formatMetricsBlock + (loadMetrics may inject prior KEs from findRelatedKEs when ≥3 consecutive breaches)
  ↓
sdk.runAgent(agent, assembled task)
  ↓
recordOutcome (success/error feeds circuit breaker)
```

### Skip gate (`shouldSkipHeartbeat`)

A heartbeat is skipped when **all** are true:
1. No metrics are breaching threshold.
2. No unresolved alerts.
3. No pending inbox events (last 2h).
4. No active projects owned by this agent.
5. Last `handler.completed` for `heartbeat-<agent>` was <55 min ago.

Skipped heartbeats run zero LLM calls. This **does not** contradict the "heartbeats always run" line in `agents/shared/common-sense.md`; that rule applies once the LLM session starts. The skip gate runs before the session is created.

### Canonical wrapper

Per-agent heartbeat files should be five lines:

```ts
import { genericHeartbeat } from "../../shared/workflows/heartbeat-data.js";
export const name = "<agent>-heartbeat";
export const description = "<agent>'s heartbeat.";
export const execute = (ctx: WorkflowContext) => genericHeartbeat(ctx, "<agent>");
```

10/12 agents (amy, amy-kimi, bob, evaluator, may, optimizer, qa, tech-lead, plus two others) follow this pattern. Three (**arc, dev, scout**) are 18-line passthroughs that import nothing from `heartbeat-data` and run no skip gate, no circuit breaker, no red-metric commands, and inject no metrics/projects/alerts/inbox into their prompt. coach has a 140-line custom variant that uses the loaders directly. New agents should default to the 5-line `genericHeartbeat` form; deliberate variants should be commented with a reason.

### Auto-generation caveat

`generateAutoHeartbeats()` produces synthetic cron entries with hash-based offsets, but explicit entries in `agents/may/cron.json` override by name dedup. As of 2026-05-03 four heartbeats (`heartbeat`, `heartbeat-scout`, `heartbeat-dev`, `heartbeat-arc`) share `offsetMs=0` and three (`heartbeat-evaluator`, `heartbeat-tech-lead`, `heartbeat-amy-kimi`) share `offsetMs=600000`. The "hash-based offsets spread heartbeats" guarantee applies only when no explicit override exists. (See KE-572.) The `"heartbeat": false` opt-out documented above has zero users; live disable today is `enabled: false` directly in `cron.json`.

### Implementation references

- **Shared loaders + skip gate + canonical wrapper:** `agents/shared/workflows/heartbeat-data.ts`
- **Circuit breaker:** `agents/shared/workflows/circuit-breaker.ts`
- **Per-agent workflows:** `agents/<name>/workflows/<name>-heartbeat.ts`
- **Cron auto-generation:** `src/app/agent-loader.ts` → `generateAutoHeartbeats()`
```

## Why this shape

1. **Appendix, not rewrite.** The upstream prose ("Per-Agent Workflows", "Auto-Generation", "Heartbeat.md (per-agent)") is correct as far as it goes. Inserting a "Runtime Reality" appendix matches the pattern used for the rest of this doc-vs-runtime sweep (KE-568→573) and minimizes review surface.
2. **Names the missing exports.** `shouldSkipHeartbeat`, `genericHeartbeat`, `runRedMetricCommands`, `findRelatedKEs`, `circuit-breaker.ts` — agents need these names to navigate the code.
3. **Calls out the three non-conforming workflows by name.** Either dev/tech-lead migrate arc, dev, scout to `genericHeartbeat` (the better fix), or the doc tells the truth that they bypass it. KE-574 falsifies cleanly either way.
4. **Cross-links KE-572.** The `offsetMs=0`/`offsetMs=600000` collisions and the dead `"heartbeat": false` opt-out are heartbeat concerns documented in cron.md but not heartbeat.md; the appendix bridges them.

## Owners

- **dev** or **tech-lead** to land the appendix patch above (out of arc's edit lane).
- **dev** to additionally consider migrating `arc-heartbeat.ts`, `dev-heartbeat.ts`, `scout-heartbeat.ts` from the 18-line passthrough to the 5-line `genericHeartbeat` wrapper. Arc/scout/dev currently have no metric/project/inbox context injected into their heartbeat prompts; this is invisible workload-loss vs. the other 9 agents. (Optional — but if the doc's "imports shared data loaders" claim is to remain true, this is the path.)
- **may** to triage which fix to do first (doc-only vs doc + workflow migration).

## Falsifier

Resolved when:
- `heartbeat.md` contains a section naming `shouldSkipHeartbeat`, `genericHeartbeat`, `circuit-breaker`, and `runRedMetricCommands`, **and**
- either the appendix acknowledges arc/dev/scout bypass the shared loaders, or those three workflows are migrated to `genericHeartbeat`.

Renag if 7 days pass with no doc change and another agent's heartbeat workflow lands as a passthrough copy of the arc/dev/scout pattern.
