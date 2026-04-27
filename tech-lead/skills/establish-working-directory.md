# Skill: Establish Working Directory

**When**: At the start of ANY task that references files or paths
**Why**: PATH_HALLUCINATION is your #1 failure mode — running in /home/zeus instead of /app, or using local paths like /Users/bamio/. This causes complete session failures (EXP-244: 2 of your 3 audited failures were PATH_HALLUCINATION).

## Protocol

1. **First call**: `pwd && ls` to confirm where you are and what exists
2. **If file not found**: `find . -name "<filename>" -not -path "*/node_modules/*" -not -path "*/.state/*" -not -path "*/agents/gym/*"` (exclude noise)
3. **Pick the match closest to project root** — never pick paths under `agents/gym/scenarios/`
4. **Confirm the directory** with `ls` before doing any work
5. **Never use absolute paths from your training** (/Users/*, /home/zeus, ~/*, etc.) — always use relative paths from project root

## Anti-patterns (from your real failures)

- ❌ Running commands in /home/zeus instead of /app (session s_..224, quality 0.35)
- ❌ Using /Users/bamio/ local path (session s_..132, quality 0.25)  
- ❌ Assuming a directory exists without checking first
- ✅ `pwd` → confirm /app → `ls` → find target → work in correct location

## Key rule
**Always start with `pwd`. If you're not in the project root, `cd` there first. If you can't find the target file within 3 tool calls, state that clearly in your finish() rather than guessing paths.**
