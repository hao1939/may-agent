# Script guide

Start with `bun run ci` for source verification. Scripts are not all safe to
run as tests: some require an installed App tree, live state, or model access.
Current design and operating procedures live in `may-agent.app/docs`, not here.

| Purpose | Entry points | Boundary |
| --- | --- | --- |
| Source checks | `bun run ci`, `check:canonical-app-boundary`, `check:event-graph` | No live installation required for CI. |
| Build | `build-runtime-binary.ts`, `build-webui.ts`, `build-image.sh` | Builds are not deployments. Use `MAY_AGENT_UI_OUTPUT_DIR` to keep UI output in an isolated checkout. |
| Image verification | `ci-container-smoke.sh` | Disposable candidate container with fixture agents; no host mounts or desktop stack. |
| Diagnostics | `sample-runtime-quiet.ts`, `event-graph-check.ts`, `log-viewer.html` | Select the intended installation; do not confuse source fixtures with live evidence. |
| Installed-App operations | `deploy.sh`, `deploy-receipt.ts` | Read each tool's usage and the operating manual. State changes require explicit task/owner authority. |
| Gym compatibility | `gym-run.sh`, `gym-baseline.sh`, `gym-batch.sh`, `gym-record.ts` | Existing sibling consumers remain. Scenario execution calls models; baseline/recording writes `.state/may.db`. Only `gym-run.sh --list` and `gym-batch.sh --help` are read-only discovery. |
| Manual diagnostics and experiments | `poc/`, `benchmark-human-task-interface.ts`, `telegram-reply-smoke.ts`, `smoke-steering.ts` | May call models, send messages, or change state. Not part of PR CI; use an authorized disposable installation. |

App-specific evaluation and reporting tools belong to their owning App or
project, not this generic Host. For current daemon status, use its `--status`
command with the intended runtime roots. For Git history, use
`git log -S 'literal' -- path` or `git log -G 'regex' -- path` in the repository
owning the file.

The sibling Gym CLI still imports `src/app/direct-agent.ts`, its May alignment
benchmark calls `gym-baseline.sh`, and the coach's Gym helper calls
`gym-batch.sh`. Retain that adapter and the wrappers' runner/recorder dependencies
until their consumers migrate together. The adapter uses the shared prepared
executor; it does not create another runtime or durable work owner. A Host-only
reference scan or canonical `.app` check does not establish that Gym is unused.
Portable tests cover these entry points with fixtures, not model-backed trials.

The old `batch-merge.sh` and `review-merge.sh` shortcuts were removed: bypassing
review, automatically choosing one side of conflicts, or deleting branches is
not part of the supported PR workflow. `status.sh` and `git-when.sh` assumed a
retired repository layout. Old `seed-metrics.ts` and
`backfill-metric-thresholds.ts` duplicated schema and App policy; metric
definitions belong to their owning Apps and use the existing metric service.
Their history remains available in Git; no installed data was removed.
