# Browser E2E Test Verification — Iteration 12/13

## Summary

The comments "browser test: e2e-headless-2026-05-15T14:10:27.919Z" and "browser test: e2e-headless-2026-05-15T14:10:49.170Z" in `discussion.md` are **artifacts of a successful e2e browser test run**, not directives requiring action.

## What the test does

`scripts/e2e-platform-comment.mjs` is a Puppeteer-based headless Chrome test that:

1. Loads the web UI at `http://localhost:8080/#/projects`
2. Clicks the "Show inactive" toggle to reveal the `platform` project (status: waiting)
3. Verifies `projectIdOf` / `projectPathOf` helper functions are present in the served UI
4. Clicks the platform row → verifies URL becomes `#/projects/platform`
5. Verifies the detail page loads via `projectPathOf('platform')` → `'projects/platform'`
6. Types a comment (`"browser test: e2e-headless-" + new Date().toISOString()`) into `#project-comment`
7. Clicks submit → verifies "Comment added" / "workflow started" status message
8. Reads `discussion.md` from filesystem → confirms the comment was appended
9. Reads `project.md` → confirms status flipped synchronously to `active`

## Checks performed (7 total)

| # | Check | What it proves |
|---|-------|---------------|
| 1 | `projectIdOf` / `projectPathOf` present | UI refactor shipped |
| 2 | Platform row click target uses `projectIdOf` | New routing works |
| 3 | URL after click is `#/projects/platform` | Canonical ID routing |
| 4 | `_projectDetailPath` = `projects/platform` | Path resolution correct |
| 5 | Comment submit button found & clicked | UI form functional |
| 6 | UI shows success status | Server endpoint responded |
| 7 | `discussion.md` contains comment | File write succeeded |
| 8 | Status flipped to active | Synchronous status flip works |

## Verdict

**PASS** — Two successful test runs landed comments at 14:10:27 and 14:10:49, confirming the full browser→server→filesystem comment pipeline works correctly, including the synchronous status flip and `projectIdOf`/`projectPathOf` refactor.

## Infrastructure notes

- Requires Chrome at `/usr/bin/google-chrome` and `puppeteer-core`
- Chrome profile stored at `.state/chrome-profile/`
- Run manually: `node scripts/e2e-platform-comment.mjs`
