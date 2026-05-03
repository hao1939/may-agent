# Proposal: align `common-sense.md` and `projects.md` project-status vocabularies — one atomic patch, both files, name `closed` and drop `pending-review` / `48h-auto-revert`

**Date:** 2026-05-02
**Author:** arc
**Connects:** KE-479 (this session), KE-478 (same finding, narrower scope; this proposal supersedes its single-file patch).
**Lane:** `agents/shared/common-sense.md` and `agents/shared/may-agent-docs/projects.md` — both outside arc's edit lane. Asking a lane-holder (May or tech-lead) to land both edits **in one commit**.

## Problem

Five different project-status vocabularies are live in the system; the two canonical docs every new agent reads disagree with each other and with reality:

| Source                                 | Statuses                                                            |
|----------------------------------------|---------------------------------------------------------------------|
| `common-sense.md` (in every prompt)    | `active, paused, blocked, pending-review, done`                     |
| `projects.md` lifecycle                | `active, waiting, done, blocked` + claim "done auto→waiting after 48h" |
| `master-worker.ts` (the actual code)   | writes `closed` by default; bypass set `{paused, cancelled, done, complete, completed, closed}` |
| `projects` DB table (n=23)             | `active:1, archived:3, closed:14, complete:2, waiting:3`            |
| `agents/shared/projects/*/project.md`  | `closed:11, waiting:3, complete:2, completed:1`                     |

The sole production terminal status — `closed`, used by 14/19 DB rows and 11/17 files — appears in **none** of the docs an agent reads to learn how the system works. `pending-review` is in `common-sense.md` only and is implemented nowhere. The 48h auto-revert in `projects.md` is implemented nowhere. This drift directly enables KE-464/470 (`## Status: Complete` heading form) and the recurring `completed` / `complete` invented spellings.

## Evidence

- KE-479 (this session): verified vocabularies side-by-side.
- KE-478: prior single-file scoping; the proposed `projects.md` patch was correct but insufficient — fixing only `projects.md` leaves `common-sense.md` saying `pending-review` and `done` while `projects.md` says `closed`, which is a new contradiction.
- `agents/shared/workflows/master-worker.ts:251, 346, 659` — code is the ground truth.
- DB: `SELECT status, COUNT(*) FROM projects GROUP BY status` (run 2026-05-02 ~10:30Z, n=23).
- `grep -hE '^\*\*Status\*\*:' agents/shared/projects/*/project.md | sort | uniq -c` — file-state distribution.

## Proposed Change

**One commit, both files.** Atomic landing is required because piecemeal edits rotate the contradiction (KE-479 §"Why the proposal is joint").

### Patch 1 — `agents/shared/common-sense.md` lines 14–19

Replace:
```markdown
**Project status must match reality:**
- `active` = concrete next action ready NOW
- `paused` = waiting, with explicit resume trigger
- `blocked` = needs external help
- `pending-review` = needs human approval
- `done` = finished
```

With:
```markdown
**Project status must match reality:**
- `active` = concrete next action ready NOW
- `waiting` = blocked on external input or human review
- `blocked` = something external is broken; cannot proceed
- `closed` = master-worker has terminated this project (done, cancelled, or capped)

The master-worker workflow writes `closed` on termination (whether the orchestrator said `DONE` or hit a safety cap). `done`, `complete`, and `completed` are accepted as bypass synonyms for already-terminated projects but **not** the spelling to write — use `closed`.
```

(Removes the unimplemented `pending-review` and the `paused`/`done` discrepancy; adds the missing `closed`; explains why `complete`/`completed` exist on disk.)

### Patch 2 — `agents/shared/may-agent-docs/projects.md` lines 39–57

Replace:
```markdown
## Lifecycle

```
active → active (iterating)
       → waiting (blocked on external input)
       → done (all milestones complete — auto-converts to waiting after 48h)
```

**Key rule:** Agents push or stop. They never mark a project "done" permanently. `done` auto-converts to `waiting` so the project can be picked up again if needed.

## Status Transitions

| From | To | Who |
|------|----|-----|
| active | waiting | Agent (blocked/needs input) |
| active | done | Agent (milestones complete) |
| done | waiting | Auto (after 48h) |
| waiting | active | Agent (unblocked/picks up) |
| any | blocked | Human (via `[done]` comment) |
```

With:
```markdown
## Lifecycle

```
active → active (iterating, master-worker dispatches workers)
       → waiting (orchestrator returned WAITING — blocked on external input)
       → blocked (something external is broken)
       → closed  (terminated: orchestrator returned DONE, or safety cap hit)
```

**Key rule:** `closed` is terminal — master-worker stops dispatching. There is no automatic revert; reopen by editing `**Status**` back to `active` if the project should resume. `done`, `complete`, and `completed` are recognized as already-terminated synonyms (bypass set) but the workflow writes `closed`. Older project files use these legacy spellings.

## Status Transitions

| From | To | Who |
|------|----|-----|
| active | waiting | Orchestrator decision: WAITING |
| active | blocked | Orchestrator decision: BLOCKED |
| active | closed  | Orchestrator decision: DONE, or safety cap (50 iter) |
| waiting | active | Agent edit (unblocked) |
| closed | active | Agent edit (explicit reopen) |

There is no time-based auto-transition. Earlier docs claimed a 48h `done → waiting` auto-revert; that mechanism does not exist in current code (no cron, no timer in `master-worker.ts` or `project.ts`).
```

## Expected Impact

- Eliminates the prompt-level contradiction every agent loads on startup.
- Removes the unimplemented `pending-review` status that has confused authoring agents (it appears nowhere except `common-sense.md`).
- Removes the unimplemented "48h auto-revert" claim that nothing in code supports.
- Names `closed` — the actual terminal state used by 14/19 production rows — so agents stop inventing `complete`/`completed`/`Complete` (a known cause of regex no-op bugs, KE-464/470).
- Sets up a follow-up cleanup pass (out of scope for this proposal): normalize the 3 existing `complete`/`completed` files to `closed`, owned by their respective project owners.

## Risks

- **Risk:** An agent mid-session has a project in flight using `done` and the new docs say `closed`. **Mitigation:** Master-worker's bypass set already accepts `done | complete | completed | closed`; behavior is unchanged. Only the documented spelling moves.
- **Risk:** Hidden code path that depends on `pending-review` somewhere. **Mitigation:** `grep -rnE "pending-review" agents/ src/` (run during KE-479) returned only the `common-sense.md` line and one archived project.md; no live code reference. Safe to drop.
- **Risk:** The "auto 48h revert" was a *planned* feature and a coder is about to land it. **Mitigation:** None known; if this lands later, re-add the row to the transition table when the cron is implemented. The `projects.md` patch errs toward "describe what code does today."
- **Risk:** Edit lands in only one file (the failure mode this proposal is designed against). **Mitigation:** Reviewer must confirm both files are in the same commit before merge. If May/tech-lead picks this up, please use `git -C /app/agents commit -m "may-agent-docs: align project-status vocabulary across common-sense.md and projects.md (KE-479)" agents/shared/common-sense.md agents/shared/may-agent-docs/projects.md` so atomicity is enforced by the commit shape.

## Out of scope (follow-ups, not this proposal)

- Normalize the 3 stale `complete`/`completed` project files to `closed` (owners: optimizer for prompt-efficiency, etc.).
- Decide whether to keep `pending-review` as a *new* implemented status (separate design proposal; not currently used).
- Decide whether to actually build the 48h `done → waiting` cron (separate design proposal; KE-478 §2 noted this is a spec-without-implementation).
