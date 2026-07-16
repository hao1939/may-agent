# Skill: Establish Working Directory

**When**: At the start of ANY task that references files or paths
**Why**: PATH_HALLUCINATION is your #1 failure mode — running in /home/zeus instead of /app, or using local paths like /Users/bamio/. This causes complete session failures (EXP-244: 2 of your 3 audited failures were PATH_HALLUCINATION).

## Protocol

1. **First call**: `pwd && ls` to confirm where you are and what exists
2. **If file not found**: `find . -name "<filename>" -not -path "*/node_modules/*" -not -path "*/.state/*" -not -path "*/projects/gym/*"` (exclude noise)
3. **Pick the match closest to project root** — never pick paths under `projects/gym/scenarios/`
4. **Confirm the directory** with `ls` before doing any work
5. **Never use absolute paths from your training** (/Users/*, /home/zeus, ~/*, etc.) — always use relative paths from project root

## Anti-patterns (from your real failures — Apr 2026 data)

- ❌ `cd /Users/jash/Developer/admyral && npx tsc` — HALLUCINATED PATH (session s_..213_92)
- ❌ `cd /Users/amadad/code/aicodebase && ...` — HALLUCINATED PATH (session s_..405_81)
- ❌ `cd /Users/bloom/src/activecontext && ...` — HALLUCINATED PATH (session s_..604_16)
- ❌ Running commands in /home/zeus instead of /app (session s_..224, quality 0.35)
- ❌ Assuming a directory exists without checking first
- ✅ `cd /app && pwd && ls` → confirm /app → find target → work in correct location

## STOP-CHECK (before every bash command)
**Does my command contain `/Users/` or `/home/`?** If yes → DELETE IT. Replace with `/app`. There are NO user home directories in this environment. Every path you remember from training data is WRONG.

## Key rule
**Always start with `pwd`. If you're not in the project root, `cd` there first. If you can't find the target file within 3 tool calls, state that clearly in your finish() rather than guessing paths.**
