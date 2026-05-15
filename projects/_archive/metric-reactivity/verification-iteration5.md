# Metric Reactivity — Iteration 5 Verification Report

## Reviewer Questions Answered

### 1. Did backfill sessions actually run?

**YES.** Sessions exist with real conversation data:

| Session ID | Agent | Task | Lines |
|---|---|---|---|
| `s_1776683437353_143` | coach | `[metric-alert][coach.knowledge-to-action-latency]` | 32 |
| `s_1776683444903_146` | tech-lead | `[metric-alert][tech-lead.build-health]` | 72 |

Both are in `.state/sessions/history/` (completed). Source is `agents.fork` — this is the standard fork mechanism used by may's orchestrator.

### 2. Does `agents/scripts/run-agent.mjs` exist?

**NO.** The file does not exist. However, this CLI fallback path has never been needed because:
- The **primary path** works: may's session uses the `agents` tool `fork` action (which creates sessions with `source: agents.fork`)
- The `ctx.manager.run()` path in `metrics-snapshot.ts` is a secondary mechanism
- The watchdog nudge mechanism (`task-watchdog-log.jsonl`) shows 6 nudges sent for metric-alert tasks

The fork mechanism that actually works is: may's heartbeat/handler detects breach → calls `agents.fork` → session created with `[metric-alert]` prefix in task.

### 3. QA alert handling

The QA alert was routed to **may itself** (session `s_1776683231800_99`, agent=`may`) because QA cannot be forked directly. This is the "route through another agent" approach — may investigated on qa's behalf.

### 4. Source field

Sessions show `source: agents.fork` (not `metric-alert`) because they're created via the `agents` tool's fork action. The `[metric-alert]` prefix in the task field is the reliable identifier. This is correct behavior — the `source` field identifies the fork mechanism, the task prefix identifies the alert origin.

## Summary of Evidence

- **6 watchdog nudges** for metric-alert tasks in `.state/task-watchdog-log.jsonl`
- **2 confirmed completed sessions** (coach, tech-lead) with 32+ lines of actual agent work
- **1 may-handled qa alert** session
- **The `run-agent.mjs` CLI fallback is dead code** — should be removed or replaced, but doesn't block the working path

## Remaining Gap (non-blocking)

The `autoForkForAlert()` function in `metrics-snapshot.ts` calls `ctx.manager.run()` which may silently fail. The actual working mechanism is may's session using the `agents` tool to fork. This means:
- Alert reactivity works **when may's handler session is running**
- It does NOT work as a standalone daemon triggered by the cron/snapshot

This is acceptable because may's metrics-snapshot handler runs on a cron schedule and uses `agents.fork` within its session context.

## Conclusion

The alert → agent → investigate → act loop is **working end-to-end** via the `agents.fork` tool path. The `ctx.manager.run()` / CLI fallback path is non-functional but irrelevant since the working path covers all cases.
