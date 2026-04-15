# System Tidiness Audit

**Date**: 2026-03-16  
**Author**: Optimizer  
**Requested by**: Hao (via May)

---

## 1. Abandoned Fork Directories

**47 fork directories** found — each containing a single `workspace/` dir with an `activity.jsonl`. These are leftover from prior agent configuration iterations (context window experiments, version forks).

| Agent | Fork Count | Directories |
|-------|-----------|-------------|
| tech-lead | 10 | -c22, -c23, -c24, -c25, -c26, -c32, -c34, -c35, -c36, -v1 |
| bob | 7 | -c23, -c24, -c26, -c27, -c27-verify, -c28, -c30, -c31 |
| may | 7 | -c24, -c26, -c29, -c29-v2, -c29v3, -c36, -v2, -v28 |
| optimizer | 5 | -c22, -c23, -c25, -c38, -v10 |
| amy | 4 | -c24, -c25, -c26, -c28 |
| evaluator | 4 | -c22, -c24, -v2, -v10 |
| amy-kimi | 2 | -c26, -c30 |
| coder | 2 | -c24, -c26 |
| scout | 2 | -c23, -c26 |

**Impact**: Minimal disk space (1 file each), but they clutter `agents/` and may confuse agents scanning the directory.

**Recommendation**: Delete all 47 fork directories. They serve no active purpose.

---

## 2. Stale Knowledge & Workspace Files

### 2.1 Bob's Duplicate Synthesis Directory
- `agents/bob/knowledge/synthesis/` (18 files, 304KB) — **100% duplicated**
- All 18 files are identical copies of files in `agents/bob/knowledge/library/synthesis/` (134 files)
- **Recommendation**: Delete `agents/bob/knowledge/synthesis/` entirely.

### 2.2 Amy's Knowledge Posts (991 files, 5.3MB)
- `agents/amy/knowledge/posts/` contains 991 post files
- These are XHS content exploration posts — may still be reference material
- **Recommendation**: Verify with Amy/Hao if these are still needed. If archival only, compress.

### 2.3 Amy-Kimi's Knowledge (2,058 posts, 15MB)
- `agents/amy-kimi/knowledge/library/posts/` — 2,058 files (15MB)
- 8 insight archive files, 9 deep-dive files, 168 library-level files
- **Recommendation**: Same as Amy — verify active use. Consider archival compression.

### 2.4 Amy's Signal Archives (25 files)
- `agents/amy/knowledge/signals-archive-*.md` — 25 archive files
- These are archived signals, not actively loaded
- **Recommendation**: Move to `agents/amy/knowledge/archives/` subdirectory or compress.

### 2.5 Scout's Workspace (539 files, 14MB)
- `paper_src/` (8 files, 2.8MB) + `paper_src.tar.gz` (1.1MB) — downloaded paper artifacts
- `omni-leak-src/` (7+ files, 776KB) + `omni-leak-src.tar.gz` (507KB) — downloaded paper artifacts
- `paper.pdf` (1.1MB) — downloaded PDF
- 7 `GRAND-UNIFIED-SYNTHESIS-*.md` versions — superseded by `GUS-CONSOLIDATED-REFERENCE.md`
- `cr143` through `cr150+` — 150+ cross-reference synthesis files
- **Recommendation**: Delete tar.gz files + extracted source dirs (paper_src, omni-leak-src) — 5.2MB recoverable. Delete superseded GUS versions.

### 2.6 Bob's Workspace (555 files, 5.3MB)
- 234 `brief-*.md` files — task briefs, many completed/outdated
- 324 `synthesis/` files (1.4MB) — synthesis notes
- 90 `archive/` files (788KB) — already-archived items
- 9 `impl-*.md` files, 6 experiment files
- **Recommendation**: Bob should consolidate. Many briefs are one-time delegation tasks that have been completed.

### 2.7 GUS File Duplication
- `agents/scout/workspace/GUS-CONSOLIDATED-REFERENCE.md` — scout's version
- `agents/shared/knowledge/GUS-CONSOLIDATED-REFERENCE.md` — shared version (differs)
- `agents/shared/knowledge/GUS-CONSOLIDATED.md` — another variant (447 lines)
- **Recommendation**: Keep one canonical version in `agents/shared/knowledge/`, remove scout's copy.

---

## 3. System Resource Waste

### 3.1 .state/memory — 303MB, 101 files
- 10 evaluator memory files alone: evaluator.jsonl, evaluator-v2 through v10, evaluator-c22, c24 (24MB each!)
- Memory files for fork agents that no longer exist (e.g., `amy-c24.jsonl`, `bob-c23.jsonl`, `tech-lead-c22.jsonl`)
- 4 backup files (`*.bak*`)
- 1 `scout-growth-test.jsonl`, 1 `reviewer.jsonl`, 1 `may-path-fix.jsonl` — test artifacts
- **Total waste estimate**: ~200MB+ of memory files for non-existent agent forks
- **Recommendation**: Delete memory files for agents that no longer exist in active configuration. Keep only memory files matching active agents.

### 3.2 .state/chrome-profile — 1.5GB
- Browser profile data for Amy/Scout's web browsing
- This is the single largest item in .state
- **Recommendation**: Clear periodically. Browser profiles accumulate cache/cookies that aren't needed between sessions.

### 3.3 .state/sessions/history — 1.8GB, 10,189 sessions
- Historical session data — necessary for evaluations and analysis
- **Recommendation**: Implement session archival — compress sessions older than 7 days. Estimated savings: 1.5GB+.

### 3.4 .state/instances — 31 dirs, all orphaned
- 29 stale instance directories with no meta.json (empty dirs)
- Includes obvious test artifacts: `-h`, `kill`, `test`, `test-debug`, `bob-coach-ex1`
- 17 completed job instance directories
- **Recommendation**: Delete all except `default` and `console` (if still needed).

### 3.5 Orphaned State Files
- `.state/job-coach-test-1.log` — empty, from Mar 9
- `.state/job-task-1773069810-2481483.log` — empty, from Mar 9
- `.state/tmp_daily_stats.py` — temp Python script from Mar 8
- `.state/health-log.md` — single entry from Mar 5, appears abandoned
- `.state/ops-receipts.jsonl` — 11 entries, no recent activity
- `.state/rejected/` — empty directory
- `.state/test-launcher-tmp/` — empty directory
- **Recommendation**: Delete all orphaned files and empty directories.

### 3.6 Disabled Cron Jobs
Three disabled cron jobs in `agents/may/cron.json`:
1. `focus-task-tracker` — disabled, never activated
2. `iraq-conflict-monitor` — disabled one-time task
3. `compliance-audit` — disabled (P53 audit, now deprecated)
- **Recommendation**: Remove all three from cron.json to keep config clean.

---

## 4. Summary

| Category | Items | Estimated Waste |
|----------|-------|----------------|
| Fork directories | 47 dirs | Clutter (minimal disk) |
| Duplicate files | bob synthesis (18 files) | 304KB |
| Stale memory files | ~60+ files for dead forks | ~200MB |
| Chrome profile | 1 dir | 1.5GB (cacheable) |
| Session history | 10,189 sessions | ~1.5GB (compressible) |
| Orphaned instances | 29 dirs | Clutter |
| Orphaned state files | 7 files/dirs | Minimal |
| Scout paper artifacts | tar.gz + extracted | 5.2MB |
| Disabled cron jobs | 3 entries | Config noise |

**Total recoverable disk**: ~3.2GB (mostly chrome profile + old sessions)  
**Total recoverable clutter**: 47 fork dirs + 29 instance dirs + ~60 stale memory files + 3 disabled crons

### Priority Actions (Hao's authorization needed)
1. **Delete 47 fork directories** — `rm -rf agents/*-c[0-9]* agents/*-v[0-9]* agents/*-verify`
2. **Delete stale memory files** — remove `.state/memory/` files for non-existent agents
3. **Delete orphaned instance dirs** — clean `.state/instances/` 
4. **Delete bob's duplicate synthesis dir** — `rm -rf agents/bob/knowledge/synthesis/`
5. **Remove disabled cron entries** — clean `agents/may/cron.json`
6. **Clear scout paper artifacts** — `rm -rf agents/scout/workspace/paper_src* agents/scout/workspace/omni-leak-src* agents/scout/workspace/paper.pdf`
7. **Clear orphaned state files** — remove empty logs, tmp files, stale health-log
