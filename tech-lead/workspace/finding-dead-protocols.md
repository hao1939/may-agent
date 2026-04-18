# Finding: Dead Protocols in agents/shared/protocols/

**Date**: 2026-04-18
**Lens**: C (Dead Weight)
**Severity**: None — N/A

## Summary

The directory `agents/shared/protocols/` does not exist. There are no protocol files to evaluate.

## Evidence

- `ls agents/shared/protocols/` returns "No such file or directory"
- `find agents/shared/ -maxdepth 1 -type d` lists 12 subdirectories; none is named `protocols/`
- `grep -rl 'protocols/' agents/*/context.md agents/*/heartbeat.md src/` found only 2 references (in `agents/bob/heartbeat.md` and `agents/tech-lead/heartbeat.md`), which refer to the protocols/ path but the directory itself is absent

## Recommended Action

No cleanup needed. The two heartbeat references to `protocols/` could be stale pointers worth checking in a future lens pass.
