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
ESLint errors, including unused imports, bindings, and private helpers. Public
callback parameters intentionally retained for compatibility use an `_` prefix.
Explicit `any` annotations remain warnings visible through `bun run lint`;
they are not a clean-type claim. Whole-tree formatting is not yet a merge gate:
format the lines you change without reformatting unrelated code.

`test` runs source, package, integration, daemon, browser, PoC, and build/deploy
script tests using two isolated Bun workers. The bounded worker count avoids
oversubscribing small CI machines with daemon and compiler subprocesses.
No automatic test retries hide a failure. Reproduce and explain flaky results.
Use bounded asynchronous subprocess calls in test fixtures; synchronous calls
can block the event loop and prevent the test runner's timeout from firing.
Scheduled daemon fixtures use the existing explicit startup offset to avoid
random initial delays; real recurring timers and lifecycle assertions remain.

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

## Keeping tests useful and fast

For the local edit loop, run the affected contract directly, for example:

```sh
bun test src/app/core/tasks/app-task-runtime-policy.test.ts
bun run test:changed
```

`test:changed` uses Bun's dependency selection against your fetched `origin/main`.
It is a convenience, not merge proof: dynamic imports, subprocess fixtures, and
served JavaScript may not be inferred. Run their owning tests explicitly.
`test:components` selects `src/` and `packages/`; it includes real Git, worker,
and build tests, not just unit tests. `test:unit` remains a compatibility alias.
The complete `bun run ci` remains the PR gate. See [test coverage ownership](test/README.md).

Measure JUnit and CI timings before optimizing; test count is not the target.
Use the smallest test that exercises real behavior, with integration tests for
the boundaries. Fresh in-memory SQLite is appropriate for reconciliation rules;
keep file-backed, multi-connection, and restart tests for storage guarantees.
Never share mutable databases between test cases to save setup time.

Test shipped behavior, not a copied parser, renderer, or policy in the test.
Keep one detailed owner for a contract and retain extra boundary tests only
where they catch a distinct failure. Use local HTTP fixtures with exact success
assertions; a failed request must not satisfy a success test. Share small data
factories, not live managers. Close databases and remove temporary roots in
teardown even when assertions fail; setup and cleanup are not test cases.

Wait for the exact event or result, not a fixed sleep. Keep real timers where
scheduling is what the test proves; other lifecycle tests can use real event
ingress. Remove examples that only exercise test-local SQL or algorithms, not
regressions that invoke production behavior. Do not skip slow coverage or add
automatic retries to make the suite look faster or greener.

Do not race a short timeout against child startup or a fixed output volume.
Test timeout selection at the execution boundary, real timer cancellation in a
process test, and retained output after observing that the output was written.

## GitHub checks

Every PR and push to `main` reports two independent Linux checks:

- **Quality** runs the checks and portable tests, including real daemon/socket
  and browser tests. JUnit results are kept even when tests fail.
- **Container** builds the actual image with its source revision embedded and
  probes the shipped binary's readiness and UI as its unprivileged user with
  fixture agents. This is not a desktop/VNC or production-App acceptance test.
  It does not mount `/app`, consume deployment credentials, publish an image,
  or deploy. Logs are retained on failure. Documentation/portable-test-only
  PRs report the image build as unnecessary, not as an executed smoke test.
  Runtime, dependency, container, CI, smoke-fixture, and unknown paths build;
  the complete PR diff (including deletions) is checked, not just its last
  commit. `main` and manual runs always build.

Keep feedback fast: no OS matrix, no extra coordination job, no repeated
dependency installation within a job. Quality runs independently of the image
build. Obsolete runs are cancelled. Main/manual builds populate the image
cache; PRs read it without uploading another large per-PR cache. Missing caches
still perform a complete build. Test files are excluded from Docker's source
layers, so they do not invalidate compiled-image caches.

Measure job and step timings in Actions before adding caches, sharding, or
removing coverage. The first hosted baseline took about 2 minutes for Quality
and 5m49s for the cold Container job; image export/load took 101 seconds and
cache upload took 124 seconds. These are observations, not guaranteed budgets.
Dependency installation took only 2 seconds, so it does not need another cache.

Actions are pinned to commit SHAs. Dependabot groups weekly action updates and
proposes base-image updates. Bun/npm dependency and embedded CLI updates must
include their lockfile or checksum changes and relevant compatibility tests;
do not auto-merge them.
There is no macOS/Windows matrix: the released deployment is Linux/container.

### Dependency and image maintenance

Dependabot checks `bun.lock`, Actions, and base images weekly. Keep Pi runtime
packages and TypeBox together, separate from routine tooling updates; a
pre-1.0 minor release can change runtime contracts. Major tooling changes also
need an explicit compatibility review. Check peer ranges before upgrading
TypeScript; a newer compiler may not yet be supported by the lint parser.

Keep `@types/node` on the same major as the minimum Node version in
`engines.node`, CI, and the image. Newer type definitions do not make newer APIs
available at runtime. Dependabot still proposes minor/patch type updates;
review major updates together with the Node runtime upgrade.

Keep one supported TypeScript 6 compiler for now. TypeScript 7.0 no longer
provides the compiler API used by `typescript-eslint`, so Dependabot excludes
only 7.0.x. The SDK export-contract test uses the public compiler CLI instead.
See the
[upstream migration guidance](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-60).
Reassess later versions when the lint integration is compatible, then verify a
frozen install, the SDK contract test, and the complete CI gate. Do not bypass
lint to force an upgrade. Explicit relative `paths` need no `baseUrl` or
deprecation suppression and work with the supported compiler.

Run `bun audit` when refreshing the lockfile and explain affected dependency
paths. Prefer updating the parent or removing unused packages over adding
another override. Existing overrides are transitive compatibility/security
pins: refresh within their major versions and remove them only when the
parent dependency graph no longer needs them. The Host uses built-in Bun/Node
SQLite, not `better-sqlite3`.

The CLI versions and terminal checksums live in `container/Dockerfile`; the
Bun version lives in `.bun-version`. Dependabot does not update those embedded
tool pins. Review them explicitly, retain exact versions, and validate CLI
flags/configuration and the image smoke test. For Codex, compare generated
schemas with the old CLI before updating `scripts/poc/codex-goal-protocol.snapshot.json`;
the image smoke test checks that snapshot against the shipped CLI without a
model call. Node/npm move together through
the Node base image. Upgrading the standalone Pi CLI does not upgrade the Pi
libraries linked into May. A new CLI version still needs model-backed checks
before claiming live provider compatibility.

Publish reviewed image changes as a new release and deploy separately. Do not
run ad-hoc global upgrades in a live container. Refresh base digests and check
OS/browser packages as part of image maintenance; an unchanged cached apt
layer is not evidence that security packages are current. `bun audit` covers
the project lockfile, not the image's OS packages or global CLI dependency trees.

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

## Publication privacy

Publish portable source and synthetic examples, not installation details.
Keep personal home paths, login names, server addresses, private repository
URLs, local agent configuration, transcripts and operational data out of
commits, PR descriptions, screenshots, logs and uploaded artifacts. Use
example users/projects and reserved example domains/IP addresses in fixtures.

Keep local credentials in ignored environment/configuration files. Add private
mounts and installation-specific Git settings in the ignored
`container/compose.local.yml`, supplied explicitly with Compose's `-f` option
alongside `container/compose.yml`. Never copy that override into an image.
The image already supplies Node and the supported coding CLIs.

Use a GitHub noreply commit address if your personal email should stay private.
CI scans the checked-out files for secrets before installing dependencies;
exceptions must match a specific synthetic fixture, never an entire test tree.
An ignore rule does not unpublish an already tracked file. If sensitive data
was published, stop copying it into reports and coordinate cleanup of Git
history, PR text and retained artifacts. After a privacy history rewrite,
reclone; do not merge or push the old history back into the cleaned repository.

Docker's automatic provenance and downloadable build records can contain the
raw GitHub webhook, including private pusher/owner email addresses even when
commits use noreply addresses. CI and release builds disable provenance in
metadata and image attestations, plus automatic build summaries/record uploads.
Ordinary build logs, test reports, smoke diagnostics, image digests, and the
embedded source revision remain. Do not re-enable raw exports as diagnostics;
any future attestation must use an explicitly reviewed, safe field set.
