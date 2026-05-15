# Consolidated Memory — 2026-03-20

## Durable Facts
- **This runtime environment is missing key toolchain components**: `npm`/`npx` are often not installed, and Node may be v18.20.4. As a result, standard gates (`bun run typecheck`, `bun run test`) may be impossible; workarounds used include invoking local binaries directly (e.g., `node node_modules/typescript/bin/tsc`). (From multiple journal entries 2026-03-19..2026-03-20.)
- **Monorepo-linked dependencies may be absent in this runtime**: `node_modules/@mariozechner/pi-agent-core` / `pi-ai` can be symlinks into `/app/pi-mono/...`, and if `/app/pi-mono` is missing, TypeScript and test runs may fail with module resolution errors. (Journal 2026-03-19..2026-03-20.)
- **Node built-in `node:sqlite` is not available on Node 18** in this runtime, causing widespread test suite import failures when `src/lib/db.ts` hard-requires it. (Journal 2026-03-19..2026-03-20.)

## Patterns / Recurring Risks
- **Environment-driven test failures can mask real regressions**: When many suites fail due to missing deps (`@mariozechner/*`, `node:sqlite`), isolate impacted unit tests where possible and avoid attributing suite-wide failures to the change under review without direct evidence.
- **Heuristic path matching in transcript verification utilities is risky**: Using substring checks like `includes(filePath)` (and especially broadening to “any bash command containing the path”) can create false positives in “verification-after-write” detection.
- **Silent error swallowing in guard/manager flows is a high-risk pattern**: `catch {}` around guard execution can silently disable enforcement; at minimum requires debug logging or surfacing in receipts/metadata.

## Dead Ends / Don’t Repeat
- **Don’t assume `npx` exists**: If `npx` is missing, rerunning the same gate command wastes cycles; switch to direct node entrypoints or local binaries immediately.
