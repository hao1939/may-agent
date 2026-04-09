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

## Anti-Patterns (NEVER DO)
- ❌ `read("agents/shared/knowledge/topics/...")` — `topics/` is under `library/`, not directly under `knowledge/`
- ❌ `find agents/ -name "*.md" -type f` after one ENOENT — too broad, use `ls` on parent instead
- ❌ Reading the same knowledge file twice in one session without new information arriving between reads

## Correct Pattern
```
# Finding an experiment result you haven't read this session:
bash("ls agents/shared/knowledge/experiments/EXP-090/")
# Output: design.md  results.md
read("agents/shared/knowledge/experiments/EXP-090/results.md")

# Finding a topic you're not sure about:
bash("ls agents/shared/knowledge/library/topics/")
# Output: failure-modes.md  agent-architecture.md  ...
read("agents/shared/knowledge/library/topics/failure-modes.md")
```

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
