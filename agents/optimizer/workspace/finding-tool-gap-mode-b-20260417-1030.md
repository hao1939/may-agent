# Mode B: Tool Gap Analysis — 6h Bash Pattern Scan (2026-04-17 10:30 UTC)

## TL;DR
**Actionable gap found.** A "gitignore detective" multi-step bash pattern recurs across **4 of 5** high-op sessions in the last 6h. Agents repeatedly (a) try to `git add`, (b) notice file not staged, (c) run `git status`, `git check-ignore -v`, `git log -- <path>`, `git ls-files`, `diff <(git show HEAD:x) x`, `cat .gitignore`, and finally `git add -f`. Estimated **~25–40 ops / 6h** (≈ 100–160 ops/day) system-wide. Proposed fix: `scripts/git-track.sh <path...>` — a single helper that reports tracked/ignored status, the matching ignore rule, and auto-suggests/executes `git add -f` when the file is an intended deliverable.

## Sessions Examined (opCount > 15, last 6h)
Queried `sessions` table (startedAt > now − 6h, opCount > 15): 15 sessions. Focused on top 5 non-optimizer high-op sessions + 1 optimizer for self-check.

| Session | Agent | Ops | Task | Ignore-hunt bash calls |
|---------|-------|-----|------|------------------------|
| s_1776419208660_73 | tech-lead | 40 | project-resume handler audit | **~15** (see below) |
| s_1776420765752_93 | coach | 36 | prove-the-loop iter (commit fm33 scenario) | **~10** |
| s_1776417964737_60 | coach | 35 | prove-the-loop iter (commit coder-post-write-verify) | **~8** |
| s_1776418602340_71 | optimizer | 31 | session-archaeology commit | **~6** |
| s_1776418265078_67 | optimizer | 46 | Mode A archaeology | ~3 (plus `bun -e` loop, pre-existing) |

Extraction: `grep -oE '"name":"bash"[^}]*"command":"[^"]*"' .state/sessions/history/<sid>/session.jsonl`.

## The Pattern: Gitignore Detective

Concrete sequence observed in s_1776419208660_73 (tech-lead), verbatim (abbreviated):
```
ls -la agents/may/handlers/project-resume.ts; cd agents && git status --short may/
cd agents && git status | head -20
cd agents && cat .gitignore | head -30
cd agents && git status --ignored | head -30
cd agents && git log --oneline -3 may/cron.json
cd agents && git ls-files may/ | head -20
cd agents && git diff -- may/cron.json | head -30
cd /app/agents && git status -- may/cron.json may/handlers/project-resume.ts
cd /app/agents && git log --oneline -5
cd /app/agents && git log --all --oneline -- may/handlers/project-resume.ts
cd /app/agents && git show --stat d19fb7527 | head -20
cd /app/agents && diff <(git show HEAD:may/handlers/project-resume.ts) may/handlers/project-resume.ts
```
≈ 15 commands to determine "is this file tracked and is my local edit committed?" — a question that reduces to `git check-ignore -v <path>` + `git ls-files --error-unmatch <path>`.

Same shape in s_1776420765752_93 (coach):
```
cd agents && git add gym/scenarios/fm33-verify-broken/... && git commit    # silently skips ignored files
cd agents && git status --short
cd agents && git log --oneline -1 gym/scenarios/fm33-verify-broken/
cd agents && git ls-files gym/scenarios/fm33-verify-broken/
cd agents && git status --short gym/ .lab/
cd agents && git check-ignore -v gym/scenarios/fm33-verify-broken/success_criteria.js
# → finally: git add -f
```

And s_1776417964737_60 (coach), same story with `gym/scenarios/coder-post-write-verify/` → ~8 calls culminating in `git add -f`.

### Why it happens
`agents/.gitignore` contains broad rules (`*/workspace/*`, `.lab/`, `shared/tools/`, etc.) that silently swallow `git add`. The standard UX is "no output, no error" — so agents escalate by running every git-introspection command they know until they spot the matching rule. This is a documented UX hole in git itself; our repo layout makes it worse because the workspace/lab patterns are essential (we don't want most of it tracked) but *some* files under those paths (gym scenarios, deliverable checklists, findings-being-promoted) must be force-added.

## Cross-Reference Against Existing Tools
| Existing tool | Covers this? |
|---------------|--------------|
| `scripts/session-query.ts` | No — DB, not git |
| `scripts/code-search.sh` | No — file content |
| `scripts/gym-batch.sh` | No — gym runs |
| `scripts/scenario-oracle.sh` | No — scenarios |
| *(none)* | **Gap confirmed.** |

## Recommendation: `scripts/git-track.sh`

**Spec (≈25-line bash wrapper):**
```bash
# scripts/git-track.sh <path> [<path>...]
#   For each path:
#     - If tracked (git ls-files --error-unmatch): print "TRACKED <path>"
#     - Else if check-ignore matches: print "IGNORED <path>  rule: <file>:<line>:<pattern>"
#         and exit non-zero with hint "run: git add -f <path>"
#     - Else print "UNTRACKED <path>" (add without -f works)
#   With --force: auto-runs git add -f on IGNORED paths, git add on UNTRACKED.
#   Always cd's to the correct git repo root for the path (handles agents/ subrepo).
```

**Projected savings:**
- Replaces 6–15 bash calls per incident with 1.
- Observed: 4 incidents / 6h ⇒ ~40 ops saved / 6h ⇒ **~160 ops/day** across the fleet.
- Above the adoption threshold iff wired into agent context (push, not pull — KE-026): add a single line to `agents/shared/context.md` under the existing "agents/ is a separate git repo" bullet: *"If `git add` silently skips your file, run `scripts/git-track.sh <path>` before escalating."*

**Risk / open questions (for tech-lead):**
- Script itself lives in `/app/scripts/` (main repo). Doesn't conflict with `agents/.gitignore`'s `scripts/` exclusion (that rule applies only inside `agents/`).
- Should it integrate with the deliverable-checklist guard? E.g., at `finish(success)` the guard could pre-scan checklist paths through `git-track.sh` and warn. Low-priority extension — propose as follow-up after v1 adoption data.

## Conclusion
Dispatch a concrete fix proposal to **tech-lead** (owner of `scripts/` and guards). Not a workflow change, not a behavioral intervention — just a small helper + one-line context push. Adoption threshold satisfied (>100 ops/day savings + push-model integration planned).

## Evidence Sources
- Session transcripts: `.state/sessions/history/{s_1776419208660_73,s_1776420765752_93,s_1776417964737_60,s_1776418602340_71,s_1776418265078_67}/session.jsonl`
- DB query: `SELECT sessionId,agent,opCount FROM sessions WHERE startedAt > now-6h AND opCount > 15`
- Ignore rules: `agents/.gitignore` (lines 1–30; `*/workspace/*`, `.lab/`, `shared/tools/` etc.)
- Prior Mode B finding: `agents/optimizer/workspace/finding-tool-gap-mode-b-20260417-0800.md` (null result 2.5h ago — pattern emerged in the intervening commit-heavy sessions)
- Rotation tracker: `agents/optimizer/workspace/todo.md`
