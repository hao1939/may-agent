# Script guide

Start with `bun run ci` for portable source verification. Build, diagnosis,
deployment and model evaluation are different operations. This guide describes
the commands shipped with the Host; App operating procedures belong to the App.
Routine CI requires no installed App, credentials or running Host.

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
| CLI protocol verification | `bun run check:codex-goal-protocol` | Runs the production client against the installed Codex CLI and a loopback Responses fixture: paused-goal notification and persistence, actual request capture, process restart/resume, fresh canonical packet and prior rejection delivery, plus old-turn fencing. Disposable state, no inherited credentials or external model call. This client-boundary fixture does not prove full executor orchestration, compaction, or live recovery; see the executor README. Also runs in image smoke. |
| Deployment | `MAY_AGENT_DEPLOY_CORRELATION=STABLE_ID bun run deploy`; optional `MAY_AGENT_DEPLOY_OWNER_APP=APP_ID MAY_AGENT_DEPLOY_TASK_ID=TASK_ID` | Standalone deployment needs no App, Task, or Task database. The optional pair requests only a best-effort settled notification and must be supplied together; destination state or delivery cannot change deployment success. Builds/stages a release and restarts through the supported restarter, so use the operations manual rather than this as a test command. Record the printed receipt path before restart. Reusing a correlation reads its existing receipt before build/staging instead of redeploying. |
| Deployment facts | `bun scripts/deploy-receipt.ts read RECEIPT_PATH`; compatibility: `read-task RECEIPT_DIR APP_ID TASK_ID` | Reads one exact requested/terminal receipt after caller interruption without deploying. `read-task` remains available for older targeted receipts. Unreadable/corrupt facts fail rather than implying absence or authorizing a retry. |

When optional notification metadata is present, the restarter attempts to emit
`deployment.settled` with `target: { appId, taskId }` and the settled receipt in
`data.deploymentReceipt`. It is an ordinary best-effort Task fact, so a missing
or closed destination and delivery failure do not alter the terminal deployment
receipt. The receipt reader validates common fields and requires completion
time, loaded hash, health and duplicate status for terminal receipts. The App
judges whether those facts satisfy its outcome; the event and reader neither
authorize another deployment nor close the Task.

Colocated `*.test.ts` files protect these commands and repository CI, lint,
publication and deployment contracts. They run through `bun run ci`; no separate
wrapper is needed.

`MAY_AGENT_UI_DIR` explicitly selects the HTTP adapter's served static directory
(relative values use its working directory). Without it, the deployed default
remains `<PROJECTS_ROOT>/platform/ui`. This is separate from the build output
setting; building never switches the running server or deploys assets.

## External execution consumers

`src/app/direct-agent.ts` exposes prepared direct execution to external callers.
Its source tests own the generic contract. Domain scenario runners, benchmark
selection and result recording belong to their consumer repositories. Check
those consumers before changing the adapter, but do not require a sibling App
checkout for Host CI. Relocating a recorder must leave its existing data intact
and provide an explicit path when adopting a retained result database.

## Retired experiments

There is no supported `scripts/poc/` tree. Completed harnesses remain in Git at
**`b1c7cbef`** (Host main after caller feedback #169, before retirement).
That revision also retains the final caller-feedback guide and managed trial;
the companion evidence records the exact earlier revisions used by live trials.
Historical invocations must run in an isolated checkout of the recorded source,
with its dependencies and any exact App revision identified by the evidence;
they are not commands for current main. Model trials require explicit authority,
provider configuration and budget, and are not reproducible output guarantees.

Keep questions, positive and negative results, limitations and adoption decisions
with the owner of an experiment. Supply exact evidence references in the work
item when revisiting it; Host contributor guidance must not depend on an App's
archive location. Retiring a harness does not accept its proposed behavior.

Useful checks have maintained homes:

- Protocol compatibility: `check:codex-goal-protocol` plus the image smoke gate.
- Definition activation: `test/e2e/e5-source-activation.test.ts` and the source-store suite.
- Exact Task results, waits, owner closure, retry and reopen: existing Task,
  Conversation and real-worker suites, not copied model-trial scoring code.

`smoke-steering.ts` is retired with its package entry. Its assumed live metric
and immediate database write are not a safe smoke contract. Portable HTTP
validation/health tests and `test/integration/daemon-events.test.ts` retain
request validation and real threshold-event application separately.

Earlier merge shortcuts, layout-specific status scripts, metric seed/backfill
scripts and the legacy Telegram smoke remain retired. Review, conflict choices,
App metric definitions and live experience trials belong to their existing
owners. No installed data is removed by this source cleanup.
