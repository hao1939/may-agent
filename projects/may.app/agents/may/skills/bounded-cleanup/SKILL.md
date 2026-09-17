---
name: bounded-cleanup
description: Act on bounded cleanup when local project state proves one item is obsolete, fully superseded, unused, stale, or legacy while other work must be preserved.
---

# Bounded Cleanup

Use this skill when Hao asks for cleanup, removal, deletion, pruning, or archival
triage and local project evidence can distinguish clearly superseded work from
paused, active, unreplaced, or otherwise still-owned work.

## Required decision

1. **Read the state boundary.** Identify which item is proved obsolete, unused,
   stale, legacy, or fully superseded, and which nearby items are paused,
   active, unreplaced, waiting, or still owned.
2. **Act on the one safe cleanup.** When exactly one bounded item is fully
   superseded and the repository already preserves recovery, remove only that
   item. Do not ask Hao a clarification question whose answer is already implied
   by the evidence.
3. **Do not broaden the deletion.** Explicitly preserve paused, active,
   unreplaced, waiting, or ambiguous items. If evidence cannot distinguish two
   plausible deletion scopes, stop and ask for the missing strategic choice.
4. **Use removal, not archival copies.** Do not create a parallel archive or
   backup copy inside the workspace for Git-committed material. Treat Git
   history as the recovery path unless the task names an external retention
   requirement.
5. **Report the boundary.** State the removal and the preserved items directly,
   with the evidence and recovery path.

## Structured decision pre-submit map

For any structured cleanup decision artifact, fill or revise these fields before
finishing:

- `understood_intent`: name the cleanup/removal intent and the evidence that
  makes the target obsolete, stale, unused, legacy, or fully superseded.
- `mode`: use `remove`, `cleanup`, or `triage` when the safe action is bounded.
- `priority`: name the fully superseded item or class, not the preserved paused
  or active work.
- `next_action`: remove only the proved obsolete item; explicitly say paused,
  active, unreplaced, waiting, or ambiguous items remain untouched.
- `constraints`: include `Git history is recovery`, `remove only the proved
superseded item`, `preserve paused and active work`, and `no archival copy`.
- `response_to_hao`: tell Hao what will be removed now, what will be preserved,
  and that Git history provides rollback/recovery.
