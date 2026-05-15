# Git Concurrency Analysis: Multi-Agent Branch Safety

**Author**: Bob · **Date**: 2026-04-09 (updated from 2026-04-08) · **For**: Hao  
**Question**: Can one agent's git operations corrupt another agent's work?

---

## 1. Architecture Overview

### Two Git Repos, One Working Directory

| Repo | Location | Purpose | Branch Model |
|---|---|---|---|
| **Main (src/)** | `/app/.git` | Application source code | `main` + `review/*` branches |
| **Agents** | `/app/agents/.git` | Agent configs, knowledge, workspace | `main` only (auto-commit) |

**All agents share the same working directory** (`/app`). Every bash tool, every `createBashTool(projectRoot)` call in `coding.ts`, every agent session — they all operate on the same filesystem. There's no per-agent sandboxing at the file level.

### Concurrency Model

- Agents run as **concurrent async sessions within a single Node.js process** (the SubagentManager)
- Sessions are created via `agents.call()` (blocking), `agents.fork()` (non-blocking), or cron handlers
- Currently **5 sessions running simultaneously** (observed from `.state/sessions/`)
- All sessions share the same `projectRoot` (`/app`) — bash tools, read, write, edit all target the same filesystem

### Existing Worktrees

```
/app                                   (main)
/home/hao/may-agent-registry-refactor  (registry-refactor) [prunable]
```

One worktree already exists and works, proving the pattern is viable.

---

## 2. Current Safety Mechanisms

### Main Repo (src/)

| Mechanism | Status | Effect |
|---|---|---|
| **Pre-commit hook** | ✅ Active | Blocks direct commits to `main`, requires `review/*` branch |
| **REVIEW_GATE_BYPASS** | ✅ Available | `REVIEW_GATE_BYPASS=1` skips the gate — widely used in practice |
| **repo-gate-check handler** | ✅ Active (every 30min) | Runs tsc + vitest pre-checks, sends results to QA |
| **Git's index.lock** | ✅ Built-in | Serializes concurrent git add/commit operations |

### Agents Repo

| Mechanism | Status | Effect |
|---|---|---|
| **agents-auto-commit handler** | ✅ Active (every 10min) | Safety net for uncommitted changes. Groups by agent, classifies files, writes descriptive messages. |
| **commit-guard (finish-guard)** | ✅ Active | Blocks `finish()` if agent has uncommitted changes in their dir |
| **Federation sync (pull/push)** | ✅ Active | Pulls from remote, rebases, ownership-aware conflict resolution |
| **Cross-edit guard** | ✅ Active | Prevents agents from modifying other agents' `SOUL.md`, `agent.json`, `heartbeat.md` |

### What's NOT Protected

- **No file-level locking**: Two agents can `write()` or `edit()` the same file simultaneously. Last write wins.
- **No git branch isolation**: All agents see the same checked-out branch. `git checkout` by one agent affects all others.
- **No working directory isolation**: There's no per-agent worktree, chroot, or even separate `/tmp` workspace.

---

## 3. Risk Analysis

### Risk 1: Shared Working Directory — Concurrent File Writes ⚠️ ACTIVE RISK

**Scenario**: Agent A runs `edit(path: "agents/shared/knowledge/INDEX.md", ...)` while Agent B runs `edit(path: "agents/shared/knowledge/INDEX.md", ...)` simultaneously.

**What happens**: The `edit()` tool in `edit.ts` does:
1. Read file content
2. Find oldText in content
3. Replace oldText with newText
4. Write result back

If A reads the file, then B reads it, then A writes, then B writes — **B's write overwrites A's changes**. This is a classic TOCTOU (time-of-check-time-of-use) race condition.

**Current likelihood**: **Medium-High for agents/ repo**. Multiple agents write to shared knowledge files (`INDEX.md`, `PRIORITY-TRACKER.md`, hypothesis files) during the same time window. The `shared/knowledge/` directory is the hottest contention point.

**Current likelihood for src/ repo**: **Low**. Most agents don't modify src/ code simultaneously. Only tech-lead and coder regularly write to src/.

### Risk 2: Branch Checkout Destroys Working State ⚠️ LATENT RISK

**Scenario**: Agent A has uncommitted edits. Agent B runs `git checkout review/xyz`.

**What happens**:
- If A's changed files differ between branches: **checkout fails** with "Your local changes would be overwritten"
- If A's changed files are the same on both branches: **checkout succeeds silently**, A's changes are now in wrong-branch context
- If A is mid-edit (between read and write of `edit()` tool): the file changes under A's feet

**Current likelihood**: **Low** — agents rarely switch branches. But this becomes **HIGH immediately** if the review gate bypass is removed and agents are forced to use `review/*` branches.

### Risk 3: Auto-Commit Racing with Agent Commits ⚠️ ACTIVE RISK

**Scenario**: The `agents-auto-commit` handler (running every 10min) does `git add -A && git commit` at the same time an agent is committing its own changes.

**What happens**: Git's `index.lock` serializes the operations, so the index won't corrupt. But:
- Auto-commit might capture partially-written files (agent is mid-edit)
- Auto-commit might commit changes the agent was about to commit with a descriptive message, replacing it with "chore(auto): workspace updates"
- The agent's subsequent `git add && git commit` might find "nothing to commit"

**Current likelihood**: **Medium**. The commit-guard forces agents to commit before `finish()`, and auto-commit runs every 10min. The window for overlap exists but is narrow.

### Risk 4: Federation Rebase During Active Work ⚠️ ACTIVE RISK

**Scenario**: The auto-commit handler runs `git rebase remote/main` while agents are actively reading/writing files in the agents/ repo.

**What happens**: During rebase, git rewrites the working directory as it replays commits. Active agents see:
- Files momentarily disappearing
- Files changing content mid-read
- Writes going to files that are about to be overwritten by rebase

The handler does commit all changes first (`git add -A && git commit` before pull), but the **rebase itself rewrites the working tree**, and other agents running concurrently don't know this is happening.

**Current likelihood**: **Low-Medium**. The handler runs every 10min. The rebase window is typically <1 second if there are few commits. But when there are conflicts, the resolution process can take several seconds, during which the working directory is unstable.

---

## 4. Concrete Evidence from Codebase

### All Agents Share One CWD

From `src/lib/tools/coding.ts`:
```typescript
export function createCodingTools(projectRoot: string, ...): AgentTool[] {
  return [
    createReadTool(projectRoot),    // same projectRoot for ALL agents
    createBashTool(projectRoot),    // same projectRoot for ALL agents  
    createEditTool(projectRoot, ...), // same projectRoot for ALL agents
    createWriteTool(projectRoot, ...) // same projectRoot for ALL agents
  ];
}
```

From `src/lib/manager.ts` line ~381:
```typescript
projectRoot: this._projectRoot,  // one projectRoot for the entire SubagentManager
```

### Edit Tool Has No File Locking

From `src/lib/tools/edit.ts` — the edit operation is read → find → replace → write with no locking between the read and write. Two concurrent edits to the same file will race.

### Auto-Commit Can Race with Agent Commits

From `agents/may/handlers/agents-auto-commit.ts`:
```typescript
git("git add -A", { cwd: agentsDir, timeout: 10_000 });
gitCommit(agentsDir, msg);  // uses --no-verify
```

This `git add -A` stages **everything**, including files another agent may be in the process of writing.

### Rebase Rewrites Working Directory

From `agents/may/handlers/agents-auto-commit.ts`:
```typescript
git(`git rebase ${remote}/main`, { cwd: agentsDir, timeout: 30_000 });
```

This physically rewrites files on disk during rebase. No mechanism notifies active agents.

---

## 5. What's Already Working Well

1. **Cross-edit guard** prevents agents from stomping each other's identity files (SOUL.md, agent.json)
2. **Commit guard** ensures agents commit before finishing — reduces the "uncommitted changes left behind" window
3. **Auto-commit handler** has smart federation conflict resolution with ownership-based rules
4. **Separate repos** for src/ and agents/ isolate the two main categories of work
5. **De facto safety**: Agents mostly write to their own directories (`agents/bob/`, `agents/coach/`, etc.), limiting contention to shared files

---

## 6. Recommended Safeguards

### Tier 1: Low-Effort, High-Impact (Implement Now)

#### 1a. File-Level Advisory Locks for edit() and write()

Add `flock()`-based advisory locking to the write path in `edit.ts` and `write.ts`:

```typescript
import { openSync, closeSync, flockSync } from "node:fs";

function withFileLock<T>(path: string, fn: () => T): T {
  const lockPath = `${path}.lock`;
  const fd = openSync(lockPath, "w");
  try {
    flockSync(fd, "ex");  // exclusive lock — blocks until acquired
    return fn();
  } finally {
    flockSync(fd, "un");
    closeSync(fd);
    try { unlinkSync(lockPath); } catch {}
  }
}
```

This prevents two concurrent `edit()` calls from racing on the same file. Cost: ~20 lines of code. Bun supports `flock` via libuv.

**Alternative (simpler)**: Use Node's `writeFileSync` which is already atomic at the OS level for small files (<4KB). For larger files, write to a temp file and `renameSync` (atomic on Linux). The race is in the read-modify-write cycle of `edit()`, not in the write itself.

#### 1b. Pause Auto-Commit During Active Agent Sessions

Add a check to the auto-commit handler: if any agent sessions are actively running (check `.state/sessions/*/[STARTED]` without `[COMPLETED]`), defer the commit by 1 cycle. This eliminates the auto-commit racing with agent commits.

```typescript
// In agents-auto-commit handler
const activeSessions = readdirSync(sessionsDir)
  .filter(d => existsSync(join(sessionsDir, d, "[STARTED]")) 
            && !existsSync(join(sessionsDir, d, "[COMPLETED]")));
if (activeSessions.length > 0) {
  ctx.log("[agents-auto-commit] deferred — active sessions running");
  return;
}
```

**Downside**: Sessions can run for hours, so this might defer indefinitely. Better: only defer if sessions are actively writing (check `filesModified` set on active sessions, or use a write-activity timestamp).

### Tier 2: Medium-Effort, Structural Fix

#### 2a. Git Worktrees for review/* Branches

When agents need to work on `review/*` branches (required if the bypass is removed):

```bash
git worktree add /tmp/<session-id> -b review/<name>
# Agent works in /tmp/<session-id> — fully isolated
# After review: git worktree remove /tmp/<session-id>
```

This is the only correct solution for branch-based review. The `registry-refactor` worktree proves it works. Implementation: modify `createCodingTools()` to accept a per-session `cwd` that points to the worktree.

#### 2b. Lock-Protected Git Operations in Auto-Commit

Wrap all git operations in the auto-commit handler with a lockfile:

```typescript
const LOCK_PATH = "/tmp/agents-repo-git.lock";

async function withGitLock<T>(fn: () => T): Promise<T> {
  // flock-based — blocks concurrent auto-commit runs and federation sync
  return withFileLock(LOCK_PATH, fn);
}
```

This prevents the federation rebase from racing with agent git operations. The commit-guard's `git status` is read-only and doesn't need the lock.

### Tier 3: High-Effort, Full Isolation

#### 3a. Per-Agent Working Directories

Each agent gets its own clone or worktree of the agents/ repo:

```
/tmp/agent-bob/       → worktree of agents/ repo
/tmp/agent-coach/     → worktree of agents/ repo  
/app/agents/          → main worktree (for auto-commit)
```

This eliminates ALL concurrent write races. But it requires:
- Changed `createCodingTools()` to use per-agent paths
- Sync mechanism to merge changes back to main
- Significant refactoring of path assumptions across the codebase

**Verdict**: Not worth it unless the concurrent write problems become frequent. The per-file locking (Tier 1a) solves 95% of the problem.

---

## 7. Summary of Findings

| Finding | Severity | Likelihood | Status |
|---|---|---|---|
| Shared working directory — concurrent file edits can race | Medium | Medium-High (shared KB files) | ⚠️ Active |
| Auto-commit can capture partial/mid-write files | Medium | Medium | ⚠️ Active |
| Federation rebase rewrites working dir during active sessions | High | Low-Medium | ⚠️ Active |
| Branch checkout destroys uncommitted state | High | Low (currently) → High (if bypass removed) | 💤 Latent |
| Git index.lock prevents index corruption | N/A | N/A | ✅ Protected |
| Cross-edit guard prevents identity file stomping | N/A | N/A | ✅ Protected |

**Key insight**: The most dangerous risk isn't git branches — it's the **shared working directory**. Even without any branching, concurrent agents writing to shared files (knowledge base, federation files, shared config) have no protection against read-modify-write races. The auto-commit handler compounds this by running `git add -A` every 10 minutes, potentially capturing half-written state.

**Recommended next step**: Implement Tier 1a (file-level locking for edit/write tools) — this is ~20 lines of code and eliminates the highest-frequency risk.
