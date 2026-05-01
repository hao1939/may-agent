# KE-443: May's heartbeat snapshot shows the outage; May reads it and does nothing

**Status:** active
**Filed by:** arc, 2026-05-01 12:30Z
**Refines:** KE-440, KE-441 (this is their falsifier-of-the-falsifier)

## What changed

KE-441 argued: "may's heartbeat doesn't ask the right question, so dev's
outage stays invisible." Today's data falsifies that — the question IS
asked AND the data IS surfaced. The break is one layer further in:
attention/triage.

## Evidence

### 1. The template explicitly asks the question (`agents/may/heartbeat.md`)

```
**System health:**
- Are any agents producing errors repeatedly? Which one and why?
- Did any agent's session count drop to zero in the last 6 hours?
  Are they alive?
```

### 2. The system snapshot block surfaces the answer

```sql
SELECT agent, COUNT(*) n, ROUND(AVG(opCount)) ops,
       SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) errs
FROM sessions WHERE startedAt > ? GROUP BY agent
```

When run at any point in the last 11 hours, `dev` row reads `n=N, errs=N`
(100%). This is a single-glance pattern; no DBA skill required.

### 3. May ran 5 heartbeats (10:49, 11:18, 11:19, 11:49, 12:19, 12:49Z) with this template active.

opCount per session: 7, 5, ?, 33, 24, 21. Plenty of budget. None of the
six outcome strings mentions: dev, error, 401, IDE, token, outage. Each
session converged on inbox processing or staged-commit cleanup.

### 4. The bottleneck is not data, query, or template

It is **decision triage**: when may's heartbeat surfaces both
`stale-project amy session 130min` (current) and `dev: 14 errors / 14
sessions, all 401 token expired` (chronic), may consistently routes to
the new/transient signal and lets the chronic one sit. Dev's
`100%-failed` row in the snapshot table has been there for 11+ hours and
been read at least 5 times.

This makes it not a knowledge-injection problem (KE-441 framing) but a
**signal-saliency-against-a-fresh-distractor** problem. KE-441's
"add KE-delta to prompt" recommendation would not have changed this
behavior — the data was already in front of may.

## Why this matters

The autonomous loop's failure mode here is the boring one, not the
exciting one:
- Not "the system is blind."
- Not "the system has the data but no decision rule."
- It is: "the system has the data and a decision rule and budget,
  and still doesn't act, because cheaper signals always win the
  triage coin flip."

Pure-text recommendations to may will not fix this. Three options
ordered by leverage:

### Option A (lowest leverage, ≈10 LOC) — deterministic pre-snapshot alert

In whatever code generates may's heartbeat task message (the workflow
file that builds the prompt — see `agents/shared/workflows/`), prepend:

```
🚨 OUTAGE: agent=dev has 14 errors and 0 successes in last 6h.
   Last success: 2026-05-01T00:58:35Z (11h ago).
   Last error: "401 IDE token expired".
   Action: surface to Hao if external; create project if internal.
```

…whenever the SQL `SUM(errs)/COUNT(*) >= 0.8 AND COUNT(*) >= 3` for any
agent. Auto-rendered, sits ABOVE the questions block, hard to skip.

This is the same shape as KE-440 §rec1 and the dev-token proposal §3,
but framed as a prompt-prefix rather than a metric — because the metric
path goes through `metric.alert` events which gets filtered by alert_op
threshold and (per KE-440) is mathematically incapable of catching
this case. A prompt-prefix bypasses the metric system entirely and
just inspects sessions directly at heartbeat-build time.

### Option B (medium leverage) — owner-restricted heartbeat

Make may's heartbeat refuse to call `finish(success)` if any agent has
`>= 3 consecutive errors` and the heartbeat outcome doesn't mention that
agent's name. Forces triage, but adds a foot-gun: the rule must be
overridable when it's intentional.

### Option C (highest leverage, hardest) — change the saliency calculus

Restructure the heartbeat template so chronic failures have a fixed,
prominent slot above the inbox/projects sections. Inbox processing
becomes a *footer* item, not the default work. This requires Hao
buy-in on may's identity.

## Recommendation

Ship Option A first; it's small, concrete, and has falsifier ready
(within 30 min of landing, dev's 401 streak should appear in may's
next outcome string). If A still doesn't change behavior, that
disambiguates between "data isn't loud enough" (A fixes) and "may's
prompt routing is structurally biased toward fresh signals" (needs C).

## Falsifier

After Option A ships:
- Predicted: next may heartbeat outcome string contains "dev" or
  "401" or "outage."
- If 3 may heartbeats post-deploy still don't mention dev: A is
  insufficient, escalate to B/C.

## Why I (arc) cannot ship this myself

Per SOUL constraints — workflow files live in `agents/shared/workflows/`
and the heartbeat task-message construction is in workflow code arc is
write-blocked from. Filed proposal:
`agents/arc/workspace/proposals/2026-05-01-may-heartbeat-pre-snapshot-alert.md`
(this commit).

## Related

- KE-440 — original "aggregate hides single-agent" finding
- KE-441 — KE-440 recurred; framed problem as missing template question
- This entry refines: template question is present; problem is one layer in
- Proposal: `2026-05-01-refresh-dev-agent-ide-token.md` (5h27m unactioned)
- Proposal: `2026-05-01-may-heartbeat-outage-check.md` (likely overlaps with Option A; check before shipping)
- KE-417/418 — INBOX read priority; same family of "data-present, decision-absent"
