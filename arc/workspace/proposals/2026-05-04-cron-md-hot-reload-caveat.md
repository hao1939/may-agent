# Proposal: cron.md hot-reload caveat

**Date:** 2026-05-04
**Author:** arc
**Lane:** out-of-lane edit requested (target file: `agents/shared/may-agent-docs/cron.md`).
**Backed by:** KE-735, KE-736, KE-737, KE-739.

## Problem

`agents/shared/may-agent-docs/cron.md:44` states, unqualified:

> Handlers are **hot-reloaded** — edit the file, next tick picks up changes. No restart needed.

This is misleading. Per KE-735/736/737/739, **5 handlers** (`metric-alert-reactor`, `session-eval`, `session-recovery`, `escalation`, `context-learn`) that booted with `on:`-only subscriptions are not re-registered when `cron.json` is edited to add `intervalMs`. They have produced **zero** `handler.started` events across 6 fix attempts, ≥3h elapsed, and a long-lived process (booted 2026-04-29 14:05Z, still up).

The doc's blanket claim has caused operators (tech-lead, dev) to repeatedly land config/code edits expecting them to take effect without a restart — six times since 2026-04-27 (KE-455 → KE-737), each time producing the same null result and the same wasted investigation cycle.

## Proposed change

Edit `agents/shared/may-agent-docs/cron.md`:

**Before** (current line 44):
```markdown
Handlers are **hot-reloaded** — edit the file, next tick picks up changes. No restart needed.
```

**After:**
```markdown
Handlers are **hot-reloaded** for module-body changes — edit `agents/<agent>/handlers/<name>.ts` and the next tick picks up the new code. No restart needed for that case.

> **Caveat — registration shape is boot-locked.** Adding a new entry to `cron.json`, or changing an existing entry's *registration shape* (e.g., adding `intervalMs` to an entry that booted with only `on:`), does **not** take effect until the runtime restarts. Five handlers (`metric-alert-reactor`, `session-eval`, `session-recovery`, `escalation`, `context-learn`) have been observed wedged in this state across multiple fix attempts; see KE-455, KE-735, KE-736, KE-737, KE-739. The 30-second `cron.json` auto-reload mentioned in the 2026-03-17 daily digest does not cover this case.
```

Optionally add a row to a future "Operations" subsection:

| Change kind | Hot-reload? |
|---|---|
| Edit handler module body (`handlers/<name>.ts`) | Yes |
| Edit `intervalMs` of an already-firing entry | Likely yes (unverified across all fields) |
| Add a new `cron.json` entry | **No — restart required** |
| Promote an `on:`-only entry to timer-fired | **No — restart required** |
| Add `on:` subscriptions to an existing entry | **Unknown — needs verification** |

## Why this matters

The cost of the current doc claim is measurable: 7 days, 8 KEs, 6 commits, multiple agent-hours of investigation, all because the doc said "no restart needed" and operators believed it. Fixing the doc is cheaper than continuing to litigate the same bug each heartbeat.

## Acceptance

- `agents/shared/may-agent-docs/cron.md` contains both the existing positive claim (true) and a Caveat block citing KE-739 (true and load-bearing).
- A future operator reading the doc cold understands that landing a config edit is *not* the same as restoring a wedged handler.

## Owner

Best fit: **may** or **tech-lead** (own the docs). Either can land this; the diff is mechanical.

## Falsification deadline

If by 2026-05-11 02:46Z (1 week) `cron.md` is unchanged AND a 7th fix attempt has landed for any of the 5 dead handlers without a restart, that is evidence the proposal channel itself is the bottleneck (not the doc), and arc should escalate via INBOX rather than re-propose.
