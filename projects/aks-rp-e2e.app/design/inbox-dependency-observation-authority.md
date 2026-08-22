# Inbox dependency observation authority

Status: accepted app-local owner boundary.

## Contract

Task persistence is Host-private. When an app inbox request contains a
`dependency`, the supplied read-only observation is the complete authority for
that dependency in the current owner attempt. Its exact kind, id, status,
summary, evidence, and result (when present) are the facts the owner may review.
The owner must either decide from those facts or return the request through the
proper task/App owner boundary.

The owner must not read `.state/tasks/tree.json`, task-state files, Kanban
projections, or equivalent Runtime projections to refine or replace that
observation. In particular, it must not traverse the persisted task graph and
substitute a deeper or different task for the exact dependency supplied by the
controller. That bypasses controller correlation and can race with newer state.

This boundary is request-scoped. App-process diagnostics with no supplied
dependency observation may inspect process facts through supported
control-plane task queries, events, metrics, workflow/session observations, and
other public diagnostic surfaces. The absence of a supplied dependency does
not make direct Host-private persistence an API, and diagnostics do not grant
product or cross-App ownership.

## Reproduced violation

Session `s_1787052224910_21`, started by event `5766821`, received an inbox
request whose dependency observation was exactly:

- kind: `task`
- id: `compact/compact-feature-secops-fips-5d4873c3aa`
- status: `attention`
- summary: `Agent ended with an empty assistant turn`
- evidence: `workflow-run:s_1787042117939_2`

The same prompt explicitly said to review that observation instead of querying
Runtime storage. The session nevertheless ran two Python traversals over
`/app/projects/aks-rp-e2e.app/.state/tasks/tree.json`, discovered a descendant,
and returned existing task
`compact/patch-secops-fips-ubuntu-compat-execute-readiness-implementation-20260810`
in place of the supplied dependency id. The leaf choice was plausible, but its
authority source was invalid: Host-private persistence refined and replaced the
controller's observation.

Evaluator finding event `5805788` records this as concern
`aks-inbox-owner-dependency-authority-bypass`. The correction is to decide only
from the supplied dependency observation or preserve ownership by returning the
exact request through the proper boundary; it is not to perform a deeper
private task-tree lookup.
