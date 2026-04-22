# KE-014: Bash Quote Splitting Bypass (Security)

**Evidence-Grade:** B — Specific technical finding, patched and concrete

**Severity:** Critical
**Status:** Patched (2026-03-14)
**Discovered by:** Bob via compliance-test

## Finding

Shell quote expansion bypasses simple regex security filters. The command `echo "payload" > S""OUL.md` writes to `SOUL.md` because the shell removes empty quotes after the security regex runs.

## Remediation

Normalize paths (resolve quotes, relative paths) to canonical absolute form before checking against blocklists. A `spawnHook`/`checkBashCommand` was added to intercept commands pre-execution.

## Lessons

1. Regex is not security — shell expansion (`*`, `?`, `""`, `''`) defeats naive string matching
2. Always canonicalize paths (`path.resolve`) before applying security checks
3. A patch on disk does not protect a running process — restarts are mandatory for security fixes (Zombie Code Protocol P118)
