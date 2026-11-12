# Creator-owned Task discovery

This refinement supports the [workload model](../../proposals/agent-task-workload-model.md):
returned work remains visible to the creator until that creator decides its
disposition. Task grouping, execution ownership, funding and closure authority
retain their existing meanings.

The candidate Host implementation is [PR #472](https://github.com/hao1939/may-agent/pull/472),
revision `13c4a66b4b53820da52ec61701e7cdeb1921588b`, based on
`c5b9b9a70f`. Scout's companion guidance and ordinary-wake diagnosis are
committed on Apps local main as `332b6ba72d`. Neither source is a live activation.

## Demonstrated gap

The [Scout follow-through verification](../../../../scout-knowledge-lib.app/docs/verification/scout-owner-publication-follow-through-20261113.md)
proved that exact creators could verify and close two already published finite
contributions. Ordinary source wakes had not done so. Comparing the exact native
prompts found empty structural child lists and empty open-wait lists, although
the publication Tasks named those source Tasks as creators. The publications
were grouped under `library-operations`, so a query by structural parent did
not describe creator-owned work. Explicit reminders supplied the missing
identities. This does not prove what earlier dependency-return attempts saw.

The standing Scout instructions also lacked the planner's explicit procedure
for consuming finite results and performing guarded creator closure. They
described useful research and preservation of publication obligations; discovery
and follow-through need a clear path for the native executor too.

## Smallest implementation

The Host reads immutable creator identity across Apps and supplies an eight-item
`createdTasks` starting page to every Task attempt. `read.tasks.created` and the
model `tasks` action `created` share that same query, with bounded pagination.
The caller cannot choose another creator. Items retain destination App and Task
identities, current status, generation/version, short previews and an accepted
attempt reference when available. Closed/cancelled work and current retired
completion receipts are excluded. Old accepted results with newer pending input
remain visible as pending, rather than being presented as ready for closure.

The read uses an index on valid creator records and performs no lifecycle write.
It creates no queue, wake, consumed flag or budget rule. The structural child
view remains independent. Existing input, dependency and review wakes still
drive execution. Missing support on older Hosts is unavailable, not an empty
list. The starting page retains its time; later pages are fresh observations,
not a fleet-wide snapshot. Exact known dependency links remain useful when
attribution or discovery is unavailable.

The same starting page survives native/workflow adapter context, the model's
per-call decision brief and the attempt's saved context file. Larger pages keep
their continuation and detail pointers; preview omission is not evidence of no
outstanding work.

Scout's native business guidance reviews returned finite work before new
discretionary expansion. It reads the original requirements, accepted result,
caller route, publication and independent obligations. Fulfilled assignments
can close through the existing creator control after a fresh exact read.
Unfulfilled work remains owned and visible; a genuine external wait can coexist
with useful research. This uses the same ordinary wake and does not add a
separate model call just for closure.

## Verification and activation gate

The focused portable checks passed 43 tests. An existing hosted workflow test now
discovers its finite contribution without a named child in workflow code, reads
it, closes through the normal creator capability, and observes it removed from
discovery. The same test against unchanged Host `c5b9b9a70f` fails with the child
still idle. Separate owning cases cover cross-App duplicate Task IDs, different
grouping parents, pagination, creator-bound cursors, pending corrections,
unchanged read state, current-session model-tool wiring, readonly access and
visible capability absence. Existing closure race/authority tests remain.

The first full portable run caught two integration gaps: the SDK export snapshot
needed the two new public types, and an unconditional JSON expression index
prevented the existing damaged-row diagnostic fixture. The snapshot was updated;
the creator index now covers valid JSON only, preserving the original diagnostic
test. Both owning checks passed afterward. The final complete
`MAY_TEST_SHARDS=4 bun run ci` passed 4,043 tests and 23,689 assertions, with
zero failures. Three existing optional installation tests were skipped;
browser tests executed and passed. The longest test shard took 225.76 seconds.
Host and SDK type checks, App-boundary checks, lint, scoped formatting and
whitespace checks passed. The final query plan uses the partial creator index
with an App/Task continuation seek and primary-key evidence/terminal lookups.
The initial failed run and final passing run are both retained. GitHub Quality,
Container and independent review remain separate PR gates.

Host review, release and separate App activation precede the live acceptance
check. An ordinary wake must discover and dispose real finite work without the
operator supplying exact child identities. Standing assignments, independent
waits, publication bytes, caller results and capacity reservations must remain
correct. The already closed publications must not be reopened or replaced to
manufacture that demonstration. Reduced idle buildup and autonomous semantic
judgment remain unproven until that observation.

Local candidate and verification evidence are retained under
`/home/hao/workspace-worktrees/may-creator-task-discovery-20261113/` and
`/home/hao/workspace-archive/may-creator-task-discovery-20261113/`.
