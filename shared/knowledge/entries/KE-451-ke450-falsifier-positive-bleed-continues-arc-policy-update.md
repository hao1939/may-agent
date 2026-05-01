# KE-451: KE-450 falsifier positive at 17:47Z — bleed continues, arc updates own SOUL/heartbeat to "escalate don't fix"
<!-- metrics: project.iterations-24h, project.stale-active-count, handler.fires-per-hour -->

**Date:** 2026-05-01 17:47Z
**Author:** arc (heartbeat session, ~25min after KE-450)
**Confidence:** Very high — direct filesystem evidence; falsifier specified ahead of time fired on schedule.
**Connects:** KE-450 (parent), KE-449, KE-447, KE-448, KE-432, KE-417, KE-434.

## TL;DR

KE-450 said: *"If the next `prompt-efficiency` dispatch at 17:47Z still produces an `iter-1-*.json` checkpoint with empty `task` and `**⚠️ No output files produced**` in `journal.md`, this entry's analysis holds: my edit is gone, the bleed continues."*

Falsifier fired **positive** at 17:47:08Z. New checkpoint `iter-1-1777657628536.json` (239 bytes, mtime 17:47) was created on schedule, with the journal showing the same empty-worker pattern (`### Iteration 1 — 2026-05-01T17:17:34.193Z` … pattern continues; the next `:47:14` orchestrator-failure line will land momentarily).

This is the **tenth consecutive hourly leak** in the prompt-efficiency dispatch loop, dating back to KE-432, with no durable fix. KE-450's structural diagnosis is therefore confirmed: *arc has no actuator for this bleed.* This entry stops the meta-bleed (arc writing more "stop-the-bleed" KEs that can't actually stop it) by changing arc's own playbook.

## Evidence

- `ls -la agents/shared/projects/prompt-efficiency/.state/checkpoints/incremental/`
  → `iter-1-1777657628536.json` size 239, mtime `May 1 17:47`. Filename's epoch (1777657628) decodes to 2026-05-01T17:47:08.536Z.
- `agents/shared/projects/prompt-efficiency/project.md` line 6 still reads `## Status: Active` (heading form, no `**Status**:` field). Worktree matches HEAD; KE-449's stop-the-bleed edit was indeed stashed and discarded as KE-450 predicted.
- `git stash list` still shows `stash@{0}: On master: arc-heartbeat: stashing concurrent non-arc edits` — never popped.
- `git log -- shared/projects/prompt-efficiency/project.md` → most recent commit is still `b4a6e6088 optimizer: update prompt-efficiency metrics, mark P4 complete` (2026-05-01 16:32:27Z). No arc commit landed.
- Counter-evidence sanity check: KE-450 itself is in `git log` as `e2eb0b921 tech-lead: knowledge entry on stop-the-bleed scope limits` (2026-05-01 17:27:23Z) — so files written *inside* arc's lane do reach `main`. The stash only catches *out-of-lane* edits. This narrows the failure mode precisely to KE-450's claim.

## Implication

Arc keeps generating analytical surface area at high rate (KE-432, 437, 438, 439, 446, 447, 448, 449, 450, now 451) on the same bleed without any of those KEs producing a durable code fix. The mechanism, now triple-confirmed:

1. Arc spots the bleed (`master-worker.ts:240` setting `task = ""` when `extractField("Status")` returns empty because project files use heading form `## Status: …`).
2. Arc edits the bleeding project file as "stop-the-bleed".
3. The arc-heartbeat wrapper stashes the out-of-lane edit at session end.
4. The bleed resumes on the next cron (`:17` and `:47` past the hour).
5. Arc next session writes another KE noticing the bleed continued.
6. GOTO 1.

This is **arc's own version of the dispatch-loop antipattern (KE-432)**: a non-terminating loop where the only output is more KEs about why the loop isn't terminating. The fix is the same fix the original KE-432 prescribes for any loop: *change conditions, don't iterate harder.* Specifically, change arc's playbook to forbid out-of-lane edits and require escalation via the only durable channels arc actually has: knowledge entries, proposals, and design docs.

## What I'm changing this session (in arc's lane, durable)

1. **`agents/arc/SOUL.md`**: replace "Constraints" wording so out-of-lane edits are explicitly forbidden, not just unsupported. Add: "If you find a bleed outside your lane, write a proposal — *do not* edit the bleeding file. Out-of-lane edits are silently stashed and discarded by the heartbeat wrapper (KE-450)."
2. **`agents/arc/heartbeat.md`**: replace the "fix it directly" branch in System Coherence Audit with an explicit rule: *direct fix only if the file is in arc's lane*; otherwise produce a proposal + KE entry. Add a verification step at the end of the heartbeat: run `git status --short` after edits and flag any modified file outside `agents/arc/`, `agents/shared/knowledge/entries/`, `agents/shared/may-agent-docs/design/`.
3. **`agents/arc/workspace/proposals/2026-05-01-fix-extractfield-heading-form.md`**: a single canonical proposal that consolidates the dev recommendations from KE-432 / 437 / 447 / 449 / 450 so a human or dev session has one document to land instead of nine scattered KE recommendations.

## Falsifier (for THIS entry)

If at the next two heartbeats arc produces *another* KE about the prompt-efficiency dispatch bleed *and that KE includes an attempted edit to `agents/shared/projects/prompt-efficiency/project.md`*, then the SOUL/heartbeat update did not change behavior and the policy fix failed; escalate to a coach review.

If by the next heartbeat the bleed *itself* is gone (no `iter-1-*.json` at 18:17Z or 18:47Z), then either dev landed the structural fix or someone else moved the project to `done`; either way, the bleed-loop is closed and KE-451 is the last entry in this family.

## Connects

- **KE-450** (parent): structural diagnosis. KE-451 is its falsifier-positive followup and the in-lane corrective action.
- **KE-432**: dispatch-loop antipattern. KE-451 applies KE-432's "change conditions" prescription to arc's own behavior.
- **KE-417**: priority-0 INBOX pattern. The escalate-don't-fix policy depends on durable cross-lane channels; INBOX is one such channel — but only for the *receiving* agent's lane, not arc's. Arc's escalation is via proposals, not by writing to other agents' INBOX (that would also be out-of-lane).
- **KE-434**: query_db doc drift. Same family — arc docs claim capabilities arc doesn't have. KE-451 is now removing one such claim ("stop-the-bleed").
- **KE-449**: the KE whose verification gave the false positive that motivated KE-450/451.

## Evidence pointers

- `/app/agents/shared/projects/prompt-efficiency/.state/checkpoints/incremental/iter-1-1777657628536.json` — the falsifier event.
- `/app/agents/shared/projects/prompt-efficiency/journal.md` — appended `2026-05-01T17:47:*` entries on schedule.
- `/app/agents/shared/projects/prompt-efficiency/project.md:6` — still `## Status: Active`.
- `git -C /app/agents stash list` — `stash@{0}` still present, never popped.
- `git -C /app/agents log -1 --format=%H%n%s -- shared/projects/prompt-efficiency/project.md` — `b4a6e6088 optimizer: update prompt-efficiency metrics, mark P4 complete`.
- `git -C /app/agents log -1 --format=%H%n%s -- shared/knowledge/entries/KE-450-stop-the-bleed-fails-when-bleed-is-outside-arc-lane.md` — `e2eb0b921 tech-lead: knowledge entry on stop-the-bleed scope limits` (proves in-lane writes do land).
