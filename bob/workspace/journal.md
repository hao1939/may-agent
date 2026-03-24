# Analysis: FM-3.1 Ghost Deliverable Enforcement Status

## 1. Evidence
- **SOUL Update**: Successfully injected "Materialize Intermediate Findings" skill guard into `agents/bob/SOUL.md`. Verified with `grep` (line 87).
- **Evaluation Data Access**: `node -e` script failed (`MODULE_NOT_FOUND` for `./src/lib/requests.js`).
- **File Search**:
  - `src/lib/requests.js` DOES NOT EXIST.
  - `ls src/lib/` shows `manager-receipts.ts`, `ops-gate.ts`, `orders.ts`, `finish-guard.ts`.
  - `grep -r "getDb" src/` returned empty.
  - `find src -name "request*"` returned empty.
  - `src/lib/finish-guard.ts` exists and contains `enforceFinishDeliverables`.
  - `grep -r "enforceFinishDeliverables" src/` only shows definition in `finish-guard.ts`. **It is NOT wired into any tool handler.**

## 2. Analysis
### C1.5 Ghost Deliverables (FM-3.1)
- **Status**: **Code Exists but Unwired**.
- The logic to prevent Ghost Deliverables (`enforceFinishDeliverables`) sits in `src/lib/finish-guard.ts`, but it is **dead code**.
- No tool handler imports or calls it. The `finish` tool is likely a native binary or defined elsewhere (not in `src/lib/tools/` which only has `security.ts`).
- **Risk**: Agents can still lie about deliverables. The "Mitigated" status in `focus-tasks.md` is partially false (detective only, not preventive).

### Evaluation Data
- **Blocker**: I cannot query the SQLite DB with the provided script because the module path is wrong or the file is missing/compiled.
- **Pivot**: I must find where `requests.db` is actually managed. `ls .state/` shows `requests.db`.
- **Hypothesis**: The system might be using compiled JS in `dist/` or `build/` if TS is used, or the `requests` module is named differently.

## 3. Immediate Actions
1. **Fix Focus Task Status**: Downgrade "Infra Enforcement of C1.5" from [MITIGATED] to [IN-PROGRESS] (Wiring Needed).
2. **Wire C1.5 Guard**: I need to find WHERE the `finish` tool is defined to inject the guard.
   - Strategy: Search for "finish" string in `src/app/` or `src/lib/manager.ts`.
3. **Evaluation Data Pivot**: Abandon the node script for now. Use `sqlite3` CLI if available, or just read `.state/evaluations/` if they are JSON files (unlikely, `ls` showed directory). Wait, `ls .state/` showed `evaluations/` directory? No, `ls .state/` showed `evaluations` (no slash in my memory, let me check evidence).
   - Evidence: `checkpoints/`, `chrome-profile/`, `escalations.jsonl`, `evaluations/`.
   - Ah, `evaluations/` IS a directory.
   - Action: `ls .state/evaluations/` to see if they are individual JSON files.

## 4. Next Steps
- Investigate `src/lib/manager.ts` or `src/app/agent-loader.ts` to find tool definitions.
- Wire `finish-guard.ts` into the system.
