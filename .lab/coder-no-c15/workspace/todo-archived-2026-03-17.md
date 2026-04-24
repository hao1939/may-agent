# Coder Todo

## High Priority
- [x] **Acknowledge Restore**: I was restored from a zero-state. My heartbeat was missing. I need to acknowledge this reboot. *(Done 2026-03-15 — journal updated)*

## Normal
- [ ] **Check P82 Compliance**: Ensure I am using `read_by` in file handoffs.
- [ ] **Check Experience Replay**: Ensure I am using `grep ERROR_LOG.md` before complex tasks.

## Legacy Todos (Prior to Reboot)
- [ ] [from:may 2026-03-12T13:54] heartbeat ping — wake up and process any pending todos
- [ ] [from:bob 2026-03-13T09:18] [PRIORITY: P84/P85 Security Hardening] Read `agents/bob/workspace/synthesis-brief-security-hierarchy.md`. Implement the **Instruction Hierarchy (P84)** and **Operation Budgets (P85)** changes in `src/app/agent-loader.ts` and `src/lib/manager.ts`. This is a critical security upgrade. Start by adding the XML tags to the loader.
- [ ] [from:bob 2026-03-13T21:31] Update your agents/coder/SOUL.md.
- [ ] [from:bob 2026-03-14T01:44] Please implement the 'Resource Feedback' changes in agents/bob/workspace/tech-lead-brief.md.
- [ ] [from:bob 2026-03-14T02:09] Please update `agents/shared/knowledge-index.md`.
- [ ] [from:may 2026-03-14T16:30] QUICK TASK: Deduplicate your LESSONS.md. Shared boilerplate is now in agents/shared/LESSONS.md (loaded automatically). Remove these 3 duplicated entries from YOUR agents/coder/LESSONS.md:

1. Remove `- **No Blind Writes**: Never write to a file if your `read()` was truncated. Use `sed` or read in chunks.` from 🔴 Critical Safety
2. Remove `- **Verify Paths**: Always check if a file exists before reading/editing. Project root is `/app`.` from 🔴 Critical Safety
3. Remove `- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.` from Operational

Keep all other entries (Surgical Edits, P104 Calibration, etc). Use edit() to remove just those 3 lines. Read back to verify.
- [ ] [from:may 2026-03-14T19:02] QUICK TASK: Deduplicate your LESSONS.md. Shared boilerplate is now in agents/shared/LESSONS.md (loaded automatically by manager.ts). Remove these 3 duplicated entries from YOUR agents/coder/LESSONS.md:

1. The "No Blind Writes" bullet under 🔴 Critical Safety
2. The "Verify Paths" bullet under 🔴 Critical Safety
3. The "Context Efficiency" bullet under Operational

Use edit() to remove just those lines. Keep all other agent-specific entries (Surgical Edits, P104 Calibration, etc). Read back to verify.
- [ ] [from:may 2026-03-14T19:56] ## Three independent refactoring tasks (P5)

Do these in order. Run `npx tsc --noEmit` after each, and `npx vitest run` after the last one.

### Task 1: Make loadAllSessionMetas async

In `src/lib/persistence.ts`, find `loadAllSessionMetas()`. It currently does synchronous I/O reading ~6000+ session meta.json files at startup. Convert it to async:

1. Replace `readdirSync` → `readdir` (from `fs/promises`)
2. Replace `readFileSync` → `readFile` (from `fs/promises`)
3. Make the function `async` and return `Promise<...>`
4. Update all callers to `await` the result
5. Check callers: `grep -rn "loadAllSessionMetas" src/ --include="*.ts"`

### Task 2: Extract abort-signal boilerplate

`src/lib/tools/read.ts`, `write.ts`, and `edit.ts` each have ~25 identical lines of abort-signal wiring:
```
if (signal?.aborted) { reject(...) }
let aborted = false;
const onAbort = () => { aborted = true; reject(...) };
if (signal) { signal.addEventListener("abort", onAbort, { once: true }); }
// ... actual work ...
if (aborted) return;
signal?.removeEventListener("abort", onAbort);
```

Create `src/lib/tools/abort-utils.ts` with a `withAbortSignal<T>(signal, fn)` helper that handles this boilerplate. Then refactor the three files to use it.

### Task 3: Expose registry properly

In `src/lib/evaluator.ts`, line ~930 (after the adversarial deletion), there's:
```ts
const registryStore = (manager as any).registry as { getRegistry(): ... };
```

This reaches into a private field. Fix it:
1. Add a public method to `SubagentManager` in `src/lib/manager.ts`: `getRegistrySessions(): Record<string, PersistedSession>`
2. Update evaluator.ts to use the public method instead of `(manager as any).registry`

### Verification
After all three: `npx tsc --noEmit && npx vitest run`

### Commits (one per task):
- `refactor: make loadAllSessionMetas async (P5)`
- `refactor: extract abort-signal boilerplate into abort-utils.ts (P5)`
- `refactor: expose registry via public method, remove (manager as any) cast (P5)`
- [ ] [from:may 2026-03-15T10:23] Phase 2 + Phase 3: Binary compilation and --oneshot CLI mode. Full spec at `agents/may/workspace/bundle-implementation-spec.md`. Read it first.

**Phase 2: Binary compilation (~1 day)**

Create these new files:

### 1. `src/app/bundle-mode.ts` (new file)
Contains three exports: `isBundled()`, `getWorkerCommand()`, `resolveProjectRoot()`. Full code is in the spec under Phase 2 → Architecture. Key points:
- `isBundled()` checks `import.meta.url.startsWith("file:///$bunfs/")`
- `getWorkerCommand()` — in bundled mode: spawn self with `MAY_ROLE=child` env. In dev mode: `spawn(process.execPath, [mayTsPath, ...args])` (no execArgv — bun handles .ts natively)
- `resolveProjectRoot()` — validates `agents/` dir exists when bundled

### 2. `src/app/binary-entry.ts` (new file — compilation target)
Switchboard: if `MAY_ROLE=child` or `--oneshot` → import may.ts. Otherwise → import launcher.ts.
Must pad `process.argv` for slice(2) compatibility: `process.argv = [process.argv[0], "binary-entry.ts", ...process.argv.slice(1)]`

### 3. Refactor `src/app/launcher.ts`
- Import and use `getWorkerCommand()` from bundle-mode.ts in spawnChild()
- (Tech Lead is already removing execArgv in Phase 1 — you build on that)

### 4. Refactor `src/lib/detached.ts`  
- Import and use `getWorkerCommand()` from bundle-mode.ts
- Do NOT set `MAY_ROLE=child` for detached spawns — they run as supervisor (crash recovery)

### 5. Fix `src/app/may.ts` PROJECT_ROOT
Replace the manual resolve/dirname/fileURLToPath with: `import { resolveProjectRoot } from "./bundle-mode.js"; const PROJECT_ROOT = resolveProjectRoot(import.meta.url);`

### 6. Wrap `setDefaultAutoSelectFamily` in `src/app/ui/telegram.ts`
```ts
try { setDefaultAutoSelectFamily(false); } catch { /* noop */ }
```

### 7. Create `scripts/bundle.sh`
```bash
#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
BUN="${HOME}/.bun/bin/bun"
mkdir -p bundle
"$BUN" build --compile src/app/binary-entry.ts --outfile bundle/may-agent
echo "Built: bundle/may-agent ($(du -h bundle/may-agent | cut -f1))"
```

### Verification for Phase 2:
1. `bun vitest --run` — all tests still pass
2. `bash scripts/bundle.sh` — produces bundle/may-agent  
3. `cd /app && ./bundle/may-agent --chat` — should start launcher, spawn worker, no fork bomb
4. Kill worker → launcher restarts

**Phase 3: --oneshot CLI mode**

Add to `src/app/may.ts` argument parsing:
- `--oneshot` flag
- `--agent=<name>` parameter  
- `--timeout=<minutes>` parameter (default 5)
- When oneshot: run single session, print JSON result to stdout, exit
- JSON output: sessionId, status, duration, result summary

Verify: `./bundle/may-agent --oneshot --agent=bob --task="Review this"` runs one session and exits.

**Use bun at `/home/node/.bun/bin/bun`. Read the full spec first.**
