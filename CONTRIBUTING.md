# Contributing to May Host

Keep changes small, independently reviewable, and based on current `main`.
Do not bundle unrelated local commits into a CI or bug-fix PR. A draft means
work or validation remains; do not describe it as ready to merge.

## Local verification

Use Node 24 for parity with the image and the Bun version in `.bun-version`.

```sh
bun install --frozen-lockfile
bun run ci
```

`check:ci` runs Host/SDK type checks, the canonical App-boundary check, and
ESLint errors. Existing lint warnings remain visible through `bun run lint`;
they are not a clean-lint claim. Whole-tree formatting is not yet a merge gate:
format the lines you change without reformatting unrelated code.

`test` runs source, package, integration, daemon, browser, PoC, and build/deploy
script tests using two isolated Bun workers. The bounded worker count avoids
oversubscribing small CI machines with daemon and compiler subprocesses.
No automatic test retries hide a failure. Reproduce and explain flaky results.

Install Chrome/Chromium for browser tests (or set `CHROME_PATH`). CI requires
the browser test to execute. Locally, `E2E_NO_UI=1` explicitly skips it; a
missing prerequisite is reported as a skip, not a pass.

Tests inspecting the separately maintained Apps, installed agent catalog, and
shared instructions run separately:

```sh
MAY_AGENT_APP_ROOT=/absolute/path/to/app bun run test:deployment
```

That command requires an explicit, existing installation and does not certify
all deployed behavior. Legacy cron checks are explicitly skipped when the
installation no longer uses the optional May cron file. Ordinary CI must work
from this repository alone.
Model-backed experiments require separate credentials and explicit authority;
neither those experiments nor a production restart belongs in PR CI.

## GitHub checks

Every PR and push to `main` runs two independent Linux checks:

- **Quality** runs the checks and portable tests, including real daemon/socket
  and browser tests. JUnit results are kept even when tests fail.
- **Container** builds the actual image with its source revision embedded and
  probes an isolated instance. It does not mount `/app`, consume deployment
  credentials, publish an image, or deploy. Logs are retained on failure.

Obsolete runs are cancelled, image layers are cached, and actions are pinned
to commit SHAs. Dependabot groups weekly action updates and proposes base-image
updates. Bun/npm dependency and embedded CLI updates must include their lockfile
or checksum changes and relevant compatibility tests; do not auto-merge them.
There is no macOS/Windows matrix: the released deployment is Linux/container.

## Review and merge rules

Use a PR, pass both checks on its current revision, resolve review discussions,
and obtain an independent human review when another maintainer is available.
For Host/App contract changes, link both revisions and state the integration
order. Do not merge incompatible halves or infer deployment authority from a
merged PR. Prefer squash merges with a clear scoped title such as
`fix(tasks): preserve accepted results after restart`.

When the repository plan supports branch protection, configure `main` to
require a PR, resolved conversations, up-to-date **Quality** and **Container**
checks, and prohibit force pushes/deletion. Require one approval when there is
an eligible reviewer other than the author. Do not require an impossible
self-approval in a single-maintainer repository.

At setup time GitHub reported that this private repository's plan does not
support branch protection or rulesets. These rules are therefore contributor
policy, not enforced merge restrictions. Enabling paid-plan protection is an
owner decision; never change visibility or billing to bypass that boundary.

Deployment remains separate: use the existing Host Operations App task and
documented deployment procedure. Never use the local production Compose file
as a CI sandbox.
