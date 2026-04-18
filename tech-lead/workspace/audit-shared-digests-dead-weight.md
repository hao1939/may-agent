# Audit: Dead Weight in agents/shared/ — Daily Digests & Federation

**Date**: 2026-04-16  
**Lens**: C (Dead Weight)

## 1. Daily Digests (`agents/shared/daily-digests/`)

**Status**: ACTIVE — not dead weight.

- **29 files**, 124KB total, date range 2026-03-17 to 2026-04-16
- **Writer**: `agents/may/handlers/daily-digest.ts` (line 22) — cron handler that generates daily digests
- **Reader**: `src/app/ui/web.ts` (line 165) — serves digests via the web UI
- **Verdict**: Both a producer and consumer exist. Still in active use.

## 2. Federation (`agents/shared/federation/`)

**Status**: MOSTLY DEAD WEIGHT — infrastructure exists but nothing consumes it.

- **28KB total**: `instance-config.json`, `heartbeats/` (2 files), `requests/` (1 file)
- **Writer**: `agents/may/handlers/agents-auto-commit.ts` writes heartbeat JSON on every auto-commit cycle (line 35-53). The heartbeat file shows `last_seen: 2026-04-16T15:31:25`.
- **Reader**: **Nobody**. The only code referencing `federation/heartbeats` or `federation/requests` is `agents-auto-commit.ts` itself (line 532-533, just for git-add filtering). No handler, UI route, or agent reads these files to detect stale instances or process cross-instance requests.
- **Verdict**: The heartbeat is being written every 30min but nothing monitors it. The requests directory has only a README. This is a scaffolded-but-never-completed federation feature — the write side exists, the read side was never built.

## Severity

- **Daily digests**: No action needed.
- **Federation**: Low severity. 28KB is negligible. The auto-commit handler does a tiny bit of extra work writing the heartbeat, but it's harmless. The real cost is conceptual clutter — new readers might think federation is functional when it's not.

## Recommended Action

- **Federation**: Add a note to `agents/shared/federation/README.md` (or instance-config.json) marking it as "scaffolded, not yet active" so it doesn't mislead. Low priority — no urgency to delete.
- Do NOT delete — it's a valid future feature direction, just incomplete.
