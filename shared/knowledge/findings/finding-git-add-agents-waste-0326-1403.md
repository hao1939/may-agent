# Finding: Git-Add-Agents Waste Pattern

**Date**: 2026-03-26T14:03
**Type**: Cost/Efficiency
**Severity**: LOW-MEDIUM (8-20 wasted ops/day)

## Problem

Agents (primarily tech-lead) waste ops trying to `git add` files in `agents/` directories,
which are gitignored. When the initial `git add` fails silently (files show in `git status`
as untracked), agents enter a debugging loop:

1. `git add agents/may/workflows/file.ts` → no error but file not staged
2. `git add -f agents/may/workflows/file.ts` → still not staged
3. `git check-ignore -v agents/may/workflows/file.ts` → discovers it's ignored
4. `git ls-files agents/may/workflows/` → empty
5. Several more diagnostic ops

## Evidence

From session s_1774532021017_464 (tech-lead, 46 ops):
- 3 direct `git add` attempts on agents/ paths
- ~8 additional diagnostic ops (check-ignore, ls-files, log, status)
- Total waste: ~11 ops out of 46 (24% of session)

From 100 recent sessions: 3 sessions affected, 8 direct git-add-agents ops counted.
True waste including follow-up diagnostics: ~20-25 ops total.

## Root Cause

`.gitignore` contains `agents/` pattern. All agent workspace/workflow files are
runtime-only and not tracked by git. Agents don't know this until they try.

## Proposed Fix

Add to `agents/shared/common-sense.md`:
```
- git add: Files in agents/ directories are gitignored. Do NOT try to git add/commit
  agent workspace or workflow files. Only src/ and scripts/ files can be committed.
  If you create a file in agents/, it lives there at runtime only.
```

This is a 1-line common-sense entry that would prevent 10-20 wasted ops/day.

## Status

PROPOSAL — needs common-sense.md update (cross-agent file, requires delegation to May).
