# Task authoring cleanup — 2026-11-12

**Supports:** [Simple first](../../1-principles/core-principles.md#simple-first).
Reduces the number of ways App authors express the same work, while preserving
accepted work and historical evidence.

**Status:** Source integration is complete. Host/SDK removal merged in
[PR #454](https://github.com/hao1939/may-agent/pull/454) as
`c5c163aafcc16c148c75119d5f9b39dab8c65707` on November 11, 2026 (UTC;
November 12 in Shanghai). Companion App source is committed on Apps `main` as
`f6ceb06366d279d9be2e0384228f598e3f7ba21a`. Neither merge establishes runtime
activation. Installed schemas remain the authority for an older installation.
Use the [source upgrade guide](../../2b-manual/app-operations-recovery.md#update-app-source-for-the-current-task-contract)
for adoption; verification results and remaining limits are below.

The first cleanup slice removes the old `dependencies` result form,
`TaskAppDependency`, `taskOwnerResultSchema`, public `TaskIntent.owner`, Condition
and observer-interest `reviewAfterMs`, and the Host's `src/lib/requests.ts` database
re-export facade. This deliberately does not remove experiments, evaluation,
workload budgets, ordinary workflow guards or event graph tools.

Use `requests` to commission work, and add an explicit request Condition when an
answer is needed. Migrated legacy callers specify `progress: "immediate"` to keep
their earlier report behavior. Use `agent` for Task assignment and Task `reviewAt`
only for a useful owner reconsideration. Database callers import the owning module.
The SDK rejects retired authoring rather than silently ignoring it. Evaluation
also stops deriving review deadlines from inert Condition intervals and uses the
existing Task/input-wait obligation ledger. Reports already written retain their
original assessment identity and evidence.

Stored Task IDs, admission and specification hash encoding, assignments, existing
Conditions, selected progress reports, accepted results and restart behavior stay
stable. Historical Condition intervals remain inert; redeclaring the supported
specification does not manufacture another observation. Recovery can repeat an
interrupted bounded attempt under the existing policy; this cleanup introduces no
new recovery or execution lifecycle and performs no live-state migration.

The tradeoff is source compatibility: old App definitions and saved model outputs
replayed as new authoring must be updated. Historical results remain evidence;
they are not passed through a new compatibility adapter. A meaningful future
review must be chosen explicitly, rather than inferred from a removed interval.

## Integration and verification

Host source: `9881d757af3071fea1e80c3a77235457aefb773d`, based on
`e9e88da22f9e0ecbbe2bde49030f589f9eeb5806`.
Apps base: `7d0ef4fe62`.
Branches: `refactor/retire-task-compat-20261112` and
`refactor/retire-task-compat-apps-20261112`.

The companion App callers integrated first: their `agent`, `requests`, explicit
Conditions and omitted intervals are supported by the Host base. The Host/SDK
removal is now merged; its tree matches the verified candidate above. Release
and activation of the matching SDK/App definitions remain separate work through
the ordinary release path. No deployment or restart is part of this change.

Measured diff: 194 fewer implementation lines across Host and Apps, or 418 fewer
lines including tests and fixtures. Documentation is counted separately; most
changed files only replace database imports. This is a smaller supported surface,
not measured runtime or token savings.

Verification:

- GitHub **Quality** and **Container** passed on PR #454's final candidate,
  confirmed after merge. These are source/image checks, not installed-App proof.
- Full Host `bun run ci` passed with four test shards and Chrome enabled:
  4,158 passed, 3 installation-only fleet checks skipped. Types, SDK exports,
  architectural checks and lint passed.
- Companion App checks: 246 passed, one pre-existing Scout correction-during-attempt
  skip across twelve files.
  PDF extraction used an isolated Python environment providing `pypdf`.
- `bun run check:may-design` passed; its existing unclassified `reports` directory
  warning remains. Both source diffs pass `git diff --check`.
- The synthetic GitHub observer composition trial passed, including independent
  waits, lost publication, restart deduplication and exact failure return.
- The older improvement-approval composition trial did not pass. It lacks the
  current Conversation-App option. A diagnostic run with current Conversation
  approval wiring then exposed the App verifier's old `provenance` expectation
  versus Host trusted approval evidence. Its transport migration and verification
  belong in a separate fix; this cleanup neither changes nor bypasses that gate.
  The scoped activation-follow-up workflow tests pass, but do not establish this
  complete activation path.

All executions use temporary databases and synthetic work; no live state was
changed, no services restarted and no real model calls or GitHub provider operations performed.
These checks establish no live adoption or model-quality improvement.

Post-merge documentation alignment (November 12): the App, SDK and attempt
contracts now reject the retired forms consistently; the source upgrade guide,
proposal dispositions and navigation reflect completed source integration.
`bun run check:may-design` passed against the merged source tree, including
executable App examples, with the existing unclassified `reports` warning.
`git diff --check` passed. This documentation pass does not resolve or reclassify
the separate approval-composition failure above. Its later source fix and
synthetic verification are recorded in the
[approval-contract cleanup](improvement-approval-contract-cleanup-20261112.md).

Shared-workspace verification additionally passed documentation integrity and
executable examples. Its full gate stops at two ignored, disabled symlinks for
retired `evaluation.app` and `gym.app` runtime artifacts without `app.ts`; the
standalone source checkout has neither entry and passes the full gate. The
shared-workspace model-surface check also passes. No runtime artifacts were
changed to make the check pass.
