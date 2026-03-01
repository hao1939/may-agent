# May-Agent Codebase Review Report

**Date:** 2026-03-01  
**Scope:** All source files, design docs, tests, agent configs, runner

---

## 1. Design-to-Implementation Gap Analysis

### 1.1 Implemented and Working

| Design Feature | Status | Notes |
|---|---|---|
| SubagentManager (register, run, status, progress, steer, cancel, resume) | ✅ Complete | All core APIs implemented |
| Six-layer state model | ✅ Complete | Knowledge, tools, workspace, memory, session, output all working |
| Registry persistence (registry.json) | ✅ Complete | Agent configs + session status persisted |
| Session JSONL persistence + archival | ✅ Complete | Messages streamed to JSONL, archived to history/ on completion |
| Memory auto-append on completion | ✅ Complete | Per-agent memory JSONL with configurable limit |
| System prompt assembly (knowledge + memory + workspace/output) | ✅ Complete | Including lessons.md auto-load, skills, and memory entries |
| `createTool()` for parent-agent orchestration | ✅ Complete | list, run, status, progress, result, cancel, waitFor actions |
| Workflow system (types, tool, steering, interruption) | ✅ Complete | WorkflowContext, WorkflowResult, steering queue, WorkflowInterrupted |
| Evaluator (evaluateSession) | ✅ Complete | Score parsing, lesson extraction, workflow staging, score persistence |
| Maintenance (maintainAgent) | ✅ Complete | Lessons pruning, suggestions for domain.md, stale detection |
| Skills system (SKILL.md discovery, frontmatter parsing) | ✅ Complete | Per-agent + shared skillsDirs, XML formatting for prompt |
| Health check tool | ✅ Complete | package.json, agents/, .state/, node_modules, tsc, tests, stale sessions |
| Learn tool | ✅ Complete | Dumb append to lessons.md |
| Validate workflow tool | ✅ Complete | Type-checks .ts files against workflow-defs.d.ts |
| Runner (run/may.ts) | ✅ Complete | Interactive loop, event streaming, auto-evaluation, periodic maintenance |
| Workflow composition (ctx.runWorkflow) | ✅ Complete | Sub-workflows share steering queue and completed steps |

### 1.2 Gaps Between Design and Implementation

#### A. `MaintenanceResult.domainUpdated` field missing

**Design doc** (`maintenance-design.md`) specifies:
```typescript
interface MaintenanceResult {
  domainUpdated: boolean;   // was domain.md rewritten?
  ...
}
```

**Implementation** (`evaluator.ts`) has:
```typescript
interface MaintenanceResult {
  lessonsPruned: number;
  suggestions: string[];    // NOT domainUpdated
  staleItems: string[];
  toolIssues: string[];
}
```

The implementation deliberately changed this: `maintainAgent()` now does NOT modify domain.md (it returns suggestions instead, for human review). This is actually a **better design** than the doc — the doc should be updated to match.

**Action:** Update `maintenance-design.md` to match the implementation. The current approach (suggestions, not auto-edit) is safer and was clearly intentional.

#### B. Design doc mentions `getKnowledgePath()` — not implemented

`design.md` Core API section lists:
```typescript
getKnowledgePath(name: string): string | undefined;
```

Implementation has `getWorkspacePath()`, `getMemoryPath()`, `getOutputPath()`, and `getWorkflowDir()` — but no `getKnowledgePath()`. The `knowledgeDir` is stored on the definition but not exposed via a getter.

**Action:** Either add `getKnowledgePath()` or update the design doc. Since `knowledgeDir` is already on `SubagentDefinition`, this is a one-liner to add.

#### C. Design doc `status()` returns `SubagentInfo[]`, implementation returns `SessionInfo[]`

The design doc specifies:
```typescript
status(): SubagentInfo[];  // returns agents with their sessions
```

The implementation returns:
```typescript
status(): SessionInfo[];   // returns flat list of sessions
```

The design has `SubagentInfo` which groups sessions under agents. The implementation flattened this. The `listAgents()` method was added separately. This is a conscious design evolution.

**Action:** Update design doc to reflect the split into `status()` (sessions) + `listAgents()` (agents).

#### D. `timeoutMs` on SubagentDefinition — persisted but never enforced

The design doc says:
> `timeoutMs` — Enforce timeout on resumed sessions

`timeoutMs` is in the type, persisted to registry.json, but **never used** — no timeout logic exists in `run()` or `resume()`.

**Action:** Either implement timeout enforcement (start a timer in `run()` that calls `cancel()` after timeoutMs), or remove it from the design/types. Given it's in the design, implementing it is the right call.

#### E. Optimizer workflow exists but optimizer agent has no evaluation data flow

The `optimize.ts` workflow and optimizer agent domain.md are defined, but:
- No mechanism to automatically trigger optimization cycles
- No evaluation data accumulation analysis tools
- The optimizer references `.state/evaluations/` but doesn't have specialized tools to aggregate/analyze JSON files
- The staging pipeline (`.state/staged/`) exists for evaluator staging but optimizer → evaluator validation is manual

**Action:** This is future work by design ("start from design, improve while using"). The foundation is in place. Priority: low.

#### F. `send()` method on manager — no persistence or memory for follow-up messages

When `send()` resumes a completed session, it doesn't:
- Update the registry status back to "running"
- Re-subscribe for JSONL persistence
- Append memory on re-completion
- Re-archive the session

**Action:** `send()` needs the same lifecycle management as `run()`. Medium priority bug.

#### G. README doesn't mention workflows, evaluator, skills, learn tool

The README covers the core SubagentManager API well but omits:
- Workflow system (createWorkflowTool, workflow files)
- Evaluator (evaluateSession, maintainAgent)
- Skills system (SKILL.md, skillsDirs)
- Learn tool
- Health check tool
- Validate workflow tool

**Action:** Update README to document these features. Low priority (README is for external users, project is still in active development).

---

## 2. Code Quality Issues

### 2.1 Failing Test

```
FAIL  test/workflow-tool.test.ts > workflow tool: steering > 
  pre-queued steering signal interrupts workflow before first runAgent
```

The test expects `tool.isRunning` to be `true` after a 10ms delay, but the workflow's 50ms `setTimeout` may not have started by then due to event loop timing. This is a **flaky test** — timing-dependent.

**Action:** Fix by using a synchronization mechanism (e.g., a Promise that resolves when the workflow's execute function begins) rather than relying on setTimeout timing.

### 2.2 `send()` lifecycle gap (detailed)

```typescript
send(sessionId: string, message: string): boolean {
  const session = this.activeSessions.get(sessionId);
  if (!session) return false;
  if (session.status === "running") return false;

  session.status = "running";
  session.error = undefined;

  session.promise = session.agent.prompt(message)
    .then(() => {
      // No memory append
      // No archive
      // No registry update
      // No persistence subscription
    });
  return true;
}
```

Missing: persistence subscription, registry status update, memory append, archive. This means follow-up messages are not persisted to JSONL and the session's final state is not correctly tracked.

### 2.3 Type safety: `(def.model as any).provider` in persistence.ts

```typescript
model: { provider: (def.model as any).provider ?? "unknown", id: def.model.id },
```

The `Model` type from pi-ai apparently doesn't have a `provider` field in its type definition, forcing an `as any` cast. The `fakeModel()` in tests does include `provider`, so it works at runtime.

**Action:** Check if `Model` type in pi-ai has been updated. If not, this is acceptable — the cast is isolated and documented by convention.

### 2.4 `extractLastAssistantText` scans content blocks but only returns first text block

The function finds the last assistant message, then iterates its content blocks and returns the first text block it finds. If the last assistant message has a text block followed by a tool call, this works fine. But if it has thinking blocks before text, it still works because it iterates forward. This is fine.

### 2.5 No error handling for corrupted JSONL files

`readSessionMessages()` and `readMemoryEntries()` call `JSON.parse()` on each line with no try/catch. A single corrupted line will crash the entire read.

```typescript
return raw.trim().split("\n").map((line) => JSON.parse(line) as AgentMessage);
```

**Action:** Add per-line try/catch, skip or log corrupted lines. Low priority but important for robustness.

### 2.6 `RegistryStore.save()` is not atomic

`writeFileSync()` can leave a truncated file if the process crashes mid-write. For a file that's critical for resume, this is a risk.

**Action:** Write to a temp file, then `renameSync()` (atomic on most filesystems). Low priority.

### 2.7 No concurrent write protection on JSONL files

Multiple sessions for the same agent can race on `appendFileSync()` to the same memory JSONL. On Linux, `appendFileSync()` with O_APPEND is atomic for small writes, so this is likely fine in practice. But there's no guarantee for session JSONL if something goes wrong.

### 2.8 `evaluateSession` creates evaluator session but doesn't handle evaluator agent not being registered

```typescript
const evalSessionId = manager.run("evaluator", prompt);
```

If no "evaluator" agent is registered, this throws `Error: Agent "evaluator" not registered`. The error propagates to the caller, which is acceptable since `evaluateSession` is called from the runner which has already registered the evaluator. But the function signature doesn't make this dependency explicit.

**Action:** Document the prerequisite or add a check with a clear error message.

### 2.9 `nextId` counter resets on import — session ID uniqueness relies on timestamp

```typescript
let nextId = 0;
function generateId(): string {
  return `s_${Date.now()}_${nextId++}`;
}
```

If the module is re-imported (e.g., in tests), `nextId` resets. The timestamp provides uniqueness in practice, but two calls within the same millisecond with a reset counter could collide. The counter fixes this within a single process lifetime.

**Action:** Acceptable as-is. The combination of timestamp + counter is sufficient.

### 2.10 Workflow `import()` cache-busting counter is module-scoped

```typescript
let importCounter = 0;
```

This means if `createWorkflowTool` is called multiple times, they share the counter — which is fine and actually correct (avoids re-using the same cache-bust value).

---

## 3. Test Coverage Analysis

### 3.1 Well-Tested Areas

| Area | Test File | Coverage |
|---|---|---|
| Registry persistence | `persistence.test.ts` | Thorough |
| Session JSONL persistence + archival | `session-jsonl.test.ts` | Thorough |
| Memory persistence + system prompt | `memory-prompt.test.ts` | Thorough |
| Resume after crash | `resume.test.ts` | Excellent (10 scenarios) |
| `createTool()` API | `create-tool.test.ts` | All actions covered |
| Path accessors + archival | `paths-archive.test.ts` | Good |
| Evaluator (evaluateSession) | `evaluator.test.ts` | Excellent (30+ tests) |
| Maintenance (maintainAgent) | `evaluator.test.ts` | Good (8 tests) |
| Skills (parsing, loading, formatting) | `skills.test.ts` | Thorough |
| Workflow tool (list, run, events) | `workflow-tool.test.ts` | Good |
| Workflow dir resolution | `workflow-dir.test.ts` | Basic |
| Health check | `health-check.test.ts` | Thorough |

### 3.2 Untested Areas

1. **`send()` method** — no tests at all for follow-up messages on completed sessions
2. **`steer()` on manager** — not tested directly (only tested via workflow tool steering)
3. **`subscribe()` on manager** — not tested (used in runner but not unit tested)
4. **`createLearnTool()`** — no dedicated tests
5. **`createReadTool()` / `createWriteTool()` / `createExecTool()`** — no dedicated tool tests (indirectly tested via integration)
6. **Workflow `runWorkflow()` (composition)** — no tests for sub-workflow execution
7. **`UsageSummary` extraction** — not tested (the `extractUsage` function in evaluator.ts)
8. **`formatTranscript`** — only tested indirectly through evaluator prompt tests
9. **Context overflow handling in runner** — not testable as unit test (runner logic)
10. **Concurrent sessions on same agent** — tested for memory but not for workspace conflicts
11. **`listAgents()`** — tested in `create-tool.test.ts` but minimally

### 3.3 Test Quality Issues

- **Flaky test:** `workflow-tool.test.ts` line 472 — timing-dependent steering test fails intermittently
- **No test isolation for evaluator integration** — evaluator tests mock the manager, which is good, but don't test the actual evaluator agent prompt quality
- **No vitest config file found** — tests run but there's no `vitest.config.ts` in may-agent (there is one in the parent project but that's for OpenClaw)

---

## 4. Architecture Observations

### 4.1 Strengths

1. **Clean separation of concerns** — types.ts, persistence.ts, manager.ts, tools.ts are well-factored
2. **Design-doc-driven development** — all features have design docs written first
3. **Testability** — Manager is easily mockable, persistence is purely file-based
4. **Incremental evolution** — the codebase shows clear growth from minimal to feature-rich without over-engineering
5. **Two-repo strategy** — separating agent configs from library code is smart for independent evolution
6. **Three-layer learning** — learn tool → evaluator → maintainAgent is a well-designed knowledge lifecycle

### 4.2 Areas of Concern

1. **All persistence is synchronous** — `readFileSync`, `writeFileSync`, `appendFileSync` throughout. Fine for current scale, but will become a bottleneck with many concurrent sessions.
2. **No cleanup of completed sessions from `activeSessions` Map** — sessions are archived to disk but the in-memory Map grows unboundedly during a long process lifetime. `send()` relies on them being in the Map, which is correct, but old completed sessions never get garbage collected.
3. **No rate limiting or concurrent session cap** — design doc mentions this as an open question. Still open.
4. **Workflow hot-reload works in Node but not in vitest** — noted in comments, test workaround exists.

---

## 5. Prioritized Next Tasks

### P0 — Fix Broken Test

1. **Fix flaky workflow steering test** — `test/workflow-tool.test.ts` line 472. The test relies on `setTimeout(resolve, 10)` being enough time for the workflow to start. Use a synchronization promise instead. (~15 min)

### P1 — Fix `send()` Lifecycle

2. **Add lifecycle management to `send()`** — subscribe for persistence, update registry status, append memory on completion, re-archive. This is a bug — follow-up messages are silently lost. (~1 hour)
   - Also add tests for `send()` behavior

### P2 — Implement Timeout Enforcement

3. **Implement `timeoutMs` on sessions** — in `run()`, if `def.timeoutMs` is set, `setTimeout(() => cancel(sessionId), timeoutMs)`. Clear the timer when the session completes. (~30 min)
   - Add tests in `test/timeout.test.ts`

### P3 — Robustness

4. **Add per-line error handling to JSONL readers** — wrap `JSON.parse` in try/catch in `readSessionMessages()` and `readMemoryEntries()`. Skip corrupted lines with a warning. (~20 min)

5. **Add `getKnowledgePath()` accessor** — one-liner, matches design doc. (~5 min)

6. **Atomic registry writes** — write to temp file, then `renameSync()`. (~15 min)

### P4 — Test Coverage

7. **Add tests for `send()`** — follow-up messages, re-running completed sessions, persistence behavior. (~45 min)

8. **Add tests for `createLearnTool()`** — creates lessons.md, appends entries, handles missing dir. (~20 min)

9. **Add tests for `steer()` on manager** — steered, queued, not_running cases. (~20 min)

10. **Add tests for `subscribe()` on manager** — event subscription and unsubscription. (~15 min)

11. **Add tests for workflow composition (`runWorkflow`)** — sub-workflow execution, shared steering queue. (~30 min)

### P5 — Doc Updates

12. **Update `maintenance-design.md`** — remove `domainUpdated: boolean`, add `suggestions: string[]`, document the "read-only domain.md" decision. (~10 min)

13. **Update `design.md`** — `status()` returns `SessionInfo[]` not `SubagentInfo[]`, add `listAgents()`, add `getWorkflowDir()`, add `send()`, remove `getKnowledgePath()` or add it. (~15 min)

14. **Update README** — add sections for workflows, evaluator, skills, learn tool, health check. (~30 min)

### P6 — Future Enhancements (Lower Priority)

15. **Session cleanup from activeSessions Map** — evict completed sessions after some time or count threshold, since they're already archived to disk.

16. **Concurrent session limits** — per-agent or global cap as mentioned in design doc.

17. **Async persistence** — move from `*Sync` to async file operations for better concurrency.

18. **Optimizer integration** — build the data aggregation tools the optimizer needs to actually analyze `.state/evaluations/` data.

19. **Context window management** — design doc open question #1. For now, the runner handles overflow by starting a fresh session with a summary. A more systematic approach (e.g., message compaction) could be built into the manager.

---

## Summary

The codebase is in strong shape. The core architecture is solid, well-tested (183/184 tests passing), and matches the design docs with minor deviations that represent design improvements. The main issues are:

1. **One flaky test** (timing-dependent steering)
2. **`send()` missing lifecycle management** (bug — follow-up messages aren't persisted)
3. **`timeoutMs` declared but not enforced** (feature gap)
4. **Minor doc drift** from implementation evolution

The project successfully self-bootstrapped: May supervised building most of the features, the evaluator evaluates sessions, and the three-layer learning system is operational. The foundation is solid for the next phase (optimizer integration, skill generation, model experiments).
