# Ordinary commands from Task workers

**Status:** Production candidate prepared for independent review; not merged or
deployed. The earlier isolated prototype established the direction but is not
the candidate or live proof. This is a common Host execution concern, owned
here rather than in May, Scout, Gym or an individual workflow.

**Reviewed source:** Host `0d25ab157ad7de6693be46781ca65a8341017804`.

## Outcome

May should run ordinary commands using their normal invocation. Running a
test through May should not require remembering an internal environment flag.
Actual Host workers must continue to use the Host-prepared database and keep
their existing lock-wait behavior.

The rule is: **a process becomes a Host worker by entering the explicit Host
worker entry point; starting another program does not transfer that role.**
Task correlation, normal configuration and cancellation remain separate from
this internal process role.

## What caused the failure

The Host starts Task attempt, recovery and admission workers. The two spawn
implementations export `MAY_TASK_ATTEMPT_CHILD=1` into those workers. The same
variable has three uses:

1. A guard on the private worker entry points.
2. The default in `getDb()` that forbids creating missing Host schema.
3. Selection of the longer SQLite retry schedule for workers.

The original database change (`e860d3e4`) avoided repeatedly executing schema
DDL from workers and competing for SQLite's one write lock. Preserve that
behavior. The defect is identifying a process's role through an environment
variable inherited by all its descendant programs.

The immutable source archive used by deployment separates source files, but
does not isolate the environment. Its portable tests still inherit the flag.
They create temporary databases, then are incorrectly treated as workers that
must find an already initialized database. This does not mean their database
path was redirected to the live database.

[PR #199](https://github.com/hao1939/may-agent/pull/199) removes the flag for
deployment's portable test subprocess. That corrects one invocation. A later
ordinary full-CI command from May encountered the same defect, demonstrating
that the deployment script is not the general owner of the fix.

## Command paths examined

| Path | Current behavior |
| --- | --- |
| Bash tool, `src/lib/tools/bash.ts` | Copies `process.env`; an optional spawn hook can further adjust it. |
| Native Codex/Claude helper, `src/lib/cli-agent.ts` | Copies `process.env` and adds provider configuration. |
| Persistent Codex adapter, `src/app/adapters/executors/codex/codex-goal-client.ts` | Uses supplied environment or `process.env`. |
| Background command, `src/lib/background-exec.ts` | Uses ordinary subprocess environment inheritance. |
| Workflow or App code launching a process directly | Can use Bun/Node subprocess APIs without passing through the Bash tool. |

Bash, a direct workflow subprocess and a helper's subprocess were reproduced
through a real Task worker using temporary App definitions and databases.
The other launcher entries above are source findings, not claims that every
provider path was exercised live.

Existing tests miss the combination. Database ownership tests explicitly
request `existingSchemaOnly`; they do not exercise an ordinary command from
a real worker. The native CLI test spawn fixture replaces the actual child
environment with `{ PATH }`, hiding this particular inherited-state defect.

## Proposed implementation

Keep the internal worker role in process memory, set explicitly at worker
entry. A small internal module can expose an entry function and a read-only
query. It starts in ordinary mode and has no production reset or App-facing
setter. This is a fixed property of a dedicated worker process, not mutable
Task or session state and not a new execution lifecycle.

1. At the common attempt/recovery entry and the admission entry, verify the
   existing parent IPC connection and enter worker mode before event
   persistence, database access or dynamic App loading.
2. Remove the worker environment marker from the two Host spawn paths. Supply
   their normal copied environment with that one obsolete key explicitly
   unset, including when an older launcher supplied it. This also lets
   commands run older checkouts whose database code still reads the marker.
   No current runtime behavior reads the marker.
3. Have `getDb()` and SQLite retry selection read this process-local role.
   Preserve the explicit `existingSchemaOnly` option, including maintenance's
   current explicit request. Leave the schema checks and retry schedules as
   they are.
4. Ordinary commands continue using their existing launchers. A newly launched
   program has its own module state, so it starts ordinary even if it imports
   Host database code. No command-name detection or per-tool filtering is
   required for this role.

The explicit entry point selects the role. IPC alone does not make an ordinary
program a worker. Checking IPC verifies the required parent transport; it is
not authentication or a new security boundary. Existing parent-disconnect,
cancellation, result validation and Task authority rules remain responsible
for their respective guarantees.

All three worker modes need the change together. Fixing database initialization
alone would leave retry behavior coupled to the inherited flag. Importing a
module or merely setting the old flag must never activate worker mode.

| Host component | Change |
| --- | --- |
| `src/lib/task-worker-context.ts` (prototype name) | Small internal, process-local role and parent-connection check. |
| `src/app/composition/workers/task-attempt-process.ts` | Stop exporting the marker; enter worker mode for attempts and recovery. |
| `src/app/composition/workers/task-admission-process.ts` | Apply the same rule to admission. |
| `src/lib/db/connection.ts` | Read the explicit worker role for the existing default. |
| `src/lib/db/busy-retry.ts` | Read the same role for the existing retry schedule. |

This requires no SDK change, database migration, new App input type, agent
instruction or workflow wrapper. On adoption, document the contract in
[Runtime](../2a-design/runtime.md), its current design owner. Keep this proposal
as the rationale and evidence record.

## Alternatives and cost

| Alternative | Value | Cost or limitation |
| --- | --- | --- |
| Keep adding `env -u` to scripts and agent guidance | Very small correction for one known path. | Each new command can rediscover the problem; requires agent knowledge. |
| Shared environment cleanup used by command launchers | Covers launchers that use it. | Every launcher and direct App subprocess must participate; future launchers can omit it. |
| Explicit worker entry with process-local role | Removes the inherited cause across ordinary process-launch APIs. | Requires ordering worker initialization before storage and changing both role consumers together. |
| Pass database mode and retry policy through every call | Makes each dependency explicit. | Broad signature and composition changes across persistence helpers for a role currently fixed per process. |

Recommend explicit worker entry. The prototype used four production-file
edits and one small internal module, plus a fixture update. Do not add an
environment registry, a command classification system or an execution wrapper
framework for this issue.

The tradeoff is a process-local default. This fits today's dedicated worker
processes. If the Host later mixes interface and worker roles inside one
process, pass the relevant policy explicitly at that new boundary. Do not
toggle one global setting around concurrent tasks. Test role changes using
fresh subprocesses, rather than adding a reset hook to production code.

## Isolated comparison on September 19

The prototype was applied only to a temporary archive of the reviewed source.
The final comparison used the production Task worker spawn function, real
worker execution and the real Bash implementation. The fixture executable
dispatches the private worker arguments through the real worker entry; it
does not replace the spawn environment through the worker's test seam. The
fixture workflow ran a temporary database command through three paths. All
inputs were synthetic; no model request or live service operation was needed.

| Observation | Current source | Prototype |
| --- | --- | --- |
| Bash command initializes its own temporary database | Fails with worker-schema error | Succeeds |
| Direct workflow subprocess does the same | Fails with worker-schema error | Succeeds |
| A subprocess launched by another helper does the same | Fails with worker-schema error | Succeeds |
| Real worker refuses to initialize missing Host schema | Yes | Yes |
| Worker database schema unchanged during the probe | Yes | Yes |
| Synthetic correlation value reaches ordinary commands | Yes | Yes |

Further isolated checks confirmed:

- A stale `MAY_TASK_ATTEMPT_CHILD=1` does not change the prototype's database
  behavior. The final prototype also retires the obsolete marker before the
  worker starts. With a deliberately polluted parent environment, all three
  command paths could initialize temporary databases using unchanged old Host
  source. This tests working on older checkouts during an upgrade.
- The private worker entry without its parent connection is rejected before
  worker mode is set. An ordinary subprocess with IPC remains ordinary.
- Real worker mode selects the existing first retry delay of 250 ms; ordinary
  mode selects 5 ms. This check recorded the selected delay by replacing the
  sleep operation within an isolated process; it is not a load benchmark.
- The affected test selection passed: **120 tests, 0 failures**, across nine
  files, including real worker recovery/delegation/control, admission,
  database, Bash, native-helper and the deployment portable checks.
- `bun run check:ci` passed: Host and SDK type checks, canonical App boundary
  checks and lint. The full portable suite and compiled-image checks were
  not run for this exploratory prototype.

One rejected intermediate approach deleted the old key from `process.env`
inside worker entry. Bash observed that deletion, but direct `Bun.spawn`
without an explicit environment still passed the original flag to children
in this installation. The new database code ignored the flag, but old source
would still interpret it. Retiring the marker in the environment supplied
when the Host starts the worker resolved that distinction. Preserve this
failed observation in `failed-entry-cleanup.log`; do not claim deleting a key
after startup is sufficient for every process API.

Local inspection artifacts are under
`.state/review-pilots/worker-command-context-20260919/` at the installation
root: `baseline.json`, `prototype.json`, `prototype-legacy-env.json`,
`prototype-old-checkout.json`,
`role-boundary-results.json`, `prototype.patch`, the two probe sources and
check logs. These are exploratory evidence, not a deployed artifact or a new
permanent test runner. Before retiring the archive, retain its source identity
and patch; promote the useful behavior checks into existing fixture tests.

To reproduce the command comparison, create an archive of the reviewed Host
commit with its locked dependencies installed, place the retained
`command-context-probe.ts` at the archive root and run it with Bun. The baseline
records the three failures without contacting a provider. Apply
`prototype.patch` and repeat the same probe; the three commands should succeed.
For the older-checkout comparison, point `CONTEXT_PROBE_CHILD_DB_MODULE` at the
baseline's `src/lib/db/connection.ts` file URL and deliberately set the obsolete
worker marker on the probe's parent process. These variables are experiment
inputs, not commands May must learn for ordinary work.

The comparison establishes the process boundary under controlled conditions.
It does not certify live Codex/Claude provider behavior, all possible environment
variables, full deployment or autonomous recovery by May.

## Implementation and acceptance plan

Have May own the production candidate and integration, with independent review
of the source and evidence. Use one small Host PR for both spawn paths and both
database consumers. The current design record remains in `may-agent.app`.

1. Promote the reproduced worker-to-command behavior into an existing portable
   worker fixture. Assert actual database initialization and normal command
   output, not merely absence of an environment variable. Include a direct
   workflow subprocess so a Bash-only correction cannot satisfy the test.
2. Preserve coverage for worker refusal on an empty database, initialized
   database reuse, retry selection, private entry without a parent, parent
   loss, admission and recovery. Check bootstrap ordering in source and the
   compiled binary. Unchanged schema contents alone do not prove no DDL was
   attempted; retain a test that detects schema-initialization behavior.
3. Add the missing environment-preserving native-helper boundary check with a
   local fixture executable. Keep native process/session identity, ordinary
   configuration and cancellation intact. No real provider credentials belong
   in portable tests.
4. Run normal full CI and compiled-container checks. After reviewed integration
   and an authorized Host update, ask the existing May instance to run an
   ordinary `bun run ci` from an isolated checkout, without supplying an
   environment workaround. Verify a fresh worker uses the updated Host.
5. Verify the normal deployment test invocation through its temporary failure
   fixture, including that failed checks prevent artifact staging/restart.
   Deployment to the live installation remains its own operation.

While PR #199 is unmerged, prefer refining or superseding it with this one
common Host correction and the regressions above. Preserve useful deployment
failure-gate coverage, but move the worker-identity regression to its owning
boundary. If #199 lands first for the immediate deployment problem, remove
the now-redundant `env -u` when the common fix is verified. Do not bypass its
review gate or claim a pending candidate is already deployed.

Older workers keep their old code and behavior until they exit. Ordinary
source checkout changes do not update a running worker. Apply the Host update
using the existing procedure and verify a fresh attempt. Broader Host/SDK/App
release conventions remain a separate, deferred proposal.
