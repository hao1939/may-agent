# Growth Investigation: Bob FM-1.3 Path-Guessing

**Date**: 2026-04-08  
**Agent**: Bob (Architect)  
**Error Pattern**: FM-1.3 (Path-Guessing / Looping / Flailing)  
**Error Count**: 6 entries across 5 sessions (7 days)  
**Coach Session**: s_1775692482869_27

## Error Analysis

### Raw Entries (6 FM-1.3 errors)

| # | Date | Session | Sub-Pattern | Wasted Calls | Description |
|---|------|---------|-------------|--------------|-------------|
| 1 | Mar 17 | s_...484717_95 | Tool-misuse loop | ~5+ | Ran `checkpoint` as bash command repeatedly instead of switching to tool interface |
| 2 | Apr 08 | s_...647104964_22 | **Path-guessing** | **14** | Listed `agents/shared/knowledge/topics/` (doesn't exist) instead of `agents/shared/knowledge/library/topics/` |
| 3 | Apr 08 | s_...659163621_40 | Repetitive re-reading | **~29** | `cat`'d same 6 files + EXP-089 results many times with/without timeout |
| 4 | Apr 08 | s_...659092616_39 | Failed-grep chain | ~5 | Early grep failed (exit 1) → small exploratory chain before moving on |
| 5 | Apr 08 | s_...666453365_98 | **Path-guessing** | ~10+ | Guessed EXP-090 results path → ENOENT → multiple `find` attempts before locating correct path |
| 6 | Apr 08 | s_...666020518_95 | **Path-guessing** | ~10+ | Same EXP-090 path-guessing pattern (duplicate entry, different session) |

### Sub-Pattern Categorization

**Pattern A: Path-Guessing (3 entries, ~34+ wasted calls)**  
Bob assumes a knowledge base path from memory, gets ENOENT, then uses broad `find` commands to locate the actual file. Specific examples:
- `agents/shared/knowledge/topics/` → actual: `agents/shared/knowledge/library/topics/`
- Guessed experiment results path → actual: `agents/shared/knowledge/experiments/EXP-090/results.md`

This is the **dominant pattern** (3/6 entries) and the most costly. The knowledge base has a deep nested structure (`knowledge/library/topics/`, `knowledge/experiments/EXP-XXX/`, etc.) that Bob remembers approximately but not precisely.

**Pattern B: Repetitive Re-reading (1 entry, ~29 wasted calls)**  
Bob reads the same files multiple times, even when the content hasn't changed. This is NOT path-guessing — it's a context management / working memory issue. The efficient-file-reading skill's "read targeted sections" would partially help, but the core issue is re-reading the same file entirely.

**Pattern C: Failed-grep Recovery (1 entry, ~5 wasted calls)**  
Grep returns exit code 1 (no match), and Bob enters a small exploratory chain instead of adjusting the search pattern. This is mild and recovery was eventually successful.

**Pattern D: Tool-misuse Loop (1 entry, ~5 wasted calls)**  
This is already addressed by Bob's `tool-interface-protocol` skill. Classically FM-2.6 rather than FM-1.3; the evaluator tagged it as FM-1.3 because of the repeated failed attempts.

### Summary
- **Path-guessing is the dominant problem**: 3/6 entries, ~34+ wasted calls
- **Re-reading amplifies it**: 1/6 entries, ~29 wasted calls  
- **Total wasted calls from FM-1.3**: ~73+ across 5 sessions
- **Root cause**: Bob navigates the knowledge base from memory rather than verifying paths exist before deep-reading

## Comparison: Coder's efficient-file-reading Skill vs Bob's Needs

### What the Coder Skill Teaches
The promoted `efficient-file-reading` skill (in `agents/coder/skills/`) focuses on:
1. Estimate file size before reading
2. grep/rg to find relevant lines before read
3. Use offset/limit for targeted reads
4. Never full-read files >200 lines

**Primary concern**: Reading large CODE files inefficiently (too many lines, no search)

### What Bob Needs
Bob's FM-1.3 pattern is different:
1. **Directory navigation, not file reading**: Bob's problem is finding the RIGHT FILE, not reading it efficiently once found
2. **Knowledge base structure, not code**: Bob navigates `agents/shared/knowledge/` (experiments/, library/topics/, library/deep-dives/, hypotheses/, entries/, synthesis/)
3. **Memory-based path guessing**: Bob constructs paths from approximate memory of the knowledge base layout
4. **Recovery strategy**: After ENOENT, Bob uses broad `find` instead of targeted `ls` of the parent directory

### Overlap Assessment
| Coder Skill Feature | Applicable to Bob? | Why/Why Not |
|---|---|---|
| "grep before read" on large files | ✅ Partially | Bob does read large files, but that's not his main FM-1.3 issue |
| Estimate file size first | ❌ Not relevant | Bob's problem is finding files, not sizing them |
| Targeted read with offset/limit | ✅ Partially | Would help with Pattern B (re-reading) |
| "Never full-read >200 lines" | ⚠️ Low impact | Bob's files (hypotheses, KEs, results) are often <200 lines |

**Verdict: The coder's efficient-file-reading skill would NOT address Bob's primary FM-1.3 pattern (path-guessing). It addresses a different failure mode (inefficient reading of large files). Deploying it as-is would be a mismatch.**

## Recommended Intervention: Bob-Specific "ls-before-navigate" Skill

### Skill Design: `knowledge-base-navigation`

**Trigger**: Before ANY `read()` or `bash("cat ...")` call to a path in `agents/shared/knowledge/` that you haven't verified exists in this session.

**Protocol**:
1. **LIST PARENT FIRST** — Before reading `agents/shared/knowledge/experiments/EXP-090/results.md`, first: `bash("ls agents/shared/knowledge/experiments/EXP-090/")`
2. **USE INDEX** — For knowledge base lookups, check `agents/shared/knowledge/INDEX.md` first — it has the full directory map
3. **TARGETED ls OVER find** — When a path doesn't exist, don't run `find agents/ -name "results.md"`. Instead, `ls` the parent directory you're most confident about:
   - Know it's in `experiments/`? → `ls agents/shared/knowledge/experiments/ | grep EXP-090`
   - Know it's a topic? → `ls agents/shared/knowledge/library/topics/`
   - Know it's a hypothesis? → `ls agents/shared/knowledge/hypotheses/ | grep H-090`
4. **NEVER GUESS DEEP PATHS** — The knowledge base has 3-4 levels of nesting. Never construct a 3+ segment path from memory. List each level.

**Anti-patterns**:
- ❌ `read("agents/shared/knowledge/topics/failure-modes.md")` — guessing that `topics/` is directly under `knowledge/` (it's under `library/`)
- ❌ `find agents/ -name "results.md" -type f` — too broad after a single ENOENT
- ❌ Reading the same file twice in one session without new information

**Why this is different from efficient-file-reading**: This is a NAVIGATION skill (find the right file) not a READING skill (read the file efficiently). Bob's bottleneck is Step 0 — knowing where files are — not Step 2 — reading them without wasting context.

### Delivery Mechanism: context.md Entry

Given our findings:
- KE-002: SOUL.md text rules = 0% effectiveness for declarative rules
- KE-059: Structural text (few-shot, checklist) ≈ 33% effectiveness
- Skills are structural text with triggers and protocols

**Recommendation**: Deploy as a **skill file** (`agents/bob/skills/knowledge-base-navigation.md`) rather than a context.md line. Skills have triggers and protocols that provide structural scaffolding, matching the ~33% effectiveness tier. A bare context.md rule ("always ls before read") would be declarative text (0% tier per KE-002).

Additionally, add a **single context.md line** as a reinforcing reminder:
```
- Knowledge base paths are nested: always `ls` the parent directory before reading files in agents/shared/knowledge/ — don't guess paths from memory (your top FM-1.3 error)
```

## Gym Testing Assessment

### Available Scenarios
- `knowledge-base-navigation`: Bob-specific scenario that tests exactly this pattern — **BUT INCOMPLETE** (no `success_criteria.js`, no `environment/` directory). The scenario has `task.md` and `scenario.json` but cannot run.
- `search-strategy-escalation` / `efficient-file-reading`: Coder-specific, tests code navigation not knowledge base navigation. Wrong domain.

### Testing Recommendation
**Cannot gym-test today.** The `knowledge-base-navigation` scenario needs to be completed first:
1. Build `environment/` directory with a mock knowledge base (nested structure mirroring real `agents/shared/knowledge/`)
2. Write `success_criteria.js` with checks for:
   - C1: Product (synthesis.md written with required sections)
   - C2: Behavioral (no ENOENT errors on guessed paths, or ≤1 ENOENT with immediate `ls` recovery)
   - C3: Efficiency (≤N total tool calls for the 4-section synthesis task)
3. Baseline Bob without the skill, then test with the skill

**Estimated effort**: ~30 min to complete scenario, ~15 min for 3 baseline + 3 treatment runs.

This is a **follow-up task**, not a blocker for deploying the skill. We know from KE-059 that skills have ~33% effectiveness — we should deploy and measure in production (FM-1.3 count in next 7 days), while building the gym scenario as a more rigorous test.

## Specific Changes (Do NOT Apply — Recommendation Only)

### 1. New Skill File: `agents/bob/skills/knowledge-base-navigation.md`

```markdown
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
```

### 2. Context.md Addition
Add to `agents/bob/context.md`:
```
- Knowledge base paths are nested 3-4 levels deep: always `ls` the parent directory before reading files in agents/shared/knowledge/ — don't guess paths from memory (top FM-1.3 error pattern: 34+ wasted calls in 7 days)
```

## Follow-Up Tasks

1. **Complete `knowledge-base-navigation` gym scenario** — Build environment, write success_criteria.js, baseline+treatment (est. 45min)
2. **Deploy skill + context.md patch** — Dispatch to May or apply directly (est. 5min)
3. **Monitor FM-1.3 count** — Target: ≤2 FM-1.3 entries in next 7 days (down from 6). Measure at 7 days post-deployment.
4. **Pattern B (re-reading)**: Separate issue. Consider adding "don't re-read unchanged files" to the skill or as a separate intervention if Pattern B recurs independently.

## Decision: RECOMMEND DEPLOYMENT (Pending Approval)

**Rationale**:
- Bob's FM-1.3 is a real, costly problem (73+ wasted calls in 7 days)
- Path-guessing is the dominant sub-pattern (3/6, highest cost)
- The coder's efficient-file-reading skill is NOT the right intervention (wrong domain)
- A Bob-specific navigation skill is structurally appropriate (skill = ~33% per KE-059)
- Gym testing is not possible today (scenario incomplete) but production monitoring can validate
- Risk is low: the skill adds a benign `ls` step, worst case it's ignored (KE-002 predicts ~67% ignore rate)

**NOT deploying**: Waiting for this report to be reviewed. Changes are specified above but not applied.
