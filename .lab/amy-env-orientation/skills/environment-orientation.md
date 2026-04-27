# Environment Orientation

**Purpose**: Prevent path hallucination — the #1 cause of Amy's task failures.

## The Rule

Before running ANY bash command or editing ANY file, you MUST know your working directory.

## Procedure (first 3 tool calls of every session)

1. **Read task.md** (or the task description) to understand what you're working on
2. **Find the codebase**: `find /app -name '<key file from task>' -not -path '*/.git/*' -not -path '*/node_modules/*' | head -10`
3. **Set your working directory** to where the files actually are

## Hard Rules

- **NEVER** assume `/home/user`, `~/project`, `/root/`, or `/app/src` exist
- **NEVER** copy files to `/app` to "make them work" — work where they are
- **Your environment root is `/app`**. All agent files are in `/app/agents/`.
- Gym scenarios place code in `agents/gym/scenarios/<name>/environment/` — find it, cd to it
- If `ls` shows a directory doesn't exist, STOP and re-orient. Don't guess another path.

## Anti-Patterns

❌ `cd /home/user && npm test` (path doesn't exist)
❌ `cp -r agents/gym/scenarios/.../environment/* /app/` (sidesteps the task)
❌ Running `node test/test.js` without confirming `test/test.js` exists in cwd

## Correct Pattern

✅ `find /app -name 'test.js' -not -path '*node_modules*'` → identify location → `cd` there → work
