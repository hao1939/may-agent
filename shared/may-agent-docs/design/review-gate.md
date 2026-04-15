# DESIGN: Automated Review Gate — Code Merge Requires QA

**Author:** May · **Date:** 2026-04-15 · **Status:** Draft — Bob approved with notes, awaiting Hao's approval  
**Requested by:** Hao · **Refs:** may-gatekeeper.md, guard-escalation.md  
**Reviewed by:** Bob (2026-04-15) — Verdict: Approve with notes. Full review at `agents/bob/workspace/REVIEW-review-gate-design.md`

---

## Problem

Agents commit code to `review/<sessionId>` branches. Nothing prevents those branches from being merged to `main` without review. Today:

1. Tech-lead or the dispatching agent merges review branches manually
2. May is *supposed to* catch system-scope changes during heartbeats (gatekeeper role)
3. But there's no automated trigger — heartbeats can miss things, and agents can merge before May's next cycle

The guard-escalation revert showed this gap: tech-lead's review branch was merged to main before any QA or gatekeeper review.

## Solution: Three Complementary Modes

The gatekeeper operates in three modes, each catching different scenarios:

| Mode | Mechanism | When | Catches |
|------|-----------|------|---------|
| **A: Workflow Guard** | `step_done` → inject QA review | During workflows | System-scope code changes in workflow steps |
| **B: Session-End Review Subscriber** | `session_end` subscriber | After each session | Agents merging their own review branches without review |
| **C: Design Review** | May's heartbeat judgment | During heartbeats | Designs/proposals that need Hao's approval |

No single mode is sufficient. Mode A is **preventive** (blocks bad changes inline). Mode B is **detective** (finds things that slipped through). Mode C is **judgmental** (catches subtle design risks that code scanning misses).

### Mode B: Session-End Review Subscriber (code changes)

A `session_end` subscriber that auto-dispatches QA when a session produces a review branch.

**Trigger:** `session_end` event where a `review/*` branch exists for the session.

**Scope filter:** Only triggers for branches touching system-scope files (see Definitions below). Workspace-only branches (markdown in `agents/*/workspace/`) pass through without review.

**Flow:**
```
Agent session ends
    │
    session_end event fires
    │
    createReviewGate subscriber checks:
      1. Does branch `review/<sessionId>` exist?
      2. Does it have commits ahead of main?
    │
    YES → dispatch QA review session (fork may with review task)
          May reviews diff, runs tsc + tests, checks for system-scope changes
          If clean → merge to main
          If system-scope → flag for Hao approval first
    │
    NO → no action (no review branch = nothing to review)
```

**Implementation:** New function in `src/lib/session-subscribers.ts`:

```typescript
export function createReviewGate(
  persistDir: string,
  emitFork: (agent: string, task: string, opts?: { kind?: string }) => void,
): (event: AgentEvent) => void {
  return (event: AgentEvent) => {
    if (event.type !== "session_end") return;
    if (event.status === "error" || event.status === "interrupted") return;
    
    // Check for review branch
    const branchName = `review/${event.sessionId}`;
    try {
      const result = execSync(
        `git log ${branchName} --not main --oneline 2>/dev/null | head -5`,
        { encoding: "utf-8", timeout: 5000 }
      ).trim();
      
      if (!result) return; // No commits ahead of main
      
      // Dispatch QA review
      emitFork("may", 
        `[review-gate] Review branch ${branchName} from ${event.agent}. ` +
        `Session: ${event.sessionId}. ` +
        `Diff: run \`git diff main..${branchName}\`. ` +
        `Check: tsc, tests, system-scope changes. ` +
        `If clean: merge to main. If system-scope: flag Hao first.`,
        { kind: "review" }
      );
    } catch {
      // Branch doesn't exist or git error — no action
    }
  };
}
```

Registered in `src/app/may.ts`:
```typescript
bus.subscribe(createReviewGate(PERSIST_DIR, (agent, task, opts) => {
  bus.emit({ type: "fork", agent, task, ...opts });
}));
```

### Mode C: May Proactive Design Review (Heartbeat)

May's heartbeat already has a "Proactive Review (Gatekeeper)" step. Extend it to explicitly check for:

1. **New/modified design docs** — any `.md` in `designs/`, `workspace/design-*`, or project files with status changes
2. **System-scope proposals** — guard changes, workflow changes, cross-agent protocol changes
3. **Pending review branches** — branches not yet reviewed by the gate

Separate from the automated systems, May's heartbeat should also proactively catch judgment calls that automated scanning can't make.

**Implementation:** Update May's heartbeat instructions — behavioral change, no code needed. This is the human-judgment layer that complements the automated modes.

## Design Decisions

**Heartbeat addition** (step 3 extension):
```markdown
### Design/Proposal Review
Check for system-scope designs that need approval before implementation:
- `git log --all --diff-filter=AM --name-only -- '*/design*' '*/designs/*' | head -20`
- Review any new designs for system-scope impact
- If system-scope: set status to pending-review, notify Hao
- If agent-scope: no action needed
```

This is behavioral — no code change, just a heartbeat update.

## Mode A: Deferred

Mode A (workflow guard) is deferred until Modes B+C prove the concept and reveal which workflow steps need inline interception. Per Bob's review: flesh this out only after behavioral validation.

## Coverage Analysis

**Mode B (session subscriber)** catches the primary failure mode: agents merging their own review branches without review.
**Mode C (heartbeat judgment)** catches design/proposal risks that automated scanning misses.

Together B+C cover:
- Agent merges own review branch without review → Mode B catches at session_end
- System-scope designs/proposals proceeding without approval → Mode C catches during heartbeat
- Mode A (deferred) would add inline prevention during workflows if needed

## What This Prevents

- ❌ Agent merges own review branch without review
- ❌ System-scope code changes slip past May's heartbeat gap
- ❌ Designs that break system-wide behavior proceed without Hao's approval

## What This Doesn't Change

- Agents still commit to `review/*` branches (existing pattern)
- Guards still enforce quality at tool-call level (existing guards)
- May still has gatekeeper authority (existing role)
- Hao is final authority for system-scope changes (existing chain)

## Implementation Order

1. **Phase 1:** Update May's heartbeat with design review checklist (Mode C) — zero code, behavioral
2. **Phase 2:** Build the session-end review subscriber (Mode B) — ~60 lines in `src/lib/session-subscribers.ts`
3. **Phase 3:** Add review metrics to DB (optional) — track what got reviewed, who approved, catch rate
4. **Phase 4 (if needed):** Write the workflow guard (Mode A) — only if B+C prove insufficient

## Definitions

**System-scope** = changes to:
- `src/` (runtime code)
- `agents/shared/protocols/` (cross-agent contracts)
- Workflow definitions, guard logic, session management
- Another agent's heartbeat, context, or SOUL files

**Agent-scope** = changes to:
- `agents/<name>/` (single agent's own workspace, context, skills)
- Knowledge entries (`knowledge/entries/`)
- Experiment results and workspace markdown

## Resolved Questions (from Bob's review)

1. **Review scope:** Only branches touching system-scope files trigger review. Workspace-only markdown changes pass through without review.
2. **Who reviews?** May reviews. A dedicated QA agent is premature — no evidence May's reviews are bottlenecked or low quality.
3. **Merge authority:** May merges agent-scope autonomously. System-scope requires Hao approval.
