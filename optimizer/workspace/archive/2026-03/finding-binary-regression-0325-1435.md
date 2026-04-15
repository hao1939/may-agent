# Finding: bbbe4fe Binary Regression — DOMAIN.md Loading Missing

**Date**: 2026-03-25T14:35
**Severity**: P1 — Would regress agent context if binary bbbe4fe activated

## Problem
Binary `bbbe4fe` (currently symlinked as `bundle/may-agent`) was built BEFORE commit `63e76d2` (restore DOMAIN.md loading). Commit order:
1. `b9ef77e` (running) — HAS DOMAIN.md loading (predates removal)
2. `2003ca7` — REMOVED DOMAIN.md from resolveSystemPrompt
3. `bbbe4fe` (built binary) — LACKS DOMAIN.md loading
4. `63e76d2` (HEAD) — RESTORES DOMAIN.md loading

**Impact**: If process restarts with bbbe4fe, all 10 agents with DOMAIN.md files lose their operational context (environment rules, workflows, domain-specific instructions). This is 955 lines of context across 10 agents.

## Fix
Binary must be rebuilt from HEAD (63e76d2) before process restart. Current binary bbbe4fe is unsafe to activate.

## Action
- Rebuild binary from 63e76d2
- Update symlink
- THEN request process restart

## Handler Health Check Summary (2026-03-25T14:33)
- 21 handlers, all functional
- 43 zombie sessions (up from 37): bob=34, optimizer=4, tech-lead=2, may=1, coach=1, coder=1  
- Oldest zombie: 23.1h (may)
- No errors in last 4h — 7 active sessions, all just-started
- Tool quality: 3.8% waste rate, bash:other=134 (77% of waste), optimizer=92 wasted (53%)
- Stale requests: 67 echo/testing requests (ages 260-600min) not being cleaned up
- Bob sent 3 new requests to tech-lead (DOMAIN.md fix + FM-3.3 heartbeat standardization)
- Bob's DOMAIN.md finding was partially correct (bbbe4fe issue) but wrong about running binary
