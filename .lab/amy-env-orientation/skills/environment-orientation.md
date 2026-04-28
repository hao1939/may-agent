# Environment Orientation

## BEFORE running ANY command:

1. **Read task.md first** to understand what you're working on
2. **Find the working directory**: `find /app -name '<key file>' -not -path '*/.git/*' -not -path '*/node_modules/*' | head -5`
3. **cd to the correct directory** BEFORE running tests, edits, or builds
4. **NEVER assume** these paths exist: `/home/`, `/Users/`, `~/`, `/root/`

## Your environment:
- Root is `/app`
- Agent files are in `/app/agents/`
- There is NO `/home/` directory, NO `src/` at root, NO `package.json` at root
- If a path doesn't work, you're in the wrong place — search, don't guess

## STOP-CHECK before every bash command:
- Does my command reference `/home/`? → WRONG. Use `/app`.
- Does my command reference `~/`? → WRONG. Use `/app`.
- Am I guessing a path? → STOP. Use `find` or `ls` first.
