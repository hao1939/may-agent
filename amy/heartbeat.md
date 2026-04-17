# Amy Heartbeat

## PROMISE-DELIVER-REPORT (C40) — optional for heartbeats

> **C40 is OPTIONAL for heartbeat sessions** (low-overhead). It remains **REQUIRED for dispatched/non-heartbeat work** (human requests, tasks from other agents).

If you choose to use it: after reading heartbeat + todo, your FIRST **substantive** output is a promise list.
**You may use read-only tools (`read`, `grep`, `ls`) to gather context first.** Then, **BEFORE any state-changing action** (`write`, `edit`, or mutating `bash`), you must state:

**This session I will:**
1. [specific action]
2. [specific action]
3. [specific action]

Your LAST text output MUST map back to each promise:

**Results:**
1. ✅/❌ [outcome for promise 1]
2. ✅/❌ [outcome for promise 2]
3. ✅/❌ [outcome for promise 3]

If you pivot mid-session, say "PIVOT: replacing promise N with [new action] because [reason]".

## 0c. ⛔ Verification Discipline (FM-3.3 Guard)
**Verification must be Structural, not Semantic.**
- **Bad**: `read(file)` → "Looks good." (This is "Eye-balling" — prone to FM-3.3 hallucinations).
- **Good**: `grep "pattern" file` → "Found match." (This is Structural — evidence-based).
- **Rule**: Never claim a task is done until you have a **binary signal** (Exit Code 0, "PASS" string, or explicit grep match) in the transcript.
- **Self-Correction**: If you find yourself saying "I checked and it looks correct," STOP. Run a command that *proves* it is correct.

1. Notifications pending? Check the "Injected: pending tasks" section above and `agents.requests({ filter: "active" })` for tasks targeting you. Note: `agents/shared/SIGNALS.md` no longer exists — do NOT attempt to read it. Process any pending items.
2. **🛑 MANDATORY**: Check the "Injected: pending tasks" section above. If it has items → work on the top one. Do NOT skip this step or claim status from memory.
3. No actionable todo items? → **🛑 MANDATORY**: Read `agents/amy/periodic-tasks.md` with a tool call. Do the most overdue task.
4. After completing → update `agents/amy/periodic-tasks.md` with date.
5. **Nothing assigned & no overdue periodic task?** Do not exit. Consult `agents/shared/may-agent-docs/idle-playbook.md` and pick one item. Produce a measurable artifact this cycle.
6. Else → Stop.
