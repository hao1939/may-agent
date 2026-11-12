# Scout source-assessment judgment and reuse

The focused change makes request fulfillment Scout's judgment and leaves source
identity, supplied coverage, archive integrity and publication to code. It removes
the XHS login exception and acceptance/prose phrase matching. The source change
has not been activated in the running Host.

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

## Remaining observation

After a separately authorized activation, observe a natural requested assessment:
the successful or incomplete judgment, retained coverage, canonical publication
read-back, caller delivery, and exact creator acceptance/closure. A fitting revisit
should return a verified unchanged record. Controlled tests do not establish that
Scout will make the right semantic decision in a live run.
