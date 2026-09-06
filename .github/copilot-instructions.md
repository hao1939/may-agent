# Review May Host changes

Follow `AGENTS.md` and `CONTRIBUTING.md`.

Review the changed behavior, not just whether tests pass. Flag duplicated
state authority, App policy in Host mechanics, unbounded retries, identity or
generation-fence gaps, lost caller results, and unsafe recovery or deployment.
Ask for a focused regression test and the relevant design reference when a
contract changes. Prefer a smaller existing mechanism over another framework.
Do not request unrelated rewrites or treat an optional live check as CI proof.
