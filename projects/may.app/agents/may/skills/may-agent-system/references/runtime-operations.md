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

Deploy only with explicit rollout authority and revised PR #220 scripts. Before
invoking the script, choose one stable correlation and retain the expected exact
path `<deploy-root>/.state/deploy-receipts/<correlation>.json` (or the path under
`MAY_AGENT_DEPLOY_RECEIPT_DIR`) in the operator's saved command or Task context:

```bash
cd /app/projects/may-agent
bun run check
bun test <targeted tests>
MAY_AGENT_DEPLOY_CORRELATION='<stable-correlation>' bun run deploy
```

`bun run deploy` is standalone: it needs no App, Task, or Task-database access.
It builds from the exact source commit, creates a durable requested receipt
under `.state/deploy-receipts/`, prints that exact path before restart, and
starts the supervisor-owned restarter. Optional
`MAY_AGENT_DEPLOY_OWNER_APP`/`MAY_AGENT_DEPLOY_TASK_ID` values request only a
best-effort result wake; supply both or neither. Destination absence, closure,
or wake failure does not change deployment success. The restarter atomically
activates the binary, Console, SDK, and UI, then starts `may-agent`,
`may-agent-web`, and `may-agent-maintenance`.

Do not inline a stop/copy/start sequence from May's shell. If the live restarter
does not support staged deploy, recreate the container from the updated image.

Treat deploy as accepted-then-async. The retained exact receipt is authoritative;
activation-marker disappearance and an unbounded log tail are not proof. Return
to that receipt after caller interruption; an optional Task wake is only a
convenience. Claim success only when its phase is `succeeded`,
`loadedArtifactSha` equals `artifactSha`, health is `healthy`, and
`duplicateDeploy` is `false`. Confirm the three long-lived services are
`RUNNING`; `may-agent-restarter` is a one-shot and normally exits after the
receipt settles.

## Read-only Live Verification

When the requested outcome is to verify an exact commit or deployment, do not
deploy or restart anything.

1. Start with the exact receipt path retained before restart. If the request
   predates that contract, use its known `sourceCommit`, correlation, or Task
   identity to perform one bounded compatibility lookup under
   `/app/projects/may-agent/.state/deploy-receipts/`; do not scan unrelated
   receipt files for a new deployment.
2. Read the exact receipt with
   `bun scripts/deploy-receipt.ts read RECEIPT_PATH`. `requested` means wait for
   that same receipt; `failed` or `rolled_back` is the terminal disposition. Do
   not tail restart logs while a receipt is already authoritative.
3. For success, require `phase: succeeded`, matching requested
   `sourceCommit`, `loadedArtifactSha == artifactSha`, `health: healthy`, and
   `duplicateDeploy: false`. Preserve its `correlation` and any optional
   `project`/`taskId` notification metadata; do not substitute a nearby session
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
