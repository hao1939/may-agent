# Releasing May Host

## Scope

Releases are versioned from the root `package.json` using Release Please.
Conventional Commits merged to `main` produce a release PR. Merging that PR
updates the changelog, creates a `vX.Y.Z` tag, and publishes a GitHub Release.

The `vX.Y.Z` tag starts the image workflow, which builds the pinned Linux
container and publishes:

- `ghcr.io/hao1939/may-agent:vX.Y.Z`
- `ghcr.io/hao1939/may-agent:latest`

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
2. Wait for the tag-triggered image workflow to finish.
3. For a retry, use **Actions → Release image → Run workflow** and provide an
   existing `vX.Y.Z` tag. This republishes the immutable version tag and moves
   `latest` to that release.

Use Conventional Commit prefixes (`fix:`, `feat:`, and `BREAKING CHANGE`) so
the next version and changelog are calculated predictably.

## Rollback

Consumers should pin an immutable `vX.Y.Z` image tag rather than `latest`.
Rollback means selecting the previous version tag. Do not delete or overwrite
published version tags. A production rollback must use the existing authorized
deployment procedure; publishing an image does not deploy it.
