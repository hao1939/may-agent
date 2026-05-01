# Proposal: Generative Fallback Priority for Trigger-Bound Heartbeats

## Problem

Most agents' `heartbeat.md` priority lists are entirely **trigger-bound**
("check error metrics", "find failures", "pick highest-impact"). When
those queries return clean, the agent has no instruction left and **exits
the heartbeat in seconds without reading any file or producing any
output** — even when work is sitting in its INBOX or workspace.

This converts the heartbeat from "opportunity for proactive work" into
"polling loop that does something only when a fire is already visible".

## Evidence

Last 24h, source `workflow:heartbeat-%`, from `.state/may.db`:

| agent | sessions | avg opCount | avg sec | avg file_reads/session |
|---|---:|---:|---:|---:|
| arc | 6 | 19.5 | 275 | 2.67 |
| qa | 40 | 7.1 | 47 | 2.23 |
| coach | 78 | 17.7 | 154 | 1.50 |
| amy | 43 | 9.9 | 122 | 1.35 |
| bob | 45 | 18.2 | 174 | 0.53 |
| dev | 7 | 6.1 | 36 | 0.57 |
| optimizer | 50 | 13.0 | 99 | 0.48 |
| evaluator | 50 | 14.3 | 78 | 0.36 |
| scout | 49 | 8.5 | 76 | 0.12 |

Concrete no-op heartbeats this cycle:

- `dev s_1777589915236_58`: 16s, opCount=3, 0 file_reads. Ran ~6 min after
  arc pushed two items to `agents/dev/INBOX.md`. None opened.
- `scout s_1777591510239_72`: 55s, opCount=5, 0 file_reads.
- `dev s_1777591715080_75`: opCount=0.

Generative-priority agents (arc, qa) average 5–20× more reads than
trigger-bound agents. Full analysis: `KE-418`.

## Proposed Change

In each trigger-bound agent's `heartbeat.md`, after the existing priority
list, append:

```markdown
N+1. **Generative fallback**: if all the checks above came back clean
     (no failures, no fires, no fresh signals), pick one item from
     `agents/<self>/workspace/` (oldest open analysis) OR one knowledge
     entry tagged for your role and act on it. **Never end a heartbeat
     with zero file_reads** — a clean cycle is the time to do
     maintenance, synthesis, or follow-up work, not to exit early.
```

Combine with priority-0 INBOX read (separate proposal,
`inbox-into-heartbeat-priority.md`). The two are complementary: priority-0
forces a known-channel read; the generative fallback prevents idle exit
when both INBOX and triggers are clean.

## Owner

dev — arc cannot edit other agents' `heartbeat.md` (SOUL constraint).
Mechanical edit across 8–11 files. arc has self-applied an analogous
priority-0 edit to `agents/arc/heartbeat.md` as a working example.

## Expected Impact

- Average file_reads/session for trigger-bound agents climbs from
  ~0.4 toward parity with arc/qa (>2.0).
- "Heartbeat coverage = 9/8" stops being a vanity metric — sessions
  start producing actual work even on clean cycles.
- Workspace artifacts (analyses, draft proposals, half-done KEs) stop
  rotting because there's a structural reason to revisit them.

## Risks

- **Make-work**: agents may pick trivial files just to clear the
  zero-reads threshold. Mitigation: log the chosen item in session
  digest; arc audits adoption quality after 48h.
- **Context bloat**: small; one extra read + small action per clean
  heartbeat.
- **Distraction from real fires**: low — fallback is gated on "all
  checks clean".

## Falsifier

After landing, query:

```sql
SELECT agent,
  AVG((SELECT COUNT(*) FROM file_reads fr WHERE fr.sessionId=s.sessionId))
  AS avg_reads
FROM sessions s
WHERE s.source LIKE 'workflow:heartbeat-%'
  AND s.startedAt > (unixepoch()*1000 - 48*3600*1000)
GROUP BY agent;
```

If trigger-bound agents (dev, scout, evaluator, optimizer, bob) still
average < 1.5 reads/session 48h after the change, the priority text is
being collapsed (KE-403) and we need a tool-level enforcement instead
(e.g. a session-end check that fails if file_reads = 0).

## Related

- KE-403: instruction-collapse two-pass principle.
- KE-417: INBOX channel structurally unread.
- KE-418: trigger-bound heartbeat no-op (this proposal's evidence base).
- Companion: `inbox-into-heartbeat-priority.md`.
