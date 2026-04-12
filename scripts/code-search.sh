#!/usr/bin/env bash
# code-search.sh — Combined grep + context display for agent workflows.
# Replaces the 3-step grep→read→grep pattern with a single invocation.
#
# Usage:
#   scripts/code-search.sh <pattern> [options]
#
# Options:
#   --context N, -C N    Lines of context around each match (default: 3)
#   --path GLOB, -p GLOB Filter to files matching glob (e.g. 'src/**/*.ts')
#   --ignore-case, -i    Case-insensitive search
#   --files-only, -l     List matching filenames only (no context)
#   --max-count N, -m N  Max matches per file (default: unlimited)
#   --help, -h           Show this help
#
# Examples:
#   scripts/code-search.sh 'Database' --path 'src/**/*.ts'
#   scripts/code-search.sh 'heartbeat' -C 5 -i
#   scripts/code-search.sh 'context\.md' --path 'agents/**/*.md' -l

set -euo pipefail

# Defaults
PATTERN=""
CONTEXT=3
PATH_GLOB=""
IGNORE_CASE=""
FILES_ONLY=""
MAX_COUNT=""

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --context|-C)
      CONTEXT="$2"; shift 2 ;;
    --path|-p)
      PATH_GLOB="$2"; shift 2 ;;
    --ignore-case|-i)
      IGNORE_CASE=1; shift ;;
    --files-only|-l)
      FILES_ONLY=1; shift ;;
    --max-count|-m)
      MAX_COUNT="$2"; shift 2 ;;
    --help|-h)
      sed -n '2,/^$/{ s/^# \?//; p }' "$0"
      exit 0 ;;
    -*)
      echo "Unknown option: $1" >&2; exit 1 ;;
    *)
      if [[ -z "$PATTERN" ]]; then
        PATTERN="$1"; shift
      else
        echo "Unexpected argument: $1" >&2; exit 1
      fi ;;
  esac
done

if [[ -z "$PATTERN" ]]; then
  echo "Usage: code-search.sh <pattern> [options]" >&2
  echo "Run with --help for details." >&2
  exit 1
fi

# Detect search tool
if command -v rg &>/dev/null; then
  USE_RG=1
else
  USE_RG=0
fi

# Build search command
if [[ "$USE_RG" -eq 1 ]]; then
  # --- ripgrep path ---
  CMD=(rg --color=never --line-number --heading)
  CMD+=(--context "$CONTEXT")
  [[ -n "$IGNORE_CASE" ]] && CMD+=(--ignore-case)
  [[ -n "$FILES_ONLY" ]] && CMD=(rg --color=never --files-with-matches)
  [[ -n "$MAX_COUNT" ]] && CMD+=(--max-count "$MAX_COUNT")
  [[ -n "$PATH_GLOB" ]] && CMD+=(--glob "$PATH_GLOB")
  # Exclude heavy directories
  CMD+=(--glob '!node_modules' --glob '!.git' --glob '!.state' --glob '!dist')
  CMD+=("$PATTERN")
else
  # --- grep fallback ---
  # Determine search root and file filter
  SEARCH_ROOT="."
  NAME_FILTER=""

  if [[ -n "$PATH_GLOB" ]]; then
    GLOB_DIR=$(echo "$PATH_GLOB" | sed 's|\*\*.*||; s|/\*$||; s|/$||')
    GLOB_EXT=$(echo "$PATH_GLOB" | grep -oE '\*\.[a-zA-Z]+$' || true)
    [[ -n "$GLOB_DIR" && -d "./$GLOB_DIR" ]] && SEARCH_ROOT="./$GLOB_DIR"
    [[ -n "$GLOB_EXT" ]] && NAME_FILTER="$GLOB_EXT"
  fi

  # Build grep options as an array (no eval needed)
  GREP_OPTS=(-rn)
  GREP_OPTS+=(--include='*.ts' --include='*.tsx' --include='*.js' --include='*.json' --include='*.md' --include='*.sh' --include='*.yaml' --include='*.yml' --include='*.toml' --include='*.txt' --include='*.html' --include='*.css')

  # If a specific extension filter was given, override includes
  if [[ -n "$NAME_FILTER" ]]; then
    GREP_OPTS=(-rn --include="$NAME_FILTER")
  fi

  GREP_OPTS+=(-C "$CONTEXT")
  [[ -n "$IGNORE_CASE" ]] && GREP_OPTS+=(-i)
  [[ -n "$MAX_COUNT" ]] && GREP_OPTS+=(-m "$MAX_COUNT")

  if [[ -n "$FILES_ONLY" ]]; then
    GREP_OPTS=(-rl)
    [[ -n "$IGNORE_CASE" ]] && GREP_OPTS+=(-i)
    if [[ -n "$NAME_FILTER" ]]; then
      GREP_OPTS+=(--include="$NAME_FILTER")
    else
      GREP_OPTS+=(--include='*.ts' --include='*.tsx' --include='*.js' --include='*.json' --include='*.md' --include='*.sh' --include='*.yaml' --include='*.yml' --include='*.toml' --include='*.txt' --include='*.html' --include='*.css')
    fi
  fi

  # Exclude heavy directories
  GREP_OPTS+=(--exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.state --exclude-dir=dist)
fi

# Execute
if [[ "$USE_RG" -eq 1 ]]; then
  "${CMD[@]}" 2>/dev/null || true
else
  grep "${GREP_OPTS[@]}" -- "$PATTERN" "$SEARCH_ROOT" 2>/dev/null || true
fi
