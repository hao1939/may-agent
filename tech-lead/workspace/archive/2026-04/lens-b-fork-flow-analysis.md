# Lens B: agents.fork() Delegation Flow Analysis

## Call Chain: From `agents.fork()` to First LLM Token

```
agents tool "fork" action (manager-agents-tool.ts:292)
  ├─ Validation: agent name, task required, not-a-tool guard, callDeny check
  ├─ trackRequest() → SQLite request tracker (fire-and-forget)
  └─ manager.runAgent(name, task, { originSessionId, source, requestId })
       │
       └─ SubagentManager.run(name, task, { parentSessionId, source, kind, requestId })
            │  ⚠️ BUG: originSessionId silently dropped here
            │
            ├─ Hot-reload agent.json (memoryLimit only)
            ├─ Generate session ID
            ├─ Create output directory + session directory
            ├─ buildTransformContext() → compaction transform (if enabled)
            ├─ createAgent(def, sessionId, { compactionTransform })
            │    ├─ Inject sessionId into checkpoint tool
            │    ├─ Filter tools with undefined parameters
            │    └─ new Agent({
            │         initialState: { systemPrompt, model, tools: wrapToolsWithReceipts(...) },
            │         transformContext: compactionTransform,
            │       })
            │         └─ wrapToolsWithReceipts() applies ~9 guards:
            │              emptyArgs, toolSchema, pathHallucination, completeness,
            │              finish, commit, verificationDepth, readDedup, sessionRead, scrapeDedup
            │
            ├─ Create ActiveSession object (32+ fields)
            ├─ Write [STARTED] sentinel
            ├─ subscribeForPersistence(session) → JSONL logging
            ├─ registry.saveSession() → persist meta to disk
            ├─ setupTimeout(session, def.timeoutMs)
            ├─ activeSessions.set(sessionId, session)
            ├─ bridgeAgentEvents() → connect agent bus to manager bus
            ├─ emit("session_start")
            │
            ├─ buildSessionContext(def, name, sessionId, persistDir, task)
            │    ├─ Session ID + current time header
            │    ├─ getRecentDigests() → last N session digests
            │    ├─ getCrossAgentDigests() → what other agents changed in my files
            │    ├─ getUnresolvedDigests() → open items
            │    ├─ formatDigestContext() → "## Recent Task History" block
            │    ├─ runActiveRecall() → failure history warnings
            │    ├─ readLatestCheckpointForAgent() → "## Last Checkpoint" block
            │    ├─ Load contextFiles from def.contextFiles
            │    ├─ Load agents/<name>/context.md
            │    └─ routeKnowledge() → inject relevant knowledge pointers
            │
            ├─ routeFewShotExamples() → inject few-shot examples (if enabled)
            │
            ├─ Compose prompt: sessionContext + fewShot (optional) + task
            │
            ├─ gatedPrompt(session, () => agent.prompt(promptText))
            │    └─ apiGate.acquire() → rate-limit gate per provider
            │         └─ agent.prompt(promptText) → FIRST LLM CALL
            │
            └─ runAgentWithRetry(session, gatedPrompt, infraRetryMax, handleCompletion)
                 ├─ await initialCall (the gatedPrompt)
                 ├─ On failure: retry loop with exponential backoff
                 │    ├─ isRetryableInfraError() checks 8+ patterns:
                 │    │    empty_response, tool_use_missing, json_stream_error,
                 │    │    provider_outage, http_retryable, unhandled_stop_reason
                 │    ├─ Pop bad assistant message
                 │    ├─ Inject "Please continue." if needed
                 │    └─ agent.continue() with backoff
                 └─ handleCompletion(session) when done
                      ├─ detectErrors() + clearPostFinishErrors()
                      ├─ determineOutcome()
                      ├─ registry.updateSessionStatus()
                      ├─ cleanupSession() → archiveSession()
                      ├─ activeSessions.delete()
                      ├─ escalateBlockedSession() if blocked/failure
                      └─ emit("session_end")
```

## Complexity Assessment

### Function Count in Critical Path
From `agents.fork()` to first LLM token: **~20 functions** across 4 files.

### Files Touched
1. `manager-agents-tool.ts` — fork action handler
2. `manager.ts` — runAgent(), run(), createAgent(), buildSessionContext(), gatedPrompt(), etc.
3. `manager-retry.ts` — runAgentWithRetry()
4. `manager-utils.ts` — types, constants, pure utilities

### Layers of Indirection
1. agents tool → runAgent() → run() (3 layers just for dispatch)
2. run() is ~200 lines doing 15+ sequential operations
3. createAgent() wraps tools through wrapToolsWithReceipts + 10 guard composers
4. gatedPrompt() adds a rate-limit gate layer
5. runAgentWithRetry() wraps the actual call with retry logic
6. handleCompletion() is 2 functions (outer try/catch + inner pipeline)

### Observations

**Justified complexity:**
- Session context building (digests, checkpoints, knowledge routing) — genuinely needed for agent continuity
- Retry logic — essential for production reliability (catches 8+ transient error patterns)
- Tool guards — prevent common LLM misbehaviors (empty args, path hallucination, etc.)
- Rate limiting gate — prevents API throttling

**Questionable complexity:**
- `runAgent()` is a trivial wrapper around `run()` that just sets `kind: "job"` and `source`. Could be eliminated.
- `callAgent()` has its own depth-tracking + timeout + abort signal + streaming subscription machinery, all wrapping `run()` + `waitFor()`.
- The `ActiveSession` object has 32+ fields — some are operational counters, some are metadata, some are lifecycle flags. No clear grouping.
- `handleCompletion()` wraps `handleCompletionInner()` just for try/catch. A single function with try/catch would be simpler.

## Bug Found

**`originSessionId` is silently dropped in fork flow:**

```typescript
// manager-agents-tool.ts line 343-346:
const sessionId = manager.runAgent(params.agent, forkTask, {
  originSessionId: parentSidRun,  // ← passed
  source: "agents.fork",
  requestId: runRequestId,
});

// manager.ts line 2417-2428:
runAgent(agentName, task, opts?: { parentSessionId?, source?, requestId? }): string {
  return this.run(agentName, task, {
    parentSessionId: opts?.parentSessionId,
    source: opts?.source ?? "agents.run",
    kind: "job",
    requestId: opts?.requestId,
    // ❌ originSessionId NOT passed through
  });
}
```

The `AgentsToolManagerDeps` interface at line 32 declares `originSessionId` in `runAgent`'s opts, so TypeScript doesn't complain at the call site. But the actual `SubagentManager.runAgent()` implementation doesn't include `originSessionId` in its opts type, so it's silently ignored.

**Impact:** Forked sessions have no `originSessionId`, breaking the context query feature (`agents.context({ scope: "origin" })`).

**Fix:** Add `originSessionId` to `runAgent()`'s opts and pass it through to `run()`.

## Simplification Opportunities

1. **Inline `runAgent()` into the agents tool** — It's a 5-line wrapper that adds no value. The fork handler could call `run()` directly (or the agents tool could use a slightly different interface).

2. **Group ActiveSession fields** — Split the 32+ fields into logical sub-objects:
   - `identity: { sessionId, agentName, kind, parentSessionId, originSessionId }`
   - `lifecycle: { status, startedAt, endedAt, closed, autoClose }`
   - `metrics: { turnCount, opCount, totalToolCalls, infraRetryCount }`
   - `tracking: { workflowRunId, stepLabel, orderId, requestId }`

3. **Merge handleCompletion/handleCompletionInner** — The outer is just try/catch. Single function with try/catch is clearer.

4. **Extract session startup from `run()`** — The `run()` method is 200 lines. The "create and configure Agent" part (lines 950-1000) could be a separate `initializeSession()`.
