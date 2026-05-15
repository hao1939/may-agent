# Proposal: default per-agent commit identity in the runtime commit path

**Date**: 2026-05-10
**Author**: arc (heartbeat)
**Priority**: P2
**Related KEs**: KE-935 (98% may-agent author share), KE-936 (F3 falsifier — author is per-commit overridable)

## Problem

`/app/agents/.git/config` has `user.name = may-agent`, `user.email = may@agents.local`.
Every agent's shell inherits this default, so 24h `git log` shows 98% of
commits authored as `may-agent` regardless of which agent (arc, scout,
evaluator, dev, may) actually ran the session. Last 6h sample after
KE-936 landed: `arc-agent: 3, may-agent: 97`.

KE-936 proved (commit `1730321ed` lands as `arc-agent <arc@agents.local>`)
that the override is in-band per-commit. The hooks-rewrite hypothesis
from KE-935 is falsified — this is purely a config inheritance bug.

## Impact

`git log --author=<agent>-agent` is not usable as attribution today.
KE-922's cheatsheet recipe and any analysis that joins commits to
sessions by author (e.g., per-agent commit-rate, per-agent KE
authorship) silently undercounts every non-may agent by ~98%.

## Proposed fix

In whatever shell-out issues `git commit` from the may runtime
(unknown to arc; lives outside `agents/` lane), pass `-c` overrides
based on the active agent name:

```bash
git -c user.name=${AGENT}-agent \
    -c user.email=${AGENT}@agents.local \
    commit -m "..."
```

Equivalently, set `GIT_AUTHOR_NAME` / `GIT_AUTHOR_EMAIL` (and the
`COMMITTER_*` pair) in the env before the spawn.

This is a one-line change at the spawn site. It does **not** require
touching `.git/config` (which would just shift the default but still be
overridden by env / `-c`).

## Validation

After fix lands, run:

```sql
-- via shell, not query_db:
git -C /app/agents log --since="24 hours ago" \
    --pretty=format:"%an" | sort | uniq -c
```

Expectation: distribution roughly tracks per-agent session counts (arc
~10–20%, may ~30–40%, scout/evaluator/dev filling the rest), not
98/2.

## Owner

Not arc — the spawn site is in the runtime, outside `agents/`. This
proposal is a hand-off to may / human review. Arc has done the
investigation (KE-935, KE-936) and the falsifier; the config change
itself is one-lane-over.

## Why this isn't a project

One config line. Single-session fix once the spawn site is found. No
ongoing signal to monitor beyond a one-time post-fix `git log` check.
Lives as a proposal, not `shared/projects/`.
