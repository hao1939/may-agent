# Script guide

Start with `bun run ci` for portable source verification. Build, diagnosis,
deployment and model evaluation are different operations. Design and operating
procedures live in the sibling `may-agent.app/docs` tree; routine CI does not
need that tree, an installed App, credentials or a running May.

## Maintained commands

Run commands below from the Host checkout unless stated otherwise.

| Purpose | Command / files | Inputs, output and effects |
| --- | --- | --- |
| Source verification | `bun run ci`; `check-canonical-app-boundary.ts` | Host/SDK types, lint and portable tests. Optional `MAY_AGENT_VERIFY_APPS_ROOT` extends the boundary scan to supplied Apps; Host-only CI does not certify them. |
| App/artifact compatibility | `MAY_AGENT_VERIFY_APPS_ROOT=/path/to/projects MAY_AGENT_VERIFY_SDK_ROOT=/path/to/sdk bun run verify:apps-artifact` | Loads supplied App source against an explicit SDK, reports compatibility, removes temporary bundle caches. Not deployment. |
| Binary build | `bun run bundle`; `build-runtime-binary.ts` | Generates `bundle/may-agent` and UI staging output using this checkout and its build revision. Does not restart an installation. |
| UI build | `bun run ui:sync`; `build-webui.ts` | Copies `packages/webui/static` to ignored **`bundle/platform-ui`** by default. `MAY_AGENT_UI_OUTPUT_DIR` selects another staging directory. The selected output is replaced recursively; never point it at source or installation data. `deploy.sh` supplies an explicit release staging directory. |
| UI development | `bun run --cwd packages/webui dev` | Serves editable `packages/webui/static` directly through the existing HTTP adapter; no build/copy or daemon startup. Uses `MAY_AGENT_UI_DIR` for assets only, without changing project discovery or state roots. Set `PROJECT_ROOT`/`STATE_DIR` to the intended development installation; `WEB_PORT` defaults to 8080. |
| Image build | `bun run build`; `build-image.sh` | Requires Docker and writes a local image using the container build definition. No publication or deployment. |
| Image selection / smoke | `ci-container-needed.sh`; `ci-container-smoke.sh IMAGE` | CI passes NUL-delimited changed paths to the selector. Smoke checks the disposable candidate image's readiness, UI and CLI protocol; no installation mounts, model calls or deployment. |
| CLI protocol verification | `bun run check:codex-goal-protocol` | Requires the pinned Codex CLI. Generates schemas in temporary storage, compares `codex-goal-protocol.snapshot.json`, removes temporary output, exits nonzero on drift. Support code/tests are `codex-goal-protocol*`. No model call. See executor README and CONTRIBUTING for upgrades. |
| Deployment | `MAY_AGENT_DEPLOY_TASK_ID=TASK_ID bun run deploy`; `deploy-receipt.ts` | Host Operations App authority and an exact open Task are required. Builds/stages a release, restarts through the supported restarter and writes correlated receipts. This changes installed state: use the operations manual, not as a test command. |
| Event integrity | `bun run check:event-graph -- --state-dir /path/to/state` | Inspects an **existing** `may.db` read-only, prints a JSON report and fails on missing/incompatible state or integrity defects. `--limit` bounds a backfill batch, not the integrity scan. Only explicit `--backfill` writes repairs. SQLite may create reader sidecars; inspection does not initialize schema. |
| Quiet-runtime sample | `bun run sample:runtime-quiet -- --socket /path/to/may.sock --state-dir /path/to/state --seconds 30` | Installed daemon, SQLite and Linux `/proc` required. Reads CPU/memory plus work-activity evidence; prints JSON. Exit 2 means the window was not quiet, not a successful idle measurement. |
| Task interface benchmark | `bun scripts/benchmark-human-task-interface.ts` | Creates 20,000 synthetic rows in memory; prints p95 latency and fails its explicit budgets. No installed state or model. Machine-sensitive benchmark, not a default CI gate. |
| Offline transcripts | Open `scripts/log-viewer.html` in a browser and select a JSONL file | Reads local message records, not daemon event logs. No upload or live service. Format and limits below. |
| Prior-lifecycle verification | `scripts/migrations/task-state-cutover.ts`, `task-runtime-cutover.ts` | Explicit clean old source plus temporary state; see the [test guide](../test/README.md). These verify an upgrade, never migrate your installation. |
| Gym compatibility | `gym-run.sh`, `gym-baseline.sh`, `gym-batch.sh`, `gym-record.ts` | Model-backed scenario execution and existing result recording. `gym-run.sh --list` and `gym-batch.sh --help` are discovery; evaluation/recording are not read-only. See compatibility boundary below. |

Colocated `*.test.ts` files protect these commands and repository CI, lint,
publication and deployment contracts. They run through `bun run ci`; no separate
wrapper is needed. The browser test requires Chrome (or `CHROME_PATH`), like the
other portable UI checks. `E2E_NO_UI=1` explicitly skips it locally, not in CI.

`MAY_AGENT_UI_DIR` explicitly selects the HTTP adapter's served static directory
(relative values use its working directory). Without it, the deployed default
remains `<PROJECTS_ROOT>/platform/ui`. This is separate from the build output
setting; building never switches the running server or deploys assets.

## Gym compatibility boundary

The sibling Gym CLI imports `src/app/direct-agent.ts`, its May alignment
benchmark calls `gym-baseline.sh`, and the coach workflow calls `gym-batch.sh`.
The runner/recorder are their dependencies. Keep these entry points until the
consumers and authoritative result store migrate together. The recorder derives
the Host `.state/may.db` path from its location: moving it alone strands history.
Baseline now preserves explicit failure and returns nonzero for FAIL/ERROR;
do not infer a stronger batch-runner/storage contract from that fix.

General scenario execution belongs with Gym and App recording with its owner.
This cleanup does not move either database or consumer. A Host-only reference
scan does not establish that domain tooling is unused. The shared prepared
executor remains the execution mechanism, not a separate work lifecycle.

## Offline transcript format

The viewer supports the message-per-line JSONL written by
`src/lib/persistence.ts` (`sessions/SESSION_ID/session.jsonl`): `user`,
`assistant` and `toolResult` messages. Text content may be a string or typed
content blocks; tool calls/results, timestamps and supplied usage are rendered.
For example, save these synthetic lines in a local `.jsonl` file:

```jsonl
{"role":"user","content":"Inspect the sample","timestamp":1000}
{"role":"assistant","content":[{"type":"text","text":"Reading the evidence."},{"type":"toolCall","id":"read-1","name":"read","arguments":{"path":"sample.txt"}}],"timestamp":2000}
{"role":"toolResult","toolCallId":"read-1","toolName":"read","isError":true,"content":[{"type":"text","text":"Sample file unavailable"}],"timestamp":3000}
```

It is a convenience viewer, not an integrity audit: malformed JSON lines are
skipped, unsupported message roles are not a conversation turn, missing usage
does not prove zero cost, and the whole file is read into browser memory.
Keep real transcripts private even if automatic redaction has run. The portable
browser regression uses the actual persistence writer and synthetic data only.

## Retired experiments

There is no supported `scripts/poc/` tree. Completed harnesses remain in Git at
**`b1c7cbef`** (Host main after caller feedback #169, before retirement).
That revision also retains the final caller-feedback guide and managed trial;
the companion evidence records the exact earlier revisions used by live trials.
Historical invocations must run in an isolated checkout of the recorded source,
with its dependencies and any exact App revision identified by the evidence;
they are not commands for current main. Model trials require explicit authority,
provider configuration and budget, and are not reproducible output guarantees.

The existing App documentation records the questions, positive/negative results,
limitations and decisions. Start at
`may-agent.app/docs/proposals/poc-retirement-and-knowledge-20260912.md` for the
inventory and links to controller, recovery, teaching, improvement and executor
evidence. Open proposals remain open; retiring code is not accepting their design.
Active experimental branches are retained and must not reintroduce the folder.

Useful checks have maintained homes:

- Protocol compatibility: `check:codex-goal-protocol` plus the image smoke gate.
- Definition activation: `test/e2e/e5-source-activation.test.ts` and the source-store suite.
- Exact Task results, waits, owner closure, retry and reopen: existing Task,
  Conversation and real-worker suites, not copied model-trial scoring code.
- Old-source conversion: `scripts/migrations/` and its explicit test-guide boundary.

`smoke-steering.ts` is retired with its package entry. Its assumed live metric
and immediate database write are not a safe smoke contract. Portable HTTP
validation/health tests and `test/integration/daemon-events.test.ts` retain
request validation and real threshold-event application separately.

Earlier merge shortcuts, layout-specific status scripts, metric seed/backfill
scripts and the legacy Telegram smoke remain retired. Review, conflict choices,
App metric definitions and live experience trials belong to their existing
owners. No installed data is removed by this source cleanup.
