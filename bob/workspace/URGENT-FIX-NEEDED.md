## Urgent: src/tools.ts Corruption

I have corrupted `src/tools.ts` during a previous session (write-after-truncated-read). The file is now missing the implementation bodies of `createReadTool`, `createWriteTool`, and `createExecTool` - it just has the headers and some helper functions, plus unrelated content (Learn tool) at the end.

The file size dropped from ~80KB to ~28KB.

### Impact
- Agents cannot read files (tool body missing).
- Agents cannot write files (tool body missing).
- Agents cannot exec commands (tool body missing).

I am currently running, so the *current* process has the old definitions loaded in memory. But if the process restarts, the system will be broken.

### Request
Please restore `src/tools.ts` from git history or a backup. I do not have access to git history in this environment (no .git directory).

If no backup exists, I need the content of `src/tools.ts` to be pasted into a file so I can reconstruct it.
