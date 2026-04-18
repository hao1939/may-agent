# Mode C — Skill & Technique Scouting (6h window, 2026-04-17 ~19:30 UTC)

**Objective:** Find ONE repeatable technique that correlates with high-quality sessions in the last 6h, not already promoted in `agents/shared/skills/` / context.md / heartbeat prompts. Propose promotion OR write a new 1-pager.

**Window:** `createdAt > now - 6h`, 113 evaluated non-evaluator sessions.

---

## 1. Method

Queries (all via `bun:sqlite` on `.state/may.db`):

1. Top/bottom by `evaluations.quality` joined with `sessions.opCount` (filter `agent != 'evaluator'`, `opCount >= 5`).
2. Tally keyword buckets inside `evaluations.issues` JSON for bottom-quality sessions to surface dominant failure modes.
3. Inspect the top-quality sessions' `verdict` / `issues` to see what the evaluator praised and whether any tool-usage or verification micro-pattern recurs.
4. Count occurrences of the dominant micro-pattern across 6h and 24h windows and by agent.

## 2. Bottom-quality issue distribution (n=21, q<0.7, ops≥5)

| Bucket (keyword in issues) | Count |
|---|---|
| SCOPE (`SCOPE_VIOLATION`, `SCOPE DRIFT`, `SCOPE_MISS`) | 14 |
| GUARD (finish blocked / completeness guard) | 13 |
| VERIFICATION (FM-3.3 lite, post-edit re-read missing) | 13 |
| COMMIT (commit flailing, wrong branch) | 12 |
| DELIVERABLE (integrity/missing) | 9 |
| FM-3.3 explicit | 8 |
| WASTE (failure chains) | 7 |
| PING (ping-pong / re-try) | 5 |
| ROLE (review-only drift) | 4 |
| BLOCKER (unresolved) | 4 |
| UNCOMMIT | 3 |
| GITIGNORE (`paths are ignored`, missing `-f`) | **high once normalized — see §3** |

## 3. The recurring micro-pattern (the lead)

Searching `issues LIKE '%gitignore%'` or `%paths are ignored%` or `%add -f%` across the full population:

- **6h window:** **13 of 113** evaluated non-evaluator sessions (11.5%) have a **gitignore commit-friction** chain flagged by evaluator.
- **24h window:** **32 of 566** sessions (5.7%). Per agent:

| agent | 24h count |
|---|---|
| optimizer | 10 |
| coach | 7 |
| bob | 5 |
| may | 5 |
| scout | 4 |
| coder | 1 |

Typical shape (5 randomly sampled 6h issues):
- `"first git commit failed because the new finding file was ignored by .gitignore; required a second add with -f (1 wasted call)"` (optimizer, q=0.92)
- `"Hit a gitignore snag committing the project file (git add failed on ignored path) and needed a second attempt with 'git add -f'"` (may q=0.80)
- `"coach/workspace/projects is gitignored, required a second bash with -f"` (coach q=0.93)
- `"11-call failure chain around 'agents/' being gitignored"` (coder q=0.45)
- `"attempted `git add` without `-f` and then proceeded to finish without resolving the commit expectation"` (coach q=0.66)

Wasted call count per incident: **1–11 bash calls**, mode **1–2**, outliers (coder 0510, bob sessions) hit full **11-call diagnostic chains** and drop quality to 0.45.

### Mechanism
- `agents/.gitignore` contains `*/workspace/*` (with `!*/workspace/.gitkeep`). Every optimizer/coach/bob deliverable lives under `*/workspace/*`. So `git add <path>` silently fails with `paths are ignored by .gitignore`.
- The commit-guard (`src/lib/tools/commit-guard.ts:111`) tells agents exactly: `git add ${addPaths} && git commit -m …` — but **never mentions `-f`**.
- Agents then either (a) add `-f` after one error (best case, 1 wasted call), or (b) spin into investigative `git check-ignore` / `git status` / `.gitignore` reads (worst case, 11-call chain).

### Correlation with quality
- Among high-quality sessions (q≥0.9, ops≥15), ignore-friction still appears but consistently as "1–2 wasted calls, recovered" → top sessions absorb the cost gracefully.
- Among low-quality sessions (q<0.7), ignore-friction is a **failure chain multiplier**: combined with verification-guard retries it eats 5–15% of the turn budget.
- The absence of this friction (or its fast single-call recovery) correlates with q≥0.85. **The technique that distinguishes high from low is: "know up-front that `agents/` workspace paths need `git add -f` and put that in the first commit attempt."**

## 4. Candidates considered

| Candidate | Source signal | Decision |
|---|---|---|
| **A. Scope-declaration at session start** (revive archived `scope-discipline`) | 14/21 bottom issues cite SCOPE | ❌ Reject. Already attempted as text injection, 19/19 text-injection failures per LIBRARY.md; KE-133 warns against text for discovery. Needs workflow, which is a heavier lift and duplicates `budget-before-act` and `plan-once-amend` (both proven). |
| **B. Review-role boundaries** (3 may review-only sessions drifted) | 3 sessions, q∈{0.25, 0.25, 0.45} | ❌ Reject. n=3 within 6h, all same agent (may), already owner of review role. Single-agent issue → direct fix to may's review handler, not a generalizable skill. |
| **C. Post-edit re-read (FM-3.3-lite)** | 13/21 bottom cite verification gaps | ❌ Reject. Already promoted: `verify-after-edit.md` (optimizer), `verify-before-finish` (may), `post-edit-readback` (.lab). Adding another layer violates KE-123 (never stack). |
| **D. `add -f` up-front for `*/workspace/*` commits** | 13/113 6h sessions, 32/566 24h, affects 6/7 agents | ✅ **WINNER.** High frequency, cross-agent, mechanical (no judgment needed), **not in any skill file, context.md, or heartbeat prompt**, and the commit-guard message can be patched in **one file** to push the knowledge at the exact moment it's needed. |

Grep confirms D is not promoted:
```
$ grep -r -l "add -f\|paths are ignored" agents/shared/skills/ agents/shared/standing-orders.md
→ only: agents/shared/skills/patterns/implement-review-commit.md  (passing mention, not prescriptive)
$ grep -l "gitignor" agents/*/context.md
→ may, tech-lead  (mention "agents/ is a separate git repo", nothing about workspace + `-f`)
```

## 5. Winner — Adoption plan (Level-3, structural)

**Promotion mechanism:** patch the **commit-guard message** in `src/lib/tools/commit-guard.ts` around line 111 to proactively surface the `-f` requirement *only when* any affected path matches `*/workspace/*`. This is **Level 3 (dispatch/prompt injection at point of need)** per the adoption hierarchy that optimizer has validated repeatedly (gym-batch, session-query, D-o-R Phase 1). Not Level 4 (context.md) which is zero-adoption per KE-026.

### Exact change

In `src/lib/tools/commit-guard.ts`, inside the existing `pathsToCheck → fileLines` block, after computing `addPaths`, detect whether any changed path is under `*/workspace/*`. If yes, use `git add -f` form in the suggested command (and add a one-line explanation):

```ts
const anyWorkspace = fileLines.some((line) =>
  /\b[^\/]+\/workspace\//.test(line.slice(3)),
);
const gitAddCmd = anyWorkspace
  ? `git add -f ${addPaths}`
  : `git add ${addPaths}`;
const workspaceHint = anyWorkspace
  ? `\n(Note: \`*/workspace/*\` is gitignored in agents/.gitignore — \`-f\` is required.)`
  : "";

return {
  block: true,
  reason:
    `finish() blocked [uncommitted changes]: You have ${fileCount} uncommitted file(s) in agents/:\n` +
    `${fileList}\n\n` +
    `Commit them with a descriptive message before calling finish():\n` +
    `  cd ${projectRoot}/agents && ${gitAddCmd} && git commit -m "${agentName}: <describe what you did>"${workspaceHint}\n\n` +
    `Good messages: "${agentName}: H-045 Decision Topology hypothesis", "${agentName}: new skill for evidence-first debugging"\n` +
    `Bad messages: "update files", "changes"\n\n` +
    `Then call finish() again.`,
};
```

### Why this is the right level
- Every affected agent already **hits the commit-guard** before finish(). The guidance is delivered at the exact moment it's needed — zero agent memory or skill-file pull required.
- It's a **one-file, ~10 LoC** change. No stacking of behavioral interventions (KE-123 safe). No few-shot templates (KE-133 safe).
- It does not restructure any heartbeat (KE-008 safe).

### Expected impact
- Conservative: 1 wasted bash call saved per incident × 32 incidents / 24h × avg ~$0.005/call ≈ tiny $, but real **quality** impact: eliminates the multi-call diagnostic chains in low-quality sessions (e.g. coder 11-call chain) that drag 0.45-q sessions further down.
- High-quality sessions also gain 1 call each — at current rate ~13 calls / 6h = ~52 calls/day saved system-wide, but more importantly removes a recurring irritant that appears in **every optimizer session's issues list**.

### Rollback
- Single-file revert. If unexpectedly the `-f` hint encourages careless commits to tracked files (unlikely — guard only fires on actually-ignored paths in workspace), revert the diff.

## 6. Dispatch

Messaging tech-lead with Priority **P2** (not urgent — micro-optimization, but cheap and crisp). Expected success criterion: commit-guard suggested command uses `git add -f` when any changed path matches `*/workspace/*`; test added.

## 7. No-signal check

Several other micro-patterns were considered but all fell into "already promoted" or "already rejected as text-injection." Gitignore-workspace friction is genuinely **unpromoted**, **cross-agent**, and **mechanically fixable at Level 3**. Confidence: medium-high.
