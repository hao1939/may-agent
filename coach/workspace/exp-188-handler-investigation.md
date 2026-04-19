# EXP-188: Handler Pipeline Investigation

## How heartbeat task text is constructed

**File:** `src/app/cron.ts`, method `fireHeartbeat()` (line ~620)

### Pipeline (in order of injection):

1. **Base message**: `entry.message` from cron config (e.g., `"[heartbeat] You are Coach..."`)
2. **Injections array** built up from multiple sources:
   - `heartbeat.md` content (line ~649)
   - Pending tasks from request DB (line ~676)
   - Metrics (line ~720)
   - Last interrupted session (line ~764)
   - Recent activity (line ~843)
   - **Active project auto-detection** (line ~853) — `buildProjectInjection()` from `project-scanner.ts`
3. Final assembly (line ~866): `taskMessage = entry.message + "\n\n---\n" + injections.join("\n\n---\n")`
4. Task message passed to `manager.run()` which calls `buildSessionContext()` to prepend session ID, history, etc.

## Current project injection mechanism

**File:** `src/lib/project-scanner.ts` (already exists!)

- `scanActiveProjects(agentDir)` — reads `workspace/projects/*.md`, finds files with `**Status**: active`
- `buildProjectInjection(agentName, agentDir)` — generates injection text telling agent to call `workflow.run("persistent-task", ...)`

### Current injection text (line ~76 of project-scanner.ts):
```
## ⚠️ REQUIRED: Use persistent-task workflow

You have an active project. Your FIRST tool call must be:
workflow.run("persistent-task", { task: "Resume active project: <goal>", project: "<path>" })

Do NOT read the project file manually. Do NOT start working directly. Call the workflow FIRST.
```

### Where it's injected in cron.ts (line ~853):
```typescript
const agentDir = resolve(this.projectRoot, "agents", agentName);
const projectInjection = buildProjectInjection(agentName, agentDir);
if (projectInjection) {
  injections.unshift(projectInjection);  // Prepended = highest priority
}
```

## Key Finding: The infrastructure already exists!

The current approach is **text-based injection** — it tells the agent to call `workflow.run()` as its first tool call. This is exactly what EXP-186 tested (skill-only = 75% compliance). The agent still has to *choose* to follow the instruction.

## EXP-188 Design: Programmatic injection

Instead of injecting text that *asks* the agent to call `workflow.run()`, we could make the cron handler **programmatically** start the persistent-task workflow — bypassing agent choice entirely.

### Option A: Replace heartbeat with direct workflow dispatch

**Change in:** `src/app/cron.ts`, `fireHeartbeat()` method, around line 853

```typescript
// Instead of injecting text, directly dispatch the workflow
const agentDir = resolve(this.projectRoot, "agents", agentName);
const projects = scanActiveProjects(agentDir);
if (projects.length > 0) {
  const project = projects[0];
  // Fire a workflow session instead of (or before) the heartbeat
  // This would need manager.run() with workflow pre-loaded
  // Problem: heartbeat is the session; can't run two sessions
}
```

**Problem:** The heartbeat IS the session. We can't run a separate workflow session while also running the heartbeat. The agent needs the heartbeat for other work (pending requests, metrics, etc.).

### Option B: Inject workflow.run() as a forced first tool call (programmatic)

**Change in:** `src/lib/manager.ts` or a new middleware

Instead of text injection, intercept the agent's first response and inject a synthetic `workflow.run()` tool call before the agent's actual first tool call.

**Problem:** Complex, fragile, breaks agent autonomy model.

### Option C (Recommended): Improve the text injection quality

The current injection (project-scanner.ts) is already well-positioned. EXP-186 got 75% with a skill file. The injection is higher-priority (prepended to task). The gap is:

1. The injection says "Your FIRST tool call must be" — but the agent processes all injections and may get distracted
2. No enforcement mechanism after injection

**Proposed change in `src/lib/project-scanner.ts`:**
- Make the injection more concise and directive
- Add the exact workflow.run() call with proper JSON (currently it uses object syntax which isn't valid for the workflow tool)

### Option D: Hard-gate enforcement in finish-guard

**Change in:** finish-guard or session-close logic

If agent has active project but never called `workflow.run("persistent-task", ...)`, block finish() with an error message. This is the "exact command + enforcement" pattern that got 100% in EXP-184.

**Files to change:**
1. `src/lib/project-scanner.ts` — export `scanActiveProjects` (already exported)
2. Finish guard (wherever it lives) — check session tool calls for workflow.run("persistent-task")

## Risks/Caveats

1. **Over-enforcement**: If active project exists but agent has urgent pending request, forcing persistent-task first may be wrong
2. **Workflow errors**: If persistent-task workflow fails, agent's entire heartbeat is wasted
3. **Multiple projects**: Currently picks `projects[0]` — no priority logic
4. **Status detection**: Regex-based status parsing is fragile (`**Status**: active`)

## Recommendation for EXP-188

Test **Option C** (improved injection text) vs **Option D** (finish-guard enforcement) in gym. Option D is closest to EXP-184's 100% approach. The injection point is already correct (line 853 of cron.ts, using project-scanner.ts).
