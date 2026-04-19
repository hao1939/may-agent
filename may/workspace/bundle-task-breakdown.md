# Bundle Task Breakdown — Gate Test Results & Implementation Plan

## Gate Test: ✅ PASSED (all critical risks mitigated)

Ran `bun build --compile` tests on 2026-03-14. Results:
- pi-ai anti-bundler patterns (string concatenation dynamic imports): PASS
- Static bundling of @mariozechner/pi-ai (1002 modules): PASS
- getModel() internal initialization: PASS
- setDefaultAutoSelectFamily: PASS (available in Bun)
- Workflow `?t=` cache-busting: PASS
- import.meta.url: Returns `file:///$bunfs/root/...` (needs PROJECT_ROOT)
- may.ts direct compilation: PASS (107MB binary, validates CLI flags correctly)
- Launcher self-spawning: FAILS (fork bomb — exactly as directive predicted)

Binary size: 107MB (within expected 80-120MB range).
Bun installed at: `$HOME/.bun/bin/bun` (v1.3.10)

## Implementation Tasks

### Task 1: Bundled Mode Detection Utility (Coder)
**File**: `src/app/bundle-mode.ts` (new file)
**What**: Create a small utility module that all other fixes depend on:
```ts
export function isBundled(): boolean {
  // In bun compiled binary, import.meta.url starts with file:///$bunfs/
  return import.meta.url.startsWith("file:///$bunfs/");
}
```
**Acceptance**: Module exports `isBundled()`, returns false in dev (tsx), true in compiled binary.

### Task 2: Fix Launcher Self-Spawning (Coder) — BLOCKER 1
**File**: `src/app/launcher.ts`
**Problem**: Line 23-24 resolves `MAY_TS` via `import.meta.url` which becomes `/$bunfs/root/may.ts` in bundled mode. Line 64 spawns `process.execPath` (bun) with `[...execArgv, MAY_TS, ...]` — but `MAY_TS` doesn't exist on disk, AND each child process is itself the launcher (because the binary IS both launcher and may.ts), causing a fork bomb.
**Fix**: In bundled mode, `spawnChild()` should spawn `process.execPath` (the binary itself) with `["--spawned-by-launcher", ...args]` instead of `[...execArgv, MAY_TS, ...args]`. The `--spawned-by-launcher` flag tells the binary "you are the child, run may.ts logic directly."
**Also need**: may.ts must check for this flag and skip the "need --chat, --task, or --cron" validation when present.
**Acceptance**: `./may-agent --chat` → launcher starts → spawns child via `process.execPath --spawned-by-launcher --chat` → child runs may.ts logic. No fork bomb. Crash restart works (exit non-zero → launcher respawns child).

### Task 3: Fix Detached Agent Spawning (Coder) — BLOCKER 1b
**File**: `src/lib/detached.ts`
**Problem**: Line 67-69 spawns `process.execPath` with `[...execArgv, resolve(projectRoot, "src/app/may.ts"), "--task", ...]`. In bundled mode, `src/app/may.ts` doesn't exist on disk.
**Fix**: In bundled mode, spawn `process.execPath` directly with `["--task", opts.task, "--socket"]` (no execArgv, no may.ts path).
**Acceptance**: Detached agent spawning works in bundled binary.

### Task 4: Fix import.meta.url Paths (Coder) — BLOCKER 2
**Files**: `src/app/may.ts:23-25`, `src/app/launcher.ts:23`
**Problem**: `dirname(fileURLToPath(import.meta.url))` resolves to `/$bunfs/root/` in bundled mode.
**Fix**: In bundled mode, default to `process.cwd()` when `PROJECT_ROOT` env is not set. The env var override already exists.
**Acceptance**: `PROJECT_ROOT=/app ./may-agent --chat` works. Running from `/app` without env var also works.

### Task 5: Wrap setDefaultAutoSelectFamily (Coder) — BLOCKER 3
**File**: `src/app/ui/telegram.ts:19,25`
**Status**: Gate test showed this IS available in Bun 1.3.10. BUT the directive says wrap in try/catch for safety.
**Fix**: Wrap in try/catch. Minimal change.
**Acceptance**: Telegram bot initializes without crashing even if function unavailable.

### Task 6: scripts/bundle.sh (Coder)
**What**: Create build script:
```bash
#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p bundle
bun build --compile src/app/may.ts --outfile bundle/may-agent
echo "Built: bundle/may-agent ($(du -h bundle/may-agent | cut -f1))"
```
**Also**: Add to package.json scripts: `"bundle": "bash scripts/bundle.sh"`
**Acceptance**: `npm run bundle` produces `bundle/may-agent`.

### Task 7: --oneshot CLI Mode (Coder) — Phase 2
**File**: `src/app/may.ts`
**What**: Add `--oneshot` flag handling:
- Parse `--oneshot --agent=<name> --task="<prompt>"` from CLI args
- Load agent config from `agents/` directory
- Run a single session with the given task
- Print structured JSON result to stdout: `{ status, lastAssistantText, turns, duration, error }`
- Exit 0 on success, 1 on failure
- Timeout after N minutes (configurable via `--timeout=N`, default 5)
**Acceptance**: `./may-agent --oneshot --agent=bob --task="What is 2+2?" --timeout=1` prints JSON result and exits.

## Sequencing
1. Task 1 (bundle-mode.ts) — no dependencies
2. Tasks 2-5 in parallel (all depend on Task 1)
3. Task 6 (bundle.sh) — depends on Tasks 2-5
4. Task 7 (--oneshot) — depends on Task 6 (needs working binary to test)

## Architecture Review (Bob)
Bob should review the approach BEFORE coder implements, specifically:
- Is `--spawned-by-launcher` the right mechanism for Task 2, or is there a cleaner way?
- Should detached.ts (Task 3) use the same flag or a different one?
- Is `process.cwd()` the right fallback for PROJECT_ROOT in Task 4?
- Any concerns about the two-binary model (launcher-binary wraps may-binary) vs single-binary with flag?
