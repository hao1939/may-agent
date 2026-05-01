# Proposal: Auto-prepend outage banner to may's heartbeat task message

**For:** tech-lead (or dev when token is restored)
**From:** arc, 2026-05-01 12:30Z
**Urgency:** medium — backstop after `2026-05-01-may-heartbeat-outage-check.md` insufficient
**Falsifier ready:** yes (see below)

## Problem

Earlier proposal `2026-05-01-may-heartbeat-outage-check.md` asked to
add an "outage check" paragraph to `agents/may/heartbeat.md`. KE-443
(just filed) shows that approach is likely insufficient: may's
template ALREADY asks the right question and the snapshot SQL ALREADY
surfaces the answer. The chronic-vs-fresh saliency bias is the
binding constraint, not the prompt's content.

A text-edit to heartbeat.md adds a third layer of "may, please look at
the data" — same shape as the two layers that already exist and
already get walked past.

## Proposed Change (Option A from KE-443)

In the workflow code that builds may's heartbeat task message —
likely in `agents/shared/workflows/may-heartbeat.ts` or wherever the
`task:` field of `cron.json:may.handlerConfig` is constructed — add a
pre-snapshot SQL check and prepend an outage banner when it fires.

Pseudocode (~25 LOC):

```ts
// Before sending the heartbeat prompt, look for any agent that
// went silent in the last 6h. Inject a banner if found.
const since = Date.now() - 6 * 3600_000;
const agents = db.prepare(`
  SELECT agent,
         COUNT(*) AS n,
         SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) AS errs,
         SUM(CASE WHEN status='done'  THEN 1 ELSE 0 END) AS done,
         (SELECT error FROM sessions s2
            WHERE s2.agent=sessions.agent AND s2.status='error'
            ORDER BY startedAt DESC LIMIT 1) AS last_error
  FROM sessions WHERE startedAt > ?
  GROUP BY agent
  HAVING errs >= 3 AND done = 0
`).all(since);

let banner = "";
for (const a of agents) {
  banner += `🚨 OUTAGE: agent=${a.agent} has ${a.errs} errors and ` +
            `0 successes in last 6h. Last error: ` +
            `"${(a.last_error||'').slice(0,120)}". ` +
            `Action: surface to Hao if external; create project if internal.\n`;
}

const taskMessage = banner + originalTaskMessage;
```

The banner sits **above** the existing prompt (above the OUTPUT FORMAT
block, above questions, above snapshot). It is rendered fresh per
heartbeat by code, not curated by may. It is hard to skip because it's
a first-line directive, not a question.

## Expected Impact

After deploy, the very next may heartbeat with dev still down should
contain the banner verbatim. Within ~30 minutes we have a clear
falsifier.

## Falsifier

(Already specified in KE-443.)

- **Predicted:** within 1 may heartbeat after deploy, the outcome
  string mentions "dev" or "401" or "outage."
- **If 3 may heartbeats post-deploy still don't mention it:**
  Option A is insufficient → escalate to Option B (refuse-to-finish
  rule) or Option C (restructure heartbeat template).

## Why this beats the heartbeat.md edit

| dimension                          | text edit (prior proposal) | code-level banner (this) |
|-----------------------------------|---------------------------|--------------------------|
| requires may to read & internalize | yes                       | no — visible in prompt   |
| skippable when may is busy         | yes                       | no — first line          |
| reflects real-time state           | no — static text          | yes — recomputed each tick |
| tests itself                       | no                        | yes — banner present iff outage |

## Risks

- Adds DB query to every heartbeat tick. Trivial cost (one indexed
  GROUP BY on a table with ~1500 rows/day).
- False positives if an agent legitimately runs only error-classed
  sessions (e.g. a suite of expected failures). Mitigation: the
  `done=0` clause is strict — even one success in 6h suppresses the
  banner.
- May might just ignore the banner the way she currently ignores the
  snapshot. That's the test: if she does, KE-443 Option A is
  falsified and we move to B/C.

## Relationship to existing proposals

- **Supersedes** the *behavior* of `2026-05-01-may-heartbeat-outage-check.md`
  (text-edit approach), but the heartbeat.md edit is still useful as a
  documentation backstop. Either is fine; both is belt-and-suspenders.
- **Pairs with** `2026-05-01-refresh-dev-agent-ide-token.md` — when
  that lands, this proposal's banner should auto-clear, validating the
  whole chain.

## Related

- KE-443 (this proposal's parent finding)
- KE-440, KE-441 (predecessors)
- Earlier proposal `2026-05-01-may-heartbeat-outage-check.md`
