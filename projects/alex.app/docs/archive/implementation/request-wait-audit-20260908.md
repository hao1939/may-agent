# Request waiting audit — September 8, 2026

**Historical context:** [Task Resource Engine](../../2a-design/task-resource-engine.md). Retained rationale and evidence; this record does not define the current contract.

Decision: defer deletion of frontend child-request waiting. Leave its public
contract, compatibility prompt, retained state interpretation, and recovery intact. This
is an explicit compatibility decision, not a claim that the path is unused.
B continues independently; the human subsequently excluded C's Evaluation
migration from this May-focused implementation pass.

Remote main was read with `git ls-remote`: Host
`e1a36126229826a0848ec6687bd07c5c950c75e7`, App/design
`d8baf6e0c73f4215bdbebf5b0160fb45b1767145`. The starting Host local main
`fb9c8278e9e8459908eb1c7291304e846325f7da` is a different history; the dirty App
checkout is on `chore/may-agent-hygiene`. Neither is an implementation base.
The owned `host` and `app` checkouts use independent Git stores cloned without
hardlinks; no worktree administrative changes touch the starting repositories.

| Consumer | Finding and disposition |
| --- | --- |
| SDK | `packages/sdk/src/app.ts` publicly exports `AppRequestDecision.dependencies`, request dependency observations, open requests, and the agent result schema. Public third-party callers cannot be excluded by this source inventory. Preserve these exports. |
| Current Apps | Search of tracked active TypeScript in `agents`, `shared`, and `projects` finds conversational `requests:` only in `projects/may.app/app.ts` and its tests. May uses `inputKinds` and `tasks`, and its prompt selects direct `followUp` admission. This is source scope, not an installed-App inventory. |
| Gym | `projects/gym.app/app.ts` has no conversational `requests` attachment. `taskForGymInput` and `gymOwnerReviewIntent` retain source/request and execution-request identity; the workflow trigger helper still routes durable work. These are ordinary Task admission/result consumers, not evidence for removing generic request handling. |
| Host fixtures | `app-inbox-host.test.ts` contains real child-request fan-out, waiting, exact continuation, cross-App targeting, completion, and in-flight replay tests. `app-inbox-runtime.test.ts` also exercises Apps with `requests` and no direct-follow-up declaration. Keep these compatibility scenarios. E2E agent fixtures are minimal bounded agents, not an installed consumer census. |
| Helpers | `stableChildRequestId` and `appRequestChildrenWaitId` are specific to frontend children, but `AppInboxHost.#requestDependencyObservation`, parent completion wakes, `createAppInboxItem`, `waitAppInboxClaim`, inbox reads, and request-to-Task result correlation serve broader request behavior. Task dependency admission remains under the Task runtime/reconciler and SDK `TaskAppDependency`. Do not remove shared request machinery with a frontend caller. |
| Retained requests | The initial source audit did not query installed state. The later read-only local audit below finds an unfinished May parent with a frontend child wait in `app_inbox_items`. This is a demonstrated compatibility obligation, not permission to drain it or a complete installed App/SDK census. |

A later removal needs a human-designated affected installation and a read-only
consistent state/caller audit. If there are no external callers and no retained
obligations, retire the fields, prompt branch, fan-out, waits, and re-entry
together. Otherwise migrate callers to direct responsible-Task admission,
leave the compatibility runtime available until those exact requests drain,
and preserve request/results and Topic links. Do not reinterpret old requests,
delete rows, or introduce a migration framework to force this cleanup.

This slice changes documentation only: zero production lines added or deleted.
The subsequent direct implementation ran the existing installation tests with
the paired App checkout: 34 passed and 7 retired-cron checks were explicitly
skipped. A stale Gym fixture used removed importer APIs; it now bootstraps the
same resource-backed fixture and retains its admission and emission assertions.
These checks do not replace the missing installed-state audit.

The subsequent B refinement narrows only new direct-handoff model attempts:
their schema no longer offers child-request dependencies. An exact retained
child list or App wait keeps the compatibility schema and prompt. A regression
fixture creates work under the old App definition, recreates the Host with the
new definition, and completes that same request and child without attaching
replacement work. No public SDK or request persistence code is removed.

## Read-only local continuation audit

On September 8 at 08:10:55 UTC, the direct assistant inspected the local WSL
installation on `LOCAL-PVB3M8VB5`. Docker inspection confirmed that the existing
`may-agent` container binds host `/app` to container `/app`. Its health status
was `unhealthy`; that status alone does not explain request behavior.
The database `/app/.state/may.db` was opened read-only, with SQLite `query_only`
enabled and queries inside a read transaction. No transcript, request input,
credential, or model call was needed.

The May-only census found 251 completed requests and 3 handling requests.
Exactly one nonterminal May parent had a child-request wait:

- Parent: `app_bba99978-1f4e-4a03-a29a-5147c207e4f2`.
- Topic: `topic_aa31fe3700d2d163f8323686`.
- Wait: `app` / `children:app_bba99978-1f4e-4a03-a29a-5147c207e4f2`.
- Two children were `done`, each with a stored result; the parent had no result.
- The parent had no `available_at`, `review_at`, lease owner, or lease expiry.

This parent is not eligible through the current ready/expired indexes. Current
source completes children and wakes their parent in one transaction, but the
inspection does not establish which old build or decision created this retained
state. Passing the isolated child-completion/restart fixture does not prove
automatic repair of this historical record. Do not create a duplicate Task or
discard the caller's unanswered request to make the audit look complete.

Disposition: keep the compatibility runtime. A later authorized recovery must
preserve the exact parent, children, Topic, and accepted results, and verify the
parent's final result. This positive finding is sufficient to reject deletion
now; it is not a full caller census or proof about another installation.
No live rows, container state, or deployment were changed.
