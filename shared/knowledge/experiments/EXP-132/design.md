# EXP-132: Path Hallucination Guard for C7.1 Regression

**Status**: IMPLEMENTATION  
**Channel**: 2 — Forced Externalization (structural guard)  
**Target**: C7.1 convention (no hallucinated paths)  
**Created**: 2026-04-11  

## Problem

C7.1 measures whether agents avoid using non-existent paths like `/home/*`, `/Users/*`, `/root/*`. May dropped from 92.9% → 73.7% on C7.1 over 2 days. All failures are bash commands in heartbeat sessions where the agent hallucinates paths:

```
cd /home/hao/may-agent && git status
cd /root/may-agent && ls
cd /Users/hao/c0 && cat file.ts
```

The project root is `/app`. There is no `/home/`, `/Users/`, or `/root/` directory.

## Hypothesis

A `beforeToolCall` guard on `bash()` can detect hallucinated path patterns in the command string and block the call with a corrective message. This is a Channel 2 (forced externalization) intervention — the agent physically cannot execute the hallucinated command.

## Design

### Guard: `path-hallucination-guard.ts`

**Trigger**: `bash()` calls where the `command` argument contains hallucinated paths.

**Detection patterns** (in the command string):
1. `/home/` — Linux home directories (don't exist in this env)
2. `/Users/` — macOS home directories (don't exist in this env)
3. `/root/` — root home (don't exist in this env)
4. `~/` — tilde expansion (expands to non-existent home)

**False positive exclusions**:
- Commands that are **searching for** these patterns rather than **using** them:
  - `grep`, `rg`, `ag`, `ack` commands with path patterns as search terms
  - `sed` with path patterns as replacement targets
  - `echo`/`printf` that just print the string
  - Quoted strings in `bun -e` / `node -e` / `python -c` inline scripts where the path is a string literal being searched/replaced, not a filesystem access
- The key heuristic: if the hallucinated path appears as a **filesystem operand** (cd, ls, cat, read, stat, mkdir, rm, cp, mv, touch, etc.) or as a bare path in the command, it's a violation. If it appears only inside a grep/sed/echo/string context, it's safe.

**Simplification decision**: Rather than trying to parse bash semantics perfectly, use a practical approach:
1. First check: does the command contain any hallucinated path pattern?
2. If yes, check: is the **entire command** a grep/rg/sed/echo that just mentions the pattern?
3. If the command starts with or pipes through filesystem-accessing commands with these paths, block.

**Actually simplest correct approach**: Check if any hallucinated path literal appears in the command. Then check if it ONLY appears inside quoted strings that are arguments to search commands (grep/rg/sed). This is still complex. 

**Final approach — simple and safe**: 
- Block if the command contains `/home/`, `/Users/`, `/root/`, or `~/` as a **path component** (not inside single/double quotes that are grep patterns)
- But since grep patterns are also in quotes sometimes... let's just use a simple heuristic:
  - If the line contains `grep`, `rg`, `ag`, `ack`, `sed`, `echo`, `printf` as the main command AND the hallucinated path is in the search pattern, allow it
  - Otherwise, block

**Even simpler final approach** (chosen):
- Block if command contains a hallucinated path pattern
- UNLESS the command is one of the known-safe patterns (grep/search for path strings)
- False positive cost is very low (agent gets a helpful message, retries with /app)
- False negative cost is high (C7.1 failure)
- So err on the side of blocking

### Action on detection

**Block mode** (hard fail). Return:
```
🚫 PATH_HALLUCINATION: This command uses a path that doesn't exist in this environment:
  Detected: /home/hao/may-agent
  
The project root is /app. There is no /home/, /Users/, or /root/ directory.
Rewrite your command using /app as the base path.
  Example: cd /app && git status
```

### Integration

Wire into `composeGuards()` in `src/lib/manager.ts`, early in the chain (before other guards that might inspect args).

## Metrics

- **Primary**: C7.1 pass rate should return to >90% within 24h
- **Secondary**: Zero false positives on legitimate grep/search commands
- **Monitor**: Guard block count in logs (should see blocks that would have been violations)

## Risk

- **False positives**: Legitimate commands that mention `/home/` etc. as search patterns. Mitigated by safe-pattern allowlist.
- **Over-blocking**: Commands that reference paths in string literals for replacement. Acceptable — agent can rephrase.
- **Under-blocking**: Novel hallucination patterns we haven't seen. Low risk — the patterns are consistent.
