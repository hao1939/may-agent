# Proposal: Arc must escalate, not edit, when bleed is outside its lane

## Problem

Arc's heartbeat instructs it to apply "stop-the-bleed" fixes when it discovers active dispatch-loop bleeds (KE-432, 437, 438, 439, 446, 447, 448, 449). In practice, the bleeds are usually in `agents/shared/projects/*/project.md` files, which is **outside arc's lane** as defined in arc/SOUL.md.

A wrapper around arc heartbeat sessions called `arc-heartbeat: stashing concurrent non-arc edits` automatically stashes any worktree change outside arc's lane and never pops the stash. **All stop-the-bleed edits to project.md files are silently discarded.** See KE-450 for the falsifier-positive case (KE-449's `prompt-efficiency` fix vanished; the leak resumed).

Arc never sees this — the in-session read-back-after-edit verification succeeds (the change is in the worktree at that moment), and the stash happens after `finish()`. Arc closes the session believing it patched the bleed; the bleed continues; arc writes a new KE next heartbeat documenting the same bleed; repeat.

## Evidence

- `git stash list` shows `stash@{0}: On master: arc-heartbeat: stashing concurrent non-arc edits` from arc's KE-449 session.
- `git log -- agents/shared/projects/prompt-efficiency/project.md` shows the last commit is by `optimizer` at 16:32Z; arc's 16:53Z edit was never committed.
- `agents/shared/projects/prompt-efficiency/.state/checkpoints/incremental/` — new failed-iter checkpoints at 16:47Z and 17:17Z, exactly as KE-449's falsifier predicted.
- KE-446 retroactively suspect: arc concluded the master-worker line-630 clobber was eating its closes, but at least some of those "closes" were probably stash-discarded too.

## Proposed change

Edit `agents/arc/heartbeat.md` "System Coherence Audit" section:

**Replace:**
> If you find stale content:
> 1. Fix it directly (simple text corrections)
> 2. Write a knowledge entry explaining what changed and why
> 3. If the fix requires human decision, write a proposal in `agents/arc/workspace/proposals/`

**With:**
> If you find stale content:
> 1. **If the file is in arc's lane** (`agents/shared/knowledge/`, `agents/shared/may-agent-docs/design/`, `agents/arc/workspace/`): fix it directly.
> 2. **If the file is outside arc's lane** (e.g., `agents/shared/projects/*/project.md`, agent SOUL/context, workflow code): **do not edit**. Edits get auto-stashed by `arc-heartbeat: stashing concurrent non-arc edits` and silently discarded. Instead:
>    - Write a knowledge entry naming the bleed
>    - Write a proposal in `agents/arc/workspace/proposals/`
>    - If the lane has an INBOX (`agents/<owner>/INBOX.md`), append a notice. (Most agents don't yet — see follow-up below.)
>    - Mark the KE explicitly: "fix not applied; depends on <owner>".
> 3. **End-of-session verification**: before `finish(success)`, run `cd agents && git diff --quiet HEAD -- <files-edited>` for each non-arc file. If the diff is empty *for a file you edited*, the stash already happened; flag in last-session.md.

## Expected impact

- Arc stops accumulating KEs about the same un-fixed bleed.
- Stop-the-bleed edits become *real* (only apply to in-lane files where they survive).
- Cross-lane fixes flow through the proposal/INBOX channel where they have a chance of being adopted.
- Reduces the false-positive verification rate (KE-449's falsifier was wrong because of in-session-only verification — see KE-450).

## Risks

- Slows arc's response to active bleeds. Mitigation: this is appropriate; arc was getting fast feedback that wasn't actually fixing anything.
- More entries pile up in proposals/ unread. Mitigation: track adoption rate as a metric (arc already self-assesses on this; reinforce it).

## Follow-ups not in this proposal

1. Most agents don't have an `INBOX.md`. Adding one to optimizer (owner of `prompt-efficiency`), coach, may, dev, etc. would let arc deliver fix tickets durably.
2. The arc-heartbeat stash wrapper should print/event-log when it stashes, so arc sees in next session that edits were dropped (KE-450 §recommended-fix #4).
3. The structural extractField/master-worker fix (KE-432 family) is unchanged by this proposal — that's still dev's job.
