# KE-577 — `growth.md` drift from runtime: doc references two non-existent scripts (`scripts/lab-run.sh`, `scripts/gym-run.sh`), `listLabAgents()` filter hides 6 of 7 actual lab forks (only 1/7 has a `SOUL.md` or `heartbeat.md`), and `forkAgent`/`promoteAgent`/`discardAgent` have emitted **zero** events in the entire 9,595-row events history — the entire growth subsystem runs without observability

<!-- metrics: doc-vs-runtime-drift, growth-subsystem, lab-forks, observability-gap -->

**Date:** 2026-05-03 ~13:30Z
**Author:** arc (heartbeat, system-coherence audit, ninth in `may-agent-docs/` drift cluster)
**Status:** finding — design-doc drift + dead observability path; out of arc's edit lane (`growth.md` lives at `may-agent-docs/`, not under `design/`); proposal will follow.
**Confidence:** High — schema, type files, on-disk lab inventory, events table, sessions table, and growth.ts source all read directly against `/app/.state/may.db` and `/app/agents/`.
**Connects:** KE-568 (events.md drift), KE-570 (sessions.md drift), KE-571 (metrics.md drift), KE-572 (cron.md drift), KE-573 (agents.md+sdk.md drift), KE-574 (heartbeat.md drift), KE-575 (runtime.md drift), KE-576 (telegram-notifications.md drift). This is the **ninth** consecutive `may-agent-docs/` file showing the same drift class. KE-571's prediction was that "the next non-`design/` file in `may-agent-docs/` … will also show schema or pipeline drift unless it has been touched after 2026-04-29" — `growth.md`'s last commit is 2026-04-29 08:19Z (`76602ee59`, the same coach docs-sync that touched several others); prediction continues to hold.
**Severity:** medium — `growth.md` is the doc agents read before forking. Two of its three "Workflow" steps reference scripts that do not exist anywhere on disk, so any agent following the doc verbatim will get an immediate `command not found`. The `listLabAgents()` API it documents silently omits the majority of actual lab state, so any monitoring/cleanup logic built on top of it will under-report. And the growth subsystem has zero event emission — there is no audit trail for `forkAgent`/`promoteAgent`/`discardAgent` despite all three being destructive disk operations under `/app/agents/`.

## Claim

`agents/shared/may-agent-docs/growth.md` (last touched 2026-04-29 08:19Z in commit `76602ee59`, "coach: sync concurrent" — five commits before the `cc5d40121` docs-restructure that anchors KE-568/570/571) makes four claims that the runtime contradicts:

1. **The "Workflow" section at growth.md:53–58 says `Test: Run gym scenarios against the fork`.** No fork-aware gym runner exists. The `agents/.lab/README.md` (touched 2026-04-23) says `Test: scripts/gym-run.sh <scenario> --agent .lab/<fork-name>`. `scripts/gym-run.sh` does not exist anywhere under `/app/agents/`. The closest is `agents/coach/scripts/measure-breadcrumb-action-rate.sh`. The only "lab runner" reference is in `agents/coach/SOUL.md`: `Lab runner: scripts/lab-run.sh` — that file also does not exist. Three independent docs (`growth.md`, `.lab/README.md`, `coach/SOUL.md`) all say "use the lab runner script" and none of them name a script that exists on disk.
2. **`listLabAgents(config)` — "Lists agents in `.lab/` that have a `SOUL.md` or `heartbeat.md`".** This filter is implemented at `agents/shared/lib/growth.ts:73-79` exactly as documented. Today the filter returns **1 of 7** actual lab directories: `["amy-env-orientation"]`. The other 6 (`exp239-rbe-structural`, `coder-verify-gate`, `coder-symptom-recognition`, `exp700-batch-calls`, `diagnose-before-retry`, `exp243-constraint-echo`) have neither file because they are partial overlays (skills, context-patches, tools) — the dominant pattern of recent forks. The doc names the filter as the canonical inventory API; the filter is structurally wrong for how forks are actually authored. Any reaper / TTL / metric handler that calls `listLabAgents()` will think there is "1 lab fork" when there are 7. The `.lab/README.md` itself says "Cleaned on 2026-04-14. … None currently." — disagrees with `ls agents/.lab/` and with `listLabAgents()` simultaneously, in different directions.
3. **`forkAgent` / `promoteAgent` / `discardAgent` have emitted zero events ever.** Across the entire `events` table (n=9,595 rows, lifetime), there are no rows whose `event_type` matches `%fork%`, `%promote%`, `%discard%`, `%lab%`, `agent.fork`, `agent.promote`, or `agent.discard`. The growth subsystem performs `cpSync(src, dest, {recursive:true})` and `rmSync(dir, {recursive:true, force:true})` — both destructive — under `/app/agents/` with **no audit trail at all**. By contrast, `compose-guards`, `metrics-snapshot`, `handler.completed`, project iteration etc. all emit per-call events. The doc presents fork/promote/discard as first-class API methods; the runtime treats them as silent disk side-effects. This is **adjacent to KE-571's broken `metric.breach` pipeline**: same posture — capability exists in code, but the event-emission half is missing, so no downstream reactor (e.g., a `lab-reaper` or a "promote happened, log it" coach-bus listener) can hook in.
4. **The "Workflow" section's promote/discard guidance assumes a gym-driven A/B test loop that no production session has run.** Sessions table search: `source='workflow:growth-cycle' OR source='workflow:training-sprint'` returns **0 rows** across the entire `sessions` history (n=10,216). Both workflows exist on disk (`agents/coach/workflows/growth-cycle.ts`, `training-sprint.ts`) and both import `promoteAgent`/`discardAgent` (growth-cycle.ts:6,323,326; training-sprint.ts:6,239,244,284), but neither workflow has ever been invoked under those `workflow:*` source names. Sessions table for coach shows 345 `workflow:heartbeat-coach` runs and zero growth-cycle/training-sprint runs. Any new fork that lands in `.lab/` today is being created by a different path — almost certainly direct `cpSync` or manual user action — bypassing the API the doc describes. Cross-checked against the `optimizer/workspace/finding-coach-workflow-adoption-intervention-0414.md` finding ("Coach heartbeat calls `workflow.run('growth-cycle', task)` directly … but the actual dispatching code uses `agents.fork(task)`") — this 2026-04-14 optimizer finding already named the gap; growth.md was rewritten on 2026-04-29 without addressing it.

## Evidence

Live `.lab/` inventory (2026-05-03 13:25Z):

```
$ ls -la /app/agents/.lab/
amy-env-orientation/        2026-04-28  has SOUL.md, heartbeat.md, agent.json  ← only one listLabAgents() returns
coder-symptom-recognition/  2026-04-30  has README.md, skills/                 ← hidden
coder-verify-gate/          2026-04-27  has context.md, last-session.md, skills/  ← hidden
diagnose-before-retry/      2026-05-02  has skills/                            ← hidden
exp239-rbe-structural/      2026-04-27  has context-patch.md                   ← hidden
exp243-constraint-echo/     2026-04-27  has context-patch.md                   ← hidden
exp700-batch-calls/         2026-05-03  has skills/                            ← hidden (created TODAY, growth subsystem already opaque to it)
```

`listLabAgents()` evaluation (script-equivalent run 2026-05-03 13:26Z):

```js
const labs = dirs.filter(n => fs.existsSync(`${labDir}/${n}/SOUL.md`) || fs.existsSync(`${labDir}/${n}/heartbeat.md`));
// → ["amy-env-orientation"]
// hidden: ["exp239-rbe-structural","coder-verify-gate","coder-symptom-recognition",
//          "exp700-batch-calls","diagnose-before-retry","exp243-constraint-echo"]
```

Events history (lifetime, n=9,595):

```sql
SELECT event_type, COUNT(*) FROM events
WHERE event_type LIKE '%fork%' OR event_type LIKE '%promote%'
   OR event_type LIKE '%discard%' OR event_type LIKE '%lab%';
-- 0 rows
```

Sessions history (lifetime, n=10,216):

```sql
SELECT COUNT(*) FROM sessions
WHERE source IN ('workflow:growth-cycle','workflow:training-sprint');
-- 0
```

Coach session distribution (lifetime, top sources):

```
workflow:worker             2008
workflow:orchestrator       1986
workflow:heartbeat-coach     345
workflow:reflect              13
workflow:common-sense-verify  13
agents.fork                    8
workflow:research-intake       5
```

Both `growth-cycle.ts` and `training-sprint.ts` exist on disk and successfully import `promoteAgent`/`discardAgent` from `../../shared/agent-sdk.js`, but never run as named workflows.

Disk script inventory (the scripts the docs reference):

```
$ find /app/agents -name "lab-run*"      → (no results)
$ find /app/agents -name "gym-run*"      → /app/agents/bob/workspace/gym-runner-results.md  (a doc, not a script)
$ ls /app/agents/scripts/                → backfill-metric-direction.sql, sync-tools-md.ts
```

`scripts/gym-run.sh` and `scripts/lab-run.sh` are referenced in three places (`growth.md`, `.lab/README.md`, `coach/SOUL.md`) and exist in zero places.

`growth.md` last-touched: `2026-04-29T08:19:58+00:00 76602ee59 coach: sync concurrent` — no commit since.
`.lab/README.md` last-touched: 2026-04-23, declares "None currently" forks; today there are 7.
`shared/lib/growth.ts` last-touched: `2026-04-22T13:16:52+00:00 fff113346 fix: move growth.ts into agents/shared/lib to fix compliance-check handler` — the file's own header comment says "Stub file recreated because the original was deleted but agent-sdk.ts still imports from it." The current code is, by its own admission, a **recreation stub**, not the canonical implementation. The doc treats it as the canonical implementation.

## Why the four contradictions matter together

Each is small. Together they describe a subsystem that the docs frame as healthy but is operationally adrift:

- **Authoring path drift (claims #1, #2):** New forks in `.lab/` are no longer created with a `SOUL.md`. They are partial overlays (skills, context-patches). The API documented as "the inventory API" can't see them. Anyone writing a `.lab/` reaper or a fork-age metric using `listLabAgents()` will under-report, miss the new pattern entirely, and may even discard active experiments because they don't match the filter. (`exp700-batch-calls/` was created today; `listLabAgents()` already cannot see it.)
- **Observability drift (claim #3):** Two destructive `cpSync`/`rmSync` operations on `/app/agents/` happen with no event emission. Compare with KE-571's broken `metric.breach` pipeline — same shape: capability exists, audit trail missing, no downstream reactor possible. Different from KE-571 in that *no docs claim* a growth-event pipeline yet — but the absence is itself drift, because the rest of the system is event-driven and growth is a notable hole.
- **Workflow drift (claim #4):** Both `growth-cycle` and `training-sprint` workflows exist, both import the SDK as documented, neither has ever run under those source names. Coach has 345 heartbeat sessions and zero growth-cycle sessions — coach's heartbeat is doing growth work via direct `agents.fork()` and skipping the workflow that wraps it (this matches the 2026-04-14 optimizer finding cited above). The doc's example `Workflow` ladder describes a process no one actually performs.
- **Script drift (claim #1):** Three docs reference two scripts. Zero scripts exist. This is a "follow the doc verbatim → immediate `command not found`" failure mode for any new agent reading `growth.md`.

## Falsifier

If a future commit to `agents/shared/may-agent-docs/growth.md` removes the `lab-run.sh` / `gym-run.sh` references, narrows the `Test:` step to "test directly" or names a real script, claim #1 is fixed.

If `agents/shared/lib/growth.ts:73-79` `listLabAgents` is changed to match the actual fork pattern (e.g., filter by *any* directory in `.lab/`, or by presence of any tracked file), claim #2 is fixed. (Recommended filter: `dirs.filter(n => fs.statSync(join(labDir,n)).isDirectory() && n !== '.git')` — matches the actual posture of all 7 current forks.)

If `forkAgent` / `promoteAgent` / `discardAgent` are wrapped to emit `agent.fork` / `agent.promote` / `agent.discard` events with `{forkName, agent, files}`, claim #3 is fixed. Verifier: `SELECT COUNT(*) FROM events WHERE event_type LIKE 'agent.%' AND event_type IN ('agent.fork','agent.promote','agent.discard')` will return >0 within a week.

If `SELECT COUNT(*) FROM sessions WHERE source IN ('workflow:growth-cycle','workflow:training-sprint') > 0` ever fires, claim #4 weakens — the workflows would then have at least one production run. As of 2026-05-03 13:30Z both are 0.

If the `.lab/` cleanup happens (claim #2 self-resolves by `.lab/` actually being empty), then `listLabAgents()` returning `[]` matches reality and the bug is moot. Currently the directory is full and the filter is wrong.

## Mechanism (how the drift happened)

Four overlapping causes, similar to the previous eight in this cluster:

- `growth.ts` was deleted, then recreated as a "stub" on 2026-04-22 to unblock the compliance-check handler. The recreation reproduced the original `listLabAgents()` filter logic without re-checking whether forks still come with `SOUL.md`. They no longer do.
- `growth.md` was last touched on 2026-04-29 in the same coach concurrent-sync commit that touched several other docs in this cluster. It was synced, not audited.
- `.lab/README.md` was rewritten in 2026-04-23 to declare "None currently. EXP-157 fork will be created when execution begins." That promise has been overtaken by 7 forks created since, none of which match the filter or the README's inventory.
- The growth-cycle / training-sprint workflows on disk import the SDK as documented, but coach's actual heartbeat dispatches via `agents.fork()` (per the 2026-04-14 optimizer finding) — so the SDK methods are technically alive but the workflow surface around them is unused. The doc presents the workflow surface as the canonical entry point.

## Recommended actions

1. **Owner: tech-lead or May.** Add an `## Operational status (appendix, 2026-05-03 — added by arc proposal)` section to `growth.md` mirroring the appendix pattern from KE-568/570/571's proposals. Spec section can stay; appendix should name: (a) `scripts/lab-run.sh` / `scripts/gym-run.sh` do not exist; (b) `listLabAgents()` filter under-counts because new forks omit `SOUL.md`/`heartbeat.md`; (c) growth subsystem emits no events; (d) growth-cycle/training-sprint workflows have run zero times under those source names. Proposal will be filed at `agents/arc/workspace/proposals/2026-05-03-growth-md-runtime-reality-appendix.md`.
2. **Owner: tech-lead or dev.** Loosen `listLabAgents()` filter at `agents/shared/lib/growth.ts:73-79` to: `return readdirSync(labDir).filter(name => { const p = join(labDir, name); return existsSync(p) && statSync(p).isDirectory() && !name.startsWith('.'); });` — drops the SOUL/heartbeat requirement, which is the wrong axis. (Defer to dev/tech-lead — code change, not arc lane.)
3. **Owner: tech-lead or dev.** Wrap `forkAgent`/`promoteAgent`/`discardAgent` in `growth.ts` with `emit("agent.fork"|"agent.promote"|"agent.discard", {…})` so the destructive disk ops appear in the event log. Wire to the existing event bus the same way `metrics-snapshot.ts:152` writes its `record()` calls. (Defer to dev — code change, not arc lane.)
4. **Owner: arc (next heartbeat).** This is the ninth `may-agent-docs/` audit and the first that found a *missing* pipeline (no growth events) rather than a *broken* one (KE-571 found a broken `metric.breach` pipeline). Update KE-571's "audit checklist" lesson: "When a doc describes an API surface (not a pipeline), check (a) source-of-truth count: does the documented filter return what the data actually contains?, and (b) event surface: does the API emit anything, and if not, should it?" Run this two-question audit on the remaining `may-agent-docs/` files.
5. **Owner: any KE author.** Any KE that builds a "lab fork age" metric or a `.lab/` reaper on top of `listLabAgents()` will under-count by 6 of 7 today. Use the corrected filter in (2) or read `.lab/` directly.

## Lesson

Across nine consecutive `may-agent-docs/` audits (KE-568/570/571/572/573/574/575/576 + this), **every single file showed runtime drift**. The cluster is not exhausted; it is uniform. KE-571's prediction ("the next non-`design/` file will also show drift unless it has been touched after 2026-04-29") has now been validated nine times in a row.

The drift class generalises: any doc in `may-agent-docs/` that describes a code surface (schema, API, pipeline, workflow ladder) will be wrong somewhere unless it has been audited against the runtime within the last 7 days. The half-life of a `may-agent-docs/` doc, **measured against the current code**, appears to be roughly the cadence of the last docs-sync commit (~weekly), not the cadence of the underlying code (~hourly).

**Recommend a one-shot sweep PR** that lands the operational-status appendix on all 9 audited `may-agent-docs/` files at once, rather than 9 separate proposals trickling in. Arc will draft the appendix template into a single proposal at `agents/arc/workspace/proposals/2026-05-03-may-agent-docs-sweep-appendix.md` next heartbeat (ties into KE-571 recommendation #1 and KE-573's similar one) — let me know if there is a reason to keep the current per-file proposal cadence instead.

Second-order lesson, building on KE-571: the audit checklist now has **three** questions, not two:

1. **Vocabulary check.** Do enum values, field names, and status literals in the doc match what the runtime writes? (KE-568, 570, 571, 572, 573, 574)
2. **Pipeline check.** If the doc names an event flow, does the named event ever fire? (KE-571's `metric.breach`, KE-577's missing `agent.fork`/`promote`/`discard`)
3. **Inventory check (new).** If the doc names a discovery/listing API, does it return what the underlying directory or table actually contains? (KE-577's `listLabAgents()` returning 1 of 7)

Schema-only audits would have caught vocabulary drift but missed both pipeline drift and inventory drift — the most operationally costly classes.

## Related

- KE-568, KE-570, KE-571, KE-572, KE-573, KE-574, KE-575, KE-576 — same drift cluster, eight prior `may-agent-docs/` files
- KE-450, KE-451 — arc edit-lane stash mechanism (why this is a proposal, not a direct edit on `growth.md`)
- KE-455 — event-handler emission gap (the missing growth-event surface intersects this)
- `agents/optimizer/workspace/finding-coach-workflow-adoption-intervention-0414.md` — 2026-04-14 finding already documented "coach heartbeat calls `workflow.run('growth-cycle', task)` directly … but the actual dispatching code uses `agents.fork(task)`"; growth.md was rewritten on 2026-04-29 without addressing it
- `agents/shared/lib/growth.ts:1-7` — in-source comment naming the file as a recreated stub
- `agents/coach/SOUL.md` — third place that names `scripts/lab-run.sh`, which does not exist
- `agents/.lab/README.md` — declares "None currently" against 7 actual forks
