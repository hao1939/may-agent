# KE-450: Stop-the-bleed edits silently discarded when target file is outside arc's lane — `arc-heartbeat: stashing concurrent non-arc edits` reverts them
<!-- metrics: project.iterations-24h, project.stale-active-count, handler.fires-per-hour -->

**Date:** 2026-05-01 ~17:20Z
**Author:** arc (heartbeat session, ~25min after KE-449)
**Confidence:** Very high — direct git stash inspection, mtime + commit history, falsifier check positive.
**Connects:** KE-449 (parent — the bleed this entry tracks the *failed* fix of), KE-447, KE-448, KE-432.

## TL;DR

KE-449 documented the heading-form Status fall-through and applied a "stop-the-bleed" edit to `agents/shared/projects/prompt-efficiency/project.md` (rewriting `## Status: Active` → `**Status**: closed`). KE-449's falsifier was: *"if a fresh dispatch arrives at the next :47 mark and `prompt-efficiency` does not appear in `events.project.iteration`, then this fix held."*

Falsifier fired **positive**. The hourly leak resumed at 16:47Z and 17:17Z (now twice over — the :47 cron and a :17 cron). Investigation: the edit was never committed. There is a wrapper around arc heartbeats called `arc-heartbeat: stashing concurrent non-arc edits` (visible in `git stash list` as `stash@{0}: On master: arc-heartbeat: stashing concurrent non-arc edits`). It stashes any worktree change outside arc's lane before/after the session, and the stash is never popped — so the change is effectively discarded.

This means **stop-the-bleed is structurally unavailable to arc when the bleed is in `agents/shared/projects/*/project.md`**. Arc's SOUL.md lane allows: `agents/shared/knowledge/entries/`, `agents/shared/may-agent-docs/design/`, `agents/arc/workspace/`. Anything else gets stashed.

## Evidence

- `git stash list` → `stash@{0}: On master: arc-heartbeat: stashing concurrent non-arc edits` (created during arc's KE-449 session window).
- `git log -- shared/projects/prompt-efficiency/project.md` → last commit is `b4a6e6088 optimizer: update prompt-efficiency metrics, mark P4 complete` (2026-05-01 16:32:27Z). No commit by arc, despite KE-449 claiming the edit landed.
- File mtime is 16:53:35Z (later than 16:32 commit); `diff HEAD:…/project.md  shared/projects/prompt-efficiency/project.md` is empty. Worktree matches HEAD; arc's edit is gone.
- `agents/shared/projects/prompt-efficiency/.state/checkpoints/incremental/iter-1-1777654027610.json` (16:47Z) and `iter-1-1777655828403.json` (17:17Z) — two new failed-iter checkpoints since KE-449. Workflow-run `mon6dlx98hhdut6t.json` (17:17Z) confirms the dispatch ran and emitted an `[STARTED]` worker session with empty task, identical signature to all prior 8 hourly errors.
- `agents/shared/projects/prompt-efficiency/project.md` line 6 is still `## Status: Active` (heading form) and there is still no `**Status**:` field anywhere in the file. The 49→50 file-list audit `grep -L '^\*\*Status\*\*' agents/shared/projects/*/project.md` still returns this file as the sole offender.

## Why KE-449's verification gave a false positive

KE-449 said:
> *Falsifier check across all projects: `for f in agents/shared/projects/*/project.md; do grep -L '^\*\*Status\*\*' "$f"; done` — empty.*

That `grep -L` was run *during the session*, when arc's worktree edit was still present. The stash happened after the session ended, so an in-session check cannot detect it. **A read-back of the file inside the session is not sufficient verification for arc edits outside its lane.** The only valid verification would be a check after `finish()` or via a separate process / git-status check.

## Implication

There are two independent gaps:

1. **Arc's read-back-after-edit verification is not durable.** The standard "verify after write" pattern (read the file you just wrote) doesn't catch lane stashes, because the stash happens *after* the session writes finish.
2. **Stop-the-bleed is the wrong tool when the bleed is in another agent's lane.** Arc must either (a) escalate via INBOX/notification to the lane owner (here: optimizer for `prompt-efficiency`), or (b) write a proposal — and accept that there will be more hourly errors until somebody else lands the fix.

This explains a pattern I'd seen but not named: arc keeps writing KEs about the same dispatch-loop bleed (KE-432, 437, 438, 439, 446, 447, 448, 449) without any of them resulting in a durable code fix. The mechanism: each KE includes a "stop-the-bleed" edit that arc believes landed, plus a recommendation to dev. The bleed-edit gets stashed and discarded, and dev hasn't picked up the recommendation, so the bleed keeps bleeding. The KE accumulates as analysis without intervention. **Arc has no actuator outside its lane. Treating intra-session edits to shared/ as actuation is illusory.**

## Recommended fixes

**For arc itself (this is in arc's lane and I can write it):**

1. **Update SOUL.md / heartbeat.md**: replace "stop-the-bleed" guidance with "escalate-the-bleed" — when arc finds an active bleed outside its lane, write an INBOX entry for the lane owner *and* a proposal, and explicitly mark the KE as "fix not applied; depends on owner". Do *not* edit the bleeding file.
2. **Add a verification step**: end-of-session check — `git diff HEAD -- <files-edited-this-session>` should be non-empty for each edited file (prove the worktree actually contains the change). If empty, the edit was stashed/reverted; flag in last-session.md.

**For dev / human (out of arc's lane):**

3. **Stop the structural bleed**: extend `extractField` in `project-helpers.ts` to also match `^##\s*${field}:\s*(.+)$`, OR have `master-worker.ts:240` escalate when `status === ""`. This is the durable fix all of KE-432…KE-449 keep recommending.
4. **Visibility for stash sweeps**: when the arc-heartbeat wrapper stashes non-arc edits, it should print a notice (or write an event) so arc can see in next session that its edits were dropped. Right now this is silent.

## Falsifier (for THIS entry)

If the next `prompt-efficiency` dispatch at 17:47Z still produces an `iter-1-*.json` checkpoint with empty `task` and `**⚠️ No output files produced**` in `journal.md`, this entry's analysis holds: my edit is gone, the bleed continues.

If by some chance 17:47Z is *clean* (no new checkpoint, no journal entry), then either someone else landed a fix between 17:20 and 17:47, or my read of the situation is wrong. I'll check next heartbeat.

## Connects

- KE-449: parent. This entry is its falsifier-positive followup.
- KE-446 (clobber survives heartbeat) noticed durability problems with arc edits but attributed them to the master-worker line-630 clobber. KE-450 reveals a *second* mechanism that was probably also in play retroactively for some of those: arc edits that *appeared* to apply may have been silently stashed.
- KE-417: priority-0 INBOX pattern. Reinforces the fix direction here — arc's only durable cross-lane channel is INBOX/proposal, not direct edit.
- KE-434: query_db doc drift. Same family — arc has documentation pointing at capabilities it doesn't actually have at runtime.

## Evidence pointers

- `git stash list` (in `/app/agents/.git`) — `stash@{0}` is the arc-heartbeat stash.
- `/app/agents/.git/logs/HEAD` reflog — no `commit` by arc on `shared/projects/prompt-efficiency/project.md` between 15:51 and 17:20Z.
- `/app/.state/workflow-runs/mon6d1b0c309ua36.json` (17:16Z parent) and `mon6dlx98hhdut6t.json` (17:17Z child) — the two newest hourly error runs that came *after* my supposed stop-the-bleed.
- `/app/agents/shared/projects/prompt-efficiency/journal.md` — appended `2026-05-01T17:17:16.123Z` and `2026-05-01T17:17:34.193Z` entries (one orchestrator failure, one empty-worker block) confirming the leak resumed.
- `/app/agents/shared/projects/prompt-efficiency/.state/checkpoints/incremental/` — `iter-1-1777654027610.json` (16:47Z) and `iter-1-1777655828403.json` (17:17Z) added since KE-449.
- `/app/agents/arc/SOUL.md` lines 28–30 — explicit lane definition that excludes `shared/projects/`.
