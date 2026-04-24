# Build-Health Metric Stuck at 0

## Summary
The `tech-lead.build-health` metric has `source='command'` and a `source_command` that works when run manually, but the metric's `current` value stays at 0. The most likely cause is the **10-second command timeout** in the metrics-snapshot handler causing `execSync` to throw before `bun build` completes.

## Evidence

1. **Timeout constant**: `CMD_TIMEOUT_MS = 10_000` (`metrics-snapshot.ts:28`) — only 10 seconds for shell commands.

2. **execSync call with timeout**: The command is executed at `metrics-snapshot.ts:237-241`:
   ```ts
   const result = execSync(m.source_command, {
     cwd: ctx.projectRoot,
     timeout: CMD_TIMEOUT_MS,
     stdio: "pipe",
   }).toString().trim();
   ```
   When `execSync` times out, it throws an error. Node.js kills the child process with SIGTERM.

3. **Silent failure in catch block**: At `metrics-snapshot.ts:257-260`, the catch only logs a message via `ctx.log()` — the metric value is never updated, so `current` stays at its initial value (0):
   ```ts
   ctx.log(`[metrics-snapshot] Failed to measure ${m.id} via command: ${msg.slice(0, 200)}`);
   errors++;
   ```

4. **`bun build` is slow**: The command `bun build --no-bundle agents/may/handlers/metrics-snapshot.ts > /dev/null 2>&1 && echo 1 || echo 0` involves TypeScript compilation which can easily exceed 10 seconds, especially on first run or in resource-constrained environments.

5. **Code path is otherwise correct**: The query at `metrics-snapshot.ts:228` correctly selects `source = 'command'` metrics. The UPDATE at `metrics-snapshot.ts:252` correctly sets `current`. The logic between is sound — `parseFloat("1")` returns 1. The only failure mode is the timeout exception.

## Severity
**Medium** — The metric exists to track build health but provides no signal. Stale data may mask real build failures.

## Recommended Fix
1. **Increase `CMD_TIMEOUT_MS`** at `metrics-snapshot.ts:28` from `10_000` to `30_000` (30s) or `60_000` (60s) to accommodate `bun build` times.
2. **Alternative**: Verify by checking May's logs for `"Failed to measure tech-lead.build-health via command"` messages — if present, this confirms the timeout theory. If absent, the handler may not be running at all (check cron execution).
3. **Secondary concern**: If `ctx.projectRoot` is incorrect or `bun` is not on PATH in the handler's execution environment, the command would also fail silently in the same catch block.
