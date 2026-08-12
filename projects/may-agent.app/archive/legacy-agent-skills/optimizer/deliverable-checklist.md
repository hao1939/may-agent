# Skill: Deliverable Checklist

**Purpose**: Before executing any brief-based or multi-step task, enumerate ALL expected deliverables in a DELIVERABLES_CHECKLIST.md file. This prevents FM-2.2 (incomplete deliverables) — optimizer's #1 failure mode.

## The Rule

**At the START of any task with multiple deliverables, create DELIVERABLES_CHECKLIST.md listing every expected output.**

## When to Use

- Any task from `optimizer-brief.md` or a dispatched work session
- Any multi-phase workflow (skill pipeline, deployment, refactoring)
- Any task where the brief lists 2+ deliverables, files to create, or changes to make

## How to Do It

### Step 1: Orient first — read context files
Read your context files (heartbeat.md, context.md, the task brief) as you normally would. C12.1 requires orientation before acting — always read before you write.

### Step 2: Identify deliverables from the task/brief
Identify every deliverable mentioned — files to create, files to modify, tests to write, configs to update.

### Step 3: Create DELIVERABLES_CHECKLIST.md
Write it in your workspace or the task's working directory:

```markdown
# Deliverables Checklist

Task: [brief description]

- [ ] Create src/lib/new-module.ts
- [ ] Add tests in test/new-module.test.ts
- [ ] Update src/lib/manager.ts to import new module
- [ ] Verify tests pass
- [ ] Update design doc with results
```

**After writing, verify with `read()` that the checklist was created correctly.** C1.3 requires every write() be verified — the checklist is no exception.

### Step 4: Check items off as you complete them

⚠️ **EVERY checklist edit MUST be preceded by read(). No exceptions.**  
C1.1 compliance is at 80.5% because of this exact step — optimizer edits the checklist without reading it first.

**MANDATORY two-call sequence** (you MUST do both calls, in this order):
```
read("agents/optimizer/workspace/DELIVERABLES_CHECKLIST.md")   // ← CALL 1: read first (C1.1)
edit("agents/optimizer/workspace/DELIVERABLES_CHECKLIST.md",    // ← CALL 2: then edit
     "- [ ] Create src/lib/new-module.ts", 
     "- [x] Create src/lib/new-module.ts ✅")
```

❌ **WRONG** — editing without reading (even right after write):
```
write("agents/optimizer/workspace/DELIVERABLES_CHECKLIST.md", ...)
edit("agents/optimizer/workspace/DELIVERABLES_CHECKLIST.md", ...)  // ← C1.1 VIOLATION!
```

✅ **RIGHT** — always read before edit:
```
write("agents/optimizer/workspace/DELIVERABLES_CHECKLIST.md", ...)
read("agents/optimizer/workspace/DELIVERABLES_CHECKLIST.md")       // ← required
edit("agents/optimizer/workspace/DELIVERABLES_CHECKLIST.md", ...)  // ← now safe
```

Example checklist after updates:
```markdown
- [x] Create src/lib/new-module.ts ✅
- [x] Add tests in test/new-module.test.ts ✅ (12/12 pass)
- [ ] Update src/lib/manager.ts to import new module
- [ ] Verify tests pass
- [ ] Update design doc with results
```

### Step 5: Before finishing, verify ALL items checked
Read DELIVERABLES_CHECKLIST.md one final time. Every item must be [x]. If any are unchecked, complete them before calling finish().

## Why This Matters

- **FM-2.2 is optimizer's dominant failure mode** (51% of FM-Heavy Worker sessions)
- **Root cause is semantic**: optimizer misinterprets which deliverables are required, not that it forgets them
- **Forced enumeration** makes all expected outputs explicit before execution begins
- **EXP-115 evidence**: This technique improved pass rate from 0% to 100% (+100pp) in controlled gym trials
- **A production guard enforces this** — if you call finish(success) without a DELIVERABLES_CHECKLIST.md in your transcript, the guard will block you

## When to Skip

- Simple single-deliverable tasks (e.g., "update this one config file")
- Heartbeat dispatching (you're triaging, not producing deliverables)
- Quick inline responses (< 3 tool calls)
