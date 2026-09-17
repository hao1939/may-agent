# Runtime Operations

Read this reference only for May-agent restart, deploy, binary activation, or
supervisor work.

## Restart

- Do not run inline `supervisorctl restart may-agent ...` from an agent shell.
  The shell is a child of the runtime being stopped and can die before restart
  completes.
- Prefer emitting `runtime.restart.requested`; the runtime asks supervisor to
  start `may-agent-restarter`.
- If a shell command is explicitly needed, use
  `supervisorctl start may-agent-restarter`. The supervisor-owned one-shot
  performs the `may-agent` and `may-agent-web` restart.
- After supervisor accepts the request, the restarter survives the May-agent
  process stopping. Normal supervisor `autorestart` owns crash recovery when no
  restart event was accepted.

## Build And Deploy

Deploy only from work owned by an existing Host Operations App Task. Name that
exact Task and use one stable correlation for the attempt:

```bash
cd /app/projects/may-agent
bun run check
bun test <targeted tests>
MAY_AGENT_DEPLOY_TASK_ID='<host-operations-task-id>' \
MAY_AGENT_DEPLOY_CORRELATION='<stable-correlation>' \
  bun run deploy
```

`MAY_AGENT_DEPLOY_TASK_ID` is required. The deploy preflight proves that the
Task exists under `app:may-agent` before building or restarting. `bun run
deploy` builds from the exact source commit, creates a durable requested
receipt under `.state/deploy-receipts/`, and starts the supervisor-owned
restarter. The restarter atomically activates the binary, Console, SDK, and UI,
then starts `may-agent`, `may-agent-web`, and `may-agent-maintenance`.

Do not inline a stop/copy/start sequence from May's shell. If the live restarter
does not support staged deploy, recreate the container from the updated image.

Treat deploy as accepted-then-async. The matching receipt is authoritative;
activation-marker disappearance and an unbounded log tail are not proof. Wait
for that receipt or the exact Task wake. Claim success only when its phase is
`succeeded`, `loadedArtifactSha` equals `artifactSha`, health is `healthy`, and
`duplicateDeploy` is `false`. Confirm the three long-lived services are
`RUNNING`; `may-agent-restarter` is a one-shot and normally exits after the
receipt settles.

## Read-only Live Verification

When the requested outcome is to verify an exact commit or deployment, do not
deploy or restart anything.

1. Start with the requested `sourceCommit`, correlation, or Task identity. If
   the input does not provide a receipt path, search only
   `/app/projects/may-agent/.state/deploy-receipts/*.json` for the matching
   `sourceCommit` or correlation. Do not search `/app`, other worktrees, build
   files, or broad logs.
2. Read the one matching receipt. `requested` means wait for that exact
   receipt; `failed` or `rolled_back` is the terminal disposition. Do not tail
   restart logs while a receipt is already authoritative.
3. For success, require `phase: succeeded`, matching requested
   `sourceCommit`, `loadedArtifactSha == artifactSha`, `health: healthy`, and
   `duplicateDeploy: false`. Preserve its `project`, `taskId`, and
   `correlation` as the exact causal link; do not substitute a nearby session
   or Task.
4. Cross-check only the bounded live surfaces: compare
   `bundle/may-agent.provenance.json` with the receipt, compare the live
   container's `/usr/local/bin/may-agent` SHA-256 with `artifactSha`, confirm
   `may-agent`, `may-agent-web`, and `may-agent-maintenance` are `RUNNING`, and
   require
   `http://127.0.0.1:${WEB_PORT:-8080}/api/readiness` to succeed.
5. Stop once those facts satisfy the requested acceptance proof. Report the
   exact receipt and mismatches, if any; do not turn verification into a
   workspace audit.
