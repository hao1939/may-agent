# Logging System Design

## Current state: 6 mechanisms, no consistency

| Mechanism | Where | Purpose | Count |
|---|---|---|---|
| `console.log()` | CLI, launcher, web server | CLI output to human/machine | 39 |
| `console.error()` | CLI, binary entry, lib | CLI errors, fatal errors | 19 |
| `console.warn()` | lib layer | Runtime warnings (no bus access) | 6 |
| `bus.emit({ type: "info" })` | may.ts, agent-loader, socket | Runtime events (catch-all) | 98 |
| `bus.emit({ type: "log" })` | agent-loader, may.ts | Structured log (new, 4 calls) | 4 |
| `this._log()` / `ctx.log()` | manager, handlers | Callback to bus (workaround for no bus access in lib) | 13 |

## What's actually happening

Four distinct **purposes**, each needing different treatment:

### 1. CLI output (not logging)

```
console.log(JSON.stringify(result))    // --oneshot JSON output
console.log(statusOutput)              // --status dashboard
console.error("Error: --task required") // CLI usage error
```

These are **program output**, not logs. They go to stdout/stderr for the human or piped program. They should stay as `console.log/error`. No logging system needed.

**Files**: may.ts (7), cli-send.ts (8), metrics.ts (20), binary-entry.ts (2), bundle-mode.ts (1).

### 2. Launcher output (separate process)

```
console.log(`[${ts}] [launcher] Starting may.ts`)
```

The launcher is a separate process that supervises the agent. It has no EventBus. `console.log` with a timestamp prefix is fine. No change needed.

**Files**: launcher.ts (8 calls, already using its own `log()` helper).

### 3. Runtime operational messages (need the event system)

```
bus.emit({ type: "info", message: `[cron] heartbeat-scout fired` })
bus.emit({ type: "info", message: `[eval] Auto-evaluation failed: ...` })
bus.emit({ type: "info", message: `[fatal] Uncaught exception: ...` })
this._log("warn", `STUCK_WARNING: Agent ...`)
```

These are **runtime events** — things that happen while the agent system is running. They need to reach all UIs (console, socket, web) and be available for monitoring. Currently split between `bus.emit({ type: "info" })` (98 calls) and `this._log()` (new, 13 calls).

The problem: `info` is a dumping ground. A cron fire and a fatal exception are both `{ type: "info", message: string }`. There's no level, no source, no structure.

### 4. Lib-layer warnings (can't reach the bus)

```
console.warn(`[persistence:jsonl] Skipping corrupted JSONL line`)
console.warn(`[active-recall] Failed for ${agentName}`)
```

These are in the `src/lib/` layer which doesn't import the EventBus (it's in `src/app/`). They use `console.warn` because they have no other option. Low volume, low priority.

## Design

### One logging function: `log(level, message)`

The entire codebase should have one way to log runtime messages:

```typescript
type LogLevel = "debug" | "info" | "warn" | "error";

function log(level: LogLevel, message: string): void;
```

That's it. One function, two parameters. No channel, no audience, no type tag polymorphism.

### Where it lives

`src/lib/log.ts` — a module-level singleton. Set up once at startup, usable from anywhere (lib, app, handlers). No dependency on EventBus.

```typescript
// src/lib/log.ts

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogHandler = (level: LogLevel, message: string) => void;

let _handler: LogHandler = (level, msg) => {
  // Default: console output (before EventBus is initialized)
  if (level === "error") console.error(msg);
  else if (level === "warn") console.warn(msg);
  else console.log(msg);
};

/** Set the global log handler. Called once at startup by may.ts. */
export function setLogHandler(handler: LogHandler): void {
  _handler = handler;
}

/** Log a message at the given level. */
export function log(level: LogLevel, message: string): void {
  _handler(level, message);
}
```

### Wiring

In `may.ts`, after the EventBus is created:

```typescript
import { setLogHandler } from "../lib/log.js";
setLogHandler((level, message) => {
  bus.emit({ type: "log", level, message });
});
```

Now every `log("warn", "...")` call anywhere in the codebase reaches the EventBus.

### Migration

Replace all runtime logging:

| Before | After |
|---|---|
| `bus.emit({ type: "info", message: "..." })` | `log("info", "...")` |
| `bus.emit({ type: "log", level, message })` | `log(level, message)` |
| `this._log("warn", "...")` | `log("warn", "...")` |
| `ctx.log("...")` | `log("info", "...")` |
| `console.warn("[persistence] ...")` | `log("warn", "[persistence] ...")` |
| `console.error("STUCK_WARNING: ...")` | `log("warn", "STUCK_WARNING: ...")` |

### What does NOT change

- **CLI output**: `console.log/error` for `--status`, `--oneshot`, `--send` output. These are program output, not logging.
- **Launcher**: `console.log` with timestamp. Separate process, no bus.
- **Console UI**: `process.stdout.write` for rendering events. It consumes log events, it doesn't produce them.
- **Web server startup**: `console.log` for "may-agent web UI, port 8080". Standalone process output.

### What happens to EventBus event types

The `info` type on RunnerEvent goes away. The `log` type stays and is the only way to emit log messages:

```typescript
export type SystemEvent =
  | { type: "log"; level: LogLevel; message: string }
  | { type: "notification"; agent: string; text: string }
  | { type: "workflow"; ... }
  | { type: "eval"; ... }
```

The `prompt` type is also deprecated (replaced by session events).

### What happens to `onLog` callback

Removed from `SubagentManagerOptions`. The manager just calls `log()` directly. No callback threading needed — `log()` is a module-level function.

### What happens to `ctx.log` in handlers

Handler `ctx.log` stays as a convenience but calls `log()` internally:

```typescript
const ctx: HandlerContext = {
  log: (msg) => log("info", msg),
  // ...
};
```

### Console UI rendering

The console UI subscribes to the bus and renders `log` events:

```typescript
case "log":
  dimLog(true, `[${event.level}] ${event.message}`);
  break;
```

### Implementation order

1. Create `src/lib/log.ts` (10 lines)
2. Wire `setLogHandler` in `may.ts`
3. Replace `bus.emit({ type: "info" })` calls with `log()` (98 calls, mechanical)
4. Replace `this._log()` / `onLog` with `log()` (remove callback)
5. Replace remaining `console.warn/error` in lib with `log()`
6. Remove `type: "info"` from RunnerEvent
7. Update console UI to render `log` events
