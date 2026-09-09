# Releasing May Host

## Scope

Releases are versioned from the root `package.json` using Release Please.
Conventional Commits merged to `main` produce a release PR. Merging that PR
updates the changelog, creates a `vX.Y.Z` tag, and publishes a GitHub Release.

When Release Please creates the `vX.Y.Z` tag and GitHub Release, it directly
calls the image workflow. Direct pushes of matching version tags also start
that workflow. It builds the pinned Linux container and publishes:

- `ghcr.io/hao1939/may-agent:vX.Y.Z`
- `ghcr.io/hao1939/may-agent:latest`

The reusable workflow uses the tag explicitly passed by Release Please, even
though its event context is still the caller's `push` to `main`. It accepts
only stable `vX.Y.Z` tags (no suffixes or leading zeroes) and checks out the
exact `refs/tags/...` ref, never a branch with the same name. A tag created by
`GITHUB_TOKEN` does not start a separate tag-push run; the direct call is needed.

This automation does not publish npm packages or deploy a production
installation. Production deployment remains an explicitly authorized Host
Operations task.

## Credentials and permissions

No repository secret is required for the default path. GitHub supplies
`GITHUB_TOKEN`; the workflows grant it only `contents`, `issues`,
`pull-requests`, and `packages` permissions needed by their job.

The repository must allow Actions to write releases and packages, and the
package visibility should be reviewed before the first publication.

## Manual release

1. Merge the Release Please PR after CI and review pass.
2. Wait for the `Publish release image` job in the Release Please run to finish.
3. For a retry, use **Actions → Release image → Run workflow** and provide an
   existing `vX.Y.Z` tag. This rebuilds the same Git release, replaces its image
   tag, and moves `latest` to that release—even when retrying an older release.
   A rebuild can produce a different digest; image tags are not immutable.

Use Conventional Commit prefixes (`fix:`, `feat:`, and `BREAKING CHANGE`) so
the next version and changelog are calculated predictably.

## Rollback

Consumers needing an immutable image should pin its `sha256` digest rather
than `latest` or a version tag. Rollback means selecting the previously verified
image digest. Do not retarget Git release tags or reuse a version for different
source. A production rollback must use the existing authorized deployment
procedure; publishing an image does not deploy it.
