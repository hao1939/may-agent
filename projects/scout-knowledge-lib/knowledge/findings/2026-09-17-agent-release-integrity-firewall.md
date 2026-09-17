<ai_context>
summary: "A GitHub implementation review of WasmAgent/open-agent-audit's incident-derived release-integrity guard. The useful pattern is to turn release failures into structural invariants with positive and negative fixtures, then invoke the same complete invariant set at every enforcement boundary. At the inspected commit, the repository's publish workflow says it checks RI-01 through RI-04, but the supplied --frozen-install mode executes only RI-04, illustrating why workflow labels and comments must be checked against CLI mode composition."
triggers: ["agent release integrity", "agent package provenance", "release preflight", "workspace pin drift", "stale metadata PR", "negative regression fixture", "open-agent-audit", "RI-01", "RI-04", "frozen install"]
last_updated: "2026-09-17"
source_basis: "WasmAgent/open-agent-audit repository, commit 44767328b6022a98487e3d0c41c64928eea46ebf; release-integrity implementation commit 86f083f99ac1f2c57e6bf19a7c359ea389d5d7c2."
</ai_context>

# Release guards must verify composed modes, not workflow labels

**Date observed:** 2026-09-17  
**Disposition:** new knowledge  
**Repo:** https://github.com/WasmAgent/open-agent-audit  
**Inspected revision:** [`44767328b6022a98487e3d0c41c64928eea46ebf`](https://github.com/WasmAgent/open-agent-audit/commit/44767328b6022a98487e3d0c41c64928eea46ebf)  
**Implementation commit:** [`86f083f99ac1f2c57e6bf19a7c359ea389d5d7c2`](https://github.com/WasmAgent/open-agent-audit/commit/86f083f99ac1f2c57e6bf19a7c359ea389d5d7c2)

## Question

What reusable release-integrity lesson does a current AI-agent audit toolkit expose beyond its repository description?

## Content reviewed

Scout used GitHub's public repository Search API, then pinned the selected
repository before reading its repository metadata, commit history and tree,
implementation commit and patch, `scripts/check-release-integrity.mjs`,
`.github/workflows/ci.yml`, `.github/workflows/release.yml`, and the runtime
release-provenance schema. The tree response reported `truncated: false`.
Scout inspected source and committed self-tests but did not clone the repository,
execute its tests, publish packages, or independently reproduce the reported
release incident.

## Source claims and implementation evidence

The implementation commit says a real Passport 0.7.0 release incident combined
two independent failures: npm rejected incomplete repository provenance, while
a stale-base metadata change silently restored package version `0.6.2` and an
exact internal dependency pin. The same commit corrected an additional stale
`@openagentaudit/passport` pin in the CLI package that the earlier worker-focused
repair had missed.

The repository converts that incident into five named invariants:

1. **RI-01:** each publishable package must carry canonical repository metadata
   and a license;
2. **RI-02:** package versions must not decrease relative to a supplied base;
3. **RI-03:** exact internal dependency pins must equal the corresponding
   workspace package version;
4. **RI-04:** `bun install --frozen-lockfile` must actually succeed; and
5. **RI-05:** a `changeset-release/*` branch is compared with `origin/main` for
   version regressions.

The script includes positive cases and incident-derived negative fixtures for
missing provenance, a `0.7.0` to `0.6.2` downgrade, and a stale `0.6.2` workspace
pin. CI invokes the normal mode with a base revision and separately invokes
`--self-test`. This is a useful pattern: preserve the historical failure as a
negative fixture, not only as a comment explaining a new check.

## The boundary mismatch

At the pinned revision, the release workflow names its final gate
`Release-integrity publish preflight (RI-01..RI-04)` and comments that provenance,
pins, metadata, and frozen-install state must all be coherent. Its command is:

```text
node scripts/check-release-integrity.mjs --frozen-install
```

But the script treats `--frozen-install` as an exclusive mode. In that branch it
runs only `bun install --frozen-lockfile`, records only `RI-04` on failure, and
skips RI-01, RI-02, and RI-03. Those checks run in the normal CI mode, not in the
advertised publish preflight.

This does **not** prove that a bad package was published. The release workflow
also runs a frozen install and the project's broader `check:all`, while ordinary
CI runs the full release-integrity command. Repository settings and prior check
results were not assessed. It does show that the last in-workflow gate is weaker
than its name and comment claim, and that the release job formally depends on
its own `preconditions` job rather than on the separate CI workflow.

## Interpretation

Incident-derived invariants are only as strong as their **mode composition at
the enforcement boundary**. A guard can contain the right pure checks, fixtures,
and CI wiring yet still lose defense-in-depth when a convenience flag selects a
strict subset immediately before publication.

For agent runtimes and agent-adjacent governance packages, this matters because
release metadata is part of the trust boundary: consumers need to know which
source, package set, and lock state produced executable policy or evidence code.
A robust design should expose an explicit complete publish mode, make narrower
modes visibly narrow, and test the CLI-to-workflow composition itself. Workflow
step names and comments are narrative evidence; the invoked control flow is the
enforcement evidence.

## Limitations

- Repository activity, commit messages, and source code are first-party evidence.
  They do not independently establish incident impact or production adoption.
- Scout did not execute the committed self-tests or verify GitHub Actions results.
- The version comparator accepts only plain `major.minor.patch` strings; other
  versioning forms fall outside this implementation review.
- The runtime release-provenance schema was inspected for context, but this
  finding does not claim that the schema is cryptographically enforced end to
  end.
