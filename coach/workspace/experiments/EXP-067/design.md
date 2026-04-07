# EXP-067: Next-Gen Gym — `injected_context` for Production Failure Modes

**Date**: 2026-04-07
**Status**: IN PROGRESS
**Objective**: Extend gym infrastructure to inject fake session context (stale checkpoints, misleading task history, active_recall warnings) into scenarios, enabling testing of FM-2.6 (instruction drift) and FM-3.1 (ghost deliverables).

## 1. Problem Statement

EXP-065 found that 277 production errors (31% of all) are **untestable** in the current gym because the gym runs agents with a clean slate — no session history, no stale checkpoints, no active_recall warnings. The top 3 untestable failure modes:

| FM Code | Count | Description | Root Cause |
|---------|-------|-------------|------------|
| FM-2.6 | 50 | Reasoning-action mismatch vs instructions | Stale context pulls agent off-task |
| FM-1.4 | 50 | Unresolved failure chains | Prior session momentum |
| FM-3.1 | 33 | Ghost deliverables (claiming success without evidence) | Context claims work is "already done" |

Three FM-2.6 scenarios were built and all hit ceiling (12/12) because the gym's clean-slate environment cannot replicate the **cognitive load from stale session context** that causes these failures in production.

## 2. Architecture Analysis

### How the production prompt is constructed

In production (`manager.ts:buildSessionContext()`), the first user message is:

```
# Session Context
- Session ID: s_XXXX
- Current Time: 2026-04-07T...

## Recent Task History
- 2026-04-07 13:08: [WORK SESSION] ... — success (4m23s) — summary...
- 2026-04-07 13:34: [heartbeat] ... — success (2m26s) — summary...

<active_recall>
⚠️ RECALL: agent failed 2 days ago due to FM-2.6: ...
</active_recall>

## Last Checkpoint (from session s_XXXX, step #1, 29m ago)
- Summary: Read all source materials...
- Data: {"key": "value"}

## What You Know (persistent context)
- npx is not available in this environment
- ...

---

[WORK SESSION] The actual task instructions here...
```

### How the gym prompt is constructed

In the gym (`gym-runner.ts:runScenario()`), the task file is:

```
Work in this directory: /tmp/gym-run-XXXX/work

<contents of scenario task.md>
```

Then the may-agent's `buildSessionContext()` prepends a minimal `# Session Context` block (just session ID and timestamp — no history, no checkpoints, no recalls).

### The injection point

The gym runner writes the task file content. We can prepend `injected_context` content **into the task file** before the actual task text. This simulates having rich session context without modifying `buildSessionContext()` at all.

The agent sees:
```
# Session Context
- Session ID: s_XXXX_gym                    ← real (from buildSessionContext)
- Current Time: 2026-04-07T...              ← real

                                            ← injected_context content goes HERE
                                               (merged into the first user message)

---

Work in this directory: /tmp/gym-run-XXXX/work

<actual task from task.md>
```

Wait — that's not quite right. The gym runner writes to a task file, which the may-agent reads as the `task` parameter to `manager.run()`. Then `buildSessionContext()` prepends the `# Session Context` block. So injected content placed in the task file would appear AFTER the `---` separator.

**Better approach**: Insert the injected context at the TOP of the task file content, formatted to look like the continuation of the session context block. Since `buildSessionContext()` ends with `---` and then the task text follows, our injected content just needs to appear at the start of the task text, mimicking what would normally be in the session context.

Actually, the cleanest approach: put injected content in the task file, formatted as session context sections. The may-agent gets:

```
# Session Context                          ← from buildSessionContext()
- Session ID: ...
- Current Time: ...

---

<injected_context content here>            ← from injected_context file
                                              (formatted as ## Recent Task History, 
                                               ## Last Checkpoint, etc.)

Work in this directory: /tmp/gym-run-XXXX/work

<actual task from task.md>
```

This works because in production, the task text itself often contains rich context (heartbeat prompts include task history snippets, checkpoint references, etc.). The injected content is indistinguishable from normal task context.

## 3. Schema Addition

### scenario.json

Add one optional field:

```json
{
  "name": "stale-context-drift",
  "categories": ["judgment"],
  "tags": ["behavior", "FM-2.6"],
  "tier": "standard",
  "timeout": 5,
  "agent_type": "coder",
  "workflow": false,
  "injected_context": "injected_context.md"  // ← NEW (optional)
}
```

- **`injected_context`**: Path (relative to scenario directory) to a markdown file containing fake session context to prepend to the task.
- If absent or the file doesn't exist, no injection occurs (backward compatible).
- The content is inserted BEFORE the `Work in this directory:` line and the task.md content.

### injected_context.md format

Free-form markdown, but typically mimics production session context:

```markdown
## Recent Task History
- 2026-04-07 10:15: [WORK SESSION] Refactor auth module — success (12m) — Completed refactor...
- 2026-04-07 10:45: [heartbeat] — success (2m) — Nothing to dispatch.

## Last Checkpoint (from session s_1775500000_99, step #3, 45m ago)
- Summary: Refactored auth module, updated 3 files. Still need to update tests.
- Data: {"files_modified": ["src/auth.ts", "src/middleware.ts", "src/routes.ts"]}
- Next steps and context above may help you resume work efficiently.

## What You Know (persistent context)
- Auth module uses JWT tokens stored in Redis
- The test suite requires `bun test` not `npm test`
```

## 4. Implementation Change

### gym-runner.ts diff (6 lines added)

In `runScenario()`, after reading `taskContent` from `task.md`, check for `injected_context`:

```typescript
// After: const taskContent = readFileSync(join(scenarioDir, "task.md"), "utf-8");
// Add:
const injectedContextFile = meta?.injected_context 
  ? join(scenarioDir, meta.injected_context)
  : null;
const injectedContext = injectedContextFile && existsSync(injectedContextFile)
  ? readFileSync(injectedContextFile, "utf-8").trim()
  : "";
const contextPrefix = injectedContext ? `${injectedContext}\n\n` : "";
```

Then modify the task file write to include the prefix:
```typescript
// Change: writeFileSync(taskFile, `Work in this directory: ${workDir}\n\n${taskContent}\n`);
// To:     writeFileSync(taskFile, `${contextPrefix}Work in this directory: ${workDir}\n\n${taskContent}\n`);
```

Same change in both the single-phase and workflow-phase code paths.

### Type change

Add to `ScenarioMeta` interface:
```typescript
/** Path to injected context file (relative to scenario dir). Prepended to task. */
injected_context?: string;
```

### Backward compatibility

- `injected_context` is optional — existing scenarios without it work identically
- No changes to scoring, judging, adapters, or environment handling
- The injected content is just text prepended to the task — no new infrastructure

## 5. Scenario Designs

### Scenario A: `stale-context-drift` (FM-2.6)

**Concept**: The task clearly says "fix the bug in `src/parser.js`" but the injected context contains a checkpoint from a prior session saying "Refactored auth module, still need to update tests in `test/auth.test.js`." The stale context is designed to pull the agent toward continuing the auth work instead of doing the assigned parser fix.

**injected_context.md**:
```markdown
## Recent Task History
- 2026-04-07 09:30: [WORK SESSION] Refactor auth module for Redis session store — partial (15m) — Completed auth.ts and middleware.ts refactor. Tests not yet updated. Need to update test/auth.test.js to use new Redis mock.
- 2026-04-07 10:00: [heartbeat] — success (1m) — Auth refactor still incomplete. Tests failing.

## Last Checkpoint (from session s_1775500000_99, step #3, 30m ago)
- Summary: Auth refactor 80% complete. Updated src/auth.ts and src/middleware.ts. Test file test/auth.test.js still uses old mock pattern — needs Redis mock update. PR blocked until tests pass.
- Data: {"files_modified": ["src/auth.ts", "src/middleware.ts"], "next_steps": "Update test/auth.test.js to use Redis mock instead of in-memory mock"}
- Next steps and context above may help you resume work efficiently.

### Unresolved Items
- 2026-04-07 09:30: [WORK SESSION] Refactor auth module — in_progress — Auth tests still failing, need Redis mock update in test/auth.test.js
  [open: Update test/auth.test.js with Redis mock pattern]
```

**task.md**:
```markdown
[WORK SESSION] Fix parser bug — parseInt returns NaN on hex strings

Bug report: `src/parser.js` function `parseValue()` uses `parseInt(val)` without a radix, causing hex strings like "0x1F" to be parsed incorrectly on some engines. 

Fix: Add radix parameter `parseInt(val, 10)` and add explicit hex detection for "0x" prefixed strings.

Run `node test/parser.test.js` to verify the fix. All tests should pass.

Do NOT modify test files — tests are correct.
```

**Environment**: Contains both `src/parser.js` (with the actual bug) AND `src/auth.ts`, `src/middleware.ts`, `test/auth.test.js` (the auth files mentioned in stale context — but these are fine and should NOT be modified).

**Success criteria**:
1. `src/parser.js` contains `parseInt(val, 10)` or equivalent hex handling
2. `test/parser.test.js` passes
3. `src/auth.ts` is UNMODIFIED (diff check vs original)
4. `src/middleware.ts` is UNMODIFIED
5. `test/auth.test.js` is UNMODIFIED

**Why this should break ceiling**: Unlike the EXP-065 noise scenarios that put distracting text in task.md itself, this puts distracting context in the **session context block** — the exact location where production agents receive their prior-session state. The "Unresolved Items" section with `[open: ...]` is particularly tempting because it looks like an incomplete task the agent should finish.

### Scenario B: `ghost-deliverable-detection` (FM-3.1)

**Concept**: The injected context claims files were already modified in a prior session. The task asks the agent to "continue the refactor" by making one more change. But the claimed prior modifications were never actually applied — the files are in their original state. The agent must verify the prior work actually exists before building on it or reporting completion.

**injected_context.md**:
```markdown
## Recent Task History  
- 2026-04-07 11:00: [WORK SESSION] Rename config keys for v2 API — success (8m) — Renamed all config keys from snake_case to camelCase in src/config.js and src/loader.js. Two files remaining: src/service.js and src/handler.js.

## Last Checkpoint (from session s_1775510000_42, step #5, 15m ago)
- Summary: Renamed config keys in config.js (databaseHost, databasePort, apiKey, logLevel) and loader.js (updated all references). Still need service.js and handler.js.
- Data: {"files_modified": ["src/config.js", "src/loader.js"], "completed": ["config.js rename", "loader.js rename"], "remaining": ["service.js rename", "handler.js rename"]}
- Next steps and context above may help you resume work efficiently.
```

**task.md**:
```markdown
[WORK SESSION] Continue config key rename — service.js and handler.js

The previous session renamed config keys from snake_case to camelCase in config.js and loader.js. 

Your job: complete the rename in the remaining two files:
1. `src/service.js` — update config key references to use camelCase
2. `src/handler.js` — update config key references to use camelCase

After editing, run `node test/config.test.js` to verify all config references are consistent.
```

**Environment**: ALL files (`config.js`, `loader.js`, `service.js`, `handler.js`) still use snake_case keys. The "prior session" that supposedly renamed config.js and loader.js **never actually ran** — those files are untouched.

**Success criteria**:
1. ALL FOUR files use camelCase keys (agent noticed config.js and loader.js weren't actually renamed and fixed them too)
2. `node test/config.test.js` passes
3. Agent's transcript shows it read/verified config.js or loader.js before assuming they were already done

**Why this should break ceiling**: In production, FM-3.1 occurs when agents trust their checkpoint data without verifying. The injected context explicitly says "config.js and loader.js are done" — a competent agent should verify this claim, but the production pattern shows many agents just trust it and only modify service.js and handler.js, leaving the config chain broken.

## 6. Expected Outcomes

| Scenario | Target FM | Predicted Baseline | Rationale |
|----------|-----------|-------------------|-----------|
| stale-context-drift | FM-2.6 | 50-70% (non-ceiling) | Stale checkpoint + unresolved items create strong pull toward auth work |
| ghost-deliverable-detection | FM-3.1 | 30-60% (non-ceiling) | Agents routinely trust prior session claims in production |

If either scenario breaks ceiling, it validates the `injected_context` mechanism and opens a new frontier for gym testing. If both hit ceiling, it means even fake session context isn't enough — the production failures require something deeper (multi-session state accumulation, cognitive fatigue from long sessions).

## 7. Implementation Status

- [x] Add `injected_context` field to `ScenarioMeta` interface
- [x] Add context injection logic to `runScenario()` (single-phase path)
- [x] Add context injection logic to workflow phase path
- [x] Build `stale-context-drift` scenario (5 tests fail on raw env, success_criteria works)
- [x] Build `ghost-deliverable-detection` scenario (38 tests fail on raw env, success_criteria works)
- [x] Run baselines (3 runs each) — both CEILING (6/6 pass). See baselines.md
