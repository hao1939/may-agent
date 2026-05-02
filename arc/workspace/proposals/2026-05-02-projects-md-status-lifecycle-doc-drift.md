# Proposal: Reconcile `shared/may-agent-docs/projects.md` with actual project-status code paths

**Date:** 2026-05-02
**Author:** arc (heartbeat session)
**Status:** open
**Lane:** out-of-arc — file lives in `agents/shared/may-agent-docs/`, not under `design/` or `arc/workspace/`. Filing as proposal per arc lane policy (KE-450/451).
**Targets:** `agents/shared/may-agent-docs/projects.md` (one-file edit; no code change)

## Problem

`shared/may-agent-docs/projects.md` is the doc most new agents read first when asked "how do projects work?". Its lifecycle section is materially wrong against the running system in three ways:

### 1. The terminal status `closed` is undocumented

`projects.md` lists exactly four statuses: `active | waiting | done | blocked`.

On disk, the actual distribution across `agents/shared/projects/*/project.md` (2026-05-02):

```
$ grep -hE '^\*\*Status\*\*:' agents/shared/projects/*/project.md | sort | uniq -c | sort -rn
     11 **Status**: closed
      3 **Status**: waiting
      2 **Status**: complete
      1 **Status**: completed
```

`closed` is the **majority** terminal state. It does not appear in `projects.md` at all. `complete`/`completed` are also in active use but undocumented.

`master-worker.ts:251` confirms code intent:
```ts
if (status === "paused" || status === "cancelled" || status === "done"
    || status === "complete" || status === "completed") {
  return ctx.done(`Project status: ${status}. Skipping.`);
}
// line 256
if (status === "closed") { /* check unread comments */ }
```

So the dispatcher's bypass-state vocabulary is `paused | cancelled | done | complete | completed | closed` — **all six** are operationally meaningful, none of which (other than `done`) are in `projects.md`.

`master-worker.ts:346` is the writer:
```ts
updateProjectStatus(projectFile, safeStatus === "done" ? "closed" : safeStatus, …);
```

The orchestrator says `done`; master-worker writes `closed`. Anyone going by `projects.md` would not know this.

### 2. The "auto-converts to waiting after 48h" claim is unimplemented

`projects.md:44` says:
> `done (all milestones complete — auto-converts to waiting after 48h)`

`projects.md:55`:
> `| done | waiting | Auto (after 48h) |`

No such 48h timer exists. Search for it:

```
$ grep -rEn "auto.*convert|convert.*to.*waiting|done.*to.*waiting|172800000" \
       agents/ src/ --include='*.ts'
agents/shared/workflows/project.ts:480:- **Agent cannot mark done**: Only human/May can mark a project done. If you say DONE, it's auto-converted to WAITING with "awaiting review".
agents/shared/workflows/project.ts:650: * Handle a WAITING decision (including auto-converted DONE).
```

The only auto-conversion is in the `project` workflow (not `master-worker`) and it fires **immediately on the orchestrator's DONE decision**, not after 48h. There is no cron, scheduled job, or timer that flips `done → waiting` 48 hours later.

The 48h figure appears in `system-efficiency/workflows/health-check.ts:60` and `metrics-snapshot.ts:178` as a *staleness* threshold for active projects, never as a `done → waiting` transition.

So the doc is making a load-bearing reliability claim ("agents can safely mark done because it'll auto-revert if needed") that no code backs up. If an agent reads this and uses it as their mental model, they will misjudge what `done` means.

### 3. The actual workflows are split and the doc collapses them

There are two project workflows in flight:

- `agents/shared/workflows/project.ts` — has the `DONE → WAITING` immediate auto-convert (project.ts:598)
- `agents/shared/workflows/master-worker.ts` — does not auto-convert; maps `done → closed` and writes the `closed` literal

The DB shows 17 projects, all using `workflow: 'master-worker'`. So the dominant path in production is master-worker, and master-worker writes `closed` as the terminal state. `projects.md` reflects neither workflow accurately — it sounds like a description of a third, idealised one.

This matters for arc's own work too: KE-470 traced the prompt-efficiency hourly loop to `updateProjectStatus`'s heading-form regex no-op, but the underlying confusion (orchestrator says DONE, file ends up `## Status: Complete`, dispatcher-bypass set says `complete` is fine) is partly *enabled* by the doc not establishing a single canonical vocabulary.

## Proposal

Edit `agents/shared/may-agent-docs/projects.md` only. No code change. Two sections need correction:

### A. Replace the Lifecycle section

Current (lines 39–47):
```
## Lifecycle

active → active (iterating)
       → waiting (blocked on external input)
       → done (all milestones complete — auto-converts to waiting after 48h)

**Key rule:** Agents push or stop. They never mark a project "done" permanently. `done` auto-converts to `waiting` so the project can be picked up again if needed.
```

Proposed:
```
## Lifecycle

active → active (iterating, dispatcher fires hourly)
       → waiting (blocked on external input/review)
       → blocked (needs human decision)
       → closed (terminal — orchestrator returned DONE in master-worker)

The two workflows differ:

- **master-worker** (current default, all 17 projects): orchestrator's DONE
  decision is mapped to `**Status**: closed` by the workflow at write-time
  (master-worker.ts:346). Subsequent dispatcher ticks early-exit on
  `closed/done/complete/completed/paused/cancelled` (master-worker.ts:251,256).
  No automatic re-opening.
- **project.ts** (legacy, no longer used by any active project): orchestrator's
  DONE decision is **immediately** auto-converted to WAITING with
  resumeCondition "awaiting human review" (project.ts:598). There is no
  48-hour timer; the conversion is synchronous within the workflow run.

**Key rule:** master-worker treats `closed` as terminal. It is set by the
workflow, not by the agent. If you are an orchestrator, output DONE — the
workflow handles the file edit (subject to KE-464's heading-form bug).
```

### B. Replace the Status Transitions table

Current (lines 49–57):
```
| From | To | Who |
|------|----|-----|
| active | waiting | Agent (blocked/needs input) |
| active | done | Agent (milestones complete) |
| done | waiting | Auto (after 48h) |     ← FALSE, no such code
| waiting | active | Agent (unblocked/picks up) |
| any | blocked | Human (via `[done]` comment) |
```

Proposed:
```
| From | To | Who | Mechanism |
|------|----|-----|-----------|
| active | waiting | Agent (orchestrator says WAITING) | master-worker.ts:683 |
| active | closed | Workflow (orchestrator says DONE) | master-worker.ts:346 maps done→closed |
| active | blocked | Agent (orchestrator says BLOCKED) | master-worker.ts:679 |
| waiting | active | Agent (unblocks externally + edits file) | manual |
| closed | active | Human (manual edit) | no automatic re-opening |
```

### C. Remove or clearly mark the 48h auto-revert claim

Either drop it entirely, or — if there's intent to add such code — leave a stub note: "(planned: see proposal …)". Do not leave the assertion in the lifecycle as if it were true.

## Why this matters (small but compounding)

- **Onboarding correctness.** Every new agent reading `projects.md` builds an incorrect mental model. The `closed` status is opaque to them; they will see it on disk and not know whether it's a valid state or a bug. (Compare KE-426 — same class of error, different doc, fixed already.)
- **Status-edit decisions.** ORDER-014 tells orchestrators to edit `**Status**: active → closed` directly. An agent reading projects.md does not know `closed` is even a status, much less the correct one. ORDER-014 and projects.md are mutually intelligible only if you've read both very carefully.
- **Aliasing the heading-form bug.** Some projects use `## Status: Complete` (heading form), some use `**Status**: closed` (bold form). The bypass set accepts `complete | completed | closed`, all aliases for "done forever" — but the doc names none of them, so authors invent their own (`Complete`, `complete`, `completed`). This is exactly the input that triggers KE-464/KE-470.

## Risk / scope

- **Risk:** None. Doc-only edit. No agent code reads this file.
- **Scope:** ~30 lines in one file. No precedent-setting; KE-426 already established the pattern of fixing `projects.md` doc drift via shared-docs edits.
- **Owner:** May or tech-lead (whoever curates `shared/may-agent-docs/`). Arc cannot land this directly per lane policy (KE-450/451).

## Falsifier

If this proposal lands and the next 24h shows a new project file written with a status not in the proposed vocabulary (`active|waiting|blocked|closed`) **and** that status is not derivable from a documented workflow path, the doc is still incomplete and a follow-up edit is needed. If all new projects in the next 24h conform to the proposed vocabulary, the doc reflects reality.

## Connects

- KE-426 — same class of doc drift on `projects.md`, location field. Fixed.
- KE-429 — master-worker's missing DONE verb (downstream of the same vocabulary gap).
- KE-464, KE-470 — heading-form `## Status: Complete` writes bypass `updateProjectStatus`'s regex; partly enabled by absence of a canonical status vocabulary in the doc.
- ORDER-014 — tells orchestrators to write `**Status**: closed`. The doc this proposal targets does not currently mention `closed`.
