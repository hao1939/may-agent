# Unreviewed Findings (QA Heartbeat)

## 2026-04-30

### 1) TypeScript build currently fails (CRITICAL)
- **Command:** `cd /app/agents && ./node_modules/.bin/tsc --noEmit`
- **Result:** FAIL
- **Errors:**
  - `shared/lib/index.ts(13,1): error TS2308: Module './iteration-monitor.js' has already exported a member named 'IterationRecord'.`
  - `shared/lib/index.ts(15,1): error TS2308: Module './iteration-monitor.js' has already exported a member named 'IterationRecord'.`
  - `shared/lib/index.ts(16,1): error TS2308: Module './task-validator.js' has already exported a member named 'ValidationResult'.`
- **Evidence:** See QA heartbeat tool output.
- **Hypothesis:** duplicate re-exports introduced in `shared/lib/index.ts` (barrel) due to overlapping named exports across modules.

### 2) Vitest test suite passes but exits non-zero due to permissions (IMPORTANT / Environment)
- **Command:** `cd /app/agents && ./node_modules/.bin/vitest --run`
- **Test outcome:** **536 tests passed**, **31 files passed**.
- **Process result:** FAIL (exit code 1) due to:
  - `EACCES: permission denied, open '/app/agents/node_modules/.vite/vitest/results.json'`
- **Cause evidence:** `node_modules/.vite/vitest` and `results.json` are owned by **root:root** while the process runs as **mayagent**.
  - `stat -c '%A %U %G %n' node_modules/.vite ...` shows root ownership.
- **Impact:** CI/local runs may intermittently fail if cache dir is root-owned.
- **Suggested fix:** ensure `.vite` cache is writable by the running user (e.g., delete/recreate as correct owner in image build; avoid running npm install as root; or configure vitest cache dir).

### Files inspected
- `agents/shared/lib/index.ts`
- `agents/scout/journal.md`
