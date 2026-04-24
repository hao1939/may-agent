# Design: Pre-Merge Code Review Gate for src/ Changes

**Author:** Bob  
**Date:** 2026-04-06  
**Status:** Draft  

---

## 1. Current State Analysis

### 1.1 How Code Gets to main Today

Every commit to `src/` follows this path:

```
May dispatches task → tech-lead session → coder agent edits files
→ coder/tech-lead runs `git add && git commit` via bash tool
→ commit lands directly on main
→ (30min later) repo-gate-check.ts runs tsc + vitest
→ (if new commits) QA heartbeat reviews post-hoc
```

**Key observations from the codebase:**

1. **All 30+ recent commits are by "May (Agent)" directly to main.** No PRs, no branches, no review before merge. The git log is a single linear stream of direct-to-main commits.

2. **repo-gate-check.ts is post-hoc only.** It runs on a 30-minute cron (`intervalMs: 1800000`), checks if there are new commits since last QA review, runs `tsc --noEmit` and `vitest --run`, then sends results to QA. But by the time QA sees it, the code is already on main and potentially running.

3. **No git hooks exist.** The `.git/hooks/` directory contains only sample files — no pre-commit, pre-push, or commit-msg hooks are active.

4. **agents/ repo is separate and auto-committed.** `agents-auto-commit.ts` runs every 2 hours as a safety net with `--no-verify` flag, committing orphaned changes with smart per-agent messages. This is intentionally low-ceremony — agents/ contains workspace/knowledge files, not runtime code.

5. **Two unused branches exist** (`bun-migration-phase0`, `registry-refactor`) — evidence that branching was tried but not systematized.

6. **The verified-coder workflow exists** but only verifies that code works (tsc passes, tests pass) — not that it's been reviewed by another agent. It's a correctness gate, not a review gate.

### 1.2 The Real Risk Profile

| Change Type | Repo | Risk | Current Gate |
|------------|------|------|-------------|
| Agent workspace/knowledge | agents/ | Low | Auto-commit, no review |
| Agent skills/config | agents/ | Medium | Auto-commit, no review |
| Agent handlers/workflows | agents/ (but affects runtime) | **High** | Auto-commit, no review |
| Runtime source code | src/ | **High** | Post-hoc QA (30min delay) |
| Dependencies/config | src/ (package.json, etc.) | **High** | Post-hoc QA |

**Critical gap:** `agents/may/handlers/*.ts` and `agents/*/workflows/*.ts` are in the agents/ repo but execute as runtime code. They get the low-ceremony auto-commit treatment despite being high-risk.

### 1.3 Why This Matters

- A bad commit to `src/lib/manager.ts` can crash the entire system
- A bad handler in `agents/may/handlers/` can waste hours of sessions before QA catches it
- Post-hoc review means broken code runs for up to 30 minutes before detection
- No structural enforcement means even well-intentioned conventions get violated under pressure

---

## 2. Design Constraints

### What We Can't Do
- **No GitHub PRs** — no CI infra, no GitHub API integration
- **No separate build/deploy pipeline** — the system runs directly from the git repo
- **No human in the loop** — agents operate autonomously, reviews must be agent-to-agent
- **No blocking the hot path** — sessions must not hang waiting for external approval

### What We Must Preserve
- **Emergency hotfixes** — system crashes need immediate fixes, can't wait for review
- **agents/ low-ceremony** — workspace/knowledge changes must stay frictionless
- **Existing QA integration** — build on repo-gate-check.ts, don't replace it
- **Agent autonomy** — agents should be able to work freely within sessions; the gate is at commit time, not edit time

### Code vs Data Decision
Per `code-vs-data-decisions.md`: this is a **mechanical check** ("has another agent reviewed this?"), not a judgment call. That means it's appropriate to enforce in code (a git hook or tool guard), not just a convention in context.md.

---

## 3. Proposed Architecture

### 3.1 Core Concept: Branch-Then-Review-Then-Merge

Instead of committing directly to main, agents commit to a short-lived feature branch. A separate review step (by QA or another agent) must approve before the branch is merged to main.

```
┌─────────────────────────────────────────────────────────────┐
│ Session: tech-lead implementing feature X                    │
│                                                              │
│  1. git checkout -b review/<sessionId>                       │
│  2. (make changes, commit to branch)                         │
│  3. Write review request to .state/review-queue/<id>.json    │
│  4. Session ends                                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Handler: review-gate-check (cron, every 10 min)              │
│                                                              │
│  1. Scan .state/review-queue/ for pending reviews            │
│  2. Run tsc + vitest on branch (deterministic pre-check)     │
│  3. If deterministic checks fail → reject, notify author     │
│  4. If pass → dispatch QA agent for code review              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Session: QA reviews the branch                               │
│                                                              │
│  1. Read review request + diff                               │
│  2. Review code quality, correctness, safety                 │
│  3. Write verdict to .state/review-queue/<id>.json           │
│     → "approved" or "changes-requested"                      │
│  4. Session ends                                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ Handler: review-merge (cron, every 5 min)                    │
│                                                              │
│  1. Scan for approved reviews                                │
│  2. git checkout main && git merge --ff-only review/<id>     │
│  3. git branch -d review/<id>                                │
│  4. Clean up .state/review-queue/<id>.json                   │
│  5. Update .state/qa-last-commit.txt (skip redundant QA)     │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Why Not Simpler Alternatives?

**Alternative A: pre-commit hook that blocks unreviewed commits to main**  
Problem: The committing agent IS the session. A pre-commit hook can't invoke another agent session synchronously — it would need to block, but agents.call() requires a running session context. Also, git hooks run in subprocess with limited env.

**Alternative B: Convention — "always commit to a branch"**  
Problem: This is exactly the kind of judgment-based convention that agents violate. Per code-vs-data-decisions.md, we need structural enforcement.

**Alternative C: pre-commit hook that only allows main commits from a "merger" process**  
This is viable and simpler! The hook checks if the committer is the review-merge handler (via env var or specific committer identity). If not, it rejects the commit to main. Agents can still commit freely to branches.

→ **I recommend combining A and C**: a pre-commit hook that enforces branch-only commits for agents, plus the handler-based merge flow.

### 3.3 The Pre-Commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit
# Blocks direct-to-main commits unless the REVIEW_GATE_BYPASS env var is set.

BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null)

if [ "$BRANCH" = "main" ] && [ "$REVIEW_GATE_BYPASS" != "1" ]; then
  echo "❌ Direct commits to main are blocked."
  echo "   Commit to a review/* branch instead:"
  echo "   git checkout -b review/<session-id>"
  echo ""
  echo "   For emergencies: REVIEW_GATE_BYPASS=1 git commit ..."
  exit 1
fi
```

Simple, impossible to accidentally bypass, easy to intentionally bypass for emergencies.

### 3.4 Review Request Schema

```jsonc
// .state/review-queue/<review-id>.json
{
  "id": "rv-1775444745",
  "branch": "review/s_1775444745_tech-lead",
  "author": "tech-lead",
  "sessionId": "s_1775444745",
  "createdAt": "2026-04-06T03:00:00.000Z",
  "commits": [
    { "hash": "abc1234", "message": "feat: add new validation logic" }
  ],
  "filesChanged": ["src/lib/tools/edit.ts", "test/edit.test.ts"],
  "diffSummary": "+45 -12 across 2 files",
  "status": "pending",        // pending | reviewing | approved | rejected | merged
  "reviewer": null,            // agent name once assigned
  "reviewedAt": null,
  "verdict": null,             // null | "approved" | "changes-requested"
  "reviewNotes": null,         // reviewer's comments
  "mergedAt": null,
  "mergeCommit": null,
  // Deterministic gate results (pre-computed by handler)
  "gates": {
    "tsc": { "pass": true, "output": "" },
    "vitest": { "pass": true, "output": "" }
  },
  // Emergency metadata
  "emergency": false,
  "bypassReason": null
}
```

### 3.5 Escape Hatches

1. **Environment variable bypass:** `REVIEW_GATE_BYPASS=1 git commit -m "hotfix: ..."` — works immediately, logged for audit.

2. **Emergency review request:** A review can be filed with `"emergency": true`, which triggers immediate QA dispatch rather than waiting for the next cron cycle.

3. **Auto-approve for test-only changes:** If the diff only touches `test/` files and both tsc + vitest pass, the review-merge handler can auto-approve without QA involvement.

4. **May exemption:** May orchestrates the system. If May's handlers need to commit (like the current auto-commit pattern), the handler sets `REVIEW_GATE_BYPASS=1`. This is acceptable because May's handlers ARE the infrastructure — they're equivalent to the merge handler itself.

### 3.6 Integration with Existing Systems

**repo-gate-check.ts:** Largely subsumed. The review-gate handler runs the same tsc + vitest checks, but BEFORE merge rather than after. repo-gate-check.ts becomes a safety net for bypass commits only.

**QA heartbeat:** Instead of proactively scanning for unreviewed commits (which it often skips due to skipIfIdle), QA gets dispatched specifically for review requests. This is more efficient — QA only runs when there's actual work.

**agents-auto-commit.ts:** Unchanged. agents/ repo doesn't go through this gate.

**verified-coder workflow:** Still valuable as an inner loop (write code → verify it compiles/tests). The review gate is the outer loop (verified code → reviewed by another agent → merged).

---

## 4. Handling the agents/ Handler/Workflow Problem

Section 1.2 identified that `agents/may/handlers/*.ts` and `agents/*/workflows/*.ts` are high-risk despite living in the agents/ repo. Two approaches:

### Option A: Move handlers/workflows to src/ (structural)
Move runtime code into the src/ repo where it gets the full review gate. The agents/ repo becomes purely data (workspace, knowledge, skills, config).

**Pro:** Clean separation — all code in src/, all data in agents/.  
**Con:** Big migration, breaks existing paths, handlers currently reference agents/ paths.

### Option B: Selective review for agents/ (pragmatic)
Keep handlers/workflows in agents/, but the auto-commit handler flags them for review. When it detects changes to `*.ts` files under `handlers/` or `workflows/`, it creates a review request instead of auto-committing.

**Pro:** Minimal disruption, incremental.  
**Con:** Two review systems (one for src/, one for agents/ code), complexity.

**Recommendation:** Start with the src/ gate (Phase 1-2). Revisit agents/ handler review as Phase 3, choosing between A and B based on how the src/ gate works in practice.

---

## 5. Implementation Phases

### Phase 1: Pre-Commit Hook + Manual Branch Workflow (1-2 sessions)

**What:** Install the pre-commit hook. Update tech-lead's context.md to instruct it to create review branches. Add a simple `.state/review-queue/` directory.

**Changes:**
- Write `.git/hooks/pre-commit` (the hook script from §3.3)
- Add to `agents/tech-lead/context.md`: "Always create a review/* branch before committing to src/"
- Create `.state/review-queue/` directory
- Document the manual merge process in a shared doc

**Risk:** Low. The hook is trivially bypassable. Worst case, agents learn the new branch pattern.

**Validation:** Tech-lead's next code session should create a branch instead of committing to main. If it doesn't, the hook blocks it and we see the error in the session transcript.

### Phase 2: Review-Gate Handler + QA Dispatch (3-4 sessions)

**What:** Build the `review-gate-check` handler that scans pending reviews, runs deterministic checks, and dispatches QA.

**Changes:**
- New handler: `agents/may/handlers/review-gate-check.ts`
- New cron entry in `agents/may/cron.json` (every 10 min)
- Update QA's heartbeat to handle review requests
- Add review-merge logic (separate handler or same handler with two phases)

**Risk:** Medium. The handler runs git operations (branch switching, merging). A bug could leave the repo on the wrong branch. Mitigation: always `git checkout main` at the start of each handler run, and use `--ff-only` merges to prevent divergence.

**Validation:** 
- Create a test review request manually, verify QA gets dispatched
- Verify approved reviews get merged to main
- Verify rejected reviews notify the author

### Phase 3: Full Integration + agents/ Code Review (2-3 sessions)

**What:** Integrate the review gate into the verified-coder and design-then-build workflows. Add selective review for agents/ handler/workflow changes.

**Changes:**
- Update `verified-coder.ts`: after verification passes, commit to review branch instead of main
- Update `design-then-build.ts`: add review step between tech-lead implementation and completion
- Update `agents-auto-commit.ts`: detect *.ts changes in handlers/workflows, route to review queue
- Add metrics: review turnaround time, approval rate, rejection reasons

**Risk:** Medium-high. Workflow changes affect the core development loop. Mitigation: keep the bypass available, monitor for increased session failures.

**Validation:**
- End-to-end: design-then-build workflow creates branch → QA reviews → merge happens
- agents/ handler change gets flagged for review instead of auto-committed

---

## 6. Risk Analysis

### 6.1 Risks

| Risk | Severity | Likelihood | Mitigation |
|------|----------|-----------|------------|
| Repo left on wrong branch after handler crash | High | Medium | Always start handlers with `git checkout main`. Add branch cleanup to watchdog. |
| QA bottleneck — reviews pile up | Medium | High | Auto-approve for trivial changes (test-only, doc-only). Emergency bypass. |
| Agents ignore branch convention | Medium | Medium | Pre-commit hook enforces it structurally. Not a convention issue. |
| Merge conflicts between review branches | Medium | Low | Short-lived branches (merge within 1 cycle). `--ff-only` fails cleanly. Rebase onto main before merge. |
| Emergency bypass becomes the norm | Medium | Medium | Log all bypasses. Audit in QA heartbeat. Alert if >20% of commits bypass review. |
| Review adds latency to development | Low | High | Expected: ~10-20 min latency (1 cron cycle for gate + 1 for QA). Acceptable for non-emergency changes. |
| Handler code in agents/ still unreviewed (Phase 1-2) | Medium | High | Accepted risk until Phase 3. Current state is no worse. |

### 6.2 What Could Go Wrong in Phase 1

The main risk is that the pre-commit hook breaks the system when an agent tries to commit to main and gets blocked but doesn't know how to handle it. Mitigation:
- The hook provides clear error messages
- tech-lead's context.md tells it to use branches
- If it fails, the session transcript shows the error, and we can adjust

### 6.3 Rollback Plan

Each phase is independently reversible:
- Phase 1: `rm .git/hooks/pre-commit` — back to current state
- Phase 2: Disable cron entry, remove handler file
- Phase 3: Revert workflow changes

---

## 7. Estimated Effort

| Phase | Sessions | Calendar Time | Dependencies |
|-------|----------|---------------|-------------|
| Phase 1 | 1-2 tech-lead sessions | 1 day | None |
| Phase 2 | 3-4 tech-lead sessions | 2-3 days | Phase 1 working |
| Phase 3 | 2-3 tech-lead sessions | 2-3 days | Phase 2 working + observation period |
| **Total** | **6-9 sessions** | **~1 week** | |

---

## 8. Open Questions

1. **Should QA be the sole reviewer, or should we support a "reviewer pool"?** Currently QA is the obvious choice, but if QA is overloaded, could Bob or another agent also review code?

2. **What about multi-commit review branches?** If a tech-lead session makes 5 commits to a branch, should QA review the full diff or each commit? (Recommendation: full diff — it's the end state that matters.)

3. **Branch naming convention?** `review/<sessionId>` is proposed. Alternative: `review/<agent>/<short-description>`. The sessionId approach is more unique and traceable.

4. **What happens to the review branch if the review is rejected?** Options: (a) notify the original agent to fix and re-submit, (b) delete the branch and re-dispatch the task, (c) QA fixes it directly. (Recommendation: (a) — the original author knows the intent best.)

5. **Should we track review metrics in may.db?** A `reviews` table with columns for turnaround time, verdict, reviewer, etc. would enable analysis. Probably Phase 2 scope.

---

## 9. Comparison with Alternatives Considered

### Git Notes for Approval State
Store approval as git notes on commits. Pro: lives in git history. Con: fragile, hard to query, agents would need to learn git notes commands. Not worth the complexity.

### SQLite Review Table
Store review state in may.db instead of JSON files. Pro: queryable, atomic. Con: harder to inspect manually, adds DB schema dependency. Could migrate to this in Phase 2 but JSON files are fine to start.

### Mandatory Dual-Commit (Author + Reviewer)
Require two different agents to have committed to a branch before it can merge. Pro: strong enforcement. Con: awkward UX — the reviewer would need to add a "sign-off" commit. The JSON approval file is simpler.

### CI-Style Webhook
Build a minimal CI that triggers on push events. Pro: familiar pattern. Con: we don't have a webhook endpoint, and building one is scope creep. The cron-based handler achieves the same result.

---

## 10. Summary

**The core proposal is simple:**
1. A pre-commit hook prevents direct commits to main (Phase 1)
2. A handler scans review branches, runs deterministic checks, and dispatches QA (Phase 2)  
3. QA reviews and approves; another handler merges approved branches (Phase 2)
4. Workflows are updated to use the review flow natively (Phase 3)

This transforms the current "commit → hope QA catches issues" into "commit to branch → deterministic checks → independent review → merge." It's the same pattern as GitHub PRs, implemented with git hooks + agent coordination instead of a hosted platform.

The escape hatch (`REVIEW_GATE_BYPASS=1`) ensures emergencies aren't blocked, and the phased rollout means we can stop at any phase if the complexity isn't worth it.
