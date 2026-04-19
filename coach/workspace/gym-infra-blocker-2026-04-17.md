# P1 Infra Blocker: Gym runner cannot launch any agent (2026-04-17)

**Discovered during**: Weekly promoted-skill regression check (work session).
**Status**: BLOCKED — regression run could not execute. 0/3 scenarios launched.
**Impact**: All gym runs abort with `Agent failed to launch (status: error, no sessionId)`. Affects every scenario + every agent.

## Symptom

```
$ scripts/gym-run.sh efficient-file-reading --agent coder
  ABORT: agent failed to launch — skipping scoring
  "summary": "FAIL: agent failed to launch"
```

Reproduces for all 3 promoted-skill scenarios (efficient-file-reading, plan-once-amend, convention-verify-edit).

## Root cause

`src/app/agent-loader.ts :: VALID_TOOL_PRESETS` is missing entries that current `agent.json` files declare. On load, every agent fails validation, so `manager.hasAgent(...)` is false and may.ts exits with "Agent X is not registered. Available: ".

Running `/usr/local/bin/may-agent --oneshot --agent coach --console` prints:
```
[loader] Skipped agents with config errors:
  master.tools: Unknown tool preset "cite-source"
  ... (19 agents)
  coach.tools: Unknown tool preset "notify"
  coach.tools: Unknown tool preset "cite-source"
  ...
Loaded 0 agent(s):
```

Both binaries are affected:
- `/usr/local/bin/may-agent` (supervised process, built 07:22Z): accepts neither `notify` nor `cite-source`.
- Freshly rebuilt `/app/bundle/may-agent` (built from working tree): accepts `notify` but not `cite-source`.

The `review/notify-tool-split` branch worktree has uncommitted reverse-edits to `src/app/agent-loader.ts` that remove `notify` from VALID_TOOL_PRESETS (see `git diff HEAD -- src/app/agent-loader.ts` — appears to be an interrupted rebase/stash state). Even without those edits, HEAD (commit d15c5249) is missing `cite-source`/`cite_source` — those were added in commit 23920774 but the split-notify commit (d15c5249) appears to have lost them.

## Ownership

- Split-notify refactor: may (d15c5249, 16:34Z today)
- Cite-source presets: likely tech-lead / feedback-loop owner (23920774, 15:10Z today)

Both landed on the same day; d15c5249 dropped the cite-source entries.

## Fix sketch

Add back to `VALID_TOOL_PRESETS` in `src/app/agent-loader.ts`:
```
  "cite-source",
  "cite_source",
```
Then `bun run bundle` and reinstall `/usr/local/bin/may-agent` (or supervisor reload). After fix, re-run regression check.

## What I could NOT do this session

- Could not verify any of the 3 promoted skills still pass — gym runner is unusable.
- Did NOT patch agent-loader.ts: this is may/tech-lead territory and I'm on an unknown-state branch (`review/notify-tool-split`) with uncommitted WIP.

## Recommended next steps

1. Flag to may (or branch owner of `review/notify-tool-split`) to resolve the uncommitted agent-loader.ts diff + add cite-source back.
2. After fix, re-run `scripts/gym-batch.sh --scenario efficient-file-reading --scenario plan-once-amend --scenario convention-verify-edit --agent coder --trials 1 --tag coach-weekly-regression-2026-04-17`.
3. Update todo.md "Gym Regression Cadence" with results.
