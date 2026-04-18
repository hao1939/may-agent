## Architecture Review: Bundle Implementation
### Verdict: Approved with Architectural Refinements ✅

The plan to use `bun build --compile` is correct. However, the proposed implementation risks creating a messy hybrid of script and module logic, particularly around process supervision and argument handling.

### 1. The Entry Point Architecture (Refined)
**Do not compile `src/app/may.ts` directly.** Compile a new **Switchboard** entry point.

**New File**: `src/app/binary-entry.ts`
```ts
import { isBundled } from "./bundle-mode";

// Dynamic imports are crucial to avoid side-effects (like launcher auto-start)
const loadLauncher = () => import("./launcher");
const loadAgent = () => import("./may");

export async function main() {
  // In the binary, we are EITHER the Supervisor OR the Worker
  if (isBundled()) {
    if (process.env.MAY_ROLE === "child" || process.argv.includes("--oneshot")) {
      // WORKER MODE (or single-run)
      await loadAgent(); 
    } else {
      // SUPERVISOR MODE (Default)
      const launcher = await loadLauncher();
      // Pass args explicitly to avoid argv offset issues (see Point 6)
      await launcher.start(process.argv.slice(1)); 
    }
  } else {
    // Failsafe for dev mode
    console.error("Binary entry point running in non-bundled mode? Use tsx src/app/may.ts");
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

### 2. Required Refactor: Launcher as a Module
**Problem**: `src/app/launcher.ts` currently runs `spawnChild()` at the top level. Importing it triggers side effects immediately.
**Fix**: Refactor `launcher.ts`.
- Wrap the execution logic in `export function start(args: string[]) { ... }`.
- Add `if (process.argv[1] === fileURLToPath(import.meta.url)) start(process.argv.slice(2));` at the bottom (is-main check).
- This allows `binary-entry.ts` to import it without starting it until ready.

### 3. Spawning Logic Abstraction
**Problem**: `launcher.ts` currently hardcodes `process.execPath + execArgv + MAY_TS`. This breaks in binary mode.
**Fix**: Abstract the spawning command in `src/app/bundle-mode.ts`.
```ts
export function getWorkerCommand(args: string[]) {
  if (isBundled()) {
    // Binary calls itself with MAY_ROLE=child
    return { 
      cmd: process.execPath, 
      args: args,
      env: { ...process.env, MAY_ROLE: "child" } 
    };
  } else {
    // TSX calls node with loader
    return {
      cmd: process.execPath,
      args: [...process.execArgv, "src/app/may.ts", ...args],
      env: process.env
    };
  }
}
```
`launcher.ts` and `detached.ts` should use this helper instead of constructing paths manually.

### 4. PROJECT_ROOT & Validation
**Risk**: Defaulting `PROJECT_ROOT` to `process.cwd()` is risky if the user runs the binary from `/tmp`.
**Requirement**:
- If `isBundled()` and `PROJECT_ROOT` is unset:
  - Check if `resolve(process.cwd(), "agents")` exists.
  - If YES: Set `PROJECT_ROOT = process.cwd()`.
  - If NO: Fail fast with "Error: 'agents/' directory not found in current working directory. Please run from the project root or set PROJECT_ROOT."

### 5. Detached Process Resilience
**Refinement**: Detached processes (`src/lib/detached.ts`) should spawn the **Supervisor**, not the Worker.
- Do NOT set `MAY_ROLE=child` in detached processes.
- Spawn the binary normally. It becomes a Supervisor, which then spawns a protected Worker.
- This gives detached agents crash-recovery (essential for long-running jobs).

### 6. CLI Argument Normalization (Critical)
**Problem**: `process.argv` offsets differ between Node and Compiled Binary.
- Node: `[node, script, arg1...]` → args start at index 2.
- Binary: `[binary, arg1...]` → args start at index 1.
**Fix**: `launcher.ts` currently slices at 2. This will drop the first argument in binary mode.
- Pass `args` explicitly to `launcher.start(args)`.
- `binary-entry.ts` calculates args: `process.argv.slice(1)`.
- `launcher.ts` (when run directly): `process.argv.slice(2)`.

### Summary of Changes to Plan
1. **Target**: Build `src/app/binary-entry.ts` instead of `may.ts`.
2. **Refactor**: `launcher.ts` must export `start()` and not run side-effects on import.
3. **Utility**: Move "how to spawn worker" logic into `bundle-mode.ts`.
4. **Safety**: Fail fast if `agents/` is missing in CWD.
