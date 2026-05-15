#!/usr/bin/env bash
# git-when.sh — narrow wrapper over `git log --pickaxe-regex -S<pattern>` to
# find when a string/pattern was introduced or changed in a file.
#
# Usage: scripts/git-when.sh <path> <pattern> [--regex] [--all] [--since DATE] [--show]
#
# - Auto-detects the correct repo root. The project has a nested repo at
#   `agents/.git`; if <path> is under `agents/`, we cd into `agents/` before
#   invoking git so history lookups resolve against the sub-repo.
# - Default uses `-S` (pickaxe string, with --pickaxe-regex). `--regex` switches
#   to `-G` (diff regex match).
# - `--show` additionally prints `git show --stat` plus the touching hunks for
#   each matching commit.
#
# Exits 0 on success (including empty results). Non-zero on invalid usage.

set -u

usage() {
  cat <<'EOF'
Usage: scripts/git-when.sh <path> <pattern> [options]

Find commits that added/removed occurrences of <pattern> in <path>.

Options:
  --regex         Treat <pattern> as a regex (uses `git log -G`) instead of a
                  literal string (default: `git log -S --pickaxe-regex`).
  --all           Search all refs, not just HEAD.
  --since DATE    Pass through to `git log --since=DATE`.
  --show          For each matching commit, also print `git show --stat` and
                  the hunks that touched the pattern.
  -h, --help      Show this help and exit.

Examples:
  scripts/git-when.sh src/app.ts Database
  scripts/git-when.sh src/app.ts 'createFoo\\(' --regex --show
  scripts/git-when.sh agents/tech-lead/workspace/todo.md 'C1.3'
EOF
}

if [ $# -eq 0 ]; then
  usage
  exit 0
fi

case "${1:-}" in
  -h|--help)
    usage
    exit 0
    ;;
esac

if [ $# -lt 2 ]; then
  echo "error: <path> and <pattern> are required" >&2
  echo "" >&2
  usage >&2
  exit 2
fi

path_arg="$1"
pattern="$2"
shift 2

use_regex=0
all_refs=0
since=""
show_hunks=0

while [ $# -gt 0 ]; do
  case "$1" in
    --regex)
      use_regex=1
      shift
      ;;
    --all)
      all_refs=1
      shift
      ;;
    --since)
      if [ $# -lt 2 ]; then
        echo "error: --since requires a DATE argument" >&2
        exit 2
      fi
      since="$2"
      shift 2
      ;;
    --since=*)
      since="${1#--since=}"
      shift
      ;;
    --show)
      show_hunks=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown option: $1" >&2
      echo "" >&2
      usage >&2
      exit 2
      ;;
  esac
done

# Resolve project root. Prefer the directory containing this script's parent.
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_root="$(cd "$script_dir/.." && pwd)"

# Decide which repo to run against. If the path lives under agents/ and
# agents/.git exists, run from agents/ and strip the leading "agents/" from
# the path so git sees a repo-relative path.
repo_dir="$project_root"
git_path="$path_arg"

# Normalize: strip optional leading "./" and leading project-root prefix.
case "$git_path" in
  "$project_root"/*)
    git_path="${git_path#$project_root/}"
    ;;
  ./*)
    git_path="${git_path#./}"
    ;;
esac

case "$git_path" in
  app/*)
    if [ -d "$project_root/app/.git" ]; then
      repo_dir="$project_root/app"
      git_path="${git_path#app/}"
    fi
    ;;
  agents/*)
    if [ -d "$project_root/agents/.git" ]; then
      repo_dir="$project_root/agents"
      git_path="${git_path#agents/}"
    fi
    ;;
esac

# Build the git log argument list safely (no eval).
pickaxe_flag="-S"
extra_pickaxe=("--pickaxe-regex")
if [ "$use_regex" -eq 1 ]; then
  pickaxe_flag="-G"
  extra_pickaxe=()
fi

log_args=(log "$pickaxe_flag$pattern")
if [ ${#extra_pickaxe[@]} -gt 0 ]; then
  log_args+=("${extra_pickaxe[@]}")
fi
if [ "$all_refs" -eq 1 ]; then
  log_args+=(--all)
fi
if [ -n "$since" ]; then
  log_args+=(--since="$since")
fi

if [ "$show_hunks" -eq 1 ]; then
  # Include the patch so the caller can see the hunks that match.
  log_args+=(-p --stat)
else
  log_args+=(--format='%h %ad %s' --date=short)
fi

log_args+=(-- "$git_path")

# Run git from the resolved repo directory. We don't want a git failure (e.g.,
# file never existed in history) to abort the script with set -e; pickaxe with
# no matches is a valid "no rows" result. Propagate the exit code for genuine
# errors other than empty output.
( cd "$repo_dir" && git "${log_args[@]}" )
rc=$?

# git log exits 0 for "no matches" too, so just forward its exit code.
exit "$rc"
