# Poller Verification Report

**Date**: 2026-05-27  
**Status**: Poller deployed but NOT yet firing — critical bugs found and partially fixed

## Summary

The `context-learn-poller` handler is correctly registered in `cron.json` (intervalMs: 1800000, enabled: true) but has **never executed** — no state file (`context-learn-poller-processed.json`) exists anywhere on disk.

## Findings

### 1. Poller Is Registered Correctly
- Entry in `/app/agents/may/cron.json`: ✅ present with `handler: "context-learn-poller"`, `intervalMs: 1800000`, `enabled: true`
- Handler file at `/app/agents/may/handlers/context-learn-poller.ts`: ✅ exists, well-structured

### 2. Poller Has Never Run
- No state file found (`find / -name "context-learn-poller-processed.json"` returns nothing)
- Likely reason: The cron scheduler hasn't picked it up yet (recently added) OR there's a module resolution error at runtime

### 3. Bug Fixed: Session Directory Prefix Mismatch
- **Before**: Poller only scanned dirs starting with `s_`
- **Reality**: History contains BOTH `s_*` (35,287 sessions) and `cron_*` (20+ sessions)
- **Fix applied**: Updated filter to accept both `s_` and `cron_` prefixes

### 4. Critical Architecture Gap: lessons.jsonl vs context.md
- The `context-learn` handler writes facts to **agent `context.md` files** — NOT to `lessons.jsonl`
- `lessons.jsonl` was populated ONLY by the bootstrap seeding (20 lessons)
- These are **two separate knowledge systems**:
  - `context.md` = per-agent durable facts (managed by context-learn handler)
  - `lessons.jsonl` = cross-agent structured lessons (no automated writer exists)
- **To grow lessons.jsonl organically, a new extraction step is needed**

### 5. Available Session Volume
- 35,287 `s_` sessions in `.state/sessions/history/`
- Very recent sessions exist (timestamps within last minute)
- Most are `status: "done"` with valid agents
- `CONTEXT_LEARN_AGENTS=coder,may,bob,coach,optimizer,tech-lead` — correctly set

### 6. context-learn Handler Extraction Methods
- **Mechanical** (`extractFactsMechanical`): command corrections, runtime facts, path discoveries
- **LLM** (`learnFromSessionLLM`): richer extraction using evaluator agent
- Neither writes to `lessons.jsonl` — both write to `context.md`

## Current State of lessons.jsonl
```
20 lines — ALL from bootstrap seeding (source_task: "bootstrapped from context.md")
0 organic lessons captured
```

## What's Working
- [x] Poller registered in cron.json
- [x] Handler file exists with correct logic
- [x] Session directory prefix bug fixed (now handles both `s_` and `cron_`)
- [x] CONTEXT_LEARN_AGENTS env var set correctly
- [x] Plenty of sessions available to process

## What's NOT Working
- [ ] Poller has never actually executed (no state file)
- [ ] No mechanism writes to `lessons.jsonl` — only `context.md` gets updated
- [ ] Cannot manually test without the full handler runtime (needs `ctx` object)

## Recommendations

1. **Wait for next cron cycle** — the poller should fire within 30 minutes now that the prefix bug is fixed
2. **Add lessons.jsonl writer** — extend context-learn handler or create new handler to also append structured lessons
3. **Monitor** — check for state file: `find /app -name "context-learn-poller-processed.json"`

## Files Modified This Session
- `/app/agents/may/handlers/context-learn-poller.ts` — Fixed session dir prefix filter (line 74: added `|| dir.startsWith("cron_")`)
