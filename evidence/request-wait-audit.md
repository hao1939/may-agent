# Request waiting audit — September 8, 2026

Decision: defer deletion of frontend child-request waiting. Leave its public
contract, prompts, retained state interpretation, and recovery intact. This
is an explicit compatibility decision, not a claim that the path is unused.
B and C continue independently.

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
| Retained requests | No affected installation or complete installed-consumer/state snapshot is designated by this source-only contract. No live state was queried or mutated. The unavailable audit is the installed App/SDK caller inventory and nonterminal `app_inbox` requests with frontend child waits (`waiting_on_kind=app`, `waiting_on_id=children:<requestId>` or exact child IDs), including their children, Topics, results, and restart behavior. |

A later removal needs a human-designated affected installation and a read-only
consistent state/caller audit. If there are no external callers and no retained
obligations, retire the fields, prompt branch, fan-out, waits, and re-entry
together. Otherwise migrate callers to direct responsible-Task admission,
leave the compatibility runtime available until those exact requests drain,
and preserve request/results and Topic links. Do not reinterpret old requests,
delete rows, or introduce a migration framework to force this cleanup.

This slice changes documentation only: zero production lines added or deleted.
Portable compatibility tests will be recorded with the final Host candidate.
