# E2E harness findings — gaps surfaced while building test/e2e/

**Status:** open
**Author:** assistant via e2e-suite work
**Date:** 2026-05-19

While building the e2e harness (Phase 1: sandbox + E1–E4), six concrete gaps
in implementation or documentation surfaced. None of them broke the e2e work
itself — each had a local workaround — but each is a real trap for anyone
writing an agent, handler, or workflow, and each was discovered by trying to
do something the docs imply is straightforward.

This proposal records the findings so they can be triaged and fixed
deliberately, instead of being absorbed into the test code as more
yet-more-undocumented knowledge.

## Findings

### F1. `cron.json` shape is undocumented and easy to get wrong

**Status:** RESOLVED — `shared/may-agent-docs/2b-manual/agent-convention.md`
and `handler-authoring.md` now state that `cron.json` is a top-level JSON
array of entries and that the entire file is ignored unless `"cron"` is in
`agent.json` tools[]. (Implementation only accepts the array shape — a
leading `{ ... }` object is rejected with a clear error.)

**Surfaced when:** writing E1's fixture cron.json as `{ "jobs": [...] }`.

The real format is a **top-level JSON array** of entries:

```json
[
  { "name": "...", "handler": "...", "intervalMs": 600000, "agent": "...", "enabled": true }
]
```

`agent-convention.md` lists `cron.json` as "Optional. Cron job definitions."
`handler-authoring.md` § Registering shows one entry (an object), which is
ambiguous about whether the file holds one entry or an array. No doc spells
out "top-level array".

Wrong shapes are silently ignored — the daemon logs nothing useful when
`cron.json` is malformed in this way; it just doesn't load entries.

**Fix:** document the top-level-array shape in `agent-convention.md` and the
`handler-authoring.md` § Registering example. Optionally add a parse-error
log line when `cron.json` is not an array.

### F2. `cron.json` is silently ignored unless the agent has `"cron"` in tools

**Status:** RESOLVED —
`src/app/loader/agent-registry-loader.ts` now emits a startup info-level
warning when `cron.json` is on disk but `agent.json` tools[] does not
include `"cron"`. The message names the agent and tells the author to add
`"cron"` to tools. Regression test:
`test/integration/agent-loader.test.ts “warns when cron.json exists but
agent.json tools[] omits cron”`. Documentation in `agent-convention.md`
and `handler-authoring.md` also calls out the gate explicitly.

**Surfaced when:** writing E1's fixture agent with `"tools": []`.

The cron config is read inside the `cron` tool's loader
(`src/app/loader/toolset-loader.ts:152`). Agents whose `tools` array does not
include `"cron"` will have a `cron.json` on disk that is **never loaded**, with
no warning.

This is a silent failure. The agent looks correctly configured. Cron jobs
never fire. There is no log line saying "found cron.json but cron tool not
enabled".

**Fix options:**
- Decouple cron-entry loading from the cron *tool*. The tool is for agents to
  edit cron from inside a session; loading entries should be unconditional
  when `cron.json` exists.
- Or, emit a warning when a `cron.json` is present but the cron tool is not
  enabled.

Document either way in `agent-convention.md`.

### F3. `intervalMs` has an undocumented 10s minimum

**Status:** RESOLVED — `handler-authoring.md` `Registering (cron.json)`
section now states the 10s floor explicitly and clarifies that entries
below the floor are **rejected** (not clamped) at load time, with the rest
of `cron.json` continuing to load.

**Surfaced when:** writing E1 with `intervalMs: 1000`.

The daemon logs `[cron:may] Cron job "e2e-noop" intervalMs too low (1000ms <
10s minimum)` and silently drops the entry. The minimum is reasonable; the
documentation does not mention it.

**Fix:** add to `handler-authoring.md` § Registering: "`intervalMs` minimum is
10000 (10 seconds). Lower values are rejected at load time."

### F4. Hot-reloaded handlers cannot use module-level state

**Status:** RESOLVED — `handler-authoring.md` now has a `Module-level state
is wiped on every fire` subsection explaining the hot-reload mechanism and
listing safe alternatives (`sdk.metrics.record`, `sdk.getDb()`, event
emit + `sdk.query.events`).

**Surfaced when:** writing E4's fixture handler with `let fireCount = 0` at
module scope. The counter resets every fire because the handler-loader uses
`withFreshImportToken` to invalidate the module cache for each invocation.

`handler-authoring.md` § Hot Reload says only:

> Handlers are hot-reloaded on every tick. Edit the file → next fire picks up
> changes. No restart needed.

The implication — that **any module-level state is wiped between fires** — is
not stated. This is a subtle correctness trap. Real handlers that use
counters, circuit breakers, dedup flags, throttling timestamps, etc., must
persist that state externally (DB, file, or via the SDK's helpers like
`dispatch-dedup-guard`).

`handler-authoring.md` does mention "deterministic preflight or skip checks"
but never says where preflight state should live for cross-fire continuity.

**Fix:** add a note to `handler-authoring.md` § Hot Reload:

> Because each fire re-imports the handler module, **module-level state does
> not persist across fires**. State that must survive between fires belongs
> in the DB (via `sdk.getDb()` or `sdk.query`), in a file under the agent's
> workspace, or in an SDK helper that already handles persistence (e.g.
> `dispatch-dedup-guard`, `circuit-breaker`).

### F5. `sdk.metrics.record()` alone does not trigger alerts

**Status:** RESOLVED — the `Simple Metric Recorder` example in
`handler-authoring.md` no longer writes via raw SQL. It now calls
`sdk.metrics.record(...)` followed by `sdk.metrics.evaluate(...)` and an
explicit pitfall callout warns that a raw `UPDATE metrics ...` will not fire
the breach/recovery pipeline.

**Surfaced when:** writing E4 expecting `record(id, breachingValue)` to emit
`metric.breach`. It does not. Only `evaluate()` reads the snapshot and emits
breach events; `record()` just inserts the snapshot row.

`sdk-quickstart.md`'s "Choose the Right Primitive" table is silent on this.
`metric-alerts.md` § Pipeline talks about the lifecycle (alert visible →
owner triages) but doesn't say which call surface produces the breach event.
The simple metric recorder example in `handler-authoring.md` writes the
`current` value via raw SQL and never calls `evaluate()` — that example would
silently fail to produce alerts in production.

In production, the `metrics-snapshot` handler periodically calls `evaluate()`
for all metrics. That central evaluator is what makes the pipeline work. For
a handler that defines and records its own metric, the author must know to
also call `evaluate()` (or rely on the next `metrics-snapshot` tick, which
introduces unbounded latency and an implicit dependency on a global handler).

**Fix:**
- Document `record()` vs `evaluate()` separation explicitly in
  `sdk-quickstart.md` § Choose the Right Primitive and in `metric-alerts.md` §
  Pipeline.
- Update the `handler-authoring.md` § Simple Metric Recorder example to call
  `evaluate()` after `record()`, or to clearly defer to `metrics-snapshot`.
- Consider whether `record()` should auto-evaluate the recorded metric. The
  cost is one DB read; the benefit is that the most natural API call also
  works the way the docs imply.

### F6. `@may-agent/sdk` does not resolve in dev mode

**Status:** RESOLVED — see resolution notes below.

**Surfaced when:** writing E3a's fixture workflow with
`import { parseProjectMeta } from "@may-agent/sdk"`. The dynamic import fails
with `Cannot find module '@may-agent/sdk' from <path>`.

**Initial hypothesis (turned out to be wrong):** the compiled binary registers
a `Bun.plugin()` resolver in `src/app/binary-entry.ts`, so I assumed that
plugin could be moved/shared so dev mode would also resolve the bare
specifier. **It can't.** `Bun.plugin()` hooks (`onResolve`, `onLoad`) only
fire during `Bun.build` bundling, not during runtime ESM import. Verified by
minimal repro: a plugin registered with `Bun.plugin({...})` and then
immediately `await import("@may-agent/sdk")` does not trigger the plugin's
`onResolve`. The plugin in `binary-entry.ts` is effective only because the
bundler runs it when compiling the binary; the comment in that file ("Register
SDK resolver so dynamically-imported handler/workflow files can use ...")
overstates its runtime relevance.

**Why production works:** the compiled binary statically inlines all SDK
symbols at build time (bundler resolution via the plugin). Dev mode works
only because `/app/node_modules/@may-agent/sdk/` exists, populated via the
`file:` dependency declared in `/app/package.json`. The repo's own
`package.json` (`projects/platform/repos/may-agent/package.json`) has no
such dependency and no workspaces declaration, so the same dev-mode
resolution does not work from the repo's own context (which is what the e2e
tests use).

**Real fix:** node_modules entries for both contexts.

1. `/app/package.json` already has `"@may-agent/sdk": "file:projects/platform/repos/may-agent/packages/sdk"`. This is sufficient for the `/app/` runtime (real agents/projects).
2. `projects/platform/repos/may-agent/package.json` needs the same. Either add `"workspaces": ["packages/*"]` (cleanest, declares the workspace structure explicitly) or add a `file:` self-reference. Workspaces is the conventional choice.
3. After `bun install` in the repo, `<repo>/node_modules/@may-agent/sdk` is a symlink to `<repo>/packages/sdk`. Dynamic imports from any file under the repo (test fixtures, the daemon's own dynamic loads) resolve correctly.
4. The e2e sandbox still needs its own `node_modules/@may-agent/sdk` because it lives at `/tmp/may-e2e-<runId>/` outside any package boundary. The harness symlinks the SDK into the sandbox — this is not a workaround for a bug; it's giving the sandbox its own node_modules, the same role `/app/node_modules/` plays for `/app/`.

**The downstream consequence — `shared/agent-sdk.ts` is still a dead workaround.**

`shared/agent-sdk.ts` exists for one reason: to re-export `@may-agent/sdk`
via an on-disk relative path so dynamically-loaded files can avoid the bare
specifier. It also re-exports a small set of app-only helpers (`growth.*`,
`finish-guard.*`), but **zero callers** in the codebase use it for those
helpers (audit: 52 importers of `agent-sdk.ts`; all import names that are
already exported by `@may-agent/sdk`; no importer uses the app-only
re-exports). The file is pure forwarder for SDK symbols.

Once both contexts have working node_modules entries for `@may-agent/sdk`,
`shared/agent-sdk.ts` has no reason to exist. Every workflow, handler, and
helper file should import from `@may-agent/sdk` directly for both types and
values. One import path, one source of truth.

**Recommended sequencing:**

1. Add `"workspaces": ["packages/*"]` to `projects/platform/repos/may-agent/package.json`. Run `bun install` in the repo to materialize `node_modules/@may-agent/sdk` as a workspace symlink.
2. Verify the repo's existing tests still pass (`bun test src/ packages/ test/`). Verify dev-mode daemon still loads handlers.
3. Verify e2e suite still passes. The harness sandbox symlink (in `test/e2e/lib/sandbox.ts`) is independent; it stays as the sandbox's own node_modules. After this step the e2e tests work with bare-specifier value imports in fixture workflows.
4. Audit: `grep -rn "agent-sdk" --include="*.ts"` should still produce 52 importers. Confirm all are pure SDK forwarding (no `growth.*` / `finish-guard.*` consumers).
5. Mechanical rewrite: 52 files change. Each file's import line goes from `from "../../../shared/agent-sdk.ts"` (or similar) to `from "@may-agent/sdk"`. This is one large but trivial diff.
6. Delete `shared/agent-sdk.ts`. Zero callers remain.
7. Update `scripts/seeds/project-iteration-seed.ts` so future project forks generated from the seed point at `@may-agent/sdk`.

**The misleading comment in `binary-entry.ts` should also be corrected.** It
currently implies the plugin enables runtime dynamic import resolution; it
actually only affects build-time bundling. The comment should say: "Bundler
plugin that rewrites `@may-agent/sdk` to its source path during
`bun build --compile`. Without this, the bundled binary cannot resolve the
bare specifier statically."

**Resolution (delivered):**

1. **Repo workspaces declaration.** Added `"workspaces": ["packages/*"]` and
   `"@may-agent/sdk": "workspace:*"` to
   `projects/platform/repos/may-agent/package.json`. `bun install` materializes
   `<repo>/node_modules/@may-agent/sdk` as a symlink to `packages/sdk`. The
   repo's own tests and any process spawned with `cwd: REPO_ROOT` resolve
   the bare specifier through this entry. (`/app/package.json` already had
   the equivalent `file:` dep for the `/app/` host context.)

2. **52-importer rewrite.** All `agent-sdk.ts` and `agent-sdk.js` import
   paths under `/app/agents/`, `/app/shared/lib/`, `/app/projects/*/workflows/`,
   `/app/scripts/seeds/` were mechanically rewritten to `@may-agent/sdk`.
   The two callers of the app-only `growth.*` re-exports
   (`agents/coach/workflows/growth-cycle.ts`,
   `agents/coach/workflows/training-sprint.ts`) were redirected to import
   directly from `shared/lib/growth.js`. Zero callers of the finish-guard
   re-exports existed.

3. **Bridge deleted.** `shared/agent-sdk.ts` removed. One source of truth:
   the `@may-agent/sdk` package.

4. **Seed updated.** `scripts/seeds/project-iteration-seed.ts` and the
   migrator `scripts/migrate-project-workflow.mjs` now reference
   `@may-agent/sdk` directly; no path rewrite is performed on the SDK import.

5. **Comment corrected.** `src/app/sdk-resolver-plugin.ts` now states
   accurately that `Bun.plugin()` only affects build-time bundling, lists
   the three runtime resolution paths (`/app/` file: dep, repo workspaces,
   sandbox-local symlink), and explains why all three coexist.

6. **E3a unblocked.** `test/e2e/e3a-task-driven-project-loop.test.ts`
   passes against a live sandbox — the harness symlinks the SDK into the
   sandbox's local `node_modules/@may-agent/sdk` (because the sandbox lives
   outside any workspace at `/tmp/may-e2e-<runId>/`, importer-relative
   resolution wouldn't otherwise find a node_modules entry).

**What still needs explicit handling:**

- The e2e sandbox symlink stays in `test/e2e/lib/sandbox.ts`. Bun's ESM
  resolver walks up from the importer file (not just cwd) when resolving
  bare specifiers, so dynamically-loaded files at `/tmp/...` need their own
  ancestral node_modules. This is structural, not a workaround.
- If a future change tries to deliver SDK to compiled binaries by relying on
  the resolver plugin alone (no node_modules), it will fail at runtime.
  Either ship node_modules with the binary or keep using the static bundler
  inlining the plugin enables at compile time.

### F7. `info` events emitted from daemon-lifecycle don't surface in `--cron --socket` mode

**Status:** RESOLVED — `src/app/daemon-lifecycle.ts` now routes reload
summaries through `log("info", ...)` in addition to `bus.emit({type:"info"})`.

**Surfaced when:** writing E5. The test fired `reload` over the socket,
the command-router received it, `handleReload` ran to completion (verified
with a `console.log` probe), yet the daemon log showed no `[reload] ...`
summary line. The `bus.emit({ type: "info", message: ... })` calls inside
`handleReload` reached the bus but were silently dropped because no
subscriber writes `info` events to stdout in `--cron --socket` mode.

`info` events are only forwarded to stdout by `attachConsoleUI`, which is
guarded behind `--console` or `--chat` flags. The daemon process running
in production is `--cron --socket` (no console attach). So any code that
relies on `bus.emit({type:"info"})` for operator visibility is effectively
invisible in production.

Counter-examples that DO appear: anything written via `log()` from
`src/lib/log.ts` (which uses `console.log` directly), and direct
`console.log` calls in the codebase (e.g. `daemon-agents.ts` prints
`[agents] Loaded N: ...` that way).

**Fix:** `handleReload` now calls both `log("info", summary)` (always
visible in daemon log) and `bus.emit({type:"info", message: summary})`
(for future bus subscribers — telegram echoes, chat console, etc.). The
same pattern should be applied to other ops-facing info emits if they
are meant to be observable in daemon mode.

**Broader question (out of scope for the immediate fix):** should
`attachConsoleUI` (or a slimmed log-only variant) auto-attach when neither
`--console` nor `--chat` is provided? Right now daemon mode has *no*
bus→stdout transport at all. This was probably intentional to keep cron
stdout clean, but it means `info` events from any subsystem are invisible
unless they also call `log()`. A `--quiet` opt-out would be cleaner than
the current implicit gate.

## Recommended sequencing

These six findings are independent and small. Suggested order:

1. **F2 + F6** (silent failures) — highest impact, hardest to diagnose. Both
   are real bugs, not docs. F6 is the largest in churn (52-file rewrite to
   collapse `shared/agent-sdk.ts`) but the rewrite is mechanical and removes
   a long-standing source of import-path confusion.
2. **F4 + F5** (silent correctness traps) — both have doc fixes and one of
   them (F5) has a defensible API-shape change too.
3. **F1 + F3** (documentation only) — trivial; one-line additions.

Each fix is roughly a 1–4 line change to source or 1 short paragraph in
docs, except F6 which is small core changes plus a mechanical 52-file
import-path rewrite. Total work: ~1–2 days including the F6 rewrite and
verification.

## Out of scope for this proposal

The e2e harness work proceeds with the F6 workaround (sandbox symlink). The
remaining e2e cases (E3a, E7) do not depend on any of these findings being
fixed before they can be written. This proposal records the findings so they
get triaged on their own merits, not silently absorbed into the test code.
