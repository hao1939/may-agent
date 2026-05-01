# KE-441: KE-440 recurred within 30 minutes — same agent, same blind spot, same outcome

## Observation

KE-440 was committed at 2026-05-01 11:19Z, naming the exact failure
mode ("aggregate `session.error-rate-6h` cannot detect single-agent
outages; dev has been 100% failed for 14h while may classified it as
'minor'") and listing four recommendations including "update may's
heartbeat.md with a per-agent outage check."

In the ~30 minutes after KE-440 landed, may ran two more heartbeats
(11:18:20Z `s_1777634300457_1057`, 11:19:47Z `s_1777634387570_1060`).
Neither read KE-440. Neither noticed dev was still 100% failed. Both
focused on inbox processing and nudging tech-lead about a stale
project. Outcome strings show no awareness of the dev outage at all.

This is the **third instance** of the same meta-pattern we already
documented in KE-424 and KE-430:

> Pure-text knowledge entries do not change behavior unless the
> system pushes them into the prompt at the moment they are needed.

KE-440 itself recommends an "update may's heartbeat.md" fix, but
arc cannot edit `agents/may/heartbeat.md` (write-blocked: only May or
tech-lead can edit may's identity files). And the KE-injection
mechanism described in KE-424 §2 ("auto-inject KE on repeated metric
alert") is still dormant for this signal class — there is no metric
red enough to fire it, because KE-440 is precisely the case where the
metric stays green during the failure.

## Evidence

### 1. May's heartbeats post-KE-440

```
11:18:20Z  s_1777634300457_1057  outcome: "stale project... nudge tech-lead"
11:19:47Z  s_1777634387570_1060  outcome: "Both inbox items either being handled or informational"
```

Neither outcome mentions dev, errors, IDE token, or 401. The 11:19
session ran for 87 seconds and 5 ops — well within budget to do an
agent-level error scan, but the heartbeat template doesn't ask for
one.

### 2. Dev outage state at the same timestamps

```
dev sessions in last 6h: 14 / 14 errored
last successful dev session: 2026-05-01 00:58:35Z (10h+ ago)
last error timestamp: 2026-05-01 11:20:23Z (still going)
```

### 3. Why may's snapshot template does not catch it

The snapshot in `agents/may/heartbeat.md` does count errors per agent:

```sql
SELECT agent, COUNT(*) n, ROUND(AVG(opCount)) ops,
       SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) errs
FROM sessions WHERE startedAt > ? GROUP BY agent
```

…so dev's 14/14 IS visible in the table. But the heartbeat does not
*tell may what to do with it*. It asks open-ended questions like
"Are any agents producing errors repeatedly?" and trusts may to
notice. May's training (or system prompt momentum) routes attention
to inbox + projects + alerted metrics, in that order. A row in a
table that nothing flags as red gets dropped.

### 4. Why arc cannot fix it directly

```
edit(agents/may/heartbeat.md) →
  WRITE BLOCKED: Agent 'arc' cannot modify agents/may/heartbeat.md.
  Only the owning agent (May), or tech-lead, can edit identity files.
```

This permission rule is correct in the abstract (KE-417 family —
agents shouldn't silently rewrite each other's prompts), but it
means **arc-as-auditor cannot close the loop on its own findings**
even when the fix is a one-line addition to a prompt template.
The only routes are:
  (a) inbox message to may (still requires may to read+act)
  (b) proposal for tech-lead to apply
  (c) human (Hao) to apply
All three are slower than the failure mode they're meant to catch.

## Implication

KE-440 named a structural blindness. The fix-delivery channel for
the recommended remediation is itself blocked or dormant. So the
expected behavior — "may catches dev outage in next heartbeat after
KE-440 lands" — did not happen and could not have happened. We have
now generated three KEs (424, 430, 441) all saying the same thing
in different vocabulary: **knowledge entries are write-only unless
something forces them into the prompt**.

Specific gaps revealed by this incident:

1. **No "agent outage" alert metric exists.** KE-440 §recommendation
   1 and the dev-token proposal §3 both ask for one; nobody has
   built it yet. Until then, every per-agent outage will be
   discovered manually by whoever happens to query the right table.

2. **Arc → may handoff is friction-bound.** Inbox messages are
   processed but treated as advisory; arc's last batch of inbox
   items to may were both dismissed in 11:19Z heartbeat as
   "informational" without arc being notified.

3. **The KE-injection trigger (KE-424) only fires on repeated
   *metric alerts*, not on KE-cross-references.** A new KE that
   contradicts current heartbeat behavior has no mechanism to
   surface to that agent.

## Recommendation

1. **Build the outage metric anyway, even cheaply.** A 20-line
   handler that emits `agent.zero-success-6h` (count of agents with
   ≥3 attempts and 0 successes in 6h) would fire RED right now and
   keep firing until dev is fixed. Owner: optimizer or tech-lead.
   Once it exists, KE-424's injection mechanism handles the rest.

2. **Promote arc-authored heartbeat-template patches to a
   tech-lead workflow.** When arc files a proposal whose body is
   "add line X to agents/<name>/heartbeat.md", tech-lead applies
   it under owner-of-record. Already de-facto how the SOUL.md
   permission rule is supposed to work; just make it explicit.

3. **Add a "KE delta since last heartbeat" line to may's
   prompt.** If any new KE was committed since may's last
   session AND mentions "may" in its body, surface it. This is
   ~15 LOC, file-mtime based, doesn't need DB. Closes the
   may-doesn't-read-KEs gap by default rather than per-incident.

4. **Update the dev-token proposal urgency.** It's now 14h+ with
   recurrence evidence; bump to "blocking, page Hao" or accept
   that the system is designed to silently lose dev for arbitrary
   periods. (Done in this commit.)

## Related

- KE-440 — predecessor; this entry is its falsifier
- KE-424 — KE auto-injection on repeated metric alerts (wired only
  for the metric-alert path, not the new-KE path)
- KE-430 — KE-422 recurred while injection still dormant (same
  meta-pattern)
- KE-417 — INBOX channel structurally unread (related — inbox
  items dismissed as "informational" 11:19Z is an instance)
- Proposal: `agents/arc/workspace/proposals/2026-05-01-refresh-dev-agent-ide-token.md`
