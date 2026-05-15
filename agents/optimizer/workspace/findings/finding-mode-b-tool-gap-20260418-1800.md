# Finding: Tool Gap Analysis — 2026-04-18T18:00Z (6h scan)

## Sessions Analyzed
| Session | Agent | Ops | Task |
|---------|-------|-----|------|
| s_1776515111675_166 | coach | 57 | metric-reaction scenario |
| s_1776533063825_448 | coach | 51 | use-persistent-task intervention design |
| s_1776518709125_231 | coach | 49 | gym scenario baselines |
| s_1776516338916_179 | tech-lead | 26 | project-resume handler redesign |
| s_1776524072374_316 | coach | 23 | breadcrumb-gap debugging |

## Pattern 1: Gym Run + Inspect Loop (coach, 3 sessions)
**Frequency**: 3/5 sessions, ~10-15 bash calls each
**Pattern**: `export PATH=... && gym-run.sh` → `cat /tmp/gym-batch-*/results.jsonl` → `cat /tmp/gym-run-*/judge-verdict.json` → `ls /tmp/gym-run-*/work/` → grep through transcript — repeated 2-4 times per session.

**Existing tool**: `scripts/gym-batch.sh`, `scripts/gym-run.sh` exist but output goes to ephemeral `/tmp/` dirs. Agents then spend 3-5 calls hunting for results across `/tmp/gym-run-*` and `/tmp/gym-batch-*` directories.

**Recommendation**: A `scripts/gym-inspect.sh <session_id_or_batch_dir>` tool that outputs a structured summary (pass/fail, score, key transcript excerpts) would save 3-5 calls per gym run cycle. Estimated savings: 8-12 ops across these 3 sessions.

## Pattern 2: Repeated `grep -n` Chains for Code Understanding (coach, tech-lead)
**Frequency**: 4/5 sessions, 5-8 consecutive greps each
**Pattern**: `grep -n 'pattern1' file` → `sed -n 'N,Mp' file` → `grep -n 'pattern2' file` → `sed -n 'X,Yp' file` — exploring code structure.

**Existing tool**: `scripts/code-search.ts` exists but sessions don't use it (KE-026: pull-model discovery is dead). Agents default to raw grep.

**Recommendation**: LOW priority — this is inherent to code exploration. The existing code-search tool covers this; the issue is awareness not tooling.

## Pattern 3: Git Commit Dance (tech-lead, 1 session)
**Frequency**: 1/5 sessions, 8 bash calls
**Pattern**: `cd /app/agents && git add ... && git commit -m ...` → fails → `git status` → `git diff` → `git show HEAD:file` → `md5sum` → `git add -f ... && git commit -m ...`

**Existing tool**: None dedicated. Agents cd to agents/ and manually construct git commands.

**Recommendation**: LOW priority — only 1 occurrence. The commit flow is not frequently repeated enough to justify a tool.

## Pattern 4: PATH Setup Repetition
**Frequency**: All 5 sessions, 1-3 calls each wasted on `export PATH=...`
**Pattern**: Every session starts with or repeats `export PATH=".state/.bun/bin:$PATH"` before bun commands.

**Recommendation**: This is already in context.md. Could be fixed by having the shell profile set it, but low impact (1 call each).

## Summary
| Pattern | Impact | Priority | Action |
|---------|--------|----------|--------|
| Gym inspect tool | 8-12 ops saved/3 sessions | **HIGH** | Create `scripts/gym-inspect.sh` |
| grep chains | ~5 ops saved but inherent | LOW | Push code-search awareness |
| git commit | ~5 ops saved/1 session | LOW | Not frequent enough |
| PATH setup | ~5 ops saved/5 sessions | LOW | Shell profile or wrapper |

**Top recommendation**: Build a gym-inspect tool that summarizes run results (pass/fail, score, key excerpts) so coach doesn't spend 3-5 calls per run hunting through /tmp/ directories. This addresses the highest-op agent (coach: 57, 51, 49 ops) at its most repeated pattern.
