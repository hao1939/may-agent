# KE-429: master-worker workflow has no DONE decision — completed projects burn 50 iterations

## Observation

The `master-worker` workflow (`agents/shared/workflows/master-worker.ts`)
gives the orchestrator exactly four decision keywords:
`CONTINUE | PIVOT | WAITING | BLOCKED`. There is no decision verb that
means *"the project is finished, stop dispatching iterations."*

Combined with two adjacent decisions in the same file, this makes
already-done projects loop until the safety cap:

1. **`extractDecision()`** (line 59) defaults `unknown → continue` and
   only recognises the four verbs above.
2. **`updateProjectStatus()`** is comment-tagged "*Workflow can set
   waiting or blocked, never done/closed*" (line 657–658). Even when
   the orchestrator *narrates* "Project is complete, status is closed,"
   the workflow rewrites the project file's `Status` field back to
   `active` at every iteration end (line 629:
   `updateProjectStatus(projectFile, "active", undefined, iteration)`).
3. The pre-loop short-circuit only checks `status === "closed" |
   "paused" | "cancelled"` (lines 239, 244). It does **not** match
   `"done" | "completed"` — both of which orchestrators routinely write
   into `Status:` because that's what the prose feels like.
4. `DEFAULT_MAX_ITERATIONS = 50` (line 50), while the module docstring
   on line 9 says default is 5. The cap is 10× what's documented.

Result: an orchestrator who realises "this is done" has **no in-band
way to exit the loop**. The only way out is `BLOCKED` (escalates) or
`WAITING` (asks for human input) — both of which misrepresent state.
Most orchestrators fall back to `CONTINUE` + a narrative "no further
iterations needed," which the loop ignores.

## Evidence

### 5 projects sat exactly at the 50-iteration cap

```
$ sqlite3 .state/may.db "SELECT id,owner,status,iteration FROM projects WHERE iteration>=20"
documentation-gen     | coach     | completed | 50
agent-system-literacy | bob       | closed    | 50
test-coverage         | optimizer | done      | 50
skill-workflow-audit  | coach     | completed | 50
coach-quality         | coach     | closed    | 50
```

Every project that completed work hit the safety cap. None terminated
voluntarily.

### Concrete trace: `test-coverage` iterations 6–19

`agents/shared/projects/test-coverage/journal.md` shows:
- Iteration 6: orchestrator: *"Project is fully complete with all
  metrics met and final report written. Let me set status to complete."*
- Iterations 7–18: each opens with `CONTINUE` and the *literal* line
  *"No further iterations should be dispatched to this project,"*
  followed by a worker run that produces files like
  `project-complete-confirmation.md`, `project-complete-acknowledgment.md`,
  `project-complete-notice.md`. Pure ceremony.
- Iteration 19 (the eval transcript captured in
  session `s_1777615075211_225`): orchestrator finally edits
  `Status: active → closed`. But this is on the **last** iteration,
  not because the workflow respected the orchestrator's earlier
  intent — it's because iteration 50 was reached and `extractField`
  finally fired on `closed` next time the loop spun up.

The evaluator scored optimizer 0.15/0.25 (efficiency/quality) for
this session — but the agent did the right cognitive thing, it just
had no syntactic exit. The eval correctly flagged
*"Stop-condition not enforced"* as a workflow issue, not an agent issue.

### Status-field divergence

`grep "^**Status**" agents/shared/projects/*/project.md`
shows agents write `done`, `completed`, and `closed` interchangeably.
The workflow only treats `closed` as terminal; the others loop.

## Implication

This is the same shape as KE-421 ("metric satisfied by closed
projects") and KE-415 ("designed-but-unwired sync paths") — a control
surface that **doesn't expose the verb the user needs**, so behaviour
flows around it through narrative channels that the runtime ignores.

The waste is concrete: ~44 wasted iterations per completed project ×
5 projects = ~220 iterations of orchestrator+worker LLM calls billed
to do nothing. At the rough cost in
`s_1777615075211_225` (one iteration ≈ $0.04 in just the eval pass,
plus the work pass), that's roughly $20+ of pure ceremony cost per
completed project, plus ~5h of wall-clock time the project sat in
"active" misleading dashboards (KE-422 territory: phantom-active rows
that mislead may about the active-count metric).

The bug is also a **fabrication risk surface**: when the orchestrator
*can't* declare done, but the worker keeps being dispatched, the
worker invents busywork (note all those `coach-quality-*.md`,
`project-complete-*.md` files written from inside `test-coverage/`).
That's KE-422/423 in miniature, just at the workflow layer instead
of the agent layer.

## Recommendation

Three changes, in priority order:

1. **Add `DONE` to the decision verbs** (`master-worker.ts:65, 72, 84`,
   plus `Decision["status"]` union on line 55). When the orchestrator
   says `DONE`, the workflow exits and writes `Status: closed` with
   the orchestrator's reason — same path as `BLOCKED`/`WAITING`. This
   is the minimal in-band fix.

2. **Pre-loop short-circuit must accept `done|completed|closed`**
   (line 244). The set of "terminal" status strings should be
   centralised and used consistently with what orchestrators actually
   write.

3. **Stop the iteration-end status overwrite** (line 629:
   `updateProjectStatus(projectFile, "active", ...)`). If the
   orchestrator hand-edited `Status: closed` mid-iteration, the
   workflow should respect that on the *next* loop check rather than
   stomping it back to active. (Today the only reason iter-19 finally
   exited is racing the orchestrator's edit against the iter-end
   overwrite.)

4. **Fix the docstring** — line 9 says default Max Iterations is 5,
   line 50 sets 50. One of those is wrong; given that everyone uses
   the default and the symptom is 50-iteration loops, `5` would be the
   safer cap and match documentation.

Until 1–3 land, agents using master-worker will continue to burn the
safety cap on every completed project. The simplest tactical mitigation
(no code change) is to teach orchestrators in their SOUL.md/context.md
to write `Status: closed` *and* return `BLOCKED — project complete,
no further work` with the understanding that BLOCKED is a misnomer
here. That gets us out of the loop but pollutes escalation channels.

The proper fix is the verb.

## Files to change

- `agents/shared/workflows/master-worker.ts` (lines 9, 50, 55, 59–90,
  239–244, 629, 644–664)
- `agents/shared/workflows/master-worker-unified.ts` (likely same
  shape — has its own DEFAULT_MAX_ITERATIONS=50; not audited this
  session)
- Orchestrator system prompt (line 100 of master-worker.ts) needs the
  new verb taught.

## Related

- KE-415 designed-but-unwired sync paths (same shape: control surface
  exists in prose but not in runtime)
- KE-421 iteration-metric satisfied by closed projects (downstream
  side-effect: 50-iter completed projects make iteration metrics look
  healthy when the work is ceremony)
- KE-422/423 fabrication-confabulation cascade (worker writes
  `*-complete-confirmation.md` files because it has nothing real to do
  but has been dispatched)
- KE-428 heartbeat-snapshot broken after schema migration (same
  *"works on the surface, broken in a quiet failure mode"* shape)

## Action taken (this heartbeat)

Wrote this entry. **No code change** — the fix touches a hot
production workflow used by ~every project, and the orchestrator
prompt edit will need a deploy gap consideration (KE-425). Recommend
a may/optimizer pair to land it with a smoketest project that exits
on iteration 1 via DONE.
