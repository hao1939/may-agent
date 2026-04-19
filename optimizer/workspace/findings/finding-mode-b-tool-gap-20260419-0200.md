# Finding: Tool Gap Analysis — Repeated Bash Patterns (2026-04-19 02:00 UTC)

## Scan Window
Last 6h sessions with opCount > 10. Sampled 4 sessions: coach-154op, coach-31op, bob-48op, coach-48op.

## Key Finding: Gym Infrastructure Discovery Is the #1 Op Sink

All 4 sampled sessions are heavily bash-dominated (90%+ bash calls). The dominant pattern across sessions:

### Pattern 1: Gym Result Discovery (15-25 ops per session)
**Seen in**: coach-154op (ops 8-21), bob-48op (ops 23-26, 35-37)

Agents spend 10-25 consecutive bash calls trying to find gym run results:
- `find /tmp/gym-batch-*/results.jsonl` → empty/missing
- `ls -lt /tmp/gym-run-*/` → list dirs
- Loop through dirs checking `score.json`, `transcript.jsonl`, `results.jsonl`
- `cat /tmp/gym-batch-XXX/results.jsonl` → empty
- Check individual run dirs for transcripts

**Root cause**: gym-batch.sh writes results to temp dirs with random names, and results.jsonl is often empty when runs error/timeout. No structured output location.

**Fix**: `gym-batch.sh` should write a summary to a predictable location (e.g., `/tmp/gym-batch-latest/` symlink, or print a structured JSON summary to stdout). Or: a `gym-results.sh <scenario>` script that queries the DB.

### Pattern 2: Lab Fork Overlay Debugging (10-15 ops)
**Seen in**: coach-154op (ops 28-40, 110-120), bob-48op (ops 17-31)

Agents don't understand how lab fork files overlay onto agents:
- Checking if context.md was applied: `cat /tmp/gym-run-XXX/agents-lab/bob/context.md`
- Grepping gym-runner.ts for "lab", "fork", "context" 
- Reading gym-run.sh to understand the overlay mechanism
- Discovering that skills/ replaces but context.md needs to exist

**Root cause**: Lab fork mechanism is undocumented. Each agent rediscovers how overlays work.

**Fix**: Add a `## Lab Fork Mechanism` section to coach and bob context.md explaining: "Lab forks in `agents/.lab/<name>/` overlay onto the agent dir. Files are copied over (cpSync). skills/ fully replaces. context.md and SOUL.md are overlaid if present in the fork."

### Pattern 3: Session Transcript Inspection (5-10 ops)
**Seen in**: coach-154op (ops 70-72, 85-99), bob-48op (ops 36-37)

Agents parse session.jsonl manually with python3 one-liners to see what tools an agent called:
- `python3 -c "import json; ..."` to parse jsonl
- `grep -o '"name":"[^"]*"' transcript.jsonl`
- Multiple attempts due to jsonl format confusion

**Root cause**: No tool to quickly summarize a gym run's actions.

**Fix**: Add `gym-inspect.sh <run-dir>` that prints: tools called (counts), pass/fail, scenario, variant, duration.

### Pattern 4: Repeated bun:sqlite Query Failures (3-5 ops)
**Seen in**: bob-48op (ops 38-41 — 4 consecutive DB query attempts)

Multiple failed `bun -e` one-liners due to quoting issues, then retries.

**Root cause**: Complex SQL in shell strings is fragile. Known issue (FM-2.2 in recall).

**Fix**: Already addressed by heredoc pattern in context.md. Could also add `db-query.sh` wrapper.

## Impact Estimate
- Pattern 1 (gym result discovery): ~20 ops/session × ~8 gym sessions/day = **160 wasted ops/day**
- Pattern 2 (lab fork debugging): ~12 ops/session × ~4 new-fork sessions/day = **48 wasted ops/day**
- Pattern 3 (transcript inspection): ~7 ops/session × ~6 sessions/day = **42 wasted ops/day**
- Pattern 4 (bun:sqlite failures): ~3 ops/session × ~10 sessions/day = **30 wasted ops/day**

**Total estimated waste: ~280 ops/day** from these 4 patterns alone.

## Priority Recommendations
1. **HIGH**: `gym-inspect.sh` — quick gym run summary tool (addresses patterns 1+3)
2. **HIGH**: Lab fork documentation in agent context.md (addresses pattern 2)
3. **MED**: `gym-batch.sh` structured output improvements (addresses pattern 1)
4. **LOW**: `db-query.sh` wrapper (pattern 4 partially addressed already)

## Sessions Analyzed
| Session | Agent | Ops | Bash% | Primary Activity |
|---------|-------|-----|-------|-----------------|
| s_1776551125350_659 | coach | 154 | 92% | persistent-task intervention + gym debugging |
| s_1776550965464_657 | bob | 48 | 84% | dreaming/consolidation experiment |
| s_1776558283950_741 | coach | 31 | 86% | heartbeat auto-detection experiment |
| s_1776545680528_605 | coach | 48 | 83% | persistent-task structural intervention |
