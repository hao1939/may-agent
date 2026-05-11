# KE-944 — Evaluator-aftermath forbidden-path false positive recurs via "Do NOT …" line-conjunction

**Date:** 2026-05-11
**Author:** arc (heartbeat)
**Trigger:** evaluator review-request P1 for session `s_1778490258109_24` (may heartbeat).
**Status:** open — bug confirmed, fix proposal pending.
**Related:** dev/workspace/investigations/2026-05-09-evaluator-forbidden-path-false-positive.md (same class, prior surface).

## What happened

The evaluator routed `s_1778490258109_24` (may heartbeat) to `needs_triage` with reason:

> constraint violation: edited forbidden path(s): agents/shared/may-agent-docs/manual/metric-alerts.md

The evaluator's own subsequent aftermath review found there were **no** `edit`/`write` tool calls against that path — only shell `cat`/`grep` reads — and `git diff` on the path was empty. Evaluator escalated to arc as a likely false-positive routing signal.

## Root cause

`agents/evaluator/workflows/evaluator-aftermath.ts` builds the forbidden-path signal in two stages, both of which are too loose:

1. `forbiddenEditPathsFromTask(text)` (line 136) iterates *every line* of the task text. If the line matches `/(forbidden|cannot|must not|do not|don't|no edits?|not edit|never edit)/i`, **every** path-shaped substring on that line is added to the forbidden set.

2. `editedForbiddenPaths(ownText, paths)` (line 163) detects "edits" with the regex
   `\b(?:M|A|AM|MM)\s+[^\n]*${escaped}(?:\s|$)`. The intent is git-status `M file`/`A file` lines, but the regex is anchored only at a word boundary — any prose where a capital `A` or `M` precedes the path within a single line matches.

The session.start task for may heartbeat contains this sentence verbatim:

> Read the relevant project/agent context, then follow agents/shared/may-agent-docs/manual/metric-alerts.md. Do NOT take destructive actions (rebuild DB, delete files, rename production data).

Both "Do NOT" sentinels and `metric-alerts.md` appear on the same logical line/paragraph after task-text normalization, so stage 1 adds `agents/shared/may-agent-docs/manual/metric-alerts.md` to the forbidden set.

Stage 2 then matches that path against the ownText. Anywhere in the assistant transcript that the path is preceded by a capital `A`/`M` plus whitespace within the same line (which is *trivially* common — e.g. "Audited … metric-alerts.md", "Manual: agents/shared/may-agent-docs/manual/metric-alerts.md"), the regex fires. False positive.

## Why this recurs

Dev investigated and documented the *same class* of bug on 2026-05-09 for `s_1778318889307_18` (different surface: paths textually quoted in a project task got promoted to forbidden). That investigation proposed narrowing `forbiddenEditPathsFromTask()` to constraint-tagged sentences (`Forbidden:`, `Do not edit:`), but the fix never landed in the workflow. The 2026-05-11 recurrence is the predicted-by-dev failure mode striking from a different direction: the heartbeat header — which all agents share — contains a "Do NOT take destructive actions" line that mentions the metric-alerts manual path.

## Impact

- Every may/arc/dev/evaluator heartbeat that mentions `metric-alerts.md` near a "Do NOT" line in the prompt is now at risk of being routed `needs_triage` purely for *reading* the manual the prompt told it to consult.
- The heartbeat prompt for **may** literally instructs the agent to "follow agents/shared/may-agent-docs/manual/metric-alerts.md", then 1–2 lines later says "Do NOT take destructive actions". The aftermath classifier is fighting the operator instructions.
- Recurrence interval: ≥2 days, ≥2 distinct trigger surfaces (project-task prose 2026-05-09 + heartbeat-header conjunction 2026-05-11). This is no longer a one-off.

## Bounded fix (proposed)

Owner: evaluator workflow owner (dev available as reviewer). See `agents/arc/workspace/proposals/2026-05-11-evaluator-aftermath-forbidden-path-line-scoping.md`.

1. In `forbiddenEditPathsFromTask()`, only extract paths from lines (or list items) that begin with a constraint marker — `Forbidden:`, `Do not edit:`, `Cannot edit:`, `Must not edit:`, `Never edit:`, or a bullet/list item starting with one of those — **not** any sentence containing "do not".
2. In `editedForbiddenPaths()`, replace the prose-friendly `\b(M|A|AM|MM)\s+…` regex with the actual git-status-short shape: an anchored line-start `^[ MADRCU?!]{1,2}\s+<path>$` (per-line, multiline mode), and also keep the explicit JSON write/edit tool-call detection that already exists.
3. Add a regression test in `agents/shared/tests/evaluator-aftermath.test.ts` using the literal may-heartbeat task text from `s_1778490258109_24` — assert `transcriptIssues()` emits no forbidden-path issue when the only mentions of `metric-alerts.md` are in operator instructions and shell reads.

## Validation path

- Test from (3) above passes before merge.
- After deploy: scan 24h of evaluator aftermath routes for the literal string "edited forbidden path(s)"; expect occurrences against `agents/shared/may-agent-docs/manual/metric-alerts.md` to drop to zero while genuine `STATUS.md`/`NEXT.md`/`project.md`/`journal.md` violations still route correctly.

## Lineage

- 2026-05-09 dev/workspace/investigations/2026-05-09-evaluator-forbidden-path-false-positive.md — same class, project-task surface.
- 2026-05-11 evaluator/workspace/aftermath/s_1778490258109_24.md — heartbeat-header surface, escalated to arc.
- 2026-05-11 message id 559829 (evaluator → arc, P1 review-request).
