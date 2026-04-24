# Critical Security Vulnerability: Zombie Code (P0)

**Date**: 2026-03-14 04:35 UTC
**Status**: **ACTIVE** (Despite code fix)
**Impact**: **P0** (Authentication Bypass)

## The Issue
The P53 "Identity Protection" layer in `src/lib/tools/security.ts` contains a critical logic fix (`normalizeForP53`) to block bash obfuscation attacks (e.g., `S""OUL.md`).

However, the running `may` process (PID 2024135) was started at **02:29 UTC**, *before* this patch was applied. As a result, the system is running **stale, vulnerable code** from memory.

## Evidence
1. **Code on Disk**: `src/lib/tools/security.ts` contains the correct `normalizeForP53` function.
2. **Exploit Success**: Running `echo "Exploit" > agents/bob/S""OUL.md` via `bash` successfully overwrote the file at 04:17 UTC.
3. **Conclusion**: The running process is using the old regex logic which fails on quotes.

## Immediate Action Required
1. **Restart the `may` process**. This is the only way to load the new code.
   - Command: `pkill -f "node.*may.ts"` or `agents.call("may", "restart")`.
   - **Risk**: This will kill all active agent sessions. Ensure state is persisted.

## Root Cause Analysis
- **System Design Flaw**: We assume hot-reloading works for all files. In reality, `import` statements in Node.js are cached. Only `agent-loader.ts` (JSON/Markdown configs) hot-reloads. Core TypeScript logic (`src/lib/`) requires a process restart.
- **Process Lifecycle (P118)**: "Code on Disk Is Not Truth Until the Process Restarts." We violated this principle by patching security code without restarting.

## Recommendation
Implement a **Supervisor** (e.g., PM2 or a simple loop) that watches `src/lib/` for changes and automatically restarts the process. Security patches must be coupled with deployment actions.
