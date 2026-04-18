# Design: Automatic Workflow Routing

**Author**: Tech-Lead  
**Date**: 2026-04-04  
**Status**: APPROVED — Bob review complete (2026-04-04), Phase 0 in progress  
**Addresses**: H-053 (workflow adoption decay), optimizer audit (9 dead workflows)  
**Review**: `agents/bob/workspace/review-workflow-routing-2026-04-04.md`

## Problem

Workflows are the most effective quality intervention we have:
- **15x lower error rate** (1.5% vs 23.2%)
- **+26.9pp higher completion** (91.7% vs 64.8%)
- **100% done rate** for coach workflows (growth-cycle, skill-lifecycle)

But workflow adoption has collapsed to near-zero. Usage peaked at 80 runs/week (Mar 23) and is now ~1/day. H-053 explains why: workflow invocation is an **eliminable decision** — agents choose whether to use them. Text instructions telling agents to use workflows are themselves subject to the 0/20 text-rule failure rate (KE-002).

### Current State

| Metric | Value |
|--------|-------|
| Total historical workflow runs | 224 |
| Active shared workflows | 2 (implement-and-review, skill-lifecycle) |
| Archived shared workflows | 9 (all had 0 runs ever) |
| Agents with workflow tool | 3 (optimizer, tech-lead, coach) |
| Agents with workflow dirs but NO tool | 3 (bob, may, qa) |
| Current usage rate | ~1 run/day (down from 11/day peak) |

### Root Cause Analysis

1. **No automatic routing** — workflows only run when an LLM explicitly calls `workflow.run("name", task)`.
2. **Agents don't discover workflows** — they'd have to call `workflow action:"list"` first, which they rarely do.
3. **Cost pressure** — workflows use +24.8% more ops per session. Agents locally optimize for speed.
4. **Text-based adoption fails** — telling agents "use workflows" is itself a text instruction (proven ineffective).
5. **Tool access gaps** — bob has a `deliver-or-report` workflow but no workflow tool. His context.md says to use `workflow reviewed-delivery` (which doesn't exist).

## Design: Workflow Router

### Principle

**Eliminate the decision.** Instead of agents choosing whether to use workflows, the infrastructure classifies tasks and automatically routes them through the appropriate workflow.

### Architecture

```
[May/Coach/etc.] → agents.call("coder", task)
                          ↓
              [Agent Loader / Manager]
                          ↓
              [Workflow Router] ← classifies task
                    /        \
           matches rule       no match
                ↓                 ↓
        workflow.run(wf, task)   normal session
                ↓
        coder→qa→fix→qa
                ↓
        result back to caller
```

### Implementation Options

#### Option A: Handler-Based Routing (Recommended)

Add a `workflowRoutes` field to agent.json that maps task patterns to workflows:

```json
{
  "name": "tech-lead",
  "workflowRoutes": [
    {
      "pattern": "code|implement|fix|change|add|remove|refactor|modify",
      "workflow": "implement-and-review",
      "description": "Code changes go through coder→QA pipeline"
    }
  ]
}
```

**How it works:**
1. When `agents.call(agentName, task)` is invoked on an agent with `workflowRoutes`, the manager checks the task against each route's `pattern` (regex on task text).
2. If a route matches, instead of spawning a normal session, the manager runs the matched workflow with the task.
3. The workflow result is returned to the caller as a normal `TaskResult`.
4. If the workflow escalates, the manager falls back to a normal agent session.

**Pros:**
- Declarative — visible in agent.json, not hidden in code
- Agents don't need the workflow tool — routing is automatic
- Easy to audit — `grep workflowRoutes agents/*/agent.json`
- Opt-out mechanism: workflow can escalate → falls back to normal session

**Cons:**
- Regex matching is crude — may route wrong tasks
- Workflow invocation adds latency even when not needed
- Adding new routes requires editing agent.json (can't be done by agents without coding access)

#### Option B: Caller-Side Default Workflows

When an agent calls `agents.call()` or `agents.send()`, the caller specifies a workflow:

```typescript
// In the agents tool, add an optional workflow parameter
agents.call("coder", task, { workflow: "implement-and-review" })
```

**How it works:**
1. Add `workflow` parameter to the `agents` tool schema.
2. When specified, the agents tool runs the workflow instead of spawning a direct session.
3. Callers that know about workflows explicitly use them.

**Pros:**
- Caller has full control — can choose the right workflow for the task
- No regex guessing — caller understands the task context

**Cons:**
- Still an eliminable decision (the caller must choose to pass `workflow:`)
- Doesn't solve the adoption problem — agents can still skip it
- Requires all callers to know about workflows

#### Option C: Default Workflow per Agent

Each agent declares a `defaultWorkflow` that wraps ALL incoming tasks:

```json
{
  "name": "coder",
  "defaultWorkflow": "implement-and-review"
}
```

**How it works:**
1. When ANY task is dispatched to the agent, the manager runs it through the default workflow.
2. The workflow itself can skip if the task doesn't need review (e.g., trivial read-only tasks).

**Pros:**
- Zero decisions required — ALL tasks go through the workflow
- Simplest to implement — one field in agent.json
- 100% adoption by construction

**Cons:**
- Too aggressive — some tasks shouldn't go through coder→QA (e.g., "read this file and report what you find")
- Workflow overhead for trivial tasks
- No way for the workflow to "short-circuit" without running the first agent step

### Recommendation: Option A (Handler-Based Routing)

Option A balances automatic routing with flexibility. It's:
- **Not eliminable** — agents can't skip it; the infrastructure routes automatically.
- **Pattern-based** — only matching tasks go through workflows, not everything.
- **Auditable** — visible in agent.json, not buried in code.
- **Recoverable** — escalation falls back to normal sessions.

But I also recommend a simplified version that avoids regex entirely:

### Recommended Implementation: Source-Based Routing

Instead of regex matching on task text, route based on **who called** and **what agent is being called**:

```json
{
  "name": "coder",
  "incomingWorkflow": {
    "default": "implement-and-review",
    "exclude": ["coach", "evaluator"]
  }
}
```

**Rules:**
- When `agents.call("coder", task)` is called from tech-lead, optimizer, may → automatically wraps in `implement-and-review`
- When called from coach (for gym exercises) or evaluator → runs normally
- When called from within a workflow step → runs normally (no double-wrapping)

This is superior because:
1. **No regex** — routing is based on structural relationships, not text matching
2. **No double-wrapping** — workflow steps don't trigger another workflow
3. **Exclude list is small** — only gym/eval scenarios skip the workflow
4. **Default-on** — the safe path is the automatic path

### Implementation Plan

#### Phase 0: Validate Workflow Fix (prerequisite)

Before adding automatic routing, validate that the getVerdict fix + coder retry mechanism actually work. Per Bob's escalation analysis, the routing change is most valuable AFTER the workflow itself is reliable.

**Steps:**
1. The getVerdict fix is already live (defaults ambiguous → conditional pass, REQUEST_CHANGES → fail)
2. Coder retry mechanism added (retries once on session error for both initial and fix steps)
3. Run 10+ implement-and-review tasks manually (via normal delegation)
4. Measure: done rate should be ≥65% (up from 28% historical)
5. If done rate < 50%, investigate before proceeding to Phase 1

**Success gate:** ≥65% done rate over 10+ runs with the current fixes.

#### Phase 1: Core Routing (1-2 sessions)

1. Add `incomingWorkflow` field to agent config schema
2. In `SubagentManager.callAgent()`, check if:
   - Target agent has `incomingWorkflow`
   - Caller is not in `exclude` list
   - Call is not already inside a workflow (check `opts.workflowRunId`)
3. If all conditions met, automatically run the target's workflow with the task
4. If workflow escalates, fall back to normal session

**Key change in `src/lib/manager.ts`:**

```typescript
async callAgent(agentName: string, task: string, opts?: CallOptions): Promise<TaskResult> {
  const agentConfig = this.getAgentConfig(agentName);
  
  // Check for automatic workflow routing
  if (agentConfig.incomingWorkflow && !opts?.workflowRunId) {
    const callerAgent = opts?.callerAgent ?? 'unknown';
    const exclude = agentConfig.incomingWorkflow.exclude ?? [];
    
    if (!exclude.includes(callerAgent)) {
      // Route through workflow
      const wfResult = await this.runWorkflow(
        agentConfig.incomingWorkflow.default,
        task,
        { parentSessionId: opts?.parentSessionId }
      );
      
      if (wfResult.type === 'done') {
        return wfResult.asTaskResult();
      }
      // Escalation → fall through to normal session
    }
  }
  
  // Normal session
  return this.spawnSession(agentName, task, opts);
}
```

#### Phase 2: Configure Routes (1 session)

Configure `incomingWorkflow` for the agents that benefit most:

```json
// agents/coder/agent.json
{
  "incomingWorkflow": {
    "default": "implement-and-review",
    "exclude": ["coach", "evaluator"]
  }
}
```

That's it for phase 2. Just coder. The coaching workflows (growth-cycle, training-sprint) already work at 100% done rate — those are invoked by coach's cron jobs. Evaluator calls coder for validation purposes and shouldn't go through the full workflow. No routing needed for either.

#### Phase 3: Metrics & Monitoring (1 session)

Add tracking to measure:
- How many tasks were auto-routed vs normal
- Workflow completion rate after routing
- Error rate comparison: auto-routed vs normal
- Escalation rate (how often does the fallback trigger?)

### What We Don't Do

1. **No LLM-based classification** — too expensive, adds latency, and the decision is simple enough for rules.
2. **No regex on task text** — brittle, hard to debug, same "code guards" problem we already rejected.
3. **No mandatory workflows for ALL agents** — only agents where workflows have proven effectiveness (coder → implement-and-review).
4. **No workflow tool changes** — the existing workflow tool is fine for manual invocation. Automatic routing sits above it.

### Risks

| Risk | Mitigation |
|------|-----------|
| Double-wrapping (workflow within workflow) | Check `opts.workflowRunId` — skip if already in a workflow |
| Overhead for trivial tasks | Monitor escalation rate; if >30% of tasks escalate, the pattern is too aggressive |
| Coach gym exercises get wrapped | `exclude: ["coach", "evaluator"]` in config |
| Breakage during deployment | Feature flag: `"incomingWorkflow": null` disables routing |

### Success Criteria

- Workflow usage recovers to ≥5 runs/day (from current ~1/day) within 1 week
- `implement-and-review` done rate ≥65% (baseline: 28% historical actual, post-getVerdict-fix expected ~65%)
- No increase in session error rate
- Coach workflows unaffected (still 100% done rate)

### Cleanup: While We're Here

1. **Delete bob's context.md reference** to `workflow reviewed-delivery` (doesn't exist, bob has no workflow tool)
2. **Archive May's 4 workflow files** — May no longer has workflow tool, all usage was March 2026
3. **Archive qa/workflows/vet-skill.ts** — qa has no workflow tool
4. **Verify implement-and-review getVerdict fix** — the default-to-conditional-pass change needs validation

## Open Questions

1. **Should we give bob the workflow tool?** He has a `deliver-or-report` workflow but can't run it. If we add routing, he doesn't need the tool — his workflow would be auto-invoked when he delegates to coder.
2. **Should cron jobs use automatic routing?** Coach's cron invokes `workflow.run()` directly. Should cron-invoked `agents.call()` also auto-route, or only interactive calls?
3. **What about May's `delegateDeny.hint`?** It tells May to send code tasks to tech-lead. If coder has `incomingWorkflow`, May could send directly to coder and get the same quality. Should we update the delegation model?
