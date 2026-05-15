# Investigation Report: Missing `ENABLE_DARK_MODE` Feature Flag

**Date:** 2026-03-22  
**Reported Issue:** User reports `ENABLE_DARK_MODE` feature flag is missing from production configuration.

---

## 1. Does the flag exist in the codebase?

**Yes — `ENABLE_DARK_MODE` is present in the environment configuration.**

A recursive search for `ENABLE_DARK_MODE` across all files in the `environment/` directory found it in one location:

- **`environment/env-vars.conf`, line 18** — under the `# Feature Flags` section:
  ```
  ENABLE_DARK_MODE=true
  ```

No other files in the `environment/` directory (`.js`, `.ts`, `.json`, `.yaml`, `.log`, `.txt`) reference `ENABLE_DARK_MODE`.

## 2. Is it in any config file?

**Yes — it is set in `env-vars.conf`.**

The flag is defined in the environment variables configuration file (`env-vars.conf`) alongside two other feature flags:

| Flag | Value | File |
|------|-------|------|
| `ENABLE_DARK_MODE` | `true` | `env-vars.conf` |
| `ENABLE_BETA_FEATURES` | `false` | `env-vars.conf` |
| `ENABLE_NEW_DASHBOARD` | `true` | `env-vars.conf` |

It is **not** referenced in:
- `deploy.json` — contains deployment settings (replicas, health checks, rolling update config) but no feature flags
- `resources.yaml` — contains only CPU/memory resource quotas

## 3. What do the deployment logs show?

**No deployment logs exist in the `environment/` directory.**

The directory contains only these files:
- `README.md` — documentation and constraints
- `env-vars.conf` — environment variables (where the flag lives)
- `deploy.json` — deployment configuration
- `resources.yaml` — resource quotas
- `optimization-report.md` — unrelated optimization report

There is no `deploy-log.txt`, `deploy.log`, or any other log file that would show when `ENABLE_DARK_MODE` was last toggled. Without deployment logs, there is no history of when the flag was added or last changed.

## 4. Recommendation

**The flag exists and is set to `true` — no action needed to add it.**

The user's report that `ENABLE_DARK_MODE` is "missing from production configuration" does not match the evidence. The flag is present in `env-vars.conf` and set to `true`, meaning dark mode should be enabled in production.

### Possible explanations for the user's report:
1. **The application may not be reading `env-vars.conf` correctly** — verify the deployment process injects these environment variables into the running containers.
2. **The flag may be overridden at runtime** — check if there's a separate runtime config or feature flag service that takes precedence over `env-vars.conf`.
3. **The user may be looking in the wrong file** — the flag is in `env-vars.conf`, not in `deploy.json` or `resources.yaml`.

### Suggested next steps:
1. Confirm with the user where they expected to find the flag.
2. Verify the deployment pipeline loads all variables from `env-vars.conf` into the production environment.
3. Check application logs to confirm `ENABLE_DARK_MODE` is being read at startup.
4. Consider adding deployment logs to the `environment/` directory for future audit trail.

---

*Files searched: all files in `environment/` — `env-vars.conf`, `deploy.json`, `resources.yaml`, `README.md`, `optimization-report.md`*  
*Search method: recursive grep for `ENABLE_DARK_MODE` across the full project*
