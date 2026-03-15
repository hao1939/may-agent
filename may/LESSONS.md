# Lessons

_Staging area for behavioral fixes. Each entry should graduate into structure (heartbeat.md, DOMAIN.md, tool code) within 2 weeks, then be deleted._

## Active Band-Aids

- **Heartbeat is NOT auto-loaded**: You MUST `read()` heartbeat.md at the start of every heartbeat. _(Added 2026-03-14. Keep until infrastructure auto-loads heartbeat.)_

- 🔴 **No Fabricated Metrics (3x recurrence)**: NEVER report statistics, percentages, or counts in your summary that you did not directly compute from tool output in this session. If you didn't run a command that produced "91%", don't write "91%". If `ls` returned empty output, say "empty" — don't say "0 sessions" unless you verified. **Self-check before final output**: for every number or metric in your summary, can you point to the exact tool output it came from? If not, remove it. _(Added 2026-03-14. Graduates to heartbeat.md Output section after verification.)_

- 🔴 **Correct TODO Path (14x recurrence)**: Your todo file is at `agents/may/workspace/todo.md` — NOT `agents/may/todo.md`. Do NOT attempt `agents/may/todo.md` first. This ENOENT wastes a tool call every heartbeat. Go directly to `agents/may/workspace/todo.md`. _(Added 2026-03-15. 14 evals flagged this same ENOENT. Graduates when 5 consecutive heartbeats have zero todo.md path errors.)_

- 🔴 **Correct SIGNALS.md Path (14x recurrence)**: The signals file is at `agents/shared/SIGNALS.md` — NOT `SIGNALS.md` at repo root. Your P82 check MUST use `agents/shared/SIGNALS.md`. Using `grep ... SIGNALS.md` without the full path causes ENOENT every heartbeat. Use: `grep -n "PENDING_ACK" agents/shared/SIGNALS.md | grep -i may | tail -20` or `cat agents/shared/SIGNALS.md`. _(Added 2026-03-15. 14 evals flagged this wrong-path ENOENT. Graduates when 5 consecutive heartbeats use the correct path on first attempt.)_

- **No Re-Cancellation Waste (C20)**: `agents.cancel()` on idle sessions does NOT remove them from `system_status` active listings. If you cancelled sessions in a previous heartbeat and they still appear as "idle" in `system_status`, do NOT cancel them again. Only cancel sessions you haven't seen before. Check your recent task history summaries — if they mention "cancelled 14 stale sessions", those same sessions will still appear but are already handled. _(Added 2026-03-15. Saves ~14 wasted tool calls per heartbeat.)_

## Graduated ✅

- ~~P114 Experience Replay~~ → **GRADUATED to heartbeat.md step 1** (P114 MANDATORY gate). _(Graduated H534)_
- ~~P82 Read Receipts~~ → **GRADUATED to heartbeat.md step 1** (P82 MANDATORY gate). _(Graduated H534)_

## Graduated (remove after confirming structural fix works)

- ~~Shallow heartbeat (🔴🔴🔴)~~ → **GRADUATED to heartbeat.md** Steps 3-5 (mandatory health checks + initiative). Lesson measured as FAILED (5%→11% worse). Structure is the fix, not the lesson. _(Removed 2026-03-14)_
- ~~No Blind Writes~~ → **GRADUATED to agents/shared/LESSONS.md**. _(Removed 2026-03-14)_
- ~~Verify Paths~~ → **GRADUATED to agents/shared/LESSONS.md**. _(Removed 2026-03-14)_
- ~~Context Efficiency~~ → **GRADUATED to agents/shared/LESSONS.md**. _(Removed 2026-03-14)_
