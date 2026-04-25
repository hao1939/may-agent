# Action Plan: Test Safe-Edit Workflow (F2)

1.  **Analyze**: `safe-edit.ts` is implemented by Optimizer.
2.  **Verify**: I need to ensure it actually works on a real file.
3.  **Setup**: Create a test file `agents/xhs-tool-test.md` (large file).
4.  **Action**: Delegate to Optimizer (or whoever has the tool, but I can't call subagents directly on `coder` from `bob`? Bob has `subagents` tool, can he call `coder`? No, only `evaluator` and `optimizer` in meta loop usually, but `may` can delegate to anyone. Wait, Bob's `subagents` tool can call `coder` if registered. Let's check `agent.json`.)
    - Actually, I should ask `optimizer` to run the test because `optimizer` owns the `safe-edit` workflow (it's in `agents/optimizer/workflows`).
    - So I will delegate to `optimizer` to RUN the workflow on the test file.
5.  **Test Case**:
    - Create `agents/xhs-tool-test.md` with >300 lines.
    - Ask `optimizer` to change a line in the middle using `safe-edit`.
6.  **Verify**: Read the file back and check if it's truncated or correctly edited.
7.  **Cleanup**: Remove test file.

## Delegation Task
"Verify the `safe-edit` workflow you just created.
1. Create a dummy file `agents/xhs-tool-test.md` with 400 lines of text (use `seq 400 > agents/xhs-tool-test.md`).
2. Run the `safe-edit` workflow on it. Change line 200 to 'Line 200 - MODIFIED BY SAFE EDIT'.
3. Verify the file still has 400 lines (no truncation).
4. Report the result."

## Test Results
- **Status**: SUCCESS
- **Verification**: The file had 400 lines before and after. Line 200 was changed correctly.
- **Workflow**: `safe-edit` correctly identified the large file and used the surgical path.

## Cleanup
- Removed test files `agents/bob/workspace/test-safe-edit.txt`.
