# Skill: Establish Working Directory

**When**: At the start of ANY task that references files (src/, test.js, utils.js, etc.)
**Why**: Your #1 failure mode is path confusion after initial ENOENT — you waste 5-15 calls searching broadly, then work in the wrong directory.

## Protocol

1. **First call**: `ls` at project root to see what exists
2. **If file not found**: `find . -name "<filename>" -not -path "*/node_modules/*" -not -path "*/.state/*" -not -path "*/agents/gym/*"` (exclude noise)
3. **Pick the match closest to project root** — never pick paths under `agents/gym/scenarios/` unless the task explicitly says gym
4. **`cd` to that directory and confirm** with `ls` before doing any work
5. **Never use `find /`** — stay within the project

## Anti-patterns (from your real failures)

- ❌ `cat utils.js` immediately → ENOENT → broad `find . -type f | head -50` → pick gym scenario path
- ❌ After ENOENT, copy gym scenario files into /app with `cp -r`
- ❌ Conclude "nothing to fix" because you found a pre-fixed version in a gym scenario
- ✅ `ls` → `find . -name "utils.js" -not -path "*/node_modules/*"` → pick correct path → work there

## Key rule
**If you can't find the target file within 3 tool calls, state that clearly in your finish() rather than working on the wrong files.**
