#!/usr/bin/env bash
set -euo pipefail

# Read `git diff --name-only -z --no-renames BASE HEAD` from stdin. Skip only
# known non-image inputs; unknown paths fail safe to a full image check.
needed=false
while IFS= read -r -d '' path; do
  case "$path" in
    test/e2e/fixtures/agents/*) needed=true ;;
    docs/*|test/*|*.test.ts|README.md|CONTRIBUTING.md|AGENTS.md|LICENSE|\
    .github/copilot-instructions.md|.github/pull_request_template.md|\
    .github/ISSUE_TEMPLATE/*|.github/dependabot.yml) ;;
    *) needed=true ;;
  esac
done
echo "$needed"
