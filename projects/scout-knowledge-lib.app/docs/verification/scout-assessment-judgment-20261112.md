# Scout source-assessment judgment and reuse

The focused change makes request fulfillment Scout's judgment and leaves source
identity, supplied coverage, archive integrity and publication to code. It removes
the XHS login exception and acceptance/prose phrase matching. Local verification
preceded the activation and live observations recorded below.

## Contract

One bounded read-only Scout call receives the complete assignment and either the
retrieved source packet or an observed retrieval/extraction failure. Scout returns
`state: converged | incomplete`; successful execution and a non-partial finish are
required for convergence. A permitted availability classification can be fulfilled
with explicit unread-body limits. Required full-body reading remains unfinished.
An access failure establishes neither source content nor its unobserved cause.

Saving and reuse share path and reviewed-byte verification. A fitting record can
return unchanged with its canonical path and Git revision, without new history or
a commit. Changed questions/evidence update the record and preserve earlier entries.
Code records the current assignment and fulfillment alongside source-access evidence.
Partial/failed execution preserves its new gap instead of reusing an older record.

Archive validation failure and an unusable draft skip publication and retain
candidate evidence. A read-only assessment cannot introduce unreviewed candidate
changes into publication. Returned invalid model output after an access failure
can preserve only a deterministic access receipt; it cannot create a substantive
or fulfilled assessment. Publication failure retains accepted work through the
existing recovery path, without claiming a canonical saved output.

Standalone no-save execution needs no Task reconciliation or publication workspace.
Hosted execution uses its authoritative reconciliation assignment, including when
that assignment is malformed; procedure input cannot replace it. Creator closure
and caller delivery remain the existing owner's responsibility.

## Verification

The final code revision passed 90 tests and 478 assertions across source assessment,
owner reconciliation, knowledge publication and accepted publication in 14.91 seconds:

```sh
PYTHONPATH=/home/hao/workspace-archive/xhs-owner-follow-through-20261112/test-python \
  bun test --timeout 15000 \
  ./projects/scout-knowledge-lib.app/agents/scout/workflows/scout-assess-source.test.ts \
  ./projects/scout-knowledge-lib.app/agents/scout/workflows/knowledge-planner.test.ts \
  ./projects/scout-knowledge-lib.app/agents/scout/workflows/lib/knowledge-publication.test.ts \
  ./projects/scout-knowledge-lib.app/agents/scout/workflows/lib/accepted-publication.test.ts
```

The source suite covers identical observed login evidence with classification,
non-English acceptance, required body reading and explicit no-save assignments.
These use controlled agent drafts; they verify orchestration and guards, not live
model interpretation. A disposable HTTP server exercises an actual HTTP 403 through
the production retriever and the same judgment/publication pipeline. Existing real
PDF, HTML, plain-text, redirect and reference extraction tests remain.

Read-back checks verify exact canonical file bytes against Git. Reuse checks retain
the same bytes, one source record and the same HEAD; missing records, symlinks,
concurrent bytes and unrelated candidate edits cannot claim publication. Other
cases retain changed-question history, partial/failed drafts, cancellation and
publication-recovery ownership.

An earlier final-code run using Bun's default five-second timeout passed 89 tests;
the existing rollback fault-injection test exceeded that limit at 6.85 seconds.
It launches subprocesses for Git operations. No restoration assertion failed.
The recorded rerun allowed 15 seconds per test, preserved all assertions, and that
test passed in 2.31 seconds. The default-timeout failure log is retained.

The repository's normal typecheck excludes Scout workflows. An explicit temporary
config extends `/app/tsconfig.json`, includes both changed workflow and test files,
and supplies Node/Bun types from `/app/node_modules/@types`. That check passed and
the test context now supplies the current SDK's required Task, waits and event
observations. Formatting, scoped whitespace checks and canonical App integrity
also passed. The source suite clones results before `toMatchObject` because Bun
1.3.14 mutates matched properties; later assertions inspect the original result.

Logs and the explicit typecheck config are retained under
`/home/hao/workspace-archive/scout-assessment-judgment-20261112/`. PDF test packages
were provisioned outside the live Python environment. All publication fixtures
used disposable repositories; no live Tasks or App definitions were changed.

## Activation and live observation

The user requested the next step after local commit
`b1714639c2317b681ac0b150b58107c8c8be14ed`. Disposable source preflight loaded
all three configured Apps and compared their manifests with the active release;
all manifests matched. The only executable source differences were the Scout
assessment workflow and archive helper, alongside Scout's updated instructions.
Uncommitted shared-workspace changes were excluded from the immutable release.

The canonical `runtime.reload.requested` event `6710861` succeeded through
operation `6710862`. The active source is
`b1714639c2317b681ac0b150b58107c8c8be14ed-definitions-v5`; installed hashes for
both changed implementation files and Scout instructions match preflight.
Daemon PID 100753 and startup identity `2026-11-12T14:19:51.632Z` remained
unchanged during this reload and observation.

Five samples from 14:36:29 to 14:38:49 UTC recorded zero SQL errors and no
handler/subscriber failures. Scout had 14 idle Tasks, no pending source-assessment
Task, and no new attempt or input during that natural-work window. This proves
activation health; that window did not exercise assessment judgment. The six
previously closed XHS children remained closed, and all nine original saved
answers matched the retained earlier answers byte for byte.

A separately scoped representative request then exercised the real no-save
source workflow through canonical App admission, using the public LangGraph
README at `https://raw.githubusercontent.com/langchain-ai/langgraph/main/README.md`.
It was a real source request with no injected source/model response, linked
material, child Tasks or library edits. Input event `6710874` admitted original
caller receipt `app_fba9f29c-bc2e-4c04-81b4-2386b5485d00` and its one root Task.

Accepted generation-1 attempt `r_1_6dd0c26a-4ea5-44cd-94b7-4fc4a12c5810`
ran from 14:41:28.896 to 14:41:41.857 UTC. Scout identified durable execution,
human intervention, memory and tracing as producer claims, connected them to
business workflow/Host management, and explicitly left implementation guarantees
and linked documentation unknown. Code recorded 6,351 supplied characters and
source-byte revision
`3a13e257af1216962d53d72414a7f44ac1fc5cea34d994bdff60ea2a3b045933`.
The original caller receipt became done with the substantive authored response
and `archive:disabled-by-assignment`. No provider delivery was requested or claimed.
The library and Git HEAD remained unchanged. After reading the accepted result
and saved caller answer, guarded operator closure of this directly initiated
finite root validation Task succeeded through event `6710887`. This operation
did not close any delegated child or revive earlier work.

A second real no-save request classified accessibility and supplied coverage for
`https://arxiv.org/pdf/2508.10874`. Input event `6710891` admitted caller receipt
`app_ffd93b4b-edbb-4328-a379-39c5e3c33e80`. Accepted attempt
`r_1_0994fda7-960b-4c14-9fd2-506048a425e3` ran from 14:44:17.142 to
14:44:30.172 UTC. The production extractor succeeded: 124,710 characters across
39 PDF pages were extracted, and 60,000 characters from 20 pages were supplied.
The recorded source-byte hash is
`d5d232d8d9be65073323618a3350ff7d33d54f8a78f172e0ec02e7e0fc8ab4c5`.

Scout returned converged for the fulfilled availability classification while
explicitly distinguishing retrieval, extraction, supplied coverage and full-paper
reading. It did not claim substantive paper analysis, full reading or proof
verification. The caller receipt became done with its authored response. Guarded
closure of this second directly initiated finite root validation Task succeeded
through event `6710904`, using its exact accepted attempt and current resource
version. The library and Git HEAD remained unchanged.

The production PDF result resolves the environment uncertainty: the operator
shell lacks `pypdf`, while the Host's separate environment successfully extracted
the actual PDF. No package installation was needed or performed. The final sample
at 14:45:30 UTC recorded two completed, converged validation attempts, their two
done caller receipts, zero SQL or handler/subscriber errors, no pending assessment
Task, and the original 14 idle Scout Tasks. Both finite validation Tasks are
closed; the test did not leave additional open work.

Activation, sampled status, exact receipts, caller results, source facts, closure
and preservation comparisons are retained under
`/home/hao/workspace-archive/scout-assessment-activation-20261112/`.
Operations followed the [control-plane-operation skill](../../../../shared/skills/control-plane-operation/SKILL.md).

## Archived publication, reuse and access failure

The next live checks used the same activated Scout code. GitHub's public commit
API pinned LangGraph `main` to
`b4cb0f19e3d8984e8a57f85667b8d1bec018f0ab`; the archive and reuse requests used
the identical assignment and immutable README URL. No source or model response
was substituted. The failure case deliberately requested an absent document path
at that same public revision and observed the actual raw endpoint's HTTP 404;
it was a bounded availability probe, not a substantive research assessment.

| Case                    | Input event | Accepted attempt                           | Guarded closure event |
| ----------------------- | ----------- | ------------------------------------------ | --------------------- |
| Archive                 | `6710912`   | `r_1_947c658b-1e04-4d84-b8f3-294a49013c0d` | `6710926`             |
| Reuse                   | `6710928`   | `r_1_02fbb7e1-1b22-41d0-98fc-8778e26e18aa` | `6710939`             |
| HTTP 404 classification | `6710941`   | `r_1_0c3a7a52-aa5d-4b41-b95c-fcacf9a45174` | `6710952`             |

The archive request completed in about 22 seconds. Its original caller receipt
`app_63da69f3-04d5-43ad-852b-69fa583b9e2f` became done with the substantive
assessment, canonical path and verified revision. The publisher committed only
[the source assessment](../../../scout-knowledge-lib/knowledge/findings/2026-11-12-source-assessment-769d2445131e.md)
in `7c8d43f759a73e12a618b7f28417c5688868216e`; canonical file bytes exactly
matched `git show` at that revision. The record preserves the pinned identity,
assignment, supplied coverage, attributed source claims and explicit limits.

The identical revisit completed in about 12 seconds. Scout chose reuse, and
caller receipt `app_9a608ce5-91da-44f3-be11-27cf7dae5f15` became done with
`publication:no-change` and
`publication-head:7c8d43f759a73e12a618b7f28417c5688868216e`.
The verified canonical path, exact bytes, one assessment entry, one source record
and Git HEAD were unchanged. The record's SHA-256 remained
`4fc8a77dc0a8cd3186071db1532e0d9e1e8d6832ee8dc4d198e9cf9277d91d4a`.
Reuse avoided an unnecessary archive update and commit; it still used one bounded
Scout call to judge fit against the current request and source observation.

The absent-document request completed in about 11 seconds. The workflow recorded
`source-access-failure:Source retrieval returned HTTP 404` and supplied no source
text. Scout returned converged against the explicitly permitted availability
branch, stated that no document content was read, and left authentication,
deletion and other unobserved causes unknown. It described successful exact-source
retrieval or an owner's revised assignment as the paths to substantive assessment.
Caller receipt `app_7fac387f-db40-4e95-a21d-e084dc97eb33` became done with that
authored answer. This no-save case produced no note or commit.

All three directly initiated finite root validation Tasks were closed only after
reading their accepted converged results, original saved caller answers and exact
source/publication evidence. Each closure used the current generation/resource
version and accepted attempt. No delegated child was operator-closed. At 14:53:12
UTC, Scout had returned to the original 14 idle Tasks with no pending, running,
waiting or attention work. There were no new handler/subscriber failures or SQL
errors; daemon PID 100753 was unchanged. All nine earlier answers still matched
the retained prior answers byte for byte. The active App source stayed at
`b1714639c2317b681ac0b150b58107c8c8be14ed-definitions-v5`; publication and later
documentation commits do not themselves activate a new App source.

Exact admission, result, file/Git comparison and closure evidence is retained in
`/home/hao/workspace-archive/scout-assessment-publication-20261112/`.
No implementation changes were required by these live checks.

## Remaining observation

Five real hosted requests now demonstrate source retrieval/extraction, bounded
semantic judgment, archived publication, unchanged-record reuse, access-failure
classification and saved caller follow-through. The subsequent
[creator follow-through check](scout-owner-publication-follow-through-20261113.md)
demonstrated that the exact standing creators consumed and closed two real
published recovery children using existing accepted results. That check used
routed reminders; discovery and closure during ordinary wakes remain unproven.
These examples do not establish broad model accuracy. A required-reading
incomplete outcome still needs a suitable live case; its guards remain covered
by the local regressions.
