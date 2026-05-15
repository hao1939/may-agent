# Bun Runtime Migration + Bundle Implementation Spec

**Priority**: High  
**Decision**: Hao merged the Bun runtime migration INTO the bundling task. They are the same project now.  
**Key insight**: Switching from `file:` links (to /home/hao/pi-mono) to npm registry packages eliminates the pi-deps/ staging dance, sed rewrite hack, rsync + npm install ceremony, and enables clean `bun install`. Switching to bun as runtime eliminates tsx entirely — launcher spawning becomes trivial.

## Pre-requisites
- Read Bob's architecture review: `agents/bob/workspace/bundle-architecture-review.md` (still valid — only change: `getWorkerCommand()` no longer needs the tsx branch)
- Do NOT attempt any phase on the live container. Branch, test, merge.

---

## Phase 0: Switch to npm deps + bun runtime (~half day)

**Owner**: Tech Lead  
**Goal**: Replace file: deps with npm registry packages, install bun, verify app runs under bun.

### Steps
1. **Change package.json**: Replace `file:` deps for pi-agent-core and pi-ai with `^0.58.1` (or latest) from npm registry
2. **Install bun in the container**: `curl -fsSL https://bun.sh/install | bash`
3. **Run `bun install`** — verify it resolves everything cleanly (no file: link errors)
4. **Run the app with bun**: `bun src/app/launcher.ts --chat --cron --socket`
5. **Verify**: agents load, heartbeats fire, sessions work
6. **Keep vitest for now** — bun can run vitest as a library, no need to migrate tests yet

### Why this must be first
The `file:` links to /home/hao/pi-mono were the reason for:
- The pi-deps/ staging dance in docker-build.sh
- The sed rewrite hack in Dockerfile
- The rsync + npm install ceremony
- The inability to do a clean `bun install`

With npm registry packages, all of that disappears.

### Success criteria
- `bun install` completes without errors
- `bun src/app/launcher.ts --chat` starts and spawns agents correctly
- All vitest tests pass when run via bun: `bun vitest`

---

## Phase 1: Simplify launcher spawning (~1 hour)

**Owner**: Tech Lead  
**Goal**: Remove ALL tsx/execArgv complexity from spawning code. Bun handles .ts natively.

### Steps
1. **Remove ALL `process.execArgv` filtering** from `src/app/launcher.ts` and `src/lib/detached.ts`
2. **Spawning becomes**: `spawn(process.execPath, [MAY_TS, ...args])`
   - No more tsx loader propagation
   - No more execArgv filtering (the `--eval`, `--print`, `-e`, `-p` filter logic)
   - Bun natively runs .ts files, so `process.execPath` is `bun` and it just works
3. **Test**: launcher starts, spawns child, crash recovery works

### What this replaces
The current spawning code (launcher.ts + detached.ts) does elaborate `process.execArgv` filtering to propagate tsx loader flags. This was the ugliest, most fragile part of the codebase. With bun: `spawn(process.execPath, ["src/app/may.ts", ...args])` just works.

### `src/app/bundle-mode.ts` simplification
The `getWorkerCommand()` function from the original spec is still needed for Phase 2 (bundled vs dev mode detection), but the dev-mode branch simplifies dramatically:

```ts
export function getWorkerCommand(args: string[], mayTsPath: string) {
  if (isBundled()) {
    return {
      cmd: process.execPath,
      args: args,
      env: { ...process.env, MAY_ROLE: "child" },
    };
  } else {
    // Bun handles .ts natively — no execArgv needed
    return {
      cmd: process.execPath,
      args: [mayTsPath, ...args],
      env: process.env,
    };
  }
}
```

### Success criteria
- `bun src/app/launcher.ts --chat` starts and spawns worker correctly
- Kill worker → launcher restarts it (crash recovery)
- `src/lib/detached.ts` spawning works without execArgv hacks

---

## Phase 2: Binary compilation (~1 day)

**Owner**: Coder  
**Goal**: Use `bun build --compile` to produce a single binary.

### Architecture (from Bob's review — still valid)

#### `src/app/bundle-mode.ts` (new file)

```ts
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Detect if we're running inside a bun-compiled binary.
 * In compiled mode, import.meta.url starts with "file:///$bunfs/".
 */
export function isBundled(): boolean {
  return import.meta.url.startsWith("file:///$bunfs/");
}

/**
 * Get the command to spawn a worker process.
 * In bundled mode: spawn self with MAY_ROLE=child env var.
 * In dev mode: spawn bun with .ts path directly (no execArgv needed).
 */
export function getWorkerCommand(args: string[], mayTsPath: string) {
  if (isBundled()) {
    return {
      cmd: process.execPath,
      args: args,
      env: { ...process.env, MAY_ROLE: "child" },
    };
  } else {
    return {
      cmd: process.execPath,
      args: [mayTsPath, ...args],
      env: process.env,
    };
  }
}

/**
 * Resolve PROJECT_ROOT safely.
 * In bundled mode: use env var or cwd, but validate agents/ exists.
 * In dev mode: use import.meta.url-based resolution as before.
 */
export function resolveProjectRoot(importMetaUrl: string): string {
  if (process.env.PROJECT_ROOT) {
    return resolve(process.env.PROJECT_ROOT);
  }
  
  if (isBundled()) {
    const cwd = process.cwd();
    if (!existsSync(resolve(cwd, "agents"))) {
      console.error(
        "Error: 'agents/' directory not found in current working directory.\n" +
        "Please run from the project root or set PROJECT_ROOT environment variable."
      );
      process.exit(1);
    }
    return cwd;
  }
  
  // Dev mode: derive from import.meta.url
  const { dirname } = require("node:path");
  const { fileURLToPath } = require("node:url");
  return resolve(dirname(fileURLToPath(importMetaUrl)), "../..");
}
```

#### `src/app/binary-entry.ts` (new file — compilation target)

```ts
import { isBundled } from "./bundle-mode.js";

async function main() {
  if (!isBundled()) {
    console.error("binary-entry.ts should only run in compiled mode. Use bun src/app/may.ts for dev.");
    process.exit(1);
  }

  // Normalize argv: compiled binary has [binary, arg1...] vs node's [node, script, arg1...]
  // Pad process.argv so may.ts's process.argv.slice(2) works correctly in both modes
  process.argv = [process.argv[0], "binary-entry.ts", ...process.argv.slice(1)];

  if (process.env.MAY_ROLE === "child" || process.argv.includes("--oneshot")) {
    // Worker mode: run may.ts logic directly
    await import("./may.js");
  } else {
    // Supervisor mode: run launcher
    const launcher = await import("./launcher.js");
  }
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

#### Refactor `src/app/launcher.ts`
1. Use `getWorkerCommand()` from bundle-mode.ts instead of manual spawn construction
2. Remove `process.execArgv` filtering entirely (done in Phase 1)
3. Keep backward compatibility: when run directly via `bun`, auto-call `start()`

#### Refactor `src/lib/detached.ts`
1. Import `getWorkerCommand` from bundle-mode.ts
2. Replace manual spawn construction with `getWorkerCommand()`
3. Per Bob's review: do NOT set `MAY_ROLE=child` for detached spawns — they run as supervisor (crash recovery)

#### Fix `src/app/may.ts` PROJECT_ROOT
```ts
// OLD:
const PROJECT_ROOT = resolve(
  process.env.PROJECT_ROOT || dirname(fileURLToPath(import.meta.url)),
  process.env.PROJECT_ROOT ? "." : "../..",
);

// NEW:
import { resolveProjectRoot } from "./bundle-mode.js";
const PROJECT_ROOT = resolveProjectRoot(import.meta.url);
```

#### Wrap setDefaultAutoSelectFamily in `src/app/ui/telegram.ts`
```ts
import { setDefaultAutoSelectFamily } from "node:net";
try { setDefaultAutoSelectFamily(false); } catch { /* noop — bun may not support this */ }
```

#### `scripts/bundle.sh`
```bash
#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

BUN="${HOME}/.bun/bin/bun"
if ! command -v "$BUN" &>/dev/null; then
  echo "Error: bun not found at $BUN. Install with: curl -fsSL https://bun.sh/install | bash"
  exit 1
fi

mkdir -p bundle
echo "Building may-agent binary..."
"$BUN" build --compile src/app/binary-entry.ts --outfile bundle/may-agent
echo "Built: bundle/may-agent ($(du -h bundle/may-agent | cut -f1))"
echo ""
echo "Run with: PROJECT_ROOT=/app ./bundle/may-agent --chat --cron --telegram --socket"
```

### Success criteria
- `bun build --compile src/app/binary-entry.ts --outfile bundle/may-agent` succeeds
- `cd /app && ./bundle/may-agent --chat` — launcher starts, spawns worker, no fork bomb
- Kill worker → launcher restarts it
- Worker loads agents from `agents/` directory

---

## Phase 3: --oneshot CLI mode (~half day)

**Owner**: Coder  
**Goal**: Add single-execution mode for CI/scripting use cases.

### Steps
Add to may.ts argument parsing:
- `--oneshot` flag
- `--agent=<name>` parameter
- `--timeout=<minutes>` parameter (default 5)
- When oneshot is set: run single session, print JSON result to stdout, exit

### Success criteria
- `./bundle/may-agent --oneshot --agent=bob --task="Review this file"` runs one session and exits
- JSON output includes: sessionId, status, duration, result summary
- Timeout kills session after specified minutes

---

## Phase 4: Update Dockerfile (~1 hour)

**Owner**: Tech Lead  
**Goal**: Simplify Dockerfile by removing tsx, pi-deps staging, sed rewrites.

### Steps
1. **Keep bookworm-slim base** (need Chrome + Xvfb stack)
2. **Install bun**: `curl -fsSL https://bun.sh/install | bash`
3. **Remove**: tsx install, pi-deps/ staging, sed rewrites, rsync ceremony
4. **Dockerfile install section becomes**:
   ```dockerfile
   COPY package.json bun.lockb ./
   RUN bun install
   ```
5. **Entrypoint becomes**: `bun src/app/launcher.ts` (or `./bundle/may-agent` if using binary)

### Success criteria
- Docker image builds cleanly without tsx, pi-deps, or sed hacks
- Container starts and runs correctly with bun
- Image size is smaller than current (removed tsx + node_modules overhead from file: links)

---

## Assignment Summary

| Phase | Owner | Estimated | Depends on |
|-------|-------|-----------|------------|
| 0 | Tech Lead | ~half day | Nothing |
| 1 | Tech Lead | ~1 hour | Phase 0 |
| 2 | Coder | ~1 day | Phase 1 |
| 3 | Coder | ~half day | Phase 2 |
| 4 | Tech Lead | ~1 hour | Phase 0 (can parallel with 2-3) |

Bob already reviewed the architecture — no new review needed for the runtime switch; it only simplifies things.

---

## What NOT to do
- Do NOT migrate vitest to bun test. Keep vitest, run with bun. Separate task if needed later.
- Do NOT change tsconfig or tsc. Still need `tsc --noEmit` for type checking.
- Do NOT attempt this on the live container. Branch, test, merge.
- Do NOT merge launcher.ts into may.ts.

## Overall Success Criteria
1. `bun install` works with npm registry deps (no `file:` links)
2. `bun src/app/launcher.ts` starts and runs correctly
3. Launcher spawning works without tsx/execArgv hacks
4. `bun build --compile` produces working binary
5. Binary runs: --chat, --cron, --oneshot modes
6. Docker image builds and runs with bun (no tsx, no pi-deps staging)
7. All existing vitest tests pass under bun

## Argv Normalization Note (from Bob's review)

Bun compiled binaries have `process.argv = [binaryPath, arg1, ...]` (offset 1).
Node has `process.argv = [node, script, arg1, ...]` (offset 2).

may.ts currently uses `process.argv.slice(2)`. In binary-entry.ts we pad process.argv:
`process.argv = [process.argv[0], "binary-entry.ts", ...process.argv.slice(1)]`
This ensures may.ts's `process.argv.slice(2)` works correctly in both modes.
