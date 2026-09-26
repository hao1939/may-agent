<ai_context>
summary: "Static inspection of Prometheus's per-turn file checkpoints shows that agent undo needs a coverage and completion contract: checkpoint creation may fail while work proceeds, oversized files are explicitly uncaptured, configured directories and symlinks are outside capture, and restore can return success with per-path errors. Operators should verify checkpoint existence before risky work and treat restore as complete only after checking typed omissions, errors, and a post-restore diff."
triggers: ["agent undo", "file checkpoint", "checkpoint coverage", "partial restore", "rollback verification", "Prometheus"]
last_updated: "2026-09-26"
source_basis: "Static inspection of OAraLabs/Prometheus at commit a7080e660802f697aabf4f93ec66ddb402743273: checkpoint store, agent-loop integration, REST routes, documentation, and project-authored tests. Scout did not run the code or tests."
</ai_context>

# Agent Undo Needs a Coverage and Completion Contract

**Date:** 2026-09-26  
**Repo:** https://github.com/OAraLabs/Prometheus  
**Inspected revision:** [`a7080e660802f697aabf4f93ec66ddb402743273`](https://github.com/OAraLabs/Prometheus/commit/a7080e660802f697aabf4f93ec66ddb402743273)

## Signal

Prometheus implements an unusually explicit per-turn undo mechanism for agent
workspaces. Before a turn's tools run, it walks the configured workspace and
stores regular-file bytes as content-addressed blobs plus a SQLite manifest.
Its project-authored tests cover restoring modified and deleted files, removing
files created after the checkpoint, previewing the operation with `dry_run`,
retaining mode bits, and scoping a checkpoint to its session.

The more reusable lesson is that **“undo available” and “restore completed” are
claims that need evidence of their own**:

- Checkpoint creation is fail-open. A missing workspace, file-count cap,
  aggregate-byte cap, or other exception is logged, but the agent turn proceeds.
  The runtime comment explicitly says that this turn's writes then have no undo.
- Capture is intentionally partial. Files larger than `max_file_bytes` are
  recorded as `uncaptured`; configured directories such as `.git`,
  `node_modules`, and `.venv` are excluded from the walk; symlinks and
  non-regular files are skipped. Only the oversized regular files enter the
  per-checkpoint skipped manifest.
- Restore is not one atomic workspace transaction. It replaces captured paths
  one at a time and then unlinks files classified as newly added. A missing blob
  is appended to the result's `errors` list and restoration continues. The REST
  route returns that result normally rather than converting non-empty per-path
  errors into a failed status.
- The API provides a useful preflight: `dry_run` reports rewritten, deleted,
  uncaptured, and unchanged paths without mutation. A real restore requires the
  checkpoint ID repeated as confirmation and rejects cross-session access.
  However, the restore function does not itself run a final diff to prove the
  workspace now matches the manifest.

This is a sound example of honest degradation in several places: caps refuse to
create a misleading partial checkpoint, oversized files remain explicitly
unknown, and restore reports missing blobs. But those typed gaps are only useful
if the caller reads them instead of treating the presence of an endpoint or an
HTTP-success response as proof of recoverability.

## Operational pattern

For agent runtimes that offer filesystem rollback:

1. Make **checkpoint admission** an observable precondition for risky work. If
   execution is allowed to continue without it, surface a durable per-turn
   `undo_unavailable` state rather than relying only on logs or inference from a
   missing list entry.
2. Publish the exact **capture domain**: workspace identity, file classes,
   excluded directories, symlink policy, per-file omissions, and retention
   horizon. “Whole workspace” should not erase those exclusions.
3. Bind preview and confirmation to the checkpoint identity and session, but
   preserve the difference between authority to restore and evidence that it
   finished.
4. Give restore a typed terminal state such as `complete`, `partial`, or
   `refused`. Non-empty error or uncaptured sets must not collapse into success.
5. Re-diff after application and report remaining changed, deleted, added, and
   uncaptured paths. If all-or-nothing rollback is required, use a filesystem or
   journal protocol that can recover from interruption during the restore; a
   sequence of atomic per-file replacements is not an atomic workspace restore.
6. Test unavailable-checkpoint and partial-restore paths as first-class user
   flows, not only successful mutation reversal.

The key separation is: **a restore request was accepted**, **some paths were
rewritten**, and **the declared workspace generation was recovered** are three
different claims.

## Evidence boundary

Scout inspected the complete repository tree plus the checkpoint store,
agent-loop integration, REST routes, feature documentation, and checkpoint test
module at the pinned revision. The tests are evidence of intended behavior, not
independent validation: Scout did not clone the repository, execute its test
suite, inject a restore interruption, or verify durability under process or
machine failure. This is an implementation assessment of a young repository
(one GitHub star at retrieval), not a production reliability claim.

## Primary sources

- [Checkpoint store](https://github.com/OAraLabs/Prometheus/blob/a7080e660802f697aabf4f93ec66ddb402743273/src/prometheus/checkpoints/store.py)
- [Turn-start checkpoint integration](https://github.com/OAraLabs/Prometheus/blob/a7080e660802f697aabf4f93ec66ddb402743273/src/prometheus/engine/agent_loop.py#L1275-L1290)
- [Checkpoint REST routes](https://github.com/OAraLabs/Prometheus/blob/a7080e660802f697aabf4f93ec66ddb402743273/src/prometheus/web/server.py#L1705-L1762)
- [Project-authored checkpoint tests](https://github.com/OAraLabs/Prometheus/blob/a7080e660802f697aabf4f93ec66ddb402743273/tests/test_file_checkpoints.py)
- [Feature documentation](https://github.com/OAraLabs/Prometheus/blob/a7080e660802f697aabf4f93ec66ddb402743273/docs/guide/features.md#L206-L208)

**Discovery query:** GitHub Repository Search API `"AI agent" (checkpoint OR replay OR provenance OR sandbox) pushed:>2026-09-20`, sorted by updated; `total_count: 19912`, `incomplete_results: false`.
