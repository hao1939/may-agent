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

From the runtime workspace:

```bash
cd /app/projects/may-agent
bun run check
bun test <targeted tests>
bun run deploy
supervisorctl status may-agent may-agent-web may-agent-restarter
tail -80 /tmp/may-agent-supervisor-restart.log
```

`bun run deploy` builds the bundle, writes the staged deploy marker, and starts
the supervisor-owned restarter. The restarter installs the bundle while the
runtime is stopped, then starts `may-agent` and `may-agent-web`.

Do not inline a stop/copy/start sequence from May's shell. If the live restarter
does not support staged deploy, recreate the container from the updated image.

Treat deploy as accepted-then-async. Verify the restarter log, confirm all
programs are `RUNNING`, and confirm the deploy marker is gone before claiming
activation.
