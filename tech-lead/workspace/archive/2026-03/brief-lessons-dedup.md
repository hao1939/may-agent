# Task: Deduplicate LESSONS.md Boilerplate

**Priority:** P2
**Context:** `agents/shared/LESSONS.md` now exists and is loaded by manager.ts before each agent's own LESSONS.md. It contains the 3 common entries that are duplicated across all agents:
1. "No Blind Writes" 
2. "Verify Paths" (about /app root)
3. "Context Efficiency" (about auto-loaded files)

Tech-lead's own LESSONS.md is already cleaned. The remaining 11 agents need their duplicated entries removed.

## What To Do

For each agent below, remove the lines that duplicate the shared LESSONS.md content. The specific lines vary slightly per agent but are semantically identical.

### agents/coach/LESSONS.md
Remove these 2 lines from `## 🔴 Critical Safety`:
- `- **No Blind Writes**: Never write to a file if your \`read()\` was truncated.`
- `- **Verify Paths**: Project root is \`/app\`. Relative paths or \`/app/...\`.`
Remove from `## Operational`:
- `- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.`

### agents/optimizer/LESSONS.md
Remove from `## 🔴 Critical Safety`:
- `- **No Blind Writes**: Never write to a file if your \`read()\` was truncated. Use \`sed\` or read in chunks.`
- `- **Verify Paths**: Always check if a file exists (\`ls\` or \`find\`) before reading/editing. Project root is \`/app\`.`
Remove from `## Operational`:
- `- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.`

### agents/coder/LESSONS.md
Remove from `## 🔴 Critical Safety`:
- `- **No Blind Writes**: Never write to a file if your \`read()\` was truncated. Use \`sed\` or read in chunks.`
- `- **Verify Paths**: Always check if a file exists before reading/editing. Project root is \`/app\`.`
Remove from `## Operational`:
- `- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.`

### agents/master/LESSONS.md
Remove from `## 🔴 Critical Safety`:
- `- **No Blind Writes**: Never write to a file if your \`read()\` was truncated.`
- `- **Verify Paths**: Use \`ls\` or \`find\` to confirm file existence. Project root is \`/app\`.`
Remove from `## Operational`:
- `- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.`

### agents/amy-kimi/LESSONS.md
Remove from `## 🔴 Critical Safety`:
- `- **No Blind Writes**: Never write to a file if your \`read()\` was truncated.`
Remove from `## Operational`:
- `- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.`

### agents/scout/LESSONS.md
No "Verify Paths" or "No Blind Writes" present. Remove from `## Operational`:
- `- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.`

### agents/bob/LESSONS.md
Remove from `## 🔴 Critical Safety`:
- `- **No Blind Writes**: Never write to a file if your \`read()\` was truncated. Use \`sed\` or read in chunks.`
- `- **Verify Paths**: Always check if a file exists (\`ls\` or \`find\`) before reading/editing. Project root is \`/app\`.`
Remove from `## Operational`:
- `- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.`

### agents/amy/LESSONS.md
Remove from `## 🔴 Critical Safety`:
- `- **No Blind Writes**: Never write to a file if your \`read()\` was truncated.`
- `- **Verify Paths**: Project root is \`/app\`. Relative paths or \`/app/...\`.`
Remove from `## Operational`:
- `- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.`

### agents/may/LESSONS.md
Remove from `## 🔴 Critical Safety`:
- `- **No Blind Writes**: Never write to a file if your \`read()\` was truncated.`
Remove from the duplicate `## Operational` section (the one at the end):
- `- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded into your system prompt. Don't re-read them. But \`heartbeat.md\` is NOT auto-loaded — you MUST \`read()\` it at the start of every heartbeat and follow its steps in order.`
Note: May's version has extra heartbeat info — keep that part somewhere in May's LESSONS.md (it's agent-specific), just not in the "Context Efficiency" bullet. You could add a separate bullet: `- **Heartbeat is NOT auto-loaded**: You MUST \`read()\` heartbeat.md at the start of every heartbeat.`

### agents/evaluator/LESSONS.md
Remove from `## 🔴 Critical Safety`:
- `- **No Blind Writes**: Never write to a file if your \`read()\` was truncated.`
- `- **Verify Paths**: Project root is \`/app\`. Relative paths or \`/app/...\`.`
Remove from `## Operational`:
- `- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.`

### agents/qa/LESSONS.md
Remove from `## 🔴 Critical Safety`:
- `- **No Blind Writes**: Never write to a file if your \`read()\` was truncated.`
Remove from `## Operational`:
- `- **Context Efficiency**: SOUL/DOMAIN/TOOLS/LESSONS are auto-loaded. Don't re-read.`

## Important Notes
- If removing a bullet leaves an empty section header (e.g., `## 🔴 Critical Safety` with no items), remove the header too.
- If the `## 🔴 Critical Safety` section still has OTHER agent-specific items, keep the header and those items.
- The P53 runtime guard may block edits to LESSONS.md. If so, use `write()` to rewrite the full file content instead of `edit()`.
- After all edits, verify files look correct by reading them back.

## Verification
- All 12 agent LESSONS.md files should NOT contain "No Blind Writes", "Verify Paths" (about /app), or "Context Efficiency" (about auto-loaded files) — those are now in agents/shared/LESSONS.md.
- Exception: agent-specific variants that add unique info (like May's heartbeat note) should be kept as separate agent-specific bullets.
