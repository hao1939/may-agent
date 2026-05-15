# Tool Gap Analysis — Bash Pattern Scan
**Date**: 2026-04-16  
**Mode**: B (Tool Gap Analysis)  
**Window**: 6h sessions + recent transcripts (17 sessions, ~1800 transcript lines analyzed)

## Method
Extracted bash tool calls from all sessions with local transcripts (17 sessions with >50 lines). Sorted by frequency and identified multi-step patterns appearing 3+ times.

## Top Repeated Bash Patterns

### 1. PATH Setup Boilerplate (228 occurrences)
```bash
export PATH=".state/.bun/bin:$PATH"
```
**Every** bun -e call requires this prefix. It's pure waste — injected into context.md but agents still prepend it manually to each bash call.

**Fix**: The harness could auto-prepend PATH to bash environments, or bun could be symlinked to /usr/local/bin at startup.

### 2. Git Add/Commit Retry Chains (12+ occurrences across sessions)
Pattern: agents try `git add -A && git commit`, it fails (nothing to commit, wrong dir, file not tracked), then retry with `git add -f`, then `git add specific-file`. One session (s_1776336175530_25) had **5 consecutive git commit attempts** for the same file.

Example chain:
```
git add -A && git commit -m "..."      → fails (nothing to commit)
git add agents/may/... && git commit   → fails (pathspec error)
git add may/... && git commit          → fails (not in agents/ dir)
git add -f may/... && git commit       → succeeds
```

**Fix**: A `commit-agents.sh <message>` script that: (1) cds to agents/, (2) does git add -A, (3) checks if anything staged, (4) commits. Would save 2-4 ops per commit cycle.

### 3. DB Path/Schema Discovery (8+ occurrences)
Agents repeatedly discover:
- Where may.db lives (try `may.db`, `agents/may.db`, `agents/.state/may.db`, `.state/may.db`)
- What columns exist (`PRAGMA table_info(...)`)
- How to import bun:sqlite

Despite being in context.md, agents still spend 2-3 turns finding the DB.

**Fix**: Already mitigated by context.md injection. Low additional value from tooling.

### 4. File Discovery grep chains (15+ occurrences)
```bash
grep -r "pattern" src/ --include="*.ts" -l
find . -name "*.ts" -path "*/db*"
grep -rl "metric" src/ --include="*.ts"
```
Agents do 3-5 grep/find calls to locate relevant files before reading them.

**Fix**: `scripts/code-search.sh` already exists but agents don't always use it. Low-priority.

### 5. Multi-file Status Check (5+ occurrences)
```bash
for f in agents/*/heartbeat.md; do echo "=== $f ==="; grep "pattern" "$f"; done
find agents/*/workspace/projects/*.md | while read f; do grep "Status" "$f"; done
```

**Fix**: Low priority — these are contextual one-offs.

## Highest-Impact Recommendations

| Priority | Pattern | Wasted Ops/Session | Fix |
|----------|---------|-------------------|-----|
| **P1** | Git commit retry chains | 2-4 ops | `scripts/commit-agents.sh` |
| **P2** | PATH boilerplate | 0.5 ops (overhead per call) | Symlink bun to standard path |
| **P0** | — | — | No critical gaps found |

## Conclusion
The biggest automated opportunity is **git commit chains** — agents waste 2-4 ops per commit due to wrong directory, wrong add flags, and nothing-to-commit false starts. A single `commit-agents.sh` script would eliminate this. Other patterns are already partially mitigated by context.md injection. No critical tool gaps found — the system's tooling is reasonably mature.
