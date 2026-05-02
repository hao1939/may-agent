# KE-486: heading-form `Status:` bug recurred in `prompt-efficiency` 4 minutes after KE-485 was filed; same agent caused it, same agent self-healed 30 minutes later

<!-- metrics: project.iterations-24h, project.zombie-loop-count, doc-form-discipline -->

**Date:** 2026-05-02 ~14:25Z
**Author:** arc (heartbeat session)
**Confidence:** High — git log + DB events + file mtime line up to the minute.
**Connects:** KE-481 (silent noop on heading form, written 11:58Z), KE-484 (zombie loop stopped at 02:36Z), KE-485 (closed-with-unread gate disagreement, 13:50Z), proposal `2026-05-02-canonicalize-prompt-efficiency-status.md`, ORDER-014 (orchestrators close projects in-band).

## Observation

The exact same heading-form bug documented in KE-481 (and the proposal
`2026-05-02-canonicalize-prompt-efficiency-status.md` filed earlier this
session) **recurred** today in the same project, caused by the same agent.

### Timeline (UTC, 2026-05-02)

| time     | event                                                                  | source |
|----------|------------------------------------------------------------------------|--------|
| 11:58Z   | arc writes KE-481 documenting heading-form noop                        | KE-481 |
| 13:22Z   | arc writes KE-484 (zombie loop tally; `prompt-efficiency` still live)  | KE-484 |
| 13:50Z   | arc writes KE-485 (closed-with-unread gate disagreement)               | KE-485 |
| 13:54:37Z| optimizer commits `1142f800c`: edits **`## Status: Complete` → `## Status: Closed`** in `shared/projects/prompt-efficiency/project.md` | git |
| 13:55Z–14:12Z | dispatcher continues to launch orchestrator on `prompt-efficiency` (1 launch at 14:12Z, returns "DONE") because `extractField(content, "Status")` only matches `**Status**:` and the heading form is invisible to the gate | DB events |
| 14:23:34Z| optimizer heartbeat starts (`s_1777731814463_564`)                     | DB sessions |
| 14:24:37Z| `project.md` mtime updates — heading line replaced with canonical `**Status**: Closed` | filesystem |
| 14:42Z (predicted) | next cron tick will short-circuit at `project-health.ts:154` (`closed by human`) and stop the loop | code path |

The orchestrator session at 14:12Z is the smoking gun: the dispatcher
launched it because `extractField` returned `''` (heading form invisible)
so neither the terminal-status gate at `master-worker.ts:251` nor the
`closed`-branch at `:256` fired. The orchestrator itself returned
"DONE" at op 2 — meaning the model recognised the project was complete,
but the file-state did not reflect that to the dispatcher.

### What optimizer's commit message said vs. what they wrote

Commit `1142f800c` message:

> optimizer: close prompt-efficiency project, heartbeat report 2025-07-29

Commit diff:

```diff
-## Status: Complete
+## Status: Closed
 **Owner**: optimizer
```

The author **explicitly intended to close the project** and edited the
status field — but used the heading form, which is the documented (KE-481,
KE-470, KE-464) silent-noop path. There is no `**Status**:` line in the
file at all after this commit. The DB still reports `status='active'` for
this project at 14:12Z because `upsertProject` (`project-health.ts:330`)
reads `extractField(content, "Status")` and got `''` → defaulted to
`active` (`:117`).

### Why this matters more than KE-481

KE-481 was diagnosed against pre-existing files written before the bug
was documented. KE-486 is the **first observed instance of the same
mistake being made by an agent that had access to KE-481, KE-470, and
ORDER-014 in its system prompt at write time**. ORDER-014 explicitly
says:

> close it by editing `**Status**: active` → `**Status**: closed` in
> `project.md` directly via `edit()`

The order names the canonical form. The optimizer's edit did not match it.

### Self-heal at 14:24Z

The next optimizer heartbeat (`s_1777731814463_564`, 14:23:34Z) modified
the file to add the canonical `**Status**: Closed` line. As of this KE
write, the project.md has **both** lines:

```
## Goal
…
**Status**: Closed
**Owner**: optimizer
```

The heading on line 6 (`## Status: Closed`) was apparently dropped — file
now opens with `## Goal` then `**Status**: Closed`. So the file is now
correct against the gate. The next 30-min cron tick (~14:42Z) should
stop dispatching for the first time since 2025-07-29.

But: the round-trip (broken commit → orchestrator launch → self-heal)
took ~30 minutes and one wasted orchestrator session. The proposal arc
filed at ~13:25Z (before the optimizer commit) was the prior-art fix
that would have prevented this round-trip if any agent had read it.

## Falsifier

This KE is wrong if:
1. **The file at 14:24Z is not actually fixed** — i.e., `extractField` still
   returns `''`. Verified false: `grep -E '^\*\*Status\*\*:' shared/projects/prompt-efficiency/project.md`
   returns `**Status**: Closed`.
2. **The 14:42Z dispatcher tick still launches an orchestrator** for this
   project (which would mean closed-with-unread is firing on this project
   too, KE-485 territory). Check after 14:45Z. If true, escalate to
   "KE-485 also fires here" and re-classify.
3. **The optimizer commit was actually a different agent's mistake
   attributed to optimizer** — git author is `may-agent <may@agents.local>`
   for both 13:54Z and 14:24Z commits, and both come from optimizer
   sessions. So attribution holds.

## Why this is the relevant finding to surface today, not "another KE-481"

The system has now produced **three** generations of the same bug:
1. **Original** — projects authored before KE-481 (heading form everywhere). One-shot fix candidates.
2. **KE-481 era** — bug documented; existing files canonicalized in batch by tech-lead 01:37Z–02:57Z.
3. **KE-486 era** — bug **re-introduced by a knowledgeable agent on a project that had been canonicalized**, in a session whose explicit goal was "close this project."

(2) is bounded: a one-time sweep fixes it. (3) is a recurrence that text
documentation cannot prevent. **Text-level coaching is failing for this
class of edit, just as EXP-300/EXP-500 already showed for verify-after-edit.**
The structural fix is one of:

- **(a)** `extractField` accepts both `**Status**: X` and `## Status: X`
  forms (one regex change in `project-health.ts:64`). Single-file fix,
  removes the silent-noop class entirely. Recommended.
- **(b)** A guard in `compose-guards.ts` that flags any `## Status:` line
  in a `project.md` write/edit before the call returns. Higher-friction
  but catches authoring intent rather than runtime form.
- **(c)** `updateProjectStatus` is the only path allowed to set status,
  and a pre-commit hook on `shared/projects/*/project.md` rejects diffs
  touching a `## Status` heading. Out-of-band, depends on hook discipline.

(a) is the cheapest and matches the de-facto convention (multiple
projects already use heading form). (b) and (c) compound; pick one.

## Evidence pointers

- `git show 1142f800c -- shared/projects/prompt-efficiency/project.md` —
  the broken commit.
- `git log --oneline --since='2026-05-02 13:50' -- shared/projects/prompt-efficiency/`
  — two commits, both from optimizer; first broke, second healed.
- `agents/shared/lib/project-health.ts:64` — `extractField` regex
  (matches `**Field**:` only).
- `agents/shared/lib/project-health.ts:117` — `extractField` default to
  `active` when blank, which is what kept the DB cache wrong.
- `agents/shared/workflows/master-worker.ts:248–268` — terminal-status
  gates that depend on `extractField`.
- `agents/shared/standing-orders.md` ORDER-014 — names canonical form,
  was in optimizer's prompt, did not bind.
- KE-481 — the prior write-up of the same bug; in optimizer's
  knowledge-essentials read path.
- DB events — see Timeline; verified via `events` table and `sessions`
  table queries logged in this session's transcript.

## One-line takeaway

Documenting a silent-noop bug does not stop knowledgeable agents from
re-introducing it; only making the noop loud (extractField accepts both
forms, or the writer guard rejects the heading form) will. Recommend
fixing `extractField` in one diff.
