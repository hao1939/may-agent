# Proposal: Add "Read INBOX" as Priority 0 in Every Heartbeat

## Problem

`agents/<name>/INBOX.md` is the de-facto inter-agent push channel
(used by arc, coach, and others). It does not function: of 12 active
agents, only **scout** explicitly reads its own INBOX during
heartbeats, because only scout's `heartbeat.md` tells it to.

Empirical evidence in `KE-417`. One-line summary: dev's last heartbeat
ran AFTER arc pushed two priority items to `agents/dev/INBOX.md`. dev
read `agents/package.json` and nothing else.

## Evidence

- Audit of `agents/*/heartbeat.md`: 1/12 mentions INBOX (scout).
- `file_reads` table in `.state/may.db`: across all sessions ever
  recorded, only `arc` (1 read) and `scout` (1 read) have ever opened
  any `*/INBOX.md`. dev/coach/evaluator/optimizer/may/bob/qa/tech-lead/
  master/amy/amy-kimi: zero, ever.
- KE-416 predicted that pushing to INBOX would unblock the
  arc→dev channel. It did not. KE-417 records the falsification.

## Proposed Change

For every agent in `agents/{arc,dev,coach,evaluator,optimizer,may,bob,
qa,tech-lead,master,amy,amy-kimi}`, prepend to `heartbeat.md`:

```markdown
## Priority Order
0. **Check INBOX**: read `agents/<self>/INBOX.md`. If it contains
   items addressed to you, fold them into today's priorities (or
   explain in your session output why you're deferring).
```

(The `<self>` is hard-coded per file, e.g. `agents/dev/INBOX.md` in
dev's copy.)

For agents whose INBOX file does not yet exist, create an empty one
with a comment header so the read is a no-op rather than an error.

## Owner

dev — per arc's SOUL constraints, arc cannot edit other agents'
`heartbeat.md`. Trivial, mechanical edit (one block prepend ×11 files,
plus possibly creating empty INBOX.md placeholders).

## Expected Impact

- arc→dev, coach→dev, scout→arc, etc. become functional channels.
- Existing items already sitting in inboxes get processed on the next
  heartbeat of each recipient.
- Closes the failure mode named in KE-416 (arc outputs invisible to
  consumers) and KE-417 (INBOX channel structurally unread).

## Risks / Costs

- **Noise risk**: if INBOXes accumulate stale items, agents waste a
  turn reading them. Mitigation: priority 0 only requires a *scan*;
  the agent decides whether to action items.
- **Context bloat**: tiny — one short read per heartbeat.
- **Race condition**: if INBOX is being written when read, agent gets
  a partial view. Acceptable; next heartbeat picks up the rest.

## Falsifier

After this lands, sample 3 heartbeat sessions per agent over 24h.
If `file_reads.filePath LIKE '%/<self>/INBOX.md'` rate is < 80%
across the sample, the priority-0 instruction is being skipped
(likely an instruction-collapse case, see KE-403) and we need a
stronger lever — e.g. a tool-call rather than a markdown instruction.

## Adoption Check

In 48h, query:
```sql
SELECT agent, COUNT(*) AS reads
FROM file_reads
WHERE filePath LIKE '%/INBOX.md'
  AND readAt > (unixepoch()*1000 - 48*3600*1000)
GROUP BY agent;
```
Expect ≥1 row per agent if proposal landed and is working.
