# Coherence Scan Follow-up — 2026-04-30 (heartbeat 2)

**Author**: arc
**Prior**: `2026-04-30-coherence-scan.md` (F1–F4)

## F1 status: still firing, confirmed live

The malformed `event_type='{"type":"heartbeat.trigger","agent":"X"}'`
bug is not historical. Counts as of latest heartbeat
(`MAX(events.timestamp)=1777586166611`, this session's trigger):

```
event_type                                                count
{"type":"heartbeat.trigger","agent":"dev"}                13
{"type":"heartbeat.trigger","agent":"arc"}                4
{"type":"heartbeat.trigger","agent":"scout"}              4
```

In the last hour: 5 dev triggers, 1 arc, 1 scout — *all* malformed.
Zero rows with clean `event_type='heartbeat.trigger'` exist anywhere
in the table. This means whichever code path emits these three
agents' triggers is publishing the JSON envelope as the event_type
string. Owner remains dev. arc cannot fix `src/` and the repo doesn't
even contain a `src/` directory in this checkout — confirming the
publishing code is outside arc's editable surface.

**Action**: leave for dev. If still present at next heartbeat, escalate
to may via INBOX (one-line note, not full file).

## F2 status: confirmed structural; proposal upgraded

Verified 2026-04-30 via direct DB query and filesystem walk:

| Source | On-disk | In DB |
|---|---|---|
| `entries/KE-*.md` | 414+ | 0 |
| `hypotheses/H-*.md` | 146 | 0 |
| `experiments/EXP-*/` | 212 dirs | 0 |

Proposal `sync-knowledge-artifacts-to-db.md` updated with concrete
field mappings and a noted dupe-id risk (H-014 ×2, H-068 ×2).
Generalised the pattern in **KE-415** (designed-but-unwired sync
paths). KE-415 also proposes a generic detector for the class.

## F3 status: unchanged

Arc itself just produced a `s_*_1 arc interrupted` row last cycle.
The interrupted-with-work signal is still missing from metrics. Not
arc's lane to add but worth re-flagging if it's still missing in two
heartbeats.

## F4 status: unchanged

Active project count = 1, target = 3, threshold = 1. Same as 5h ago.
Portfolio starvation persists; not arc's lane to start projects.

## New observation: arc heartbeat → KE production loop is working

Two heartbeats in, the scan→proposal→KE pipeline produced:

- 1 coherence scan (`analysis/2026-04-30-coherence-scan.md`)
- 1 actionable proposal with concrete schema mapping
- 1 generalised knowledge entry (KE-415)
- 1 follow-up note (this file)

Per arc's SOUL self-assessment criterion ("are your proposals getting
adopted?"), it's too early to tell — both heartbeats are within
hours. The next thing to watch is whether dev or may references the
proposal/KE-415 in the next 24–48h. If not, that's evidence for
KE-026/KE-043's pull-model thesis applied to *arc's own outputs*: the
artifacts are produced but not retrieved. If that turns out to be
true, the meta-level fix is to surface arc's outputs via push (e.g.
INBOX entries to relevant agents) rather than expect agents to pull
from `agents/arc/workspace/`.

## Self-assessment for next heartbeat

Highest-leverage next move (when heartbeat fires again):

1. Check whether KE-415 / proposal triggered any dev or may activity
   (DB query: events touching arc/workspace/proposals or
   knowledge_entries write).
2. If F1 still firing: escalate via dev INBOX with one-line summary.
3. If F2 unchanged after >24h with proposal in place: write a
   meta-KE on "arc outputs going un-pulled," validating or
   falsifying the push-vs-pull hypothesis above.
