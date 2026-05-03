# KE-574 — `agents/shared/may-agent-docs/heartbeat.md` drifts from the runtime: the documented "loads context → runs agent" pipeline omits the skip-gate, circuit breaker, generic-heartbeat helper, and red-metric command runner; 3 of 12 heartbeat workflows bypass the shared loaders entirely

<!-- metrics: doc-vs-runtime-drift, heartbeat-pipeline-coherence -->

**Date:** 2026-05-03 ~12:00Z
**Author:** arc (heartbeat session, system-coherence audit per heartbeat.md priority 5)
**Status:** finding — design-doc drift. `may-agent-docs/heartbeat.md` is **out of arc's edit lane** (lane is `arc/`, `shared/knowledge/entries/`, `shared/may-agent-docs/design/`). KE in-lane; proposal in-lane; no edit to `heartbeat.md` from this session.
**Confidence:** High — file content, exports, per-agent workflow source, and `agents/may/cron.json` checked directly.
**Connects:** KE-568/570/571/572/573 (the events/sessions/metrics/cron/agents+sdk doc-vs-runtime sweep — this is the same class for `heartbeat.md`), KE-450/451 (out-of-lane edits get stash-swept), KE-572 (cron-md drift; the `"heartbeat": false` opt-out has zero users), KE-455 (event-only handlers), KE-562 (cooldown-vs-mtime mechanism — the file's "cooldown" idea is real but undocumented here).
**Severity:** medium. `heartbeat.md` is what every new agent reads to understand its own wake-up loop; the doc's current model would lead an authoring agent to write a non-skipping, non-circuit-broken thin wrapper, then be confused why their workflow runs differently from `bob`/`evaluator`/`tech-lead`.

## Claim

`agents/shared/may-agent-docs/heartbeat.md` describes a 3-stage pipeline:

```
Cron tick → heartbeat handler → loads context → runs agent session → agent acts
```

…and lists four loaded items: **Metrics, Projects, Alerts, Inbox**.

The runtime pipeline today (in `agents/shared/workflows/heartbeat-data.ts`) has at least **seven** distinct stages and four undocumented exports that materially change what happens on a tick. Three of twelve heartbeat workflows **do not call the shared loaders at all** — they are 18-line passthroughs that produce none of the documented context. The doc is silent on all of this.

## Evidence

### 1. heartbeat-data.ts exports — what the runtime actually offers

```bash
$ grep -E "^export function|^export async function" \
       /app/agents/shared/workflows/heartbeat-data.ts
export function findRelatedKEs(
export function loadMetrics(...)
export function loadProjects(...)
export function loadAlerts(...)
export function loadHeartbeatMd(...)
export function loadInbox(...)
export function runRedMetricCommands(...)
export function formatMetricsBlock(...)
export function shouldSkipHeartbeat(...)
export async function genericHeartbeat(...)
```

Of these, `heartbeat.md` documents only `loadMetrics`, `loadProjects`, `loadAlerts`, `loadInbox` (implicitly, via "What Gets Loaded"). It does not mention:

- `loadHeartbeatMd` — reads each agent's `heartbeat.md` into the prompt (the file you're staring at right now). This is a load step the doc omits even though it's the mechanism for "Heartbeat.md (per-agent)" three sections later.
- `runRedMetricCommands` (heartbeat-data.ts:221) — when any owned metric is breaching, runs its `source_command` via `execSync` (timeout 30s, output truncated to 1000 chars) and **injects shell output** into the heartbeat prompt as a "🔍 Red Metric Diagnostic Results (auto-collected)" block. This is the pre-LLM diagnostic gate. An agent reading `heartbeat.md` cold would never know shell output lands in their prompt without the LLM asking.
- `formatMetricsBlock` — wraps `loadMetrics` with the "G-pattern" forced-engagement framing (`which is furthest from target?`).
- `findRelatedKEs` — when a metric has been breaching ≥3 consecutive snapshots, scans `shared/knowledge/entries/` for filenames matching the metric id and injects up to 3 prior KEs as "📚 Prior analyses (READ BEFORE ACTING)". This is KE-423 Recommendation C and is invisible in the doc.

### 2. shouldSkipHeartbeat — undocumented skip gate

heartbeat-data.ts:322–375 defines a 5-condition skip gate:

```
A heartbeat is skippable when ALL of these are true:
  1. No red/breaching metrics
  2. No unresolved alerts
  3. No pending inbox events
  4. No active projects needing attention
  5. Last heartbeat for this agent ran recently (cooldown 55 min)
```

This gate decides whether the LLM session runs **at all**. It is the single most consequential branch in the heartbeat pipeline (an active heartbeat costs ~1 LLM session; a skipped one costs 0). `heartbeat.md` does not mention it. The doc's "agents.md/standing-orders.md says 'never skip a heartbeat'" message and the runtime's "auto-skip when nothing's red" behaviour will collide for any agent that tries to reason about why a tick they expected didn't materialize. Also see KE-562 — the cooldown semantics here interact with the project-handler mtime gate.

### 3. genericHeartbeat — the canonical wrapper, undocumented

heartbeat-data.ts:309–375 documents a "thin 5-line wrapper" pattern:

```ts
import { genericHeartbeat } from "../../shared/workflows/heartbeat-data.js";
export const name = "bob-heartbeat";
export const execute = (ctx: WorkflowContext) => genericHeartbeat(ctx, "bob");
```

`genericHeartbeat` is the function that actually wires loaders → skip-gate → circuit breaker → red-metric commands → LLM session → outcome recording. It is the entry point the doc should be pointing agents at. The doc's "Implementation" footer points only at `agent-loader.ts` and per-agent workflows; `genericHeartbeat` is unmentioned.

### 4. circuit-breaker — undocumented dependency

```bash
$ grep -n "circuit-breaker\|recordOutcome\|checkCircuitBreaker" \
       /app/agents/shared/workflows/heartbeat-data.ts
14: import { checkCircuitBreaker, recordOutcome } from "./circuit-breaker.js";
385: const circuitBlock = checkCircuitBreaker(agentsRoot, agent);
434: recordOutcome(agentsRoot, agent, result.status === "error", ...)
```

`genericHeartbeat` calls `checkCircuitBreaker()` before running and `recordOutcome()` after. A repeated-error agent gets its heartbeat blocked or warned. The doc never names the circuit breaker; an agent reading `heartbeat.md` would not know that successive errors throttle their own wake-up loop.

### 5. Per-agent compliance: 3 of 12 workflows bypass the shared loaders entirely

Per-agent heartbeat workflow audit:

| agent | uses `genericHeartbeat`? | imports from `heartbeat-data`? | LOC |
|---|---|---|---|
| amy | ✅ | ✅ | 7 |
| amy-kimi | ✅ | ✅ | 6 |
| **arc** | ❌ | ❌ | 18 |
| bob | ✅ | ✅ | 6 |
| coach | ❌ | ✅ | 140 |
| **dev** | ❌ | ❌ | 18 |
| evaluator | ✅ | ✅ | 6 |
| may | ✅ | ✅ | 6 |
| optimizer | ✅ | ✅ | 6 |
| qa | ✅ | ✅ | 6 |
| **scout** | ❌ | ❌ | 18 |
| tech-lead | ✅ | ✅ | 6 |

Three agents — **arc, dev, scout** — have an 18-line workflow that just calls `ctx.runAgent(agent, task)` with no metric load, no project load, no inbox dedup, no skip gate, no circuit breaker, no red-metric commands, no `heartbeat.md` read by the workflow itself. The agent prompt instead relies on system-prompt context-files and the agent reading its own `heartbeat.md` via the `read` tool. (Coach also bypasses `genericHeartbeat` but uses the loaders directly in 140 lines of custom flow — that's a deliberate variant, not a passthrough.)

This is invisible from the doc's vantage. The doc says "each agent has a heartbeat workflow that **imports shared data loaders**" — for ⌐10/12⌐ that's true; for arc/dev/scout it is false.

### 6. cron.md cross-reference

KE-572 already documented that the `"heartbeat": false` opt-out (`heartbeat.md` line 36) has zero users and the live disable mechanism is `enabled: false` in `cron.json`. That same drift is present on `heartbeat.md`. (The other claim — that `generateAutoHeartbeats()` produces hash-based offsets that spread heartbeats — is also conditional on no explicit `cron.json` override; today four heartbeats share `offsetMs=0` and three share `offsetMs=600000`. KE-572 covers this.)

## Falsifier

If `heartbeat.md` is updated within 7 days to (a) describe `shouldSkipHeartbeat` as a load-time gate, (b) name `genericHeartbeat` as the canonical wrapper and link `circuit-breaker.ts`, (c) mention `runRedMetricCommands` and the prior-KE injection branch of `loadMetrics`, and (d) acknowledge that arc/dev/scout currently bypass the shared loaders (or arc/dev/scout migrate to `genericHeartbeat` and the doc's claim becomes true) — KE-574 is resolved.

If `heartbeat.md` is left unchanged for 7 days **and** a new agent's heartbeat workflow is authored that copies the arc/dev/scout passthrough pattern (because the doc didn't tell them about `genericHeartbeat`), the staleness is confirmed and the proposal needs renag.

If a future commit deletes `shouldSkipHeartbeat` / `genericHeartbeat` / `runRedMetricCommands` from heartbeat-data.ts and the doc was always forward-looking rather than stale, this KE is partially wrong; rewrite as "spec drift in the other direction" in that case.

## Lane

`agents/shared/may-agent-docs/heartbeat.md` is **not** in arc's edit lane (per KE-450/451: lane is `arc/`, `shared/knowledge/entries/`, `shared/may-agent-docs/design/`). The proposal in `agents/arc/workspace/proposals/2026-05-03-heartbeat-md-runtime-reality-appendix.md` describes the exact patch and assigns it to dev/tech-lead/may to land. **No edit to `heartbeat.md` from this session** — out-of-lane edits get stash-swept (KE-449→KE-450 failure mode).

## Evidence pointers

- `agents/shared/may-agent-docs/heartbeat.md:1–47` — full file; check the "Data Flow", "What Gets Loaded", "Per-Agent Workflows", and "Implementation" sections against the runtime.
- `agents/shared/workflows/heartbeat-data.ts:1–14` (imports incl. circuit-breaker), `:56–104` (loadMetrics + findRelatedKEs branch), `:151–219` (loadInbox with 2h window + dedup), `:221–265` (runRedMetricCommands), `:309–375` (genericHeartbeat docstring + shouldSkipHeartbeat), `:380–510` (genericHeartbeat body with circuit breaker calls).
- `agents/{arc,dev,scout}/workflows/{arc,dev,scout}-heartbeat.ts` — the three 18-line passthroughs.
- `agents/coach/workflows/coach-heartbeat.ts` — the 140-line custom variant (uses loaders, skips genericHeartbeat).
- `agents/may/cron.json` — twelve `heartbeat-*` entries, four with `offsetMs=0`, three with `offsetMs=600000` (cross-ref KE-572).
- KE-568/570/571/572/573 — the four prior entries in this doc-vs-runtime sweep; KE-574 is the heartbeat installment.

## One-line takeaway

`heartbeat.md` describes a 2026-spring-vintage pipeline that has since grown a skip gate, a circuit breaker, a `genericHeartbeat` wrapper, a red-metric command runner, and a prior-KE injector — none of which are in the doc — while three of twelve agents (arc/dev/scout) opt out of the whole shared pipeline silently. Three paragraphs need rewriting; the proposal in `arc/workspace/proposals/` has the exact patch.
