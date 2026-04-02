# Finding: Binary Rebuild f4b83c6

**Date**: 2026-03-25T16:04 UTC
**Status**: Built, awaiting process restart (P0 req:e535d4d8 sent to May)

## Context
- Running binary: `may-agent-b9ef77e` (PID 52, started Mar 24)
- Previous build: `may-agent-bbbe4fe` (UNSAFE — missing DOMAIN.md loading)
- New build: `may-agent-f4b83c6` (from HEAD, includes all fixes)

## Why Rebuild Was Needed
Binary `bbbe4fe` was built from a commit BEFORE the DOMAIN.md restore fix (f4b83c6). Commit `2003ca7` removed DOMAIN.md loading during prompt simplification. The restore commit (`f4b83c6`) came after the binary build. Activating `bbbe4fe` would have caused all 10 agents with DOMAIN.md to lose ~955 lines of critical operational context.

## What's New (29 commits: b9ef77e → f4b83c6)
Key features:
1. **DOMAIN.md loading restored** (f4b83c6) — critical context for 10 agents
2. **Verification gym scenarios** (ada9b0c) — test FM-3.3 compliance
3. **30 test fixes** (7b1487c) — across 7 test files
4. **Zombie session cleanup** — cleanupZombieSessions() in startup
5. **Path assumption guard** — blocks /home/*, /Users/* path hallucinations
6. **Session read guard bash protection** — blocks bash grep of session.jsonl
7. **Classifier sub-categories** — cmd-not-found, cd-bad-path, file-not-found-bash
8. **Skill lifecycle early-exit** — "ALREADY COVERED" saves ~90 ops per wasted run
9. **Empty args guard** — blocks read({})/bash({}) before LLM call
10. **Evaluator age cutoff** (48h) — prevents re-eval infinite loop

## Build Details
- Command: `bun build --compile src/app/binary-entry.ts --outfile bundle/may-agent-f4b83c6`
- Size: 103,883,281 bytes (~104MB)
- Build time: 469ms compile
- Symlink: `bundle/may-agent -> may-agent-f4b83c6`

## Verification
- `grep -n "DOMAIN" src/lib/manager.ts` confirms DOMAIN.md loading at lines 331, 363, 374, 375
- Symlink points to f4b83c6 (confirmed via ls -la)
- Binary exists and is executable

## Next Steps
1. Process restart to activate (P0 req:e535d4d8)
2. Gym baseline after restart (`scripts/gym-baseline.sh --tier smoke`)
3. Verify zombie cleanup runs on startup
4. Verify DOMAIN.md loaded for agents (check system prompt length)
