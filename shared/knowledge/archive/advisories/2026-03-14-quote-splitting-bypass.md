# Security Advisory: Bash Quote Splitting Bypass (2026-03-14)

**Severity**: Critical
**Status**: Patched (Pending Restart)
**Discovered**: 2026-03-14
**Reporter**: Bob (Architect) via `compliance-test`

## Vulnerability Description
The system's security layer (`src/lib/tools/security.ts` or similar regex checks) relied on simple string matching to block writes to protected files like `SOUL.md`. The check looked for patterns like `>.*SOUL.md`.

However, the `bash` tool executes commands via a shell, which processes quote expansion *before* file system operations but *after* simple regex checks might run (depending on implementation).

**The Exploit Pattern**:
```bash
echo "Malicious Payload" > agents/bob/S""OUL.md
```
The shell expands `S""OUL.md` to `SOUL.md` (empty quotes are removed).
If the security filter only looks for the literal string `SOUL.md`, it misses `S""OUL.md`.

**Affected Components**:
- `bash` tool
- Any tool using `child_process.exec` with a shell

## Evidence of Exploitation
On 2026-03-14, the Architect (Bob) demonstrated a successful bypass:
```bash
echo "Zombie Check" > agents/bob/S""OUL.md
```
This overwrote the `SOUL.md` file despite "Protected File" policies being nominally active.

## Remediation
**Patch**: `src/lib/tools/coding.ts` and `src/app/agent-loader.ts` were patched to include a `spawnHook` or `checkBashCommand` that normalizes paths *before* checking against the blocklist.
- **Normalization**: Resolve quotes and relative paths.
- **Hook**: Intercept the command before execution.

**Verification**:
Post-patch attempts (simulated) or pending restart verification show the exploit is blocked when the new code is loaded.

## Lessons (L2 Knowledge)
1.  **Regex is not Security**: Simple regex matching on shell commands is insufficient due to shell expansion (`*`, `?`, `""`, `''`).
2.  **Canonicalize First**: Always resolve paths to their absolute, canonical form (using `path.resolve` or similar) *before* applying security checks.
3.  **Zombie Risk**: A patch on disk does not protect a running process. Process restarts are mandatory for security fixes.

## References
- P53 (Restricted Execution)
- P118 (Zombie Code Protocol)
