# Amy Path Audit & Fix

## 1. Problem
Amy and Amy-Kimi knowledge files contained hardcoded absolute paths (`/home/hao/.openclaw/...`) to external tools. These paths:
- Break in the container (where user is `root` or `node`, and home is different)
- Break for other users (who don't have `/home/hao`)
- Are fragile against system reconfiguration

## 2. Findings
- **Paths**: Found 30+ references to `/home/hao/.openclaw/` across `tools.md` and `domain.md` for both agents.
- **Availability**: The tools (`xhs_fetch.mjs`, etc.) are **NOT present** in the container.
  - `find / -name "xhs_fetch.mjs"` returned nothing.
  - The container mounts `agents/`, `run/`, `src/`, `.state/` but not the external tool library.
- **Environment**: No `OPENCLAW_HOME` environment variable is set.

## 3. Corrective Actions Taken
I have replaced all hardcoded absolute paths with `~/.openclaw/...` in:
- `agents/amy/knowledge/tools.md`
- `agents/amy/knowledge/domain.md`
- `agents/amy-kimi/knowledge/tools.md`
- `agents/amy-kimi/knowledge/domain.md`

**Why `~/.openclaw`?**
- It is standard shell expansion for "user home".
- On the host: `~` -> `/home/hao`, so it resolves correctly to `/home/hao/.openclaw`.
- In the container: `~` -> `/root` (or `/home/node`), so it resolves to `/root/.openclaw`.

## 4. Remaining Issue (Infrastructure)
Even with the path fix, **the tools will still fail in the container** because the directory `~/.openclaw` (or `/root/.openclaw`) is empty/unmounted.

**Recommendation for Infrastructure Owner:**
To make Amy functional in the container, you must mount the host's `.openclaw` directory to the container's home.
Example `docker-compose.yml` update:
```yaml
volumes:
  - ${HOME}/.openclaw:/root/.openclaw  # Map host tools to container user home
```
Or set `OPENCLAW_HOME` env var and mount to that location.

For now, the documentation is "correct" (agnostic), but the environment is missing the files.
