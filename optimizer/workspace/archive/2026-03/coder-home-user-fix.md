# Patch: Fix coder `/home/user` path errors

## Problem
Coder agent has 16 wasted bash calls in 24h due to `cd /home/user` which doesn't exist.
The working directory is `/app` — there is no `/home/user` in this environment.

## Target File
`agents/coder/LESSONS.md`

## Change
Add this entry under "Active Band-Aids":

```
### Working Directory
- **Working directory is `/app`**: Do NOT use `cd /home/user` — that path doesn't exist in this environment.
- All project files are under `/app`. Start commands from there.
```

## Evidence
Tool quality report (2026-03-26T21:07): bash:nonexistent-path = 17 wasted calls, coder responsible for 16 of them.
All 16 were `cd /home/user: No such file or directory`.

## Expected Savings
~16 wasted calls/day → 0.
