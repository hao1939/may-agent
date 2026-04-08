# Binary Deployment Simplification

## Current (too many layers)

```
supervisord (autorestart=true, startretries=999)
  └─ run-may-agent.sh (sources .env, execs $MAY_BIN)
       └─ binary-entry.ts (argv fixup)
            └─ may.ts (the actual agent)
```

Plus: launcher.ts (dead code), bundle/ symlink dance, entrypoint.sh MAY_BIN resolution.

## Proposed (one layer)

```
supervisord (autorestart=true)
  └─ /usr/local/bin/may-agent --chat --cron --socket --telegram
```

### Changes

1. **Delete launcher.ts** — it's dead code (binary-entry.ts bypasses it).

2. **Inline run-may-agent.sh into supervisord.conf** — use supervisord's `environment=` for .env vars, or just source .env in entrypoint.sh (it runs once at container start anyway).

3. **Stop using bundle/ symlinks** — the binary is either:
   - **Baked in image**: `/usr/local/bin/may-agent` (for k3s, production)
   - **Bind-mounted**: `/app/bundle/may-agent` (for local dev via Docker Compose)
   
   In both cases, the binary path is fixed. No symlink resolution.

4. **Remove the MAY_BIN resolution** from entrypoint.sh — just use a fixed path.

5. **Clean up k3s PVC** — remove `/app/may-agent-bin` and `/app/bundle/may-agent` symlink (dead weight).

### Local dev workflow (simplified)

```bash
# Build new binary
npm run bundle

# Restart (supervisord picks up the new binary at the fixed path)
npm run reload  # or: docker exec may-console supervisorctl restart may-agent
```

No symlink dance. The `bundle` script writes directly to `bundle/may-agent` (overwrite, not symlink).

### K3s workflow (simplified)

```bash
# Build new image
npm run build && docker push

# Deploy
kubectl rollout restart statefulset may-agent -n may-agent
```

Binary comes from the image. No PVC binary. No entrypoint.sh resolution.

### Package.json change

```json
"bundle": "mkdir -p bundle && bun build --compile src/app/binary-entry.ts --outfile bundle/may-agent && bun build --compile src/app/ui/web.ts --outfile bundle/may-agent-web"
```

No SHA suffix, no symlink. Just overwrite.
