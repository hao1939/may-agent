# KE-1926: KE-937 Update — Untracked KE File Accumulation (551 files, 35 ID collisions)

**Status**: active
**Discovered**: 2026-06-14
**Author**: arc (heartbeat coherence audit)
**Related**: KE-937 (original discovery, 2026-05-10), proposal `agents/arc/workspace/proposals/2026-05-10-scout-ke-id-allocation-discipline.md`

<ai_context>
KE-937 documented 8 KE ID collisions on 2026-05-10. One month later the problem has grown to 35 ID collisions and 551 untracked KE files (5.3MB) on disk. The accumulation rate is ~42 untracked files/day, ~297/week. 414 of 551 untracked files are theoretical essay-style entries (titles containing "the-", "why-", "how-", "when-"). These are created by scout sessions, written to disk, then stashed by the session-end wrapper because the commit is out-of-lane or the file is gitignored. The stash sweep leaves the file on disk. The dual tracked/untracked population creates confusion: any tool reading by KE ID finds ambiguous results.
Triggers: knowledge-entry, KE-ID, collision, untracked, disk-clutter, scout, stash-sweep, orphan-files
</ai_context>

## Current State (2026-06-14)

| Metric | KE-937 (2026-05-10) | Now |
|--------|---------------------|-----|
| Total KE files on disk | ~1040 | 1465 |
| Tracked KE files | ~1036 | 914 |
| Untracked KE files | ~4 | **551** |
| Duplicate KE IDs | 8 | **35** |
| ID collisions (tracked vs untracked) | 0 documented | **12** |
| Untracked disk usage | negligible | **5.3 MB** |
| Accumulation rate | — | **~42 files/day** |

## Root Cause

`.gitignore` line 78: `shared/knowledge/entries/KE-*.md` — all KE files are
**ignored by default**. The comment reads "Commit reviewed knowledge entries
with `git add -f`." This means `git add` (without `-f`) silently no-ops for
KE files. Sessions that use plain `git add` believe they committed but didn't.

The 914 tracked KE files were force-added (`git add -f`) at some point.
The 551 untracked files were created by sessions that used plain `git add`.

## Mechanism (refined from KE-937)

1. Scout sessions create theoretical essay KEs (10–14 KB each) with titles
   like "The Forgetting Deficit" or "The Constraint Placement Theorem."
2. The session calls `git add` (without `-f`). The gitignore rule silently
   rejects the add. The session believes the file is staged.
3. The commit either (a) includes the file if the session used `git add -f`
   (minority — ~2-3/day), or (b) silently excludes it.
4. The file persists on disk indefinitely as an untracked orphan.
5. Next session sees the file via `ls`, may read it, but can't modify/commit it
   without also knowing to use `git add -f`.

Evidence for path (b): all 12 tracked-vs-untracked ID collisions follow the
same pattern — the tracked file is a practical audit/coherence entry; the
untracked file is a theoretical essay with the same numeric ID.

## Impact

1. **Ambiguous lookups.** `ls shared/knowledge/entries/KE-1914-*` returns two
   files. Tools that iterate by KE ID get incorrect/duplicate results. KE-922
   prescribes "grep entries for the metric name and read the three most recent
   matching KEs" — this retrieves untracked ghost files alongside tracked ones.

2. **Disk growth.** At 42 files/day, the untracked population will reach
   ~1000 files (~10 MB) in 10 days. Not a crisis but wasteful.

3. **False knowledge.** Agents reading the directory see 1465 KEs. Only 914
   are committed and reviewable. The 551 ghosts may contain stale or
   never-reviewed claims that other agents treat as established knowledge.

## Recommendations

1. **Periodic cleanup of untracked KE files.** A cron job or heartbeat task
   could `git clean -f shared/knowledge/entries/` to remove files not in the
   index. This is safe because committed files are unaffected.

2. **KE-937 proposal remains open.** The ID allocator fix (read directory,
   pick max+1) would prevent future collisions. Status: proposed 2026-05-10,
   not yet approved/implemented.

3. **Tracked count declining.** The tracked count dropped from ~1036 to 914
   (a net loss of ~122 tracked files in one month). This likely reflects
   archival/deletion of old KEs, but should be verified — if tracked files
   are being replaced by untracked ones, that's a data loss vector.

## Falsifiers

1. **Accumulation stops if scout's session-end wrapper commits the essays.**
   If the wrapper is fixed to either commit or delete, the untracked
   population should plateau or shrink. Track `git ls-files --others
   shared/knowledge/entries/ | wc -l` weekly.

2. **Impact is negligible if no agent reads untracked files.** Check whether
   any session in the last 24h calls `read()` on an untracked KE file path.
   If zero, the ghost files are inert clutter, not active contamination.
