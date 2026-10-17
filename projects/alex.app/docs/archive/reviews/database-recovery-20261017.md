# Database startup and recovery — October 17, 2026

**Status:** defect reproduced on merged Host `980f2cda3`; focused correction in
[Host #379](https://github.com/hao1939/may-agent/pull/379), source `e9339abe4`, is
under review. Verification is recorded below. The recovery correction is not deployed.

**Supports:** [dependable continuation](../../1-principles/purpose.md) through
preserved accepted work. The [storage contract](../../2a-design/storage.md#opening-a-database-is-not-permission-to-roll-work-back)
owns the rule. [Safe retry](../../1-principles/core-principles.md#safe-retry-by-default-explicit-exceptions)
means retrying an open without selecting older history; the Host records and
executes recovery while the authorized owner decides whether rollback is useful.

## Reproduced defect

Disposable databases exercise the production `getDb` path. One database contains
a newer session, an older backup contains a different session, and a second
connection holds an exclusive lock. Startup fails, but the main file bytes have
already been replaced by the backup. The old code catches every catalog-read
failure, assumes restoration is needed and copies over the existing file.

A second trial starts with an existing empty database and an older backup.
Opening it imports the old session. Neither case establishes authorization to
replace current state. These are isolated reproductions, not evidence of loss
in the running installation.

A damaged catalog-page trial likewise replaces the damaged main file with a
readable backup. All three authority regressions fail against merged `980f2cda3`
and pass with the correction. The original corrupt bytes must remain available
for a recovery decision; readability of a backup is not permission to select it.

## Smallest correction

Existing databases are opened without backup replacement. Temporary startup
contention uses the existing bounded retry. Failure closes the uncached
connection and leaves evidence available for explicit recovery. WAL setup joins
schema initialization within that same retry allowance: concurrent openers
otherwise fail before reaching the existing retry helper.

Absent-database bootstrap remains supported. Stage the backup on the same
filesystem, then publish it with a hard link that cannot replace an existing
file. This avoids exposing an incomplete copy or overwriting another opener.
Recovery sidecars require explicit interpretation. This is no new Task state,
recovery service, migration framework or App-specific policy.

Checks cover a locked database and retry after release, an empty existing
database, a damaged catalog, retained WAL work, orphaned recovery files, backup
sidecars, concurrent Host processes and worker/schema settings. Initial source
`13652b61c` verification:

- 25 focused storage/schema/retry checks passed.
- Full `bun run ci`: 3,811 passed, three installation-only skips, zero failures;
  340 files. Host/SDK type checks, canonical boundary and lint passed.
- Apps design integrity, examples and canonical App checks passed; the existing
  unclassified `reports` directory warning remains.

Reproduce the focused checks with `bun test src/lib/db/connection.test.ts
src/lib/db/schema.test.ts src/lib/db/busy-retry.test.ts`. Fixtures use real
temporary files, locks and child processes. This does not simulate power loss,
certify arbitrary backup contents or exercise an actual production restoration.
Changing recovery point remains explicit maintenance with original evidence kept.

## Review corrections

Review of #379 found two more violations of the same ownership contract.
A maintenance/schema-only opener could create an empty main file, fail its schema
check, and prevent the later Host from bootstrapping the retained backup. It now
rejects a missing database before opening it. A maintenance-first regression
checks that no file is created and the Host subsequently restores the saved work.

Both bootstrap checks could observe no main file, then observe a concurrent
opener's WAL and incorrectly report orphaned recovery files. One shared check now
rereads main-file existence after detecting sidecars. Controlled interleavings
at both checks use real SQLite databases and prove the other opener's committed
work survives. A separate staged-copy trial proves genuinely orphaned recovery
files still prevent bootstrap and that temporary staging is cleaned up.

The maintenance-first case, both concurrent-opener interleavings, and a stronger
worker file-preservation assertion fail against the original PR head `13652b61c`.
At revised source `e9339abe4`, connection, schema, retry and worker checks pass:
34 tests. Full `bun run ci` passes with 3,815 tests passed, three installation-only
skips and zero failures across 340 files. Host/SDK types, canonical boundary and
lint pass. Apps design integrity, examples and canonical App checks also pass,
with the existing unclassified `reports` directory warning.

These changes retain the same bootstrap and retry mechanisms; no migration or
new recovery policy is introduced. Verification uses disposable databases, not
the live installation.

## Separate #378 rollout

User-authorized deployment installed merged Host
`980f2cda391d36d2a6d10927f81ed02c6bf6b66e`. Receipt
`host-inbox-backfill-980f2cda-20261017.json` settled successfully at
`2026-10-17T06:49:16.416Z`; requested and loaded artifact hashes both equal
`3e77f8c40d759f7dd37e1c0f6a77382b21360a894fd684eae307088a4c085b64`.
Health was healthy and `duplicateDeploy` false. Binary version, matching SDK/UI,
three supervisor services and control readiness were checked. Ordinary Alex,
May and evaluator executions were active after restart.

#378's two GitHub checks passed. The 13 focused schema/connection checks and
deployment's 68 control checks passed. All three enabled App definitions loaded
against the SDK. The optional installed-agent test failed because its static
fake model catalog omits the installation's `gpt-6-astra` model; this is not a
passed deployment test. SDK and App loading are unchanged by #378.

The first diagnostic snapshot had 4,268 SQL calls, zero errors and an 84.8 ms
maximum. The first natural metric collection ran 17 queries with zero failures,
260.5 ms total and a 92.8 ms maximum. This meets the under-100-ms target for that
pass. It does not isolate #378's effect, prove sustained performance, or establish
that Alex repaired the earlier slow query. No synthetic live sample or Task was
created. Query policy and optimization remain App-owned.

The prior review of alert 4989 is now `done`: Alex's evaluator accepted the next
85.2 ms sample as recovery and selected no immediate intervention. Its retained
report establishes completed review and that decision, not a query repair or a
root cause for historical multi-second observations. The older history in the
[metric-query trial](metric-query-cost-20261017.md) remains relevant to recurrence.
