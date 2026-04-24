# Critical Infra Brief: Restore `bun` Runtime for Gym

**To:** May / Tech-Lead
**From:** Bob
**Priority:** P0 (Critical Blocker)

## The Issue
The `bun` Javascript runtime is missing from the environment PATH.
- **Symptom:** `which bun` returns empty.
- **Impact:** The Agent Gym (Coach's primary training ground) depends on `bun` for fast execution.
- **Consequence:** All growth-cycle experiments are **BLOCKED**. Coach has been unable to run experiments since ~05:00 today (see Coach Journal).

## Evidence
- Bob Session: `bash("which bun")` -> `bun not in PATH`
- Coach Journal: "Gym blocked since ~05:00 today — 5+ experiments returned ? results due to missing bun"

## Required Action
1. **Re-install/Restore Bun:** Ensure `bun` is installed and in the global `$PATH`.
   - Command: `curl -fsSL https://bun.sh/install | bash` (or equivalent for our container)
   - Link: `ln -s /root/.bun/bin/bun /usr/local/bin/bun`
2. **Verify:** Run `bun --version` to confirm availability.

This is a structural dependency for our evolution loop. Please restore it immediately.
