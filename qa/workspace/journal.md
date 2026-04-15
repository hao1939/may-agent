# QA Journal

## 2026-04-15T09:32Z — QA proactive scan
- Reviewed latest commit in repo: 1115e7d8 (adds/updates `test/workflow-tool.test.ts`).
- Read `test/workflow-tool.test.ts`: new tests cover workflow tool list/run/event emission, ctx.agent fallback to `unknown`, and defensive rejection of `runAgent(undefined)` and `runAgent("undefined")`.
- `./node_modules/.bin/tsc --noEmit`: PASS (no output).
- `./node_modules/.bin/vitest --run`: FAIL due to 9 suites with missing imports under `agents/may/handlers/*` and `agents/optimizer/workflows/investigate-and-fix.js`. 115 files passed; 1766 tests passed. This appears to be environment/module layout mismatch rather than caused by the new `test/workflow-tool.test.ts`.

Verdict: CONDITIONAL — patch-specific tests look reasonable and TS builds, but overall vitest run is currently failing due to missing agent handler/workflow modules.

2026-04-15T10:01Z — Proactive QA scan: reviewed commit 1115e7d8 adding `test/workflow-tool.test.ts` (workflow tool list/run/steering/ctx.agent). Mandatory gates: `./node_modules/.bin/tsc --noEmit` PASS; `./node_modules/.bin/vitest --run` PASS (124 files, 1898 tests). No new issues found in the test logic aside from some non-critical commentary mismatch inside the “steer() queues…” test (test expects error because steering can’t happen in time — consistent with comment).

2026-04-15T12:31Z — Proactive QA scan: reviewed HEAD 5978a052 touching `src/app/ui/socket.ts` + `src/app/ui/telegram.ts` (output channel noise reduction). Mandatory gates: `./node_modules/.bin/tsc --noEmit` PASS; `./node_modules/.bin/vitest --run` PASS (123 files, 1843 tests). Findings: (1) CRITICAL: `src/app/ui/socket.ts` has duplicate `if (cmdType === "fork")` branches; second branch is unreachable and likely intended for a different command alias (risk: incorrect argument mapping for fork). (2) IMPORTANT: `cmdType === "cancel_task"` maps to `{type:"cancel_all"}` despite its name suggesting cancel a single task; verify protocol or rename.

2026-04-15T13:01Z — QA review of HEAD 5978a052 (“reduce output channel noise”). Read `src/app/ui/telegram.ts` and `src/app/ui/socket.ts`. Gates: `./node_modules/.bin/tsc --noEmit` PASS; `./node_modules/.bin/vitest --run` PASS (123 files, 1843 tests). Verdict: CONDITIONAL — logic smells remain in socket command normalization: duplicate `if (cmdType === "fork")` branches (unreachable) and potentially incorrect alias mapping for `cancel_task`.

2026-04-15T13:30Z — Proactive QA scan: reviewed HEAD 06a0f563 adding `scripts/scenario-oracle.sh` (before/after oracle generation for gym scenarios). Read the script. Gates: `./node_modules/.bin/tsc --noEmit` PASS; `./node_modules/.bin/vitest --run` PASS (123 files, 1843 tests). Findings: IMPORTANT — script uses `eval` for `--run-cmd` and `--fix-cmd`; acceptable for a local dev tool but should be explicitly documented as “trusted input only” to avoid accidental unsafe usage. Also note: `npm install` failures are swallowed (`|| true`), potentially hiding dependency issues.

