# Evaluator forbidden-path false positive: textual owner/path mentions

## Summary

A new evaluator FYI reported that session `s_1778318889307_18` was routed to `needs_triage` for:

> constraint violation: edited forbidden path(s): app/agents/shared/projects/daily-alert-review/outputs/2026-05-09-recommendations.md, config/spec, evaluator/scout

The route is a false positive. The actual write target was the permitted project output file `agents/shared/projects/daily-alert-review/outputs/2026-05-09-recommendations.md`; the extra `config/spec` and `evaluator/scout` strings came from prose in the produced recommendations document, not from write/edit tool calls or git-status output.

## Evidence

- `agents/evaluator/workspace/aftermath/s_1778318889307_18.md` reports no edit/write calls to `config/spec`, `evaluator/scout`, `project.md`, or `journal.md`, and identifies the trigger as likely heuristic/path extraction from document text.
- Bounded transcript grep showed the only `write` call wrote `/app/agents/shared/projects/daily-alert-review/outputs/2026-05-09-recommendations.md`.
- The same transcript lines show the document content contained prose owner labels such as `metric config owner` and `evaluator/scout owner`.
- Session row check: `s_1778318889307_18` is `status='done'`, `outcome='done'`, `error=NULL`, `source='workflow:project'`, and `opCount=0`. The `opCount=0` part matches the already-documented accounting issue and should not be used as proof of no tool activity.

## Root cause hypothesis

`agents/evaluator/workflows/evaluator-aftermath.ts` only checks explicit write/edit/apply_patch tool-call JSON and git-status style `M/A` lines in `editedForbiddenPaths()`. That function looks appropriately scoped. The false path likely entered earlier, when `forbiddenEditPathsFromTask()` extracts forbidden paths from the entire user/task text.

The project prompt includes a line like `You CANNOT edit the project file or journal`, while the user/task text and embedded prior recommendations include many arbitrary path-like/prose owner mentions. If those mentions appear on or near constraint lines, the extractor can promote textual names into forbidden-path candidates. The later match step then sees the legitimate write to the allowed output file and/or document text and emits an over-broad constraint issue.

## Recommended bounded fix

Owner: evaluator workflow owner, with dev available to review.

1. Add a regression test to `agents/shared/tests/evaluator-aftermath.test.ts` for a project task that forbids only `project.md`/`journal.md`, writes `agents/shared/projects/daily-alert-review/outputs/2026-05-09-recommendations.md`, and includes prose strings `metric config owner` and `evaluator/scout owner` in the written content. Expected: `transcriptIssues()` does **not** emit a forbidden-path issue.
2. Narrow `forbiddenEditPathsFromTask()` to extract paths only from the same constraint sentence/list item, not arbitrary later task/document text. Also avoid treating slash-bearing owner labels without a file extension or repo-root prefix as forbidden paths unless explicitly introduced by `Forbidden:` / `Do not edit:`.
3. Keep the existing positive tests for explicit forbidden writes (`STATUS.md`, `NEXT.md`) so true constraint violations still route to `needs_triage`.

## 2026-05-11 recurrence: metric-alerts.md read classified as edit

A new evaluator → dev P2 review-request for `s_1778564062377_783` reports the same false-positive class, now against `agents/shared/may-agent-docs/manual/metric-alerts.md`.

Additional evidence checked this heartbeat:

- `agents/evaluator/workspace/aftermath/s_1778564062377_783.md` says the session used only read/list shell commands (`grep`, `cat | grep`, `ls`) on `metric-alerts.md`; no `write`/`edit` tool call touched that path, and review-time `git diff -- agents/shared/may-agent-docs/manual/metric-alerts.md` was empty.
- `agents/shared/knowledge/entries/KE-944-evaluator-aftermath-forbidden-path-false-positive-recurs-via-do-not-line-conjunction.md` documents the concrete mechanism: `forbiddenEditPathsFromTask()` promotes `metric-alerts.md` because it appears near a `Do NOT` operator instruction, and `editedForbiddenPaths()` can match prose via an unanchored `\b(M|A|AM|MM)` git-status regex.
- `agents/arc/workspace/proposals/2026-05-11-evaluator-aftermath-forbidden-path-line-scoping.md` is already in the Proposed queue as P1 with the right bounded fix: line-scoped constraint extraction, anchored git-status parsing, and a regression test.

Disposition for the new dev inbox event: acted by confirming it is a duplicate recurrence of the known KE-944/proposal, not a distinct new failure. No code patch applied from this heartbeat because the implementation target is `agents/evaluator/workflows/evaluator-aftermath.ts` and the proposal remains unapproved in `agents/shared/work-queue.md`.

## Disposition

- Acted on the P2 FYI for `s_1778318889307_18`: confirmed false-positive mechanism and left a bounded fix/test contract.
- Acted on the P2 review-request for `s_1778564062377_783`: confirmed recurrence and linked it to KE-944 / the pending P1 proposal rather than creating a duplicate project.
- Dismissed as no immediate dev-owned code change because the implementation file is `agents/evaluator/workflows/evaluator-aftermath.ts`, outside dev's normal writable ownership list for heartbeat patches, and the work-queue item is Proposed rather than Approved.
- Related P2 FYI for `s_1778317686099_15` remains covered by `agents/dev/workspace/investigations/2026-05-09-clean-start-interrupts-and-opcount.md`: productive transcript with `opCount=0` confirms accounting false positives.
