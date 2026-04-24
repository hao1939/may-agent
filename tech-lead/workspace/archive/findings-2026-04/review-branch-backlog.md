# Review Branch Backlog — Dead Weight Audit

Session: s_1776484895774_835 · Generated: 2026-04-18T04:02Z
Total local `review/*` branches: **18** (git branch --list output above).

## 1. Already merged into main → DELETE (9)

Per `git branch --merged main` (run this session):

| Branch | Last commit |
|---|---|
| review/commit-guard-workspace-force | 2026-04-17 20:02 |
| review/common-sense-audit-handler | 2026-04-17 13:42 |
| review/fix-file-read-tracker-import | 2026-04-17 20:32 |
| review/git-when-tool | 2026-04-17 19:32 |
| review/gym-batch-inspect | 2026-04-17 17:39 |
| review/notify-tool-split | 2026-04-17 16:34 |
| review/restore-cite-source-preset | 2026-04-17 19:14 |
| review/s_1776442615172_478 | 2026-04-17 16:19 |
| review/s_1776445332324_510 | 2026-04-17 17:06 |

**Recommendation:** `git branch -d` all 9 (safe — merged). One-liner:
`git branch --merged main | grep '^  review/' | xargs -n1 git branch -d`

## 2. Unmerged branches — classified (9)

Metadata from `git log main..<branch>` + `git log -1 --format=%ci <branch>` this session.

| Branch | Commits | Files | Age (last commit UTC) | Status | Recommendation |
|---|---|---|---|---|---|
| review/fix-auto-pause-notify-assertions | 3 | 3 | 2026-04-18 01:37 | notify-split test fixups (the recurring 9-failure set I've tracked across heartbeats) | **merge-now** — scope is test-only, unblocks red build |
| ~~review/evaluator-source-tag~~ | 4 | 13 | 2026-04-18 00:58 | ✅ **MERGED to main** 2026-04-18 (merge commit 2da1d05d); branch deleted | done |
| ~~review/evaluator-standalone-retry~~ | 1 | 1 | 2026-04-17 21:34 | ✅ subsumed by evaluator-source-tag merge; branch deleted 2026-04-18 | done |
| review/fix-create-tool-message-tests | 2 | 2 | 2026-04-17 22:03 | Subset of evaluator-source-tag (d503f2fd + 33150a57) | **delete** after evaluator-source-tag lands |
| review/sync-gate-skip-evaluator | 3 | 24 | 2026-04-17 15:32 | Builds on feedback-loop M2 (2854dedf, 23920774) + 66dfdebb fix for evaluation-sync exclusion | **investigate** — contains 2 commits shared with s_..._423/_427 |
| review/s_1776438041618_427-citations | 2 | 23 | 2026-04-17 15:10 | feedback-loop M2 citations + tool-preset fix (2854dedf, 23920774) | **investigate** — likely superseded by sync-gate-skip-evaluator |
| review/s_1776437912999_423 | 1 | 23 | 2026-04-17 15:04 | feedback-loop M2 bidirectional citations (2854dedf only) | **abandon** — subset of 427-citations which itself is subset of sync-gate-skip-evaluator |
| review/s_1776436033817_399 | 1 | 21 | 2026-04-17 14:52 | coach prove-the-loop Iter 12 (ba210b5b) — evidence-count-guard reorder | **investigate** — standalone, 1 commit, check if coach still relevant |
| review/s_1776427541234_215 | 1 | 22 | 2026-04-17 12:12 | gym-runner `--common-sense <path>` overlay flag (d2923b9f) | **investigate** — standalone infra; 40h old; check if feature still wanted |

### Superseded-chain detail (feedback-loop M2 family)

Commits `2854dedf` and `23920774` appear on three branches:
- review/s_1776437912999_423 → 2854dedf only
- review/s_1776438041618_427-citations → 2854dedf + 23920774
- review/sync-gate-skip-evaluator → 2854dedf + 23920774 + 66dfdebb

**Recommendation:** land `sync-gate-skip-evaluator` (it's the superset), delete the other two.

### Evaluator-fix family

Commits `d503f2fd` and `33150a57` appear on:
- review/evaluator-standalone-retry → d503f2fd only
- review/fix-create-tool-message-tests → d503f2fd + 33150a57
- review/evaluator-source-tag → d503f2fd + 33150a57 + 15fe6859 + ce82ef9f

**Recommendation:** ✅ DONE 2026-04-18 — `evaluator-source-tag` merged to main (merge commit 2da1d05d); both `evaluator-standalone-retry` and `evaluator-source-tag` branches deleted. `fix-create-tool-message-tests` still pending deletion (subsumed).

## 3. Summary of actions

- **Delete immediately (safe, merged):** 9 branches (see §1).
- **Delete as subsumed:** 4 branches (evaluator-standalone-retry, fix-create-tool-message-tests, s_1776437912999_423, s_1776438041618_427-citations).
- **Merge candidates (test-only/small):** review/fix-auto-pause-notify-assertions (highest priority — unblocks the red build I've flagged across 6+ heartbeats).
- **Investigate before merge:** review/evaluator-source-tag, review/sync-gate-skip-evaluator, review/s_1776436033817_399, review/s_1776427541234_215.

Net: after a cleanup sweep, 18 → ~4 active review branches.

## 4. Follow-up (separate session — NOT this one)

Dispatch order:
1. Delete the 9 merged branches (one-liner above).
2. Fork coder (verified workflow) to run tsc+vitest on `review/fix-auto-pause-notify-assertions`; if green, merge to main. This is the notify-split fallout fix.
3. Same for `review/evaluator-source-tag` (larger diff — 13 files — may need reviewer pass).
4. Decide on feedback-loop M2 family (sync-gate-skip-evaluator) — may need product/tech-lead call since 23 files overlap with other work.
5. Per-heartbeat triage: branches older than 7 days with no activity → abandon.

## 5. Evidence (commands run this session)

- `git branch --list 'review/*' | wc -l` → 18
- `git branch --merged main | grep review/` → 9 branches listed in §1
- `git branch --no-merged main | grep review/` → 9 branches listed in §2
- Per-branch: `git log -1 --format=%ci <b>`, `git log main..<b> --oneline`, `git diff --name-only main..<b> | wc -l`
- Subject lines obtained via `git log main..<b> --format='%h %s'` for each unmerged branch
