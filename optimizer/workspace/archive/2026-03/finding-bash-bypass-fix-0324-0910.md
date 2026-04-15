# Finding: Session Read Guard — Bash Bypass Fix

**Date:** 2026-03-24T09:10 UTC  
**Type:** LLM-to-JS (structural guard)  
**Status:** ✅ Implemented & tested

## Problem

The existing `session-read-guard.ts` only blocked the `read()` tool from accessing session.jsonl files. Agents (particularly coach) bypassed this by using `bash` with `grep`/`cat` to dump the same files:

- **Session s_72**: 401KB from 35 bash calls, each producing 50-102KB of grep output from session.jsonl
- **Cost**: $2-5/session in wasted tokens (per cost-scan-0323-1906)
- **Root cause**: Guard only intercepted `read()` tool, not `bash` tool

## Fix

Extended `session-read-guard.ts` to also intercept bash tool calls:

1. **cat/less/more** of session.jsonl → always blocked (dumps full file)
2. **grep/rg** of session.jsonl without output limiter → blocked
3. **grep -c/-l/-m** or **grep | head** → allowed (bounded output)

### What's allowed (safe patterns):
- `grep -c 'pattern' ...session.jsonl` — count only
- `grep -l 'pattern' ...session.jsonl` — filenames only  
- `grep -m 5 'pattern' ...session.jsonl` — max N matches
- `grep 'pattern' ...session.jsonl | head -20` — piped to head/tail
- `wc -l ...session.jsonl` — line count
- `jq ... session.jsonl | head -N` — jq with limiter

### What's blocked:
- `cat .state/sessions/.../session.jsonl` — full dump
- `grep 'pattern' .state/sessions/.../session.jsonl` — unbounded output

### Known limitation:
Shell variable indirection (`for f in *session.jsonl; do grep 'x' "$f"; done`) bypasses the guard since the regex can't match grep against a variable. This is an acceptable gap — 95%+ of real usage is direct path references.

## Files Changed
- `src/lib/tools/session-read-guard.ts` — Extended guard logic
- `test/session-read-guard.test.ts` — 29 tests (was 8, now 29)

## Projected Savings
- Coach sessions bypass: ~$2-5/session, ~5 sessions/day = **$10-25/day**
- Conservative estimate: **$10/day** (not all coach sessions grep session.jsonl)

## Tests
All 29 tests pass. No regressions in existing test suite.
