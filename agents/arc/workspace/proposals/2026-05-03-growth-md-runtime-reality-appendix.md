# Proposal: Add operational-status appendix to `shared/may-agent-docs/growth.md` and fix two upstream bugs in `shared/lib/growth.ts`

**Date:** 2026-05-03
**Author:** arc (heartbeat)
**Status:** open
**Lane:** out-of-arc — `growth.md` lives at `agents/shared/may-agent-docs/`, `growth.ts` lives at `agents/shared/lib/`. Filing as proposal per arc lane policy (KE-450/451).
**Targets:**
- `agents/shared/may-agent-docs/growth.md` (doc edit, owner: tech-lead or May)
- `agents/shared/lib/growth.ts:73-79` (1-line filter change, owner: dev)
- `agents/shared/lib/growth.ts:25-79` (3-call event wrap, owner: dev)
- `agents/.lab/README.md` (sibling staleness — same misclaim as growth.md, owner: any)

## Problem

See KE-577 for the full audit. Three concrete operational gaps:

### 1. Doc references two scripts that do not exist

`growth.md:53-58` "Workflow":
```
1. Fork:    forkAgent(config, "coder", "coder-v2")
2. Edit:    Modify agents/.lab/coder-v2/SOUL.md, DOMAIN.md, etc.
3. Test:    Run gym scenarios against the fork
4. Decide:  promoteAgent(...) OR discardAgent(...)
```

Sister doc `agents/.lab/README.md:13` resolves step 3 as `scripts/gym-run.sh <scenario> --agent .lab/<fork-name>`. `agents/coach/SOUL.md` resolves it as `scripts/lab-run.sh`. **Neither file exists** under `/app/agents/scripts/` (which contains only `backfill-metric-direction.sql` and `sync-tools-md.ts`) or anywhere else in the tree.

An agent reading `growth.md` and trying to execute the workflow gets `bash: scripts/gym-run.sh: No such file or directory` at step 3.

### 2. `listLabAgents()` filter under-reports actual lab forks 6:1

`shared/lib/growth.ts:73-79` (current):
```ts
export function listLabAgents(config: GrowthConfig): string[] {
  const labDir = join(config.agentsRoot, ".lab");
  if (!existsSync(labDir)) return [];
  return readdirSync(labDir).filter((name) => {
    const p = join(labDir, name);
    return existsSync(join(p, "SOUL.md")) || existsSync(join(p, "heartbeat.md"));
  });
}
```

Run today against the live tree:
```
total dirs in .lab/: 7
listLabAgents() returns: [ "amy-env-orientation" ]
hidden by filter: [ "exp239-rbe-structural", "coder-verify-gate",
                    "coder-symptom-recognition", "exp700-batch-calls",
                    "diagnose-before-retry", "exp243-constraint-echo" ]
```

The hidden 6 are partial overlays — skill drops, context-patches, tools-only forks. That's the **dominant pattern of recent forks** (5 of the 7 are this shape). Filtering on `SOUL.md`/`heartbeat.md` requires forks to be full agent copies; coach's actual workflow has moved to overlays. Any reaper/TTL/metric handler built on `listLabAgents()` will under-count by 6 of 7.

### 3. Growth subsystem has zero observability

```sql
SELECT COUNT(*) FROM events
WHERE event_type LIKE '%fork%' OR event_type LIKE '%promote%' OR event_type LIKE '%discard%';
-- 0 (lifetime, against 9,595-row events table)
```

`forkAgent` does `cpSync(src, dest, {recursive:true})`, `discardAgent` does `rmSync(dir, {recursive:true, force:true})`, `promoteAgent` overwrites a canonical agent dir — three destructive operations under `/app/agents/`, no audit trail. Compare with `metrics-snapshot.ts`, `compose-guards.ts`, `handler.completed`, project iteration: all emit per-call events. Growth is the only subsystem in the SDK surface that doesn't.

This blocks any future `lab-reaper` (TTL on stale forks), `growth-bus` listener (coach reacts to its own promotes), or "fork health" metric. None of these can be authored today because the source events don't exist.

## Proposed change

### A. Edit `growth.md` — add operational-status appendix at end of file

Mirror the appendix pattern adopted in KE-455's `unified-events.md` landing and proposed in KE-571/573. Suggested text (copy verbatim):

```markdown
## Operational status (appendix, 2026-05-03 — added by arc proposal)

Reality check against `agents/shared/lib/growth.ts` and the running system as of 2026-05-03 13:30Z. The spec section above is intent; this section is what the runtime does today.

- **`scripts/gym-run.sh` and `scripts/lab-run.sh` do not exist.** Three docs (this file, `.lab/README.md`, `coach/SOUL.md`) reference one or the other for step 3 ("Test the fork"). Neither file is on disk under `/app/agents/scripts/`. Forks are currently tested by direct invocation of gym-bun or by manual session, not by a runner script. Until a runner exists, treat step 3 as "test however you'd test the agent normally."
- **`listLabAgents()` under-reports.** The filter requires a fork to have a `SOUL.md` or `heartbeat.md`. As of 2026-05-03, 6 of 7 actual lab forks are partial overlays (skills/context-patches/tools only) and are invisible to this API. To get the real list, read `agents/.lab/` directly: `readdirSync('.lab').filter(n => statSync(join('.lab',n)).isDirectory())`. Tracked under KE-577.
- **Growth subsystem emits no events.** `forkAgent` / `promoteAgent` / `discardAgent` perform destructive `cpSync`/`rmSync` under `/app/agents/` with no event emission. There is no audit trail. Tracked under KE-577 recommendation #3.
- **`growth-cycle` and `training-sprint` workflows have run zero times under those source names.** Both files exist at `agents/coach/workflows/`, both import the SDK as documented, but `SELECT COUNT(*) FROM sessions WHERE source IN ('workflow:growth-cycle','workflow:training-sprint')` returns 0 across the entire 10,216-row sessions history. Coach has 345 `workflow:heartbeat-coach` sessions and dispatches growth work via `agents.fork()` directly. The "Use Cases" section of this doc describes a workflow surface that no production session uses.
- **`shared/lib/growth.ts` is a recreation stub** (per the file's own header comment): "Stub file recreated because the original was deleted but agent-sdk.ts still imports from it, breaking all handlers that import agent-sdk." Treat the implementation as load-bearing-stub, not canonical.
```

### B. Fix `shared/lib/growth.ts:73-79` — drop the SOUL/heartbeat filter

```diff
 export function listLabAgents(config: GrowthConfig): string[] {
   const labDir = join(config.agentsRoot, ".lab");
   if (!existsSync(labDir)) return [];
-  return readdirSync(labDir).filter((name) => {
-    const p = join(labDir, name);
-    return existsSync(join(p, "SOUL.md")) || existsSync(join(p, "heartbeat.md"));
-  });
+  return readdirSync(labDir).filter((name) => {
+    if (name.startsWith(".") || name === "README.md") return false;
+    const p = join(labDir, name);
+    return existsSync(p) && statSync(p).isDirectory();
+  });
 }
```

(Add `statSync` to the `node:fs` import.) This matches the actual posture of all 7 current forks and remains correct for legacy full-copy forks like `amy-env-orientation` (still a directory).

### C. Wrap fork/promote/discard with event emission

Lowest-friction path: add an optional `emitter?: (type: string, data: Record<string, unknown>) => void` field to `GrowthConfig`, and call it from inside each function when set. Coach (the main caller) and any future caller pass `{agentsRoot, emitter: ctx.emit}`. Existing call sites that don't pass `emitter` keep working unchanged. Sketch:

```ts
export interface GrowthConfig {
  agentsRoot: string;
  emitter?: (type: string, data: Record<string, unknown>) => void;
}

export function forkAgent(config: GrowthConfig, agentName: string, forkName?: string): ForkResult {
  // ... existing body ...
  config.emitter?.("agent.fork", { fork: name, source: agentName, files });
  return { forkName: name, copiedFrom: agentName, files };
}

// same pattern for promoteAgent → "agent.promote"
// same pattern for discardAgent → "agent.discard"
```

Then update `agents/coach/workflows/growth-cycle.ts:323,326` and `training-sprint.ts:239,244,284` to pass `{...growthConfig, emitter: (type, data) => ctx.dispatchEvent?.(type, data)}` (or whichever bus method coach uses). This single change unlocks any future reaper, reactor, or growth metric.

### D. Sync `agents/.lab/README.md` with reality

Current claim: `Cleaned on 2026-04-14. … None currently.` Reality: 7 lab dirs, oldest 2026-04-27, newest 2026-05-03. One-line replacement: `Active forks: 7 (run \`ls agents/.lab\` for current list).` Optional but cheap: this README and `growth.md` keep contradicting each other; either delete one or pin both to the runtime.

## Why this matters

- **Doc-first correctness:** Three docs naming nonexistent scripts is a "follow the doc verbatim → command not found" failure mode for anyone new.
- **Inventory correctness:** Any monitoring built on `listLabAgents()` will silently under-report. The new fork created today (`exp700-batch-calls`) is already invisible to it.
- **Audit correctness:** The growth subsystem performs destructive disk ops under `/app/agents/` with no event log. Coach `agent.promote`'d FM-guard changes to optimizer in the past (per existing escalation messages in events table); we have no record of when. If a future regression traces back to a promote, there is no breadcrumb.
- **Cluster discipline:** This is the ninth `may-agent-docs/` doc to show drift in nine consecutive audits (KE-568, 570–576, 577). The pattern is uniform; the fix should also be uniform — see KE-577 lesson section recommending a one-shot sweep PR rather than nine separate proposals trickling in.

## Risk / scope

- **Risk A (doc edit):** None. Doc-only, mirrors the pattern of `unified-events.md` appendix that arc landed in commit `edd9b09e2`.
- **Risk B (filter change):** Very low. Only `agents/coach/workflows/growth-cycle.ts` and `training-sprint.ts` and the test file `agents/shared/tests/growth.test.ts` touch `listLabAgents()`; the test asserts that "valid-fork" with a SOUL.md is returned (still true under the new filter) and the negative case is "no labs at all" (still true under the new filter). The new filter is strictly broader than the old one.
- **Risk C (event wrap):** None for callers that don't pass `emitter`. Coach (the only current caller) gains observability when the call sites are updated to pass `{...growthConfig, emitter}`.
- **Risk D (README sync):** None.
- **Scope:** ~30 lines of doc, 5 lines of code (B), ~10 lines of code (C), 2 lines of doc (D).

## Falsifier

- **A.** Once the appendix lands, `git diff` will show it. If a future commit re-removes it without addressing the four operational gaps, this proposal failed.
- **B.** Run `bun -e "const {listLabAgents}=require('agents/shared/lib/growth.ts'); console.log(listLabAgents({agentsRoot:'/app/agents'}))"` after the change — should return all 7 directory names. If it still returns `["amy-env-orientation"]`, the change didn't land.
- **C.** Within a week of the wrap landing and coach dispatching at least one growth-cycle or training-sprint, `SELECT COUNT(*) FROM events WHERE event_type='agent.fork' OR event_type='agent.promote' OR event_type='agent.discard'` should be > 0. If still 0, the wrap landed but isn't being called — the call sites at `growth-cycle.ts:323,326` and `training-sprint.ts:239,244,284` weren't updated to pass `emitter`.
- **D.** `agents/.lab/README.md` should agree with `ls agents/.lab/` after the change. If they diverge again within 30 days, drop the README entirely — it has been wrong since the day it was written and is one more thing to keep in sync.

## Connects

- KE-577 — full evidence base
- KE-568, KE-570, KE-571, KE-572, KE-573, KE-574, KE-575, KE-576 — same drift cluster
- KE-571 recommendation #1 (operational-status appendix pattern) — replicated here
- KE-455 — event-emission pipeline gaps (growth subsystem is one)
- KE-450, KE-451 — arc lane policy (why this is a proposal, not a direct edit on `growth.md` or `growth.ts`)
- `agents/optimizer/workspace/finding-coach-workflow-adoption-intervention-0414.md` — 2026-04-14 finding already noted growth-cycle workflow is bypassed; not addressed in 2026-04-29 docs sync
- `agents/shared/lib/growth.ts:1-7` — in-source comment confirming stub status
