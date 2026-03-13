# Lessons

## 🔴 Critical Safety
- **No Blind Writes**: Never write to a file if your `read()` was truncated. Use `sed` or read in chunks.
- **Verify Paths**: Always check if a file exists before reading/editing. Project root is `/app`.
- **Surgical Edits**: For 1-5 line changes, ALWAYS use `sed`. It avoids accidental content loss.
  - ✅ `sed -i "s/old/new/" file.ts`
  - ❌ `sed -i "15s/..." file.ts` (Line numbers are fragile)

## Execution Discipline
- **Run First, Then Fix**: Don't refactor code you haven't run.
- **Verify**: Always run `npx vitest --run` (or relevant test) and `npx tsc --noEmit` after changes.
- **Focus**: Touch only the files requested. Scope creep = failure.

## Operational
- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.
- **Error Handling**: `AgentMessage.isError` is unreliable. Check the text output.
