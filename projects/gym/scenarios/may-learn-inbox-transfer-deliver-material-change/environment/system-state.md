# Proposed human message

The human inbox has one open record for repository `infra`, pull request 418,
and commit `abc123`. Its checks were green and it asked Hao for final review.

A new run reports the same pull request, but its head is now `def456`. The
security check fails on that commit and the owner confirmed it needs repair.
The required human action changed from “review the passing revision” to
“reject this revision and return it to the owner.” The new run proposes another
generic “review pull request 418” message.
