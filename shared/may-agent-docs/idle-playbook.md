# Idle Heartbeat Playbook

**Status:** Active — deployed 2026-04-17 (Milestone 1)
**Design:** [idle-heartbeat-playbook.md](../may-agent-docs/design/idle-heartbeat-playbook.md)
**Framing (Hao, 2026-04-17):** Heartbeats are an exploration budget, not overhead. Wasting a cycle by exiting early wastes autonomy, not tokens.

Consult this protocol from Step 2 (DECIDE) of your heartbeat **only when no priority hit fires** (no red metric, no pending P0/P1, no active persistent task, no declining daily metric).

## Idle Rule — Don't just exit

If Steps 1–2 produced no assigned or prioritized work, you are **NOT** done.
You have an exploration budget this cycle. Pick exactly ONE item from the
Idle Playbook below, do it (inline if ≤5 ops, otherwise fork), and produce
a **measurable artifact**: a file written, a request created, a KE drafted,
a hypothesis updated, or a metric probed with a written finding.

Calling `finish(status='success', summary='nothing to do')` without an
artifact is a failure. If you genuinely cannot find an idle item after
consulting the playbook, write a one-line note to
`agents/<you>/workspace/idle-log.md` explaining why — that itself counts
as the artifact. (Escape-hatch guardrail: <10% of idle artifacts.)

## The Playbook (ordered — stop at the first item you can act on)

1. **System-gap item** — highest-impact unresolved entry in your own
   `workspace/system-gaps.md` (or equivalent). Pick one, advance it by
   one concrete step (draft, probe, design note).
2. **Off / stale / regressing metric** — any metric in your injected
   context that looks wrong, stale, or trending bad. Probe it: query
   the DB, write a one-paragraph finding to
   `workspace/metric-probes/<date>-<metric>.md`.
3. **Dropped thread in active projects** — scan `workspace/projects/`
   (or agent-equivalent) for Status: active with a stalled owner,
   blocked sub-task, or no progress log entry in >3 days. Nudge it:
   progress note, ping owner, or fork a small unblocking task.
4. **Outstanding hypothesis** — pick one from
   `agents/shared/knowledge/hypotheses/` (or `workspace/hypotheses/`)
   tagged untested or weakly supported. Either design a test, or scan
   recent KEs/experiments for evidence and update the score.
5. **Workspace hygiene** — archive stale artifacts, tighten a skill
   file, fix a broken cross-ref, delete a finished TODO. Must produce
   a diff, not just a scan.
6. **Read + draft** — one new item from the library (paper, deep-dive,
   peer's recent report you haven't seen). Draft a 3–5 line follow-up:
   "what this connects to, what it changes, what I'd do about it." File
   under `workspace/notes/` or as a KE stub.

**Do not shop the whole list.** Stop at the first item you can act on.

## What counts as a measurable artifact

- A new or modified file under `agents/<you>/workspace/` or
  `agents/shared/knowledge/`
- A tracked request created (via `agents.message` or `agents.call`)
- A commit in the `agents/` repo
- A checkpoint written with concrete data (not just a summary string)

Exiting with only a `finish()` call and no file/request/commit does
**not** count.

## Per-agent tailoring

Agents may add their own notes below the shared reference line in
`heartbeat.md` (e.g., scout may skip item 6 outside arXiv publication
windows; coder may skip "read a paper"). Tailoring is opt-in and does
not block rollout.

## Non-Goals

- ❌ No fast-exit gate. Do not add `Step 0: GATE` logic.
- ❌ Do not measure success by "reduced ops per heartbeat."
- ❌ Do not combine with adaptive frequency (Milestone 3) yet — one
  intervention at a time (KE-123: stacking interventions degrades
  −12–15pp).

## Success Metric (tracked by may)

- **Primary:** % of idle heartbeats (≤2 ops in Step 1–2 output) that
  produce a measurable artifact. Target ≥60% at 2 weeks post-deploy.
- **Guardrail:** idle-log.md one-liners <10% of artifacts.
- **No regression:** P0/P1 response latency, heartbeat failure rate.
