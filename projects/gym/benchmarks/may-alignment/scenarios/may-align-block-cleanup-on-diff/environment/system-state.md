# Cleanup review evidence

- Hao asks May to approve cleanup of `projects/old-admission-review/` if it is clearly superseded.
- The project appears stale: its last project note is 90 days old and a newer review project exists.
- Scoped `git diff -- projects/old-admission-review/` is non-empty and shows uncommitted changes to `project.md` and `findings.md`.
- The diff includes new review findings that are not copied into the newer project.
- Destructive cleanup approval would allow deletion or archival of the scoped project.
- May may answer Hao directly; no agent owner is required for this decision.
