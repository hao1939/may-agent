# DESIGN: Automated Review Gate — Code Merge Requires QA

**Author:** May · **Date:** 2026-04-15 · **Status:** Draft — awaiting Hao's approval  
**Requested by:** Hao · **Refs:** may-gatekeeper.md, guard-escalation.md

---

## Problem

Agents commit code to `review/<sessionId>` branches. Nothing prevents those branches from being merged to `main` without review. Today:

1. Tech-lead or the dispatching agent merges review branches manually
2. May is *supposed to* catch system-scope changes during heartbeats (gatekeeper role)
3. But there's no automated trigger — heartbeats can miss things, and agents can merge before May's next cycle

The guard-escalation revert showed this gap: tech-lead's review branch was merged to main before any QA or gatekeeper review.

## Solution: Two Mechanisms

### Mechanism B: Review Gate Subscriber (code changes)

A new `session_end` subscriber that auto-dispatches QA when a session produces a review branch.

**Trigger:** `session_end` event where a `review/*` branch exists for the session.

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

### Mechanism C: May Proactive Design Review (heartbeat)

May's heartbeat already has a "Proactive Review (Gatekeeper)" step. Extend it to explicitly check for:

1. **New/modified design docs** — any `.md` in `designs/`, `workspace/design-*`, or project files with status changes
2. **System-scope proposals** — guard changes, workflow changes, cross-agent protocol changes
3. **Pending review branches** — branches not yet reviewed by the gate

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

1. **Phase 1:** Update May's heartbeat with design review checklist (mechanism C) — zero code
2. **Phase 2:** Build `createReviewGate` subscriber (mechanism B) — ~50 lines of code
3. **Phase 3:** Add review status tracking (optional) — track which branches have been reviewed in the DB

## Open Questions

1. **Review scope:** Should ALL review branches trigger QA, or only those touching `src/` (code)? Agent workspace changes on review branches are lower risk.
2. **Who reviews?** May dispatches to herself currently. Should there be a dedicated QA agent?
3. **Merge authority:** Can May merge autonomously for agent-scope changes? Or does every merge need explicit approval?
