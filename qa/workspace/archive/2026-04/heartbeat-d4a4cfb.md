## QA Heartbeat — 2026-04-03T16:58Z

- HEAD: `d4a4cfb` (web: run in-process under launcher supervisor — no more orphan crashes)
- Reviewed range: `8681325..d4a4cfb`

### Evidence (files read)
- `src/app/may.ts`
  - Adds in-process Web UI startup guarded by `WEB_PORT` (default `8080`): dynamically imports `./ui/web.js` and calls `startWebUI({ stateDir: PERSIST_DIR, port: WEB_PORT })`.
  - On failure, emits a bus info message: `[web] Failed to start: ...`.
- `container/entrypoint-console.sh`
  - Removes background `may-agent-web` (or bun web.ts) startup; comment notes web UI now runs in-process.
- `src/app/ui/web-static/index.html`
  - Pins marked.js CDN to `@15.0.12` (was unpinned).
  - Adds `window.onerror` handler that surfaces JS errors in a fixed top banner and logs to console.
- `test/gym/run-gym.sh`
  - Now a thin redirect to `scripts/gym-run.sh`.
- `scripts/lab-run.sh`
  - Extended experiment setup options: `append_context`, `remove_skill`, and per-arm `model` override (with restore).

### Mandatory gates
- `./node_modules/.bin/tsc --noEmit`: **PASS** (exit 0; no output)
- `./node_modules/.bin/vitest --run`: **FAIL** (36 failed, 1621 passed; 123 files; exit 1)

### Issues
- **CRITICAL (pre-existing / not caused by d4a4cfb)**: repo test suite remains red (36 failures) primarily due to the earlier session-archival removal + API changes (e.g. tests expecting `sessions/history/`, missing exports like `isToolError`, missing `(manager as any).applyContextUpdates`, etc.). The new web/lab/gym script changes do not touch those failing components.
- **IMPORTANT**: `may.ts` reports web startup failures as `type: "info"` events. If ops/telemetry treats `info` differently than `log:error`, failures to serve the UI could be under-signaled.

### Verdict
CONDITIONAL — The changes in `d4a4cfb` look coherent and TypeScript-clean, but cannot be considered shippable while `vitest --run` is failing (36 tests).

### Notes
- Attempted to append this entry into `agents/qa/workspace/journal.md` but the append failed due to shell quoting/Node string mistakes; to avoid further risk, this entry is written as a standalone heartbeat file.
