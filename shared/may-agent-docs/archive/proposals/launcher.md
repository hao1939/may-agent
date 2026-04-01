# Launcher Design

Status: **Unimplemented proposal**. Currently `may.sh` uses tmux for background
instances. The launcher would replace bash restart loops with a TypeScript wrapper.

## Problem

Code changes to `run/*.ts` or `src/*.ts` require restarting the may-agent process. Currently:
- `may.sh cmd_run` has a bash `while true` restart loop for crash recovery
- Docker uses `entrypoint-console.sh` with a similar bash loop
- `restart-may.sh` kills the process; the bash loop respawns it
- None of these are designed for intentional hot-reload — they're crash recovery

## Proposal

A minimal wrapper process (`run/launcher.ts`) that keeps may-agent running:

```
launcher.ts (foreground process / PID 1 in Docker)
  └── spawns: may.ts (child process, inherits stdio)
        ├── owns: may.sock, may.pid, identity.json
        ├── owns: chat session, heartbeat sessions
        └── owns: cron timers, job spawning
```

### Behavior

| Child exit code | Launcher action |
|---|---|
| 0 | Clean shutdown. Launcher exits. |
| Non-zero | Crash or restart. Launcher respawns with backoff. |

That's it. The launcher reacts to child exit — nothing else.

### Crash recovery

On non-zero exit, respawn with exponential backoff + jitter:
- Base delay: 2s → 4s → 8s → 16s → max 30s
- Jitter: ±50% of base delay (e.g. 8s base → random between 4s–12s)
- Reset backoff after child runs successfully for >60s

Jitter prevents thundering herd (multiple instances crashing and restarting in lockstep) and avoids hitting the same transient failure at a deterministic interval.

### Hot-reload

Already handled: send a restart command to `may.sock` (or `./may.sh restart` which does this). The child shuts down with a non-zero exit code. The launcher sees non-zero, respawns with new code. Sessions resume from JSONL.

### Shutdown

`SIGTERM`/`SIGINT` to the launcher → forward to child → child exits 0 → launcher exits.

### What the launcher monitors

Only its direct child (the may.ts process). Job processes spawned by may.ts are may.ts's responsibility — it manages their lifecycle (overlap prevention, timeouts, cleanup on shutdown). If may.ts dies, orphaned job processes finish independently or get cleaned up on next may.ts startup via stale PID detection.

### What the launcher does NOT do

- No socket of its own — all commands go through `may.sock` to the child
- No business logic, no sessions, no cron, no agent code
- No config parsing beyond forwarding CLI args
- No state — all state lives in may.ts and `.state/`
- Minimal code, rarely needs changes itself

### Why this works

may.ts is already designed for restart:
- Persistent sessions resume from JSONL
- Compaction rebuilds from message history
- PID/socket files overwritten on start
- Cron timers restart from config
- Only loss: in-flight LLM streaming (current turn resumes from last completed message)

## Code sketch

```ts
// run/launcher.ts
import { spawn, type ChildProcess } from "node:child_process";

const args = process.argv.slice(2);
let child: ChildProcess | null = null;
let shuttingDown = false;
let backoffMs = 2000;
let lastStartTime = 0;

function spawnChild() {
  lastStartTime = Date.now();
  child = spawn("npx", ["tsx", "run/may.ts", ...args], {
    stdio: "inherit",
    env: process.env,
    cwd: process.cwd(),
  });

  child.on("exit", (code) => {
    child = null;
    if (shuttingDown || code === 0) process.exit(code ?? 0);

    // Reset backoff if child ran >60s (not a crash loop)
    if (Date.now() - lastStartTime > 60_000) backoffMs = 2000;

    // Jitter: ±50% of base delay
    const jitter = backoffMs * (0.5 + Math.random());
    const delay = Math.min(jitter, 30_000);

    console.log(`[launcher] may.ts exited (code ${code}). Restarting in ${Math.round(delay)}ms...`);
    setTimeout(spawnChild, delay);
    backoffMs = Math.min(backoffMs * 2, 30_000);
  });
}

// Forward signals to child
for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, () => {
    shuttingDown = true;
    child?.kill(sig);
    if (!child) process.exit(0);
  });
}

spawnChild();
```

## Integration

### may.sh

```bash
cmd_run() {
  # Launcher replaces the bash while-true loop
  npx tsx run/launcher.ts --keep-session --cron --telegram --openclaw
}
```

### Docker

```bash
# entrypoint-console.sh — launcher is PID 1
exec npx tsx run/launcher.ts --keep-session --cron

# restart-may.sh — send restart to child's socket, launcher respawns
echo '{"type":"restart"}' | socat - UNIX-CONNECT:/app/.state/may.sock
```

## What this replaces

| Before | After |
|--------|-------|
| `may.sh cmd_run` bash while-true loop | `launcher.ts` |
| `entrypoint-console.sh` bash while-true loop | `launcher.ts` is PID 1 |
| `restart-may.sh` kills tsx by PID | Sends restart to `may.sock`, launcher respawns |
