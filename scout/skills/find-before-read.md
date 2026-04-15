# Skill: Find Before Read

**Status:** ACTIVE
**Owner:** Scout
**Source:** FM-1.3 error analysis (10 errors in 7 days — path-guessing pattern)

## Problem
You waste 5-10 tool calls recovering when you guess file paths that don't exist (ENOENT errors). This is your #1 efficiency failure mode.

## Rules

### Rule 1: Never guess a file path
Before calling `read(path)` on any source file, verify it exists:
- `find . -name "filename.ts" -not -path "*/node_modules/*"` — when you know the filename
- `grep -rl "keyword" --include="*.ts" .` — when you know a symbol/concept but not the file
- `ls src/` — when exploring directory structure

### Rule 2: Concept → grep → read
When looking for code related to a concept (e.g., "rate limiter", "auth middleware"):
1. `grep -rl "rateLimiter\|rate-limit\|rateLimit" --include="*.ts" --include="*.js" .` 
2. Read the files grep found
3. Do NOT construct paths from memory like `src/tools/manager-agents-tool.ts` — they're usually wrong

### Rule 3: ENOENT = immediate pivot
If `read()` returns ENOENT or "file not found":
- **STOP** — do NOT guess another path
- Run `find . -name "*.ts" | head -30` or `ls -R src/` to see what actually exists
- Then read the correct file

## Anti-Pattern Examples
❌ `read("src/tools/manager-agents-tool.ts")` → ENOENT → `read("src/lib/tools/manager-agents-tool.ts")` → ENOENT → `read("src/tools/manager-agent-tool.ts")` → ENOENT (3 wasted calls)

✅ `grep -rl "manager.*agent" --include="*.ts" .` → finds `src/lib/manager-agents-tool.ts` → `read("src/lib/manager-agents-tool.ts")` (1 search + 1 read = efficient)

## When This Applies
- Any time you need to read a source file you haven't read before in this session
- When exploring an unfamiliar codebase
- Does NOT apply to files you've already confirmed exist (e.g., reading a file you just wrote)
