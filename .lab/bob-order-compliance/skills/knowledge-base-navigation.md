# Skill: Directory-First Navigation

## Trigger
Before ANY `read()` or `bash("cat ...")` on a path in an **unfamiliar directory** — one you haven't confirmed exists via `ls` in this session. This includes `agents/shared/knowledge/`, `environment/`, or ANY nested directory structure you're exploring for the first time.

## Core Rule: ZERO PATH GUESSING
**NEVER construct a file path from memory or assumption.** Every path segment must be confirmed by a prior `ls` output in this session. If you haven't listed a directory, you cannot read files from it.

## Tool-Call Budget
You typically have **fewer than 25 tool calls** for a task. Every wasted call on a wrong path costs 4% of your budget. Plan your navigation: read INDEX.md first, identify exactly which files you need, then ls→read each one.

## Protocol
1. **START WITH INDEX.md** — If the directory has an INDEX.md, read it FIRST. It maps the structure and tells you where things are. This one call saves 5-10 wasted exploration calls.
2. **LIST PARENT BEFORE READING** — Before reading any nested file, `ls` its parent directory:
   - `bash("ls environment/experiments/RX-031/")` before reading `results.md`
   - `bash("ls agents/shared/knowledge/library/topics/")` before reading a topic file
3. **ONE LEVEL AT A TIME** — Never construct paths 3+ segments deep from memory. Verify each directory level.
4. **AFTER ENOENT: ls PARENT, DON'T find** — If a path fails, `ls` the parent directory (1 call). Never `find . -name '...'` (floods context with irrelevant results).

## Worked Example: Navigating an Unknown Knowledge Base

You're given a knowledge base in `environment/` and need to synthesize information from experiments, hypotheses, and deep dives. There are ~18 files across multiple directories.

### ❌ WRONG: Path-Guessing Cascade (15 tool calls to read 4 files)

```
# "I need hypothesis RH-044..."
read("environment/hypotheses/RH-044.md")
→ ERROR: ENOENT

# "Maybe it's under research?"
read("environment/research/hypotheses/RH-044.md")
→ ERROR: ENOENT

# "Let me search for it..."
bash("find environment/ -name 'RH-044*'")
→ environment/hypotheses/RH-044.md
   ... plus 15 other .md files scrolling past (wasted context)

# Wait — it WAS at environment/hypotheses/RH-044.md? Let me try again...
read("environment/hypotheses/RH-044.md")
→ SUCCESS (but burned 3 calls for 1 read)

# "Now experiment RX-031 results..."
read("environment/experiments/RX-031/results.md")
→ SUCCESS (lucky guess, but won't always work)

# "Deep dive about failure modes..."
read("environment/library/deep-dives/failure-modes.md")
→ ERROR: ENOENT

# "Hmm..."
read("environment/deep-dives/failure-modes.md")
→ ERROR: ENOENT

bash("find environment/ -name '*failure*'")
→ environment/library/deep-dives/failure-taxonomy-analysis.md
```

**Cost**: 8 tool calls just to locate 3 files. Multiple ENOENT errors. Context polluted with find output. At this rate, you'll use 40+ tool calls.

### ✅ RIGHT: Index-Guided, ls-Verified Navigation (8 tool calls to read 4 files)

```
# Step 1: Read the map
bash("ls environment/")
→ INDEX.md  entries  experiments  hypotheses  library  synthesis-templates

read("environment/INDEX.md")
→ [Shows full directory map with file descriptions]
→ Key insight: hypotheses are in hypotheses/, experiments in experiments/RX-XXX/,
   deep dives in library/deep-dives/

# Step 2: Read hypotheses (INDEX told me they're in hypotheses/)
bash("ls environment/hypotheses/")
→ PRIORITY-TRACKER.md  RH-044.md  RH-048.md
read("environment/hypotheses/RH-044.md")
→ SUCCESS (first try)
read("environment/hypotheses/RH-048.md")
→ SUCCESS (first try)

# Step 3: Read experiment (INDEX told me the path format)
bash("ls environment/experiments/RX-031/")
→ design.md  results.md
read("environment/experiments/RX-031/results.md")
→ SUCCESS (first try)
```

**Cost**: 8 tool calls for 4 reads + 3 ls + 1 INDEX. ZERO errors. Every read succeeds on first attempt because we verified the path first.

### The Key Decision Point

The temptation comes right after an ENOENT or when you "remember" a path. Instead:
1. **Stop.** Don't guess another path.
2. **`ls` the parent** of the path that failed. 
3. **Read what's actually there.**

This costs 1 extra tool call but saves 3-5 from the guess→fail→find→retry cycle.

## Anti-Patterns (NEVER DO)
- ❌ Constructing a 3-level-deep path from memory without ls verification
- ❌ `find . -name "*.md"` after one ENOENT — too broad, use targeted `ls`
- ❌ Reading ALL files in a directory "just in case" — use INDEX.md to identify what you need
- ❌ Reading the same file twice without new information between reads

## Assertion
Every `read()` of a file in an unfamiliar directory MUST be preceded by EITHER:
- An `ls` of its parent directory in this session, OR
- A read of INDEX.md that lists the file's path


## ⚠️ Task-Type Restriction

Do NOT use this skill's worked examples as templates on **discovery, exploration, or creative-inference tasks** (e.g., knowledge integration, open-ended research, novel pattern discovery). KE-133 showed a **-67pp effect** (p=0.030) — template-following displaces the open exploration these tasks require. Use this skill only for the specific task type it was designed for.
