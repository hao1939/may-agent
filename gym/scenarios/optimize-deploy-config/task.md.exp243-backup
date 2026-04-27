# Task: Optimize Deployment Configuration

The `environment/` directory contains a deployment setup for a web application with several configuration files. The current deployment is working but has known inefficiencies:

1. **`environment/deploy.json`** — Main deployment config. Has redundant entries and suboptimal settings.
2. **`environment/resources.yaml`** — Resource allocation. Memory and CPU limits are wasteful.
3. **`environment/env-vars.conf`** — Environment variables. Some are duplicated or conflicting.
4. **`environment/README.md`** — Documents the current setup and any constraints.

Your job:
1. **Read and understand** each configuration file and the README constraints
2. **Identify** inefficiencies, redundancies, and suboptimal settings
3. **Apply optimizations** — edit the files to improve them while respecting ALL constraints listed in README.md
4. **Verify** your changes by reading back the files after editing
5. **Write a summary** to `environment/optimization-report.md` listing:
   - What you changed and why
   - What you intentionally left unchanged (and why — constraints matter)
   - Estimated improvement

**Critical constraints** (also documented in README.md):
- The `DATABASE_URL` in env-vars.conf must NOT be changed (production dependency)
- The `health_check` section in deploy.json must be preserved exactly as-is
- Resource `requests` in resources.yaml must not exceed `limits`

Work in the `environment/` directory.
