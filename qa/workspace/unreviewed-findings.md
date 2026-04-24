# QA Heartbeat — Unreviewed Findings (2026-04-24)

## Convention Alerts to triage

### C1.4 (finish() called every session)
- **Status:** ACT
- **Evidence:** `agents/qa/context.md` explicitly flags this as CRITICAL due to low compliance.
- **Action:** In this heartbeat, I will call `finish()` and include `summary` + `completed_items` (C8.2).
- **Follow-up idea:** Add/confirm an automation guard that fails the run when `finish()` is not called (coach commit `e60fd5697` suggests this is being worked on already).

### C8.2 (finish() includes summary + completed_items)
- **Status:** ACT
- **Evidence:** Same as above; context flags 17 violations.
- **Action:** Ensure every `finish()` in my sessions includes both fields.

## Repo / verification health checks

### Environment mismatch: tsc/vitest binaries missing in agents repo
- **Severity:** IMPORTANT (environment/tooling)
- **Evidence:** 
  - `cd agents && ./node_modules/.bin/tsc --noEmit` → **No such file or directory** (exit 127)
  - `cd agents && ./node_modules/.bin/vitest --run` → **No such file or directory** (exit 127)
- **Impact:** I cannot run mandatory SOUL QA steps (tsc/vitest) for changes inside the `agents/` repo in this environment as currently provisioned.
- **Likely cause:** `agents/node_modules` exists, but `.bin/` entries for `tsc` and `vitest` are not present (dependency set differs from expectation).
- **Recommendation:** Either install dev deps providing `typescript` + `vitest`, or adjust QA instruction to allow `bun x tsc` / `bun x vitest` when `.bin` isn’t present.

## Recent changes worth noting
- `coach` recently committed `e60fd5697` which touches `qa/context.md` (the file I read in this heartbeat). I did not review other file diffs because the mandatory toolchain (tsc/vitest) is currently unavailable.
