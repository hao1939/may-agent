# KE-1252: Guard Alert Fatigue — 62% of Guard Triggers Are Ambient Noise

<ai_context>
summary: 601 of 963 guard.triggered events in 24h (62%) are the identical "uncommitted files exist" warning that fires on nearly every tool call when any agent has pending changes. This single warning type exceeds all other guard signals combined, creating classic alert fatigue. The guard system's actual safety signals (verification depth blocks, session read blocks, path hallucination blocks) are drowned in noise. Connects to KE-1246 (metric measuring wrong thing) and KE-774 (false positive alert cascades) as part of a broader pattern: the guard/alert system generates more noise than signal.
triggers: [alert-fatigue, guard-system, signal-to-noise, uncommitted-files, guard.triggered]
last_updated: 2026-05-13
source_basis: Empirical query of events table, 24h window ending 2026-05-13
</ai_context>

## Finding

In the last 24 hours, the guard system emitted **963 `guard.triggered` events**: 683 warnings, 280 blocks. The top trigger by volume:

| Reason | Count | % of Total | Action |
|---|---|---|---|
| "Uncommitted files exist in agents/..." | 601 | 62% | warn |
| Verification depth block | 89 | 9% | block |
| Session.jsonl read block | 35 | 4% | block |
| Read dedup warning (4+ reads) | 33 | 3% | warn |
| Uncommitted files at finish() | ~58 | 6% | block |
| Path hallucination block | 16 | 2% | block |
| Everything else | ~131 | 14% | mixed |

The "uncommitted files" warning fires on virtually every `beforeToolCall` when *any* agent has pending uncommitted changes. Since agents often overlap in time and changes from one session linger until commit, this warning is nearly always present. It fired across **all 5 agents** hitting every session:

| Agent | Warn Count | Sessions Hit |
|---|---|---|
| evaluator | 296 | 296 |
| may | 132 | 125 |
| dev | 64 | 62 |
| scout | 58 | 48 |
| arc | 51 | 49 |

The evaluator alone receives 296 of these — nearly one per session, since evaluator runs many short sessions (aftermath reviews).

## Why This Matters

Alert fatigue is well-documented in ops/security literature: when >50% of alerts are false positives or ambient noise, operators stop reading all alerts, including the real ones. Our guard system has crossed that threshold.

The 89 verification-depth blocks and 16 path-hallucination blocks are **genuinely useful safety signals**. But they arrive embedded in a stream where 62% of events are the same ambient noise. An agent (or a human reviewing guard logs) has to sift through ~7 noise events for every 4 real signals.

## The Structural Issue

The "uncommitted files" guard has a useful intent: prevent agents from committing other agents' changes. But as implemented:

1. It fires as a **warning** (not a block) — agents can't act on it except to be aware
2. It fires on **every tool call** in a session, not once per session
3. The condition (uncommitted files exist somewhere in agents/) is nearly always true in a multi-agent system with overlapping sessions
4. The warning message says "Do not commit unrelated files" — instruction-giving via guard, repeated hundreds of times

This is a **rate problem**: the guard fires at tool-call frequency (~10-30x per session) when the information is session-level (only needs to be seen once). Firing it once per session would reduce volume from 601 to ~580 events... actually even per-session it'd still be dominant. The deeper issue is that in a multi-agent repo, "uncommitted files exist" is the default state, not an anomaly.

## Connection to Broader Pattern

This is the third entry in a guard/alert system noise pattern:

- **KE-774** (May 6): Rate-mode alerts on rolling-window counters produce false positive cascades — 11 flap cycles in 5h
- **KE-1246** (May 12): `guard.repeat-trigger-count-24h` metric queries for an action value that never occurs, reading 0 while real repeats are ~108/day
- **KE-1252** (this): 62% of raw guard triggers are ambient noise from a single warning type

The common thread: **the guard/alert system optimizes for coverage (fire on everything that could be wrong) at the expense of precision (fire only when action is needed)**. This is the opposite of what the HN discourse and arXiv robustness literature suggest: production agent systems need high-precision, low-noise safety signals because agents (like humans) develop learned helplessness toward noisy warnings.

## Recommendation

1. **Deduplicate per-session**: The "uncommitted files" warning should fire at most once per session, not per tool call
2. **Suppress when not actionable**: If the uncommitted files don't match the current session's write paths (which the guard already checks!), don't warn — the agent literally cannot fix the situation
3. **Re-evaluate as block-at-finish only**: The real risk is committing other agents' files, which is already separately guarded at `finish()`. The per-tool-call warning may be entirely redundant

Reducing this single source would bring guard SNR from 38% to ~75% — a dramatic improvement with no safety cost.

## Validation

After any fix, verify:
```sql
SELECT COUNT(*) FROM events 
WHERE event_type='guard.triggered' 
  AND timestamp > (strftime('%s','now')*1000 - 86400000)
  AND json_extract(data, '$.reason') LIKE 'Uncommitted files exist%';
```
Target: <50/day (from 601).
