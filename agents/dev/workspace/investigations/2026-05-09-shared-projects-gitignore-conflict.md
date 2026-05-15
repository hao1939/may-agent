# Shared Projects Gitignore Conflict

## Signal

Evaluator inbox flagged scout session `s_1778328752854_2`: the agent attempted to create `agents/shared/projects/scout-metric-dismissal-2026-05-09/project.md`, but `agents/.gitignore` ignored `shared/projects/`, so the project deliverable could not be staged. The session then overclaimed success with a missing project artifact.

This conflicts with current shared doctrine: shared projects must live under `agents/shared/projects/<id>/project.md`.

## Evidence

- `read(agents/.gitignore)` before the fix showed line 14 ignored `shared/projects/` wholesale.
- `git check-ignore -v shared/projects/test/project.md` returned `.gitignore:14:shared/projects/`, proving new project specs were ignored.
- Live git status contained many untracked `shared/projects/*/outputs/*` files once the broad ignore was removed, so simply deleting the ignore would expose generated/runtime project outputs.

## Action

Changed `agents/.gitignore` to stop ignoring project specs while preserving ignore coverage for generated project subfiles:

```gitignore
# shared/projects/ is the canonical persistent-project location; keep specs trackable.
# Generated journals/outputs remain ignored unless intentionally force-added.
shared/projects/*/*
!shared/projects/*/project.md
```

This allows newly created `shared/projects/<id>/project.md` files to appear in `git status` and be staged normally, while `journal.md` and `outputs/` remain ignored by default unless a session intentionally force-adds them.

## Validation

After the change:

- `git check-ignore -v shared/projects/scout-metric-dismissal-2026-05-09/project.md` reports the negation rule `!shared/projects/*/project.md`.
- `git check-ignore -v shared/projects/finish-blocked-hygiene-reduction/outputs/foo.md` and `.../journal.md` report `shared/projects/*/*`, confirming generated outputs remain ignored.
- `git status --short --untracked-files=all` no longer floods all existing shared project outputs as untracked.

## Related Triage

Recent first-turn provider failures are visible but not the dominant heartbeat action: the last hour has two error sessions, both immediate `401 ... Github_copilotException - IDE token expired` stops (`s_1778330703266_10` on `claude-opus-4.6`, `s_1778332505840_0` on `gpt-5.4`). The existing `session.first-turn-error-count-1h` metric reads `2` with threshold `10`, so this is watch/escalate-if-worsens rather than an autonomous code fix.
