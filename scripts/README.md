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
| Installed-App operations | `deploy.sh`, `deploy-receipt.ts`, `cutover-task-resources.ts`, `reconcile-human-approval-backlog.ts` | Read each tool's usage and the operating manual. State changes require explicit task/owner authority. |
| Manual experiments | `poc/`, `gym-*`, `benchmark-human-task-interface.ts`, `telegram-reply-smoke.ts`, `smoke-steering.ts` | May call models, send messages, or change state. Not part of PR CI; use an authorized disposable installation. |
| Legacy offline inspection | `session-query.ts` | Reads the old `.state/sessions/history` layout under the working directory, not current daemon status. |

For current daemon status, use its `--status` command with the intended runtime
roots. For Git history, use `git log -S 'literal' -- path` or `git log -G 'regex'
-- path` in the repository owning the file.

The old `batch-merge.sh` and `review-merge.sh` shortcuts were removed: bypassing
review, automatically choosing one side of conflicts, or deleting branches is
not part of the supported PR workflow. `status.sh` and `git-when.sh` assumed a
retired repository layout. Old `seed-metrics.ts` and
`backfill-metric-thresholds.ts` duplicated schema and App policy; metric
definitions belong to their owning Apps and use the existing metric service.
Their history remains available in Git; no installed data was removed.
