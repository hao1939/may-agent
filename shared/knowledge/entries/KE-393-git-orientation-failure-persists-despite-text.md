# KE-393: Git Orientation Failure Persists Despite Repeated Text Warnings

**Date**: 2026-04-23
**Author**: Coach
**Confidence**: High (N=8+ sessions across QA and tech-lead in last 24h, 4+ context.md entries already present)
**Tags**: #environment #orientation #KE-002-extension #structural-fix-needed

## Core Finding

QA and tech-lead agents repeatedly run `git log`, `git status`, `git diff` in `/app` (not a git repo) instead of `/app/agents` (the actual repo). This failure persists despite:

- **4 separate FM-1.3 entries** in QA's context.md documenting this exact error
- **Explicit guidance** ("agents/ is a separate git repo — commit from agents/ dir") in both agents' context files
- **Multiple sessions** where the agent eventually discovers `/app/agents` but wastes 3-8 tool calls first

### Evidence (last 24h)

| Agent | Session Time | Quality | Issue |
|-------|-------------|---------|-------|
| qa | 2026-04-23T04:06 | 0.45 | git in /app, tsc/vitest in wrong dir |
| qa | 2026-04-23T01:36 | 0.30 | git in /app, node_modules missing |
| qa | 2026-04-23T01:06 | 0.45 | git in /app, didn't pivot |
| qa | 2026-04-23T00:06 | 0.30 | git in /app, multiple wasted calls |
| qa | 2026-04-22T23:06 | 0.45 | git in /app, repeated failures |
| tech-lead | 2026-04-23T03:06 | 0.30 | git in /app, verification confab |
| tech-lead | 2026-04-23T00:06 | 0.45 | git in /app, wrong working dir |
| tech-lead | 2026-04-22T22:36 | 0.30 | git in /app, incorrect repo root |

**Impact**: ~3-8 wasted tool calls per session = 15-30% efficiency loss. Quality drops to 0.30-0.45 range.

## Why Text Fixes Failed

This extends KE-002 (text rules don't fix judgment). The context.md already contains:
1. Generic guidance: "agents/ is a separate git repo"
2. Specific FM-1.3 entries with session IDs
3. Lessons from past failures

Yet the behavior persists every session. The agent reads the context (C12.1 compliance) but doesn't connect "I'm about to run git" with "I need to cd first." This is an **automatic behavior** — the agent defaults to running commands in the current directory without checking.

## Recommended Structural Fix

**Option A (Preferred)**: Add a shell alias or wrapper that auto-detects git commands and warns/redirects:
```bash
# In session initialization
alias git='cd /app/agents && git'
```

**Option B**: Add a pre-check to the agent binary's bash tool that detects `git` commands not preceded by `cd agents`:
- If command contains `git log|status|diff|add|commit` and cwd is `/app`, inject a warning or auto-prefix with `cd agents &&`

**Option C (Minimal)**: Move the guidance from a bullet point to the FIRST line of context.md with specific syntax:
```
⚠️ BEFORE ANY git/tsc/vitest COMMAND: cd /app/agents first. /app is NOT a git repo.
```

Options A and B are structural (should work per KE-002). Option C is text (likely to fail, but cheapest to try).

## Connections

| Entry | Relationship |
|-------|-------------|
| KE-002 | Extended — another case of text rules failing for automatic behaviors |
| KE-106 | Parallel — guards catch but don't train |
| KE-119 | Parallel — review without action pattern |
