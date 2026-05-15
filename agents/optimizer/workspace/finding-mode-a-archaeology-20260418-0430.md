# Mode A: Session Archaeology — Tech-Lead 21-op IT-27 ENOENT Diagnosis

TL;DR: Tech-lead 21-op D-o-R session flailed 13 calls (WM-B path hunting + WM-A bun-quote typo) locating a handler that had been deleted; one-off, NO_DISPATCH.

Target session: `s_1776473691736_737` (tech-lead, 21 ops, 3m28s, D-o-R workflow, acceptable verdict, quality 0.66, efficiency 0.42).

- R1=NO_DISPATCH — KE-123 stacking (tech-lead 23:30 inline-diagnostic tweak still in observation) + KE-002 judgment (path-deleted discovery is reasoning, not a text-rule fix) + one-off (no recurrence in 6h cohort; other top-5 ops are optimizer Mode C/B self-sessions).

## Target Session

- Session: `s_1776473691736_737`  agent=tech-lead  op=21  kind=call  workflow=D-o-R  parent=s_1776473674130_736
- Task: Lens D Fragility — diagnose IT-27 cron `evaluation-sync` silently failing with ENOENT (48 failures). Scope-capped to ≤3 files, ≤20 ops budget.
- Outcome: Delivered `agents/tech-lead/workspace/it-27-evaluation-sync-enoent.md` (verdict acceptable; finish() blocked twice — uncommitted changes, then superficial verification).
- Evaluator issues: FM-1.3 recovery flailing, FM-2.6 reasoning-action mismatch, FM-3.3 superficial verification.

## Waste Mode Classification

Primary: **WM-B path hunting** (~9 wasted ops).
- The prompt named `agents/may/handlers/evaluation-sync.ts` as a read target. That file was deleted in commit `608709124` (Apr 17 16:04 UTC, "scout session 806: todo.md hygiene sweep"). First `read()` returned ENOENT with no hint.
- Recovery chain 3 (9 wasted calls): `git log --all --follow --name-status` → `git log --diff-filter=D` → `git show 608709124 --stat` → `grep -rn 'ENOENT reading|BuildMessage'` → `find src -name '*.ts' | xargs grep` → `grep cron-tool.ts` → `grep agent-loader.ts`. Agent was hunting for both (a) the deleted handler's last commit and (b) the loader source that emits ENOENT. Could have been a single `cd agents && git log --all --diff-filter=D --oneline -- may/handlers/evaluation-sync.ts` + one `grep -rn evaluation-sync src/` in 2 ops.

Secondary: **WM-A query-unit flailing** (~3 wasted ops).
- Chain 2: first `bun -e` DB query failed on shell-quote escaping of inner double quotes in `SELECT COUNT(*) as n, substr(error,1,200)` (exit=1, `[]` output). Recovered with schema probe, then git log. Matches recurring bun:sqlite quoting hazard noted in prior Mode C findings.

## Ops Wasted Estimate

- 13 wasted calls confirmed by evaluator failureChains (1 + 3 + 9).
- ~62% waste rate on a 21-op session. Productive work = the deliverable write + the couple of successful recovery reads.
- Budget cap (≤20) was marginally exceeded (21 ops), and finish() was double-blocked which likely pushed it over.

## R1 Decision

**NO_DISPATCH.**

Reasoning:
1. **KE-123 stacking**: tech-lead already has an in-flight dispatch (23:30 inline-diagnostic tweak). Stacking another tech-lead behavior change risks -12-15pp compounding; tweak needs more observation.
2. **KE-002 judgment failure**: The root waste is "target file is missing, but don't know it's missing" — this is discovery/judgment, not a text rule. Text-level "if ENOENT on scoped target, immediately `git log --diff-filter=D`" would be a new behavioral intervention with low expected adoption (Level-4 context.md, KE-026 ceiling).
3. **One-off recurrence**: 6h top-5 non-coach sessions are 3× optimizer self-sessions (expected), 1× this tech-lead IT-27 (one-off — driven by a specific file being deleted hours earlier), and 1× coder retry (20 ops, separate pattern). No other "scoped-target-deleted" pattern in 6h.
4. **Systemic fix is upstream, not in tech-lead**: If anything, the *dispatcher* (Hao or heartbeat) should verify scoped paths exist before dispatching. That's an infra change, not a behavioral dispatch to tech-lead. Noting as observation for potential Mode D follow-up (scoped-path preflight check).

## Rotation

Next: **B** (Tool Gap 6h bash pattern scan).
