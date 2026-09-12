# May Host

This repository retains the technical name `may-agent`, but it implements the
generic **May Host**, not May's reasoning worker. The Host runs agent sessions,
workflows, task reconciliation, transports, persistence, and the local control
surfaces used by the apps under `/app/projects`.

All system, product, and runtime design lives in
[`../may-agent.app/docs`](../may-agent.app/docs/README.md). This repository
contains implementation and tests, without a parallel design tree.

## Layout

```text
src/
  lib/       Hosted session and workflow infrastructure
  app/       Daemon, event runtime, transports, and project-app host
  types/     Shared type declarations

packages/
  control/   Local daemon protocol and client
  sdk/       Public project-app authoring API
  terminal/  PTY-backed terminal support
  webui/     Browser control surface

test/
  integration/  Runtime component integration tests
  e2e/          Full process and transport tests
  fixtures/     Shared test data
  helpers/      Shared test utilities
  deployment/   Explicit installed-App compatibility checks

container/   Container image and supervisor configuration
scripts/     Current build, deploy, maintenance, and diagnostic commands
```

Unit tests normally live beside the source they test. Put cross-component
tests in `test/integration` and process-level tests in `test/e2e`.

For the loading-to-Task path, start with the [App source map](src/app/README.md).
The [control package guide](packages/control/README.md) describes public event
contracts and clients; the [Conversation guide](src/app/conversations/README.md)
locates message projections and Topic links.

`src/lib` is hosted runtime infrastructure, not a dependency-free public
library. Project apps should use `@may-agent/sdk`; local control clients should
use `@may-agent/control`.

For execution-context changes, start with
[`app-dependency-catalog.ts`](src/app/app-dependency-catalog.ts) for the installed
App input summaries shared by conversation and Task execution, and
[`app-task-context.ts`](src/app/core/tasks/app-task-context.ts) for Task event, child, and
accepted-wait context. The latter separates explicit scoped reads from pure
formatting. Neither looks up runtime registries or schedules work. Attempt
orchestration remains in [`app-task-runtime.ts`](src/app/core/tasks/app-task-runtime.ts),
with lifecycle checks and transactional writes in
[`app-task-reconciler.ts`](src/app/core/tasks/app-task-reconciler.ts).

## State

Runtime state belongs under `STATE_DIR` (normally `/app/.state`), never in this
checkout. SQLite is the durable index for sessions, events, workflows, tasks,
and message delivery. Session transcripts and output artifacts remain in their
session directories when file-shaped evidence is useful.

Do not add scratch scripts or databases to this repository. Use a temporary
directory for one-off investigation and delete it when the investigation ends.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md) for reproducible CI, test boundaries,
review rules, and the separate deployment procedure.

See [RELEASING.md](RELEASING.md) for the Release Please and GHCR image release
procedure. Releases do not deploy production installations.

```bash
bun install --frozen-lockfile
bun run ci
```

Useful focused commands:

```bash
bun run test:components
bun run test:integration
bun run test:e2e
bun run test:sdk
```

For an isolated local build, generated UI files stay in this checkout by default:

```bash
bun run bundle
```

`ui:sync` (also called by `bundle`) stages to `bundle/platform-ui`.
`MAY_AGENT_UI_OUTPUT_DIR` may select another staging directory; that directory
is replaced. A build does not update the sibling served UI. Installed diagnostics
such as `bun run check:event-graph -- --state-dir /path/to/state` require an
existing database, not just this source checkout. See the
[script guide](scripts/README.md) before running operational helpers. Deploy with
`bun run deploy` from work owned by a live `may-agent` App task. The candidate
must contain the current canonical May commit. Another App cannot deploy the
May Host on behalf of its own task. `reload` only reloads agent and app
definitions and does not deploy runtime code.

## Layout rules

- Keep generated output in ignored directories such as `bundle/`.
- Keep runtime evidence and generated artifacts outside version control.
- Keep app-specific workflows and tests in their owning project app.
- Add Gym scenarios to `/app/projects/gym`.
- Delete obsolete scripts when their owner or data model disappears.
- Prefer package imports over reaching into another package's `src/` tree.
- Keep every platform and runtime design in `may-agent.app/docs`; do not create
  a second design tree here.

## Requirements

Node.js 24 and the Bun version recorded in `.bun-version` for CI/image parity.

## License

MIT
