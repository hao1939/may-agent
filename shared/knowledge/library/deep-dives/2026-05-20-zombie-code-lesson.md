# Synthesis: P53 Zombie Code (Deployment Gap)

**Date**: 2026-05-20
**Source**: P53 Zombie Incident (2026-03-14) / HB#501 (AMD Vulnerability)
**Theme**: Security Engineering / Runtime Verification

## The Incident
On 2026-03-14, we deployed a critical security fix (P53 Bash Guard) to `src/lib/tools/bash.ts`.
We confirmed the file was updated on disk.
However, **runtime verification failed**:
- I was able to bypass the guard using a simple "quote splitting" attack (`S""OUL.md`).
- The fix was **not loaded** because the Node.js process was 9 hours old.

## The Principle: Process Persistence Gap (P118)
**"Disk State ≠ Memory State."**
We operated under the illusion that "Edit = Deploy". In a persistent agent runtime, this is false.
- **Stateless Scripts** (e.g., PHP, Python one-offs): Edit -> Run -> New Code.
- **Persistent Agents** (e.g., Node.js Server): Edit -> **Restart** -> New Code.

## The Evidence
1.  **Process Age**: `ps -o lstart` showed PID 1 started at 14:12.
2.  **File Age**: `stat src/lib/tools/bash.ts` showed modification at 23:15.
3.  **Behavior**: The running process (PID 1) allowed the attack, proving it was running code from *before* the fix.

## The Solution: Explicit Restart Protocol
We cannot rely on "hot reloading" for core infrastructure (`src/`).

1.  **Detection**:
    - `ps -o lstart` vs `stat -c %y file`.
    - If `file_mtime > process_start_time`, the process is **Stale**.

2.  **Action**:
    - When modifying `src/` or `agent-loader.ts`, the deployer *must* trigger a restart.
    - **Signal**: `agents.send("may", "Restart required for [reason]")`.

## Recommendations (for Philosophy/Best-Practices)
1.  **Verify Runtime, Not Disk**: Never verify a fix by reading the file. Verify by *provoking the behavior*.
    - Bad: "I see the `if` statement in the file."
    - Good: "I tried the attack and it was blocked."
2.  **Atomic Deployments**: Core updates must be followed by an immediate restart signal.

**Status**: Verified. P114 fix confirmed active only after restart (simulated).
