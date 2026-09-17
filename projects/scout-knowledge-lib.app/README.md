# Scout Knowledge Library App

The current App requires Host v3.0.0: mode-free Tasks, `facts` in Task and
execution results, and explicit typed dependencies for delegated results.
Source adapters keep their own evidence payloads. Workflow publication uses
the exact wake identity, so new research cycles can publish while retries of
the same input retain their keys. Task parent links alone do not return work.

This Agent App adds schedules, observation, durable task reconciliation, and
delivery to the independently runnable Scout knowledge-library project in
[`../scout-knowledge-lib`](../scout-knowledge-lib).

## Current contract

- [`app.ts`](app.ts) is the only App declaration.
- [`design/scout-knowledge-library-process.md`](design/scout-knowledge-library-process.md)
  owns Scout's current operating model.
- [`design/scout-knowledge-library-layout.md`](design/scout-knowledge-library-layout.md)
  owns the current durable library layout.
- [`tasks/README.md`](tasks/README.md) explains the task resources, supported
  live reads, and the boundary with retained historical JSON files.
- [`docs/herdr-supervisor.md`](docs/herdr-supervisor.md) explains which Scout
  responsibilities fit Herdr goals, how to run them, and how to recover them.
- [`docs/protected-knowledge-edit-pilot.md`](docs/protected-knowledge-edit-pilot.md)
  defines immutable published paths and the bounded protected-edit pilot gap.
- [`herdr/goals/library-health-pilot.goal.json`](herdr/goals/library-health-pilot.goal.json)
  is a safe, portable first contract for validating the supervised workflow.
- [`design/archive/`](design/archive/) retains completed proposals and rollout
  evidence; those files are not current instructions or deployment targets.
- [`archive/agents/`](archive/agents/) preserves the retired Amy and Amy-Kimi
  agents and their historical research. The Host does not load agents from the
  archive; `agents/scout/` is the only active agent in this App.

The Host owns persistence, scheduling, attempts, recovery, and delivery. Scout
owns research judgment and library meaning. Historical runtime commits,
worktrees, rollout commands, and incident snapshots are evidence only.

Credentials belong in ignored runtime state or the external credential source,
never in the tracked agent or knowledge archive.

## Development

```bash
cd /app/projects/scout-knowledge-lib.app
bun run check
```

The deterministic library observer also has a read-only inspection command:

```bash
bun scripts/library-health-readonly.ts
```

Run it from an isolated worktree when using it as Herdr completion evidence.

The allocation-design isolation fixture is offline and authorizes no provider
calls:

```bash
bun scripts/verification-allocation-factorial.ts
```

It verifies a synthetic 64-episode toy schedule. Passing it is design-tooling
evidence, not a model result or proof of a cryptographic lineage authority.

The execution-freeze validator binds a proposed schedule to immutable model
resolution declarations, a Scout-specific seed policy, exact artifact hashes,
and completed external-registration metadata while keeping results empty and
provider authority false:

```bash
bun test scripts/verification-allocation-freeze.test.ts
```

Use `verifyExecutionFreezeManifest` from
[`scripts/verification-allocation-freeze.ts`](scripts/verification-allocation-freeze.ts)
with the unknown manifest value and the exact supplied artifact bytes. The
validator also runs the factorial isolation verifier over the bound schedule.
It is an offline structural and byte-binding gate: it does not contact a
provider, verify that an external URL or timestamp is genuine, authenticate
lineage, or grant call or spending authority.

For an explicit goal-owned directory, use `verifyExecutionFreezeBundle` from
[`scripts/verification-allocation-freeze-bundle.ts`](scripts/verification-allocation-freeze-bundle.ts).
It reads the fixed `freeze-manifest.json`, inventories the directory, and
rejects relative roots, traversal-shaped artifact names, symlinks, non-regular
entries, and undeclared files before invoking the same offline gate. Regular
files are opened through no-follow descriptors, so replacing an inventoried
file with a final-component symlink cannot redirect the subsequent read. On
the Linux Scout runtime, the root directory remains pinned and recursive
children are opened relative to its `/proc/self/fd` descriptor chain, so an
intermediate directory replacement also fails closed. A runtime without that
descriptor filesystem cannot validate a directory bundle. Directory
validation does not authenticate provenance or authorize provider calls.
