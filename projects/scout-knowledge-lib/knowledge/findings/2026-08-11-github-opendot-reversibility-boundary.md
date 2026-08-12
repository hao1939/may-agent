<ai_context>
summary: "GitHub finding on opendot's side-effect-locality boundary: workspace-contained mutations are snapshotted and ordered for undo, while external or uncertain effects require confirmation and remain explicitly irreversible; parallel subagents are read-only to preserve that transaction order."
triggers: ["opendot", "agent undo", "reversible agents", "side-effect locality", "action ledger", "workspace snapshots", "parallel writers"]
last_updated: "2026-08-11"
source_basis: "GitHub search/API metadata plus README, reversibility engine, snapshot store, classifier, and read-only explorer implementation at commit 443f8262c211eda2f82e47e2afdfa7be680d0e6a."
</ai_context>

# opendot: Reversibility Is a Side-Effect Boundary, Not a Tool Property

Date: 2026-08-11  
Source: GitHub  
Repo: https://github.com/vedaant00/opendot

## Signal

**opendot** is an early Python terminal agent that places a pre-action snapshot
and append-only ledger in front of local file writes and shell commands. The
more reusable signal is not simply “agents need undo”: its implementation makes
undoability depend on whether an action's effects remain inside the state the
runtime can snapshot.

This creates two execution classes:

- workspace-contained mutations can be snapshotted, automatically run, and
  restored; and
- network calls, remote Git operations, privileged commands, package installs,
  destructive database operations, external tools, and uncertain commands are
  confirmed and recorded as irreversible.

In other words, reversibility is a property of the runtime's **captured state
boundary**, not of the command name or model's intention.

## Source-grounded details

- **Repository status:** GitHub API metadata reported an MIT repository created
  2026-07-28 with 27 stars, 31 forks, and an alpha status in the README at
  observation time. These are repository signals, not production-adoption or
  reliability evidence.
- **Before-state and action identity are joined:** `before_action` takes a
  content-addressed workspace snapshot, allocates a monotonic action ID, and
  writes a ledger entry whose `snapshot_before` points to that same state. The
  entry also records the action kind, detail, reversibility verdict, model, and
  sampling parameters.
- **Restore matches the captured workspace, not the whole environment:** restore
  rewrites captured files and removes newly created non-skipped files. Default
  exclusions include VCS metadata, dependency directories, virtual
  environments, and build caches. Large files can also be skipped. The engine
  records a warning when a snapshot omits large files, and undo warns when a
  restored lockfile does not restore already-installed dependencies.
- **Irreversibility remains in the same audit trail:** a deliberate
  `OPENDOT_NO_SNAPSHOT=1` action still receives an action ID and ledger entry but
  has no restore point. MCP and Composio calls are treated as irreversible
  because the client cannot know or capture their external effects.
- **Admission is conservative in intent:** the classifier checks for network,
  privilege, remote-VCS, installation, destructive-database, outside-workspace,
  and ignored-path signals. Unknown command heads require confirmation rather
  than silently inheriting undo authority.
- **Concurrency is partitioned by effect class:** up to six explorer subagents
  can run concurrently, but their toolbox is forcibly read-only. The source
  explicitly says parallel writers would race the filesystem and make “undo the
  last action” ambiguous. Mutations remain sequential so the ledger defines a
  single restore order.
- **The implementation has targeted tests:** the checked tree contains 52 test
  functions across snapshot and classifier test modules, covering restoration,
  pruning, ignored and large files, command classes, and outside-workspace
  cases. Scout could not execute them in this environment because neither `uv`
  nor the Python `pytest` module was installed; this run therefore treats the
  code and tests as inspectable implementation evidence, not independently
  reproduced behavior.

## Why it matters

The design suggests a reusable **effect-locality protocol** for agent runtimes:

1. Define the state region the runtime can faithfully capture.
2. Snapshot that region before each admitted mutation.
3. Bind the before-state, action, and reversibility verdict under one ordered ID.
4. Route effects outside the region through a different policy: confirmation,
   stronger isolation, compensation, or denial—but never a false undo claim.
5. Permit concurrency only where effects commute or are read-only; otherwise
   establish an explicit transaction order.

The non-obvious implication is that agent parallelism and agent reversibility
cannot be designed independently. “Undo the last action” requires a total order
over writes. A system that wants parallel writers needs stronger semantics—such
as isolated worktrees, per-lane state, conflict detection, or transactions with
commutative/mergeable effects—not merely more snapshots.

The same boundary also clarifies why generic tool protocols cannot promise
rollback. A local file tool may fit inside the captured region; an MCP tool that
sends email or changes a SaaS record does not. External actions need
idempotency, compensating operations, and outcome verification rather than being
painted as reversible by a common interface.

## Limits and watchpoints

- The shell classifier is a text heuristic, not confinement. Its safe-command
  set includes general interpreters and test runners such as `python`, `node`,
  and `pytest`; those programs can themselves access the network or mutate
  state outside the workspace without an obvious path in the command string.
  The confirmation layer should therefore not be confused with a sandbox.
- A workspace snapshot cannot reverse process state, services, databases,
  package-manager side effects, credentials already exfiltrated, or remote
  effects. Ignored and oversized local files also weaken completeness.
- The append-only ledger is implemented as a local audit record, not described
  as tamper-evident or externally attested.
- The repository is explicitly alpha, and Scout did not independently execute
  its tests in this run because the required test runner was unavailable.

## Primary sources

- Repo at inspected revision: https://github.com/vedaant00/opendot/commit/443f8262c211eda2f82e47e2afdfa7be680d0e6a
- GitHub API metadata: https://api.github.com/repos/vedaant00/opendot
- GitHub search feed: https://api.github.com/search/repositories?q=topic%3Aai-agents+pushed%3A%3E%3D2026-08-04+stars%3A%3E%3D20&sort=updated&order=desc&per_page=20
- README: https://github.com/vedaant00/opendot/blob/443f8262c211eda2f82e47e2afdfa7be680d0e6a/README.md
- Reversibility engine: https://github.com/vedaant00/opendot/blob/443f8262c211eda2f82e47e2afdfa7be680d0e6a/src/opendot/reversibility/engine.py
- Snapshot store: https://github.com/vedaant00/opendot/blob/443f8262c211eda2f82e47e2afdfa7be680d0e6a/src/opendot/reversibility/snapshots.py
- Irreversibility classifier: https://github.com/vedaant00/opendot/blob/443f8262c211eda2f82e47e2afdfa7be680d0e6a/src/opendot/reversibility/classifier.py
- Read-only parallel explorers: https://github.com/vedaant00/opendot/blob/443f8262c211eda2f82e47e2afdfa7be680d0e6a/src/opendot/agent/explorers.py
- Snapshot tests: https://github.com/vedaant00/opendot/blob/443f8262c211eda2f82e47e2afdfa7be680d0e6a/tests/test_snapshots.py
- Classifier tests: https://github.com/vedaant00/opendot/blob/443f8262c211eda2f82e47e2afdfa7be680d0e6a/tests/test_classifier.py
