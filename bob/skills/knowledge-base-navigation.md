# Skill: Knowledge Base Navigation

## Trigger
Before ANY `read()` or `bash("cat ...")` on a path in `agents/shared/knowledge/` that you haven't verified exists this session.

## Protocol
1. **LIST PARENT FIRST** — Before reading a nested path, `ls` its parent directory:
   - `bash("ls agents/shared/knowledge/experiments/EXP-090/")` before reading `results.md`
   - `bash("ls agents/shared/knowledge/library/topics/")` before reading a topic file
2. **USE INDEX.md** — For broad lookups: `read("agents/shared/knowledge/INDEX.md")` has the full directory map
3. **ls > find** — When a path doesn't exist, `ls` the parent directory (targeted), don't `find` the whole tree (broad)
4. **NEVER GUESS 3+ SEGMENTS** — The knowledge base has 3-4 nesting levels. Never construct `knowledge/X/Y/Z` from memory. List each level.

## Worked Example: Synthesizing Failure-Mode Research

Bob was asked to write a synthesis connecting failure-mode findings from a recent
experiment (EXP-090) with the existing deep-dive on agent failure modes. He needed
three files: the experiment results, the failure-modes topic overview, and a related
deep-dive.

### ❌ The WRONG Approach (14 wasted tool calls — from a real session)

Bob remembered approximately where files lived and started guessing paths:

```
# "I know there's a topics file about failure modes..."
read("agents/shared/knowledge/topics/failure-modes.md")
→ ERROR: ENOENT — no such file or directory

# "Hmm, maybe it's under entries?"
read("agents/shared/knowledge/entries/failure-modes.md")
→ ERROR: ENOENT — no such file or directory

# "Let me search for it..."
bash("find agents/ -name 'failure-modes.md' -type f")
→ agents/shared/knowledge/library/topics/failure-modes.md
   (plus 47 other .md files scrolling past — wasted context)

# "OK found it. Now the experiment results..."
read("agents/shared/knowledge/experiments/EXP-090/results.md")
→ ERROR: ENOENT (the experiment dir is actually EXP-090/ but maybe
  results aren't written yet, or the path is slightly different)

# "Maybe it's named differently?"
bash("find agents/shared/knowledge/experiments/ -name '*090*'")
→ agents/shared/knowledge/experiments/EXP-090/
→ agents/shared/knowledge/experiments/EXP-090/design.md
→ agents/shared/knowledge/experiments/EXP-090/results.md

# "It does exist! Let me try again..."
read("agents/shared/knowledge/experiments/EXP-090/results.md")
→ SUCCESS (finally)
```

**Cost**: 6 tool calls just to locate 2 files. Each `find` command dumped dozens of
irrelevant paths into context. The `topics/` guess was wrong because `topics/` lives
under `library/`, not directly under `knowledge/` — a 3-level nesting mistake.

### ✅ The RIGHT Approach (3 tool calls for the same 2 files)

Bob lists directories before reading, one level at a time:

```
# Step 1: "I need the failure-modes topic. Let me check where topics live."
bash("ls agents/shared/knowledge/library/topics/")
→ agent-architecture.md  failure-modes.md  skill-effectiveness.md  ...
# Good — I can see failure-modes.md is here.

read("agents/shared/knowledge/library/topics/failure-modes.md")
→ SUCCESS (first try)

# Step 2: "Now the EXP-090 results. Let me verify what's in that directory."
bash("ls agents/shared/knowledge/experiments/EXP-090/")
→ design.md  results.md
# Both files present. Now I can read confidently.

read("agents/shared/knowledge/experiments/EXP-090/results.md")
→ SUCCESS (first try)
```

**Cost**: 4 tool calls total (2 `ls` + 2 `read`). Zero errors. Zero wasted context
from broad `find` output. Each `ls` is tiny (one line of filenames) and confirms the
exact path before reading.

### The Key Decision Point

The temptation comes right after an ENOENT. Your instinct says: *"The file must be
somewhere — let me `find` it."* But `find agents/ -name 'X'` is a **shotgun blast**
that dumps dozens of paths into your context.

**Instead**: After ENOENT, go UP one directory level and `ls`. The knowledge base is
only 3-4 levels deep. An `ls` of the parent will show you exactly what's there in a
single line. You'll find the right path in 1 call instead of burning 3-5 calls on
`find` + retry cycles.

## Anti-Patterns (NEVER DO)
- ❌ `read("agents/shared/knowledge/topics/...")` — `topics/` is under `library/`, not directly under `knowledge/`
- ❌ `find agents/ -name "*.md" -type f` after one ENOENT — too broad, use `ls` on parent instead
- ❌ Reading the same knowledge file twice in one session without new information arriving between reads

## Knowledge Base Directory Map (Quick Reference)
```
agents/shared/knowledge/
├── INDEX.md              ← Start here for lookups
├── entries/              ← KE-001.md, KE-002.md, ...
├── experiments/          ← EXP-001/, EXP-002/, ... (each has design.md, results.md)
├── hypotheses/           ← H-001.md, H-002.md, PRIORITY-TRACKER.md
│   ├── archive/
│   ├── design-proposals/
│   └── research-notes/
├── library/
│   ├── cross-references/
│   ├── deep-dives/       ← DD-001.md, DD-002.md, ...
│   ├── posts/
│   ├── synthesis/
│   └── topics/           ← failure-modes.md, agent-architecture.md, ...
├── findings/
├── incidents/
├── conventions/
├── summaries/
└── synthesis/
```

## Assertion
Every first `read()` of a file in `agents/shared/knowledge/` MUST be preceded by an `ls` of its parent directory in the same session, OR by reading `INDEX.md`.
