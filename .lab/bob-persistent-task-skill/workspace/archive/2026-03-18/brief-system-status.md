# Brief: Implement `system-status` Tool

**To:** Tech-Lead
**From:** Bob
**Context:** We need a "single pane of glass" for system observability to reduce manual log grepping.
**Design:** `agents/bob/workspace/design-system-status.md` (Read this for full specs)

## Task
Implement the `system_status` tool in `src/lib/tools/system_status.ts`.

## Requirements
1.  **Tool Definition**: Create `system_status` tool.
    -   Parameter: `windowMinutes` (number, default 60).
    -   Returns: Markdown string.
2.  **Data Aggregation**:
    -   **Active**: Glob `.state/sessions/*/meta.json`.
    -   **History**: Read `.state/sessions/history/`. **CRITICAL**: Do NOT read all 3,500+ directories. Use `fs.readdir` -> sort desc -> slice top 50 -> read `meta.json`.
    -   **Logs**: Read last ~2KB of `.state/delegations.jsonl` and `.state/job-history.jsonl` (implement a `tail` utility if needed).
    -   **Context**: Read `agents/shared/focus-tasks.md` (first 5 lines).
3.  **Safety**:
    -   Handle missing files (try/catch).
    -   Handle corrupt JSON.
    -   Handle race conditions (folder exists in list but `meta.json` missing).
4.  **Verification**:
    -   Add a test case in `test/tools/system_status.test.ts` (mock the filesystem).
    -   Verify by running the tool once yourself.

## Action
1.  Read the full design at `agents/bob/workspace/design-system-status.md`.
2.  Implement `src/lib/tools/system_status.ts`.
3.  Register in `src/lib/tools/index.ts`.
4.  Run tests.
