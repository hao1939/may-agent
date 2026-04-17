# Design: Idle Heartbeat Playbook (Milestone 1)

**Author:** bob
**Date:** 2026-04-17
**Status:** Draft — awaiting review (tech-lead + may)
**Project:** [adaptive-heartbeats](../../../may/workspace/projects/adaptive-heartbeats.md)
**Supersedes Phase 1 of:** [adaptive-heartbeats.md](./adaptive-heartbeats.md) (fast-exit gate — killed by Hao reframe 2026-04-17)

---

## Framing (Hao, 2026-04-17)

> "Heartbeats is by design for agent to explore and try. It's OK to waste tokens as long as it provides chance for agent to be autonomous."

Idle heartbeats are an **exploration budget**, not overhead. The failure mode we are fixing is *"agent wakes, does ≤2 ops, exits"* — that wastes the budget. We are **not** adding a fast-exit gate; we are replacing the exit with a prioritized menu of autonomous work.

## Problem (restated)

From the sessions DB (see superseded doc for raw counts), ~65% of heartbeats do ≤2 ops. Under the old framing this looked like "overhead to cut." Under the corrected framing it is **~7,600 wasted autonomy opportunities** in the current dataset — cycles where the agent was alive, had context loaded, and chose to exit instead of explore.

## Design: The Playbook

A single section injected into every agent's `heartbeat.md`, consulted *only* when Step 2 (DECIDE) produces no priority hit from red metrics, pending tasks, or active projects. The playbook replaces "nothing to do → finish(success)" with "nothing assigned → pick one exploration item and do it."

### Rule: Don't just exit

```
## Idle Rule
If Steps 1-2 produced no assigned or prioritized work, you are NOT done.
You have an exploration budget this cycle. Pick exactly ONE item from the
Idle Playbook below, do it (inline if ≤5 ops, otherwise fork), and produce
a measurable artifact: a file written, a request created, a KE drafted, a
hypothesis updated, or a metric probed with a written finding.

Calling finish(status='success', summary='nothing to do') without an
artifact is a failure. If you genuinely cannot find an idle item after
consulting the playbook, write a one-line note to workspace/idle-log.md
explaining why — that itself is the artifact.
```

### The Playbook (ordered, pick highest you can act on)

1. **System-gap item** — highest-impact unresolved entry in your own `workspace/system-gaps.md` (or equivalent). Pick one, advance it by one concrete step (draft, probe, design note).
2. **Off / stale / regressing metric** — any metric in your injected context that looks wrong, stale, or trending bad. Probe it: query the DB, write a one-paragraph finding to `workspace/metric-probes/<date>-<metric>.md`.
3. **Dropped thread in active projects** — scan `workspace/projects/` (or the agent-equivalent) for Status: active with a stalled owner, blocked sub-task, or no progress log entry in >3 days. Nudge it: write a progress note, ping the owner, or fork a small unblocking task.
4. **Outstanding hypothesis** — pick one from `agents/shared/knowledge/hypotheses/` (or `workspace/hypotheses/`) tagged untested or weakly supported. Either design a test, or scan recent KEs/experiments for evidence and update the score.
5. **Workspace hygiene** — archive stale artifacts, tighten a skill file, fix a broken cross-ref, delete a finished TODO. Must produce a diff, not just a scan.
6. **Read + draft** — one new item from the library (paper, deep-dive, peer's recent report you haven't seen). Draft a 3-5 line follow-up: "what this connects to, what it changes, what I'd do about it." File it under `workspace/notes/` or as a KE stub.

**Stop at the first item you can act on.** Don't shop the whole list.

### What counts as a measurable artifact

- A new or modified file under `agents/<you>/workspace/` or `agents/shared/knowledge/`
- A tracked request created (via `agents.message` or `agents.call`)
- A commit in the agents/ repo
- A checkpoint written with concrete data (not just a summary string)

Exiting with only a `finish()` call and no file/request/commit does **not** count.

## Rollout

Deployed as a shared snippet so we don't 12-way-fork the wording.

1. Create `agents/shared/protocols/idle-playbook.md` containing the rule + the 6-item list verbatim.
2. Each agent's `heartbeat.md` gets a small addition at the end of Step 2 (DECIDE):

   ```markdown
   **No priority hit?** Do not exit. Consult `agents/shared/protocols/idle-playbook.md`
   and pick one item. Produce a measurable artifact this cycle.
   ```

   This is a **content addition** within the existing Step 2, not a restructure — respects KE-008 (do not reorder/rename heartbeat steps).

3. Per-agent tailoring is allowed *below* the shared line (e.g., scout links to its own system-gaps.md, coder skips "read a paper").

### Agents to update (12)

`amy`, `amy-kimi`, `bob`, `coach`, `coder`, `evaluator`, `master`, `may`, `optimizer`, `qa`, `scout`, `tech-lead`.

Each gets the same 2-line addition. Total diff: ~24 lines across 12 files + 1 new protocols file.

## Success Metric

**Primary:** % of idle heartbeats (≤2 ops in Step 1-2 output) that produce a measurable artifact.
- Baseline (pre-deploy, 2 weeks): sample 100 idle heartbeats from sessions DB, count artifacts. Expect ≈0%.
- Target (2 weeks post-deploy): ≥60% produce an artifact.

**Secondary:**
- Count of artifacts/day by type (file, request, commit, KE).
- No regression in heartbeat failure rate (FM-3.3 guard triggers, finish(failure)).
- No regression in P0/P1 response latency — the playbook runs *after* priority checks, so pending tasks should still be picked up first.

**Guardrail (anti-gaming):**
- "idle-log.md one-liner" artifacts must stay <10% of total. If agents spam the escape hatch, the playbook needs tightening.

## Non-Goals (explicit, per Hao)

- ❌ No fast-exit gate. No `Step 0: GATE` that reads a signal file and bails.
- ❌ Do not measure success by "reduced ops per heartbeat." Tokens spent exploring are cheap.
- ❌ Do not combine this with adaptive frequency (Milestone 3) yet — one intervention at a time (KE-123: stacking interventions degrades -12-15pp).

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Agents pick low-value busywork just to satisfy the "artifact" rule | Playbook is ordered by impact; success metric tracks artifact *type*, not just count. Review mix weekly for 2 weeks. |
| Idle-log.md escape hatch gets abused | Guardrail: <10% of artifacts. If breached, remove the escape hatch and require a playbook item. |
| Playbook increases cost without increasing signal | Accepted by Hao framing. Re-evaluate only if artifact quality is demonstrably poor. |
| Playbook interferes with P0/P1 pickup | Placed after priority checks in Step 2; cannot fire if any pending task exists. |
| Scout polls arXiv during dead windows under the "read something new" item | Milestone 2 fixes this separately (arXiv windowing). Until then, scout's tailored playbook explicitly skips item 6 outside 19:00-23:00 UTC. |

## Open Questions for Review

1. Should "idle-log.md one-liner" count as an artifact at all, or force real work? (Current: yes, with <10% guardrail.)
2. Per-agent tailoring — opt-in (each owner edits) or centrally drafted (bob proposes, each agent reviews)? (Current: centrally drafted 2-line addition, agent-specific customization below.)
3. Metric collection — do we have a clean query to count "idle heartbeats that produced an artifact"? May needs to confirm or build.
4. Should the playbook be enforced by a heartbeat-finish guard (reject finish(success) with 0 artifacts and no idle-log entry), or by norm only? Leaning norm-only for Milestone 1; revisit if adoption is low after 1 week.

## Decision Needed

1. Approve the playbook text (rule + 6 items) as shared protocol.
2. Approve the 2-line heartbeat.md addition and 12-file rollout.
3. Confirm success metric + baseline sampling plan.
4. Answer the four open questions.

Once approved, rollout is ~15 min of edits + 1 commit in agents/.
