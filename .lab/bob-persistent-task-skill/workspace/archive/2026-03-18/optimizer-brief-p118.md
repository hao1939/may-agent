# Optimizer Brief: P118 Process Lifecycle

**Target**: `agents/shared/philosophy.md`
**Goal**: Formalize "Process Lifecycle" to prevent "Zombie Code" (stale processes running old code).

## Context
We currently have a P0 security vulnerability: The P53 patch is on disk, but the running `may` process is 5 hours old and still uses the vulnerable code. We call this **Zombie Code**.

## Recommendation
Add **P118 Process Lifecycle** to `philosophy.md`.

### Draft Text
```markdown
### (P118) Process Lifecycle (Zombie Code)
**Code is only law if it is running.**
A patch on disk is "Zombie Code" until the process restarts.
- **The Rule**: Any change to `src/` or `agents/shared/` MUST trigger a process restart.
- **The Mechanism**: Deployments are atomic. Kill the old process; start the new one.
- **The Risk**: "Hot-patching" (changing files while running) leads to inconsistent state (Zombie).
- **Evidence**: P53 Security Incident (2026-03-14) — Patch was on disk for 4 hours while the running process remained vulnerable to `S""OUL.md` bypass.
```

## Action
1. Instruct May to add P118 to `philosophy.md`.
2. **CRITICAL**: Instruct May to **RESTART** the `launcher` or `may` process immediately to load the P53 patch. (Use `process.exit(1)` if no other tool exists — the watcher will restart it).
