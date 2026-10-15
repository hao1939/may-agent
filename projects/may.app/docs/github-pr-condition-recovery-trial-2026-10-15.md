# Local PR observation and recovery trial — October 15, 2026

**Supports:** [GitHub observation and missed-change recovery](../design/github-pull-request-observation.md).
This trial checks whether the existing Condition mechanism returns useful facts
without turning unchanged polling into model work. It also checks the rollout
boundary between executable definitions and retained interests.

## Installed behavior

At 15:19 UTC, the existing container accepted reload request `6664180` and
recorded successful activation in event `6664182`, with Apps source
`bcebf5cb54f613daf203d3f8f1a713f667579868`. The Host and SDK remained at
`cbd71af0752df378e4faaac056d045a53ce85e4f`. No Host source or binary change was
needed. May, Alex and Scout remained loaded; Sample remained disabled.

The live observer published real facts for PRs #352–#356 in events
`6664183`–`6664187`. Each was admitted to its existing May Task. Native May
attempts handling #352 and #354 saved source-bound resource Conditions through
ordinary results. Their immediate exact checks were recorded as events
`6664228` and `6664204`, respectively, with **zero work routes selected**:
the observed fingerprints still matched the retained baselines.

May retained the legacy format for #356. A one-off operator migration converted
only its inactive, unsatisfied `host-action-notification-pr-state` Condition
through the existing fenced resource-store API. It retained the Task, logical
Condition generation, baseline, input waits and independent human approval
Condition. An isolated copy first verified stale-plan rejection and unchanged
Task/independent state. No active attempt was impersonated and no raw SQL write
was used. #353's satisfied Condition was left to its active owner. After that
attempt completed and rearmed a legacy wait, the same fenced migration converted
it while inactive. #355 had a human decision wait, so the operator did not invent
a PR requirement.

## Provider-backed recovery proof

A separate temporary Host composition used real GitHub reads and production
observation, persistence and admission components. PR #351 was already merged
before the restarted observer read it. The fact reached its original test Task,
while an independent approval remained unknown. Completing that PR interest
stopped its reads. A second read of unchanged, open PR #356 emitted no new fact
and made no Task runnable. The trial made six HTTP reads and no history-list
request or GitHub mutation. Agent judgment in this composition was a fixture.

## Defect found while trying it

Repeated read-only checks exhausted GitHub's anonymous quota. The reader had
never attached the token already configured for this installation. The App
reader now uses `GH_TOKEN`, with `GITHUB_TOKEN` as fallback, on its validated
GitHub requests. Both live and direct reads share this rule; secrets are not
retained in observations. Public unauthenticated reads remain available when
no token is configured, with their lower provider quota.

At 15:25 UTC the corrected reader, using the running service's configured
credential, successfully checked the three saved interests for #352, #354 and
#356. #352 and #356 were unchanged and matched no waiting predicate. #354 had a
changed fingerprint matching its exact saved Task. These diagnostic reads did
not publish events; its still-unhandled change remained eligible on the second
read. That repeat is necessary recovery behavior, not duplicate agent work.

## Evidence and limits

Local receipts and reproducible trial scripts are retained under
`/app/.state/github-pr-condition-trial-20261015/`. They distinguish source
integration, installed release, migration and read-only diagnostic checks.
The initial snapshot, migration before/after plan and previous immutable release
are retained for reviewed rollback; do not restore a stale database over later
work.

The corrected source passes 49 focused tests, including credential precedence,
anonymous fallback and both observation paths, plus May type checking. The
separate composition trials cover publication failure, restart, shared reads,
independent waits and removal of demand.

This is a bounded trial. The real merged-PR recovery happened in isolated Tasks,
not by merging a production PR for testing. The format migration establishes
#356's saved demand; its installed hourly read is separate evidence. There is no
claim that CI checks, unresolved review threads, protected delivery or whole-Task
acceptance are covered by PR observation. Follow the operation receipt for the
exact final activated revision after the credential correction.
