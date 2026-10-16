# Proposal B recovery trials — October 17

The connected offline trials found no additional App behavior defect. Existing
Task admission, workflow feedback, owner routing and restart handling satisfy the
tested recovery cases. This change adds regression coverage and evidence; it
does not add a retry controller, another recovery Task per failure, a permissive
report reader, or a production model call.

The App schema/admission fix remains the independently activated
`1f11af385afabd18f581d2d4c3d3e107f7c56923`, recorded in the
[judgment-contract rollout](judgment-contract-20261017.md). These trials build on
Apps `1aef62625f`; the tests were committed in Apps
`06e7c28e3bae8affbb2b89ef73818e5bc20035c9`. Baseline checks used Host
`234a027a3d6105b37c51ddd4a8849e3760cdde26`, including the separately deployed
#375. Paired checks and the subsequent authorized #374 rollout are recorded below.

## Connected checks

The committed [recovery tests](../../../recovery-contract.test.ts) load the real
Alex definition, Host inbox and Task runtime into temporary file-backed SQLite
state. Scheduling is disabled for the fixture and attempts are dispatched
explicitly. Report cases use the actual workflow tool, App reader and agent
runner with scripted provider responses. Setup failure uses the actual workflow
adapter against a missing module. No provider credentials or running installation
are needed; a sibling Host checkout and its installed dependencies are needed.

| Case | Observed result |
| --- | --- |
| Readable retained report | Reader returns verified evidence without a nested model call; the original owner finishes its existing invocation. |
| Unfamiliar rubric | Reader rejects the unsupported identity. Original bytes/reference and exact rejection reach the owner, which returns a schema-valid interpretation with missing evidence disclosed. |
| Unreadable retained JSON | Integrity rejection reaches the same owner. The trial returns an honest limited contribution and leaves the saved bytes unchanged. |
| Completed interpretation followed by restart | One Task admission and one agent invocation remain; completed work is not repeated. Each report case uses two scripted replies: workflow call, then finish. |
| Selector cannot load before execution | The original selector Task/input remain. Real failure events reach Alex's existing `runtime/selector-recovery` Task and are considered by its executor; a second failure after restart joins that same owner Task with its own evidence. |
| Typed request rejected before destination admission | The requesting Task receives the exact schema rejection through `previousAttempt`, retains the original reference/input and considers it on its next attempt. No destination Task is created; the obligation is not declared fulfilled. |
| Retained incompatible input and schema replacement | Recovery preserves the input and caller identity, with rejection visible. Pending event admission prevents incompatible schema replacement. The unchanged ordinary message envelope still admits unfamiliar content. |

The missing-caller fixture deliberately does not install May. It preserves the
addressed failure instead of inventing a recipient. The executable-caller trial
and selector-owner trial separately prove consideration, not just logging.
Scripted interpretation demonstrates transport and acceptance mechanics, not
real-model judgment quality or compliance with instructions.

Existing owning tests additionally cover rejected delivery reusing verified
development evidence via `previousAttempt`, publication failure/retry without
another judgment, original immutable publication reuse, and changed evidence
requiring fresh work. Those tests remain the detailed owners of effect recovery.

Verification: 95 focused tests passed across the new recovery suite, Alex intake,
development workflow, Task review and retained report reader. Root type checking
and a targeted strict TypeScript check of the new suite and imported sources
passed. Fixture construction initially exposed test setup mistakes (controller
startup/teardown, asynchronous admission, normalized request fields and pending
event setup); these were corrected without production changes.

Reproduce the focused checks from the Apps checkout:

```sh
EVALUATION_AUTO_REVIEW_REVIEWER=evaluator bun test \
  ./projects/alex.app/recovery-contract.test.ts \
  ./projects/alex.app/app.test.ts \
  ./projects/alex.app/agents/alex/workflows/develop-change.test.ts \
  ./projects/alex.app/agents/evaluator/workflows/task-outcome-review.test.ts \
  ./projects/alex.app/agents/evaluator/workflows/evaluation-report-reader.test.ts
```

## Host #374 and activation boundary

[Host PR #374](https://github.com/hao1939/may-agent/pull/374) supplies the shared
finish acceptance/concise feedback change. It permits declared string-or-number
representations and shared App normalization; it does not impose strict types
where the App explicitly accepts multiple representations.

Quality and Container passed in run `38937306468` on the approved PR head
`56676e9b81567a9b579f6130e0f2b6e31b4fb404`. Merged main
`e982e7537712e58e06e0a3733152964b5689a0ec` has the identical Git tree
`9eac0244596bde0baa8e99022cee39e5e692457a` and retains #375. The seven connected
recovery trials (91 assertions) passed against that PR head. Paired App/SDK
artifact compatibility passed for all four source Apps; the sample remains
inactive. The checked SDK tree hash was
`adf4d68427a108679458864c1e3a5de676e3aa197caac44649ca3e24c1e3ca67`.

The authorized local deployment used the ordinary standalone deploy command from
an external immutable checkout of merged main. Its 68 deployment transport tests
passed, and its exact receipt is:

`/app/projects/may-agent/.state/deploy-receipts/host-report-contract-e982e753-20261017.json`

It settled `succeeded` at **2026-10-17 01:15:40 Asia/Shanghai**, with
`health: healthy`, `duplicateDeploy: false` and matching requested/loaded SHA-256
`7ca4a876e0cd861a06c84476e68b2be61568943621172b89eb434e40a7752d76`.
Independent reads confirmed binary `v5.5.0 (e982e753)`, the installed artifact
hash, matching SDK/UI releases, three running Host services, HTTP readiness and
the control-socket registry's three active Apps. Active App definitions remain
`1f11af385afabd18f581d2d4c3d3e107f7c56923-definitions-v5`.

At the post-deployment observation cut, **01:15:59 Asia/Shanghai**, the natural
sample remained 2/50, with 2/10 reports inspected and zero reviews started after
#374 activation. The earlier sample below therefore establishes no live outcome
or token savings for #374. Keep subsequent samples segmented by rollout time.

This tests/documentation-only App change needs no runtime reload. Live Task
controls, schedules, models and budgets were not changed by this work. The
existing six-hour audit remains the next verification slice; these trials do
not establish its cost-pattern detection or follow-up quality.

## First natural observation cut

At **2026-10-17 01:06:56 Asia/Shanghai**, two DeepSeek reviews had started after
the App activation at 00:41:54 and published results: **2/50** review samples and
**2/10** inspected judgments. A publication from an invocation started before
activation was excluded. Both new invocations finished on their first finish
call, with zero finish-correction turns. One unrelated SQL column-name error
received the actual schema and was corrected within its existing invocation.

Provider-reported usage totals were 142,497 input, 234,688 cache-read, zero
cache-write and 15,503 output tokens: 392,688 including cache reads across eight
replies. DeepSeek pricing remains unknown; zero estimated price is not free use.
The first invocation ran on Host `b86592b0`; the second followed the separate
#375 deployment to `234a027a3`. #374 was not active for either observation.

Both saved publications passed the actual integrity reader and current judgment
schema. Manual evidence checks found:

- Event `6676114`: the adverse metric finding retains the breach (28 versus 5).
  A read-only query reproduced its 27 reconcile-start events plus one reload
  event in the reported window. Its follow-up was admitted to Alex's ordinary
  Task route. The classification/causal explanation remains explicitly a
  hypothesis pending code inspection and post-change verification.
- Event `6676227`: the Task review retains the outstanding below-threshold
  measurement and caller obligation, acknowledges truncated evidence, and
  chooses no additional follow-up for an already owned wait. Its deployment
  reference and retained Task evidence support the reported partial progress;
  it does not claim alert recovery. It also identifies a bounded repeated PR
  merge reconciliation as a minor efficiency observation.

This sample contains an adverse finding and an unresolved waiting outcome; it
does not yet contain a live `insufficient-evidence` disposition. No savings or
population-wide quality conclusion follows from two reports. Continue the
existing plan's read-only observation cuts as work becomes naturally due; do not
generate reviews to fill the sample.

Private logs, strict-check configuration and the one-shot observation script and
snapshot are retained under
`/home/hao/workspace-worktrees/may-token-review-20261016/` with the
`proposal-b-recovery-*`, `proposal-b-live-*` and `host-report-contract-*` prefixes.
