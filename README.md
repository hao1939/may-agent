# May Host

This repository retains the technical name `may-agent`, but it implements the
generic **May Host**, not May's reasoning worker. The Host runs agent sessions,
workflows, task reconciliation, transports, persistence, and the local control
surfaces used by the apps under `/app/projects`.

Host contracts and implementation guidance are available through the source maps,
SDK types, package guides and tests below. Apps maintain their own policy,
manuals and operating knowledge. Host development does not require a particular
App checkout or documentation location.

## Layout

```text
src/
  lib/       Hosted session and workflow infrastructure
  app/       Daemon, event runtime, transports, and project-app host
  types/     Shared type declarations

packages/
  control/   Local daemon protocol and client
  sdk/       Public project-app authoring API
  terminal/  May Console client
  webui/     Browser control surface

test/
  integration/  Runtime component integration tests
  e2e/          Full process and transport tests
  fixtures/     Shared test data
  helpers/      Shared test utilities

container/   Container image and supervisor configuration
scripts/     Current build, deploy, maintenance, and diagnostic commands
```

Unit tests normally live beside the source they test. Put cross-component
tests in `test/integration` and process-level tests in `test/e2e`.

For the loading-to-Task path, start with the [App source map](src/app/README.md).
The [control package guide](packages/control/README.md) describes public event
contracts and clients; the [Conversation guide](src/app/conversations/README.md)
locates message projections and Topic links.

The [execution source map](src/lib/README.md) locates session ownership, context
preparation, the model loop and workflows. `src/lib` is Host infrastructure.
Project apps use `@may-agent/sdk`; local control clients use `@may-agent/control`.

For execution-context changes, start with
[`app-dependency-catalog.ts`](src/app/app-dependency-catalog.ts) for the installed
App input summaries shared by conversation and Task execution, and
[`app-task-context.ts`](src/app/core/tasks/app-task-context.ts) for Task event, child, and
accepted-wait context. [`task-decision-context.ts`](src/lib/task-decision-context.ts)
refreshes the bounded current Task view before model calls. Context preparation
separates explicit scoped reads from formatting; these modules do not schedule
work. Attempt
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

The [reporting guide](src/app/adapters/reporting/README.md#context-usage)
explains the Metrics page, retained context-usage observations and their limits.

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
[script guide](scripts/README.md) before running operational helpers. Authorized
operators deploy with `bun run deploy`; it requires no App or Task. Optional
App/Task metadata requests a completion notification. The script guide owns
those options and receipt handling. `reload` only reloads agent and App
definitions and does not deploy runtime code.

For UI development, `bun run --cwd packages/webui dev` serves the editable static
source directly; no build or installation copy is needed. Set `PROJECT_ROOT`
and, if needed, `STATE_DIR` to your development installation. `WEB_PORT` defaults
to 8080. The command sets the HTTP-only `MAY_AGENT_UI_DIR` override; ordinary
deployed serving still reads `<PROJECTS_ROOT>/platform/ui` by default.

## Layout rules

- Keep generated output in ignored directories such as `bundle/`.
- Keep runtime evidence and generated artifacts outside version control.
- Keep app-specific workflows and tests in their owning project app.
- Keep domain scenarios and their acceptance checks with the owning App.
- Delete obsolete scripts when their owner or data model disappears.
- Prefer package imports over reaching into another package's `src/` tree.
- Keep generic Host contracts with their owning API and implementation guide.
  Supply App-specific design references as work context, without hard-coding
  a sibling App path into Host guidance.

## Requirements

Node.js 24 and the Bun version recorded in `.bun-version` for CI/image parity.

## License

MIT

## Installation policy

Host has no built-in human-facing App. Set `AGENT` (or `DAEMON_AGENT`) for
its interface/socket identity and `CONVERSATION_APP` for the App receiving
human input. `CONVERSATION_ID` optionally preserves an existing Conversation;
it defaults to `<appId>:primary`. For example, `AGENT=helper` and
`CONVERSATION_APP=support` select different agent and App identities. Without
an App binding the Host can run background Tasks, but Console, Telegram and
human notifications report that their destination is unavailable. Browser
clients read the same binding from `/api/interface`.
The interface agent's web page and message endpoint use that binding even
when an older chat session exists. Explicit session follow-ups remain addressed
to the selected session. A missing App binding reports an error and preserves
the browser draft.

For Compose, put these bindings in the installation `.env` consumed by
`container/compose.yml`, or set them in an explicit Compose override file.
The base Compose file does not forward shell binding variables or inject
identity defaults: `AGENT` takes precedence over legacy `DAEMON_AGENT`, and
the runtime defaults to `host` only when both are empty or absent.

The installation may commit `shared/file-write-policy.json`:

```json
{
  "protectedPaths": ["projects/quality.app/criteria/**"],
  "grants": [{ "paths": ["projects/quality.app/criteria/**"], "writers": ["reviewer"] }]
}
```

Patterns are relative to the installation root. A working directory alone
does not declare a copy of that root. Task context identifies a project checkout,
so its files retain the source project's installation-relative paths. Direct
runs explicitly map their installation-layout work root to the installation.
An App-local working directory does not change that scope: `agents/*/agent.json`
matches installation-level agents only, not `projects/example.app/agents/*/agent.json`.
Explicit grants override protected paths and generic file-tool safeguards;
agent names alone grant nothing. The policy file itself cannot be rewritten
through these tools. The selected definition captures the policy with its
source release, including when a Task uses another execution directory. A
project checkout therefore cannot gain installation-level permissions by
containing similarly named files.
Without a declaration, generic shared-guidance and cross-agent configuration
protection remains. This covers `write` and `edit`, not shell or native CLI
filesystem access; it is not a security sandbox.

When upgrading an existing installation, supply its destination and intended
file grants before rollout. Keep the old Conversation ID to retain its history.
Source relocation does not rename saved Task, Request or return identities.
