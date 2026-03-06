# Design: Explicit Feature Flags for may.ts

## Problem

`may.ts` is the single entrypoint for both the **main instance** (long-running, interactive, connected to Telegram) and **task instances** (ephemeral, run a single task, exit). Previously, features were gated inconsistently:

- **Cron**: gated by `--cron` flag ✓
- **Telegram**: always initialized (connected even in task mode) ✗
- **OpenClaw**: gated by env var `OPENCLAW_TARGET` (inherited by task instances) ✗
- **Console UI**: always on (ANSI codes written to log files) ✗
- **Heartbeat**: gated by `!TASK_MODE` (implicit, not explicit) ✗
- **Session persistence**: gated by `!TASK_MODE` (dual-purpose variable) ✗

Task instances would connect to Telegram, emit ANSI to log files, and inherit env-var-gated features from the parent process — all unnecessary overhead and potential side effects.

## Solution

Every feature is opt-in via an explicit CLI flag. No flag = no feature.

### Flags

| Flag | Feature | Description |
|------|---------|-------------|
| `--keep-session` | Session persistence | Resume on restart, compaction, idle prompt, stdin interaction |
| `--cron` | Cron schedulers | Periodic job execution |
| `--telegram` | Telegram bot | Bidirectional Telegram bridge |
| `--openclaw` | OpenClaw bridge | OpenClaw messaging integration (also requires `OPENCLAW_TARGET` env) |
| `--console` | Console UI | ANSI-formatted event rendering to stdout |
| `--heartbeat` | Heartbeat timer | Periodic agent wake-up from heartbeat.md |

### Data arguments (not feature flags)

| Arg | Purpose |
|-----|---------|
| `--task "msg"` | Initial task message for ephemeral sessions |
| `--task-file path` | Read initial task from file |
| `INSTANCE` env var | Instance name for PID/socket management (set by `may.sh`) |

### Invocation patterns

```bash
# Main instance — all features enabled
npx tsx run/may.ts --keep-session --cron --telegram --openclaw --console --heartbeat

# Task instance — bare minimum, ephemeral
npx tsx run/may.ts --task "evaluate unevaluated sessions"

# Task instance with named instance (via env var)
INSTANCE=job-evaluate npx tsx run/may.ts --task-file /tmp/task.txt

# No flags, no task — exits with error
npx tsx run/may.ts
# → "Error: ephemeral mode requires --task or --task-file. Use --keep-session for interactive mode."
```

### Implementation

All flags are parsed at the top of `may.ts`:

```typescript
const SCHEDULERS_ENABLED = process.argv.includes("--cron");
const TELEGRAM_ENABLED = process.argv.includes("--telegram");
const OPENCLAW_ENABLED = process.argv.includes("--openclaw");
const CONSOLE_ENABLED = process.argv.includes("--console");
const HEARTBEAT_ENABLED = process.argv.includes("--heartbeat");
const KEEP_SESSION = process.argv.includes("--keep-session");
```

Each feature section checks its flag before initializing:

```typescript
if (CONSOLE_ENABLED) attachConsoleUI(bus);
if (OPENCLAW_ENABLED && process.env.OPENCLAW_TARGET) { ... }
if (HEARTBEAT_ENABLED) { ... }
const telegramBot = TELEGRAM_ENABLED ? attachTelegramBot({...}) : { close: () => {} };
```

Safety guard for empty invocation:

```typescript
if (!KEEP_SESSION && !INITIAL_TASK) {
  console.error("Error: ephemeral mode requires --task or --task-file. Use --keep-session for interactive mode.");
  process.exit(1);
}
```

Session lifecycle uses `KEEP_SESSION`:

```typescript
const interfaceRunOpts = {
  persistent: KEEP_SESSION,
  compaction: !KEEP_SESSION ? false : { threshold: 0.6, keepRatio: 0.3, ... },
};

if (!KEEP_SESSION) {
  // Ephemeral: run task, wait, exit
  sid = manager.run(interfaceAgent, INITIAL_TASK!, interfaceRunOpts);
  await manager.waitForIdle(sid);
} else {
  // Persistent: try resume, fallback to fresh
  ...
}
```

### Key refactoring

The old `TASK_MODE` variable served two roles:
1. Boolean gate for features (`if (!TASK_MODE)`)
2. String holder for the initial task message

Now split into:
- `KEEP_SESSION` — boolean flag for session persistence and interactive features
- `INITIAL_TASK` — string from `--task`/`--task-file`, or null

### Files changed

- `run/may.ts` — flag parsing, conditional feature initialization
- `may.sh` — main instance passes all flags; task instances pass only `--task`
- `docker/entrypoint.sh` — main instance passes all flags

### What always runs (no flag needed)

- `EventBus` creation — internal plumbing
- `SubagentManager` — core session management
- Socket UI + PID file — needed for `may.sh status` and process management
- Agent loading from `agents/*/agent.json`

## Design principles

1. **Explicit over implicit** — every capability requires a flag
2. **Task mode is the default** — no flags = simplest possible execution
3. **Flags are additive** — each flag adds one capability, no interactions
4. **Data args are separate** — `--task` passes data, not a mode toggle

## Review notes

### Bob's review (approved with one fix)

**Approved:** Architecture, flag naming (`--keep-session`), separation of `KEEP_SESSION` vs `INITIAL_TASK`.

**Fixed:** Empty run guard — running with no `--task` and no `--keep-session` now exits with a clear error instead of silently passing `undefined` to `manager.run()`.

**Noted (no action):**
- Compaction disabled in ephemeral mode — acceptable; ephemeral tasks have turn limits before hitting context limits.
- Heartbeat + ephemeral is technically combinable but pointless — flags are orthogonal by design, no need to prevent it.
