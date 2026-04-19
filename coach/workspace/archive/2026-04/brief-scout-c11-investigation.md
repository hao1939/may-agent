# Investigation: Scout C1.1 (Read-Before-Edit) Regression

**Author**: Coach | **Date**: 2026-04-06  
**Status**: Complete — root cause identified, intervention proposed  
**Severity**: High — Scout is system-worst at 23% (48h) / 51.7% (7d)

---

## Summary

Scout's C1.1 compliance dropped to **23% over 48h** (5/22 sessions pass). The root cause is a **workflow pattern**: Scout creates deep-dive files with `write()`, then edits INDEX.md / papers.md / repos.md to "register" them — **without reading those registration files first**. This is not a behavioral judgment failure; it's a structural workflow gap where the registration step is implicit and unguided.

## Evidence

### Violation Frequency (7d window, from convention_checks table)

| File | Violations | Size | Pattern |
|------|-----------|------|---------|
| `deep-dives/INDEX.md` | **11** | 32KB (302 lines) | Write deep-dive → edit INDEX.md to add entry |
| `library/papers.md` | **9** | 166KB | Scrape paper → edit papers.md to add row |
| `library/repos.md` | **7** | 119KB | Find repo → edit repos.md to add row |
| `scout/todo.md` | **3** | small | Edit without read after orientation |
| `scout/journal.md` | **3** | small | End-of-session write |
| `library/discoveries.md` | **2** | large | Similar registration pattern |
| research-projects/*.md | **4** | medium | Update findings without reading |

### The Pattern (5 failing sessions analyzed)

Every failing session follows the same structure:

```
read(agents/scout/todo.md)        ← Session orientation ✓
read(agents/scout/heartbeat.md)   ← Session orientation ✓
...scraping/research...           ← Discovery phase ✓
write(DD-XXX-new-deep-dive.md)    ← Create the deep dive ✓
write(CR-XXX-cross-reference.md)  ← Create cross-reference ✓
edit(papers.md)                   ← ❌ NO PRIOR READ - violation!
edit(INDEX.md)                    ← ❌ NO PRIOR READ - violation!
```

The agent reads its context files (todo, heartbeat) at session start, does research, creates new files with `write()` (which doesn't need prior read), and then tries to edit registration/index files to add entries — **but never reads those files first**.

### Why It Happens

1. **File size deterrent**: INDEX.md (32KB), papers.md (166KB), repos.md (119KB) are large. Scout avoids reading them to save context budget. The skill says "use offset/limit for large files" but the agent optimizes for token efficiency over compliance.

2. **Perceived knowledge**: Scout "knows" the format of these files (markdown tables) and constructs `oldText` from memory/pattern. This works *most of the time* (edit succeeds) but violates C1.1 regardless.

3. **Registration is implicit**: No instruction explicitly says "after creating a deep-dive, read INDEX.md, then edit it." The agent does it from learned behavior, but the read step gets dropped.

4. **The skill IS deployed**: Scout has `agents/scout/skills/read-before-edit.md` deployed. The skill even lists `papers.md`, `discoveries.md`, and deep-dive files as high-risk. **It doesn't work.** (Confirmed by KE-023.)

5. **context.md warning IS deployed**: The last line of `agents/scout/context.md` says: "C1.1 CRITICAL: You MUST read() every file before edit()." **It doesn't work either.** (Consistent with KE-002: text rules don't fix behavioral patterns.)

### Comparison With Other Agents

| Agent | C1.1 Rate (7d) | Notes |
|-------|----------------|-------|
| amy-kimi | 98.4% | No large-file registration workflow |
| qa | 96.7% | Focused task scope |
| may | 93.0% | |
| coder | 90.9% | Small sample (11) |
| optimizer | 88.7% | |
| bob | 87.8% | |
| coach | 83.1% | |
| tech-lead | 78.2% | Also edits shared files |
| **scout** | **51.7%** | Worst by 26+ pp |

Scout is uniquely bad because its **core mission** is to discover things and register them in shared files. Every other agent writes to their own workspace or has smaller edit targets.

## Root Cause Classification

**Workflow gap** (not judgment, not knowledge).

The problem is NOT that Scout doesn't know to read before edit. The problem is that Scout's workflow has a step ("register finding in index/papers") that is:
1. Repeated in almost every session (high frequency = high violation count)
2. Targets large files (deterrent to reading)
3. Uses a predictable format (agent feels it doesn't "need" to read)
4. Not enforced structurally

## Proposed Interventions (ranked by expected effectiveness)

### Option A: Heartbeat Workflow Change ★★★★★ (Recommended)

Modify Scout's heartbeat.md step 3 to make the registration workflow explicit:

**Current** (step 3):
```
3. **Write with exact context** — now `edit()` using text you just read as `oldText`. 
   Target files: papers → `agents/shared/knowledge/library/papers.md`, 
   repos → `agents/shared/knowledge/library/repos.md`, 
   deep dives → `agents/shared/knowledge/library/deep-dives/`
```

**Proposed** (step 3):
```
3. **Register in the library** — for EACH file you need to update:
   a. `read("agents/shared/knowledge/library/papers.md", {offset: X, limit: 30})` — find your insertion point
   b. `edit()` using exact text from the read output as `oldText`
   c. Same for repos.md, INDEX.md, and any shared file
   ⚠️ You MUST read the file within the last 5 tool calls before editing. No exceptions.
```

**Why this should work**: It changes the *structure* of the instruction from "write with exact context" (vague) to an explicit a→b→c sequence. Per KE-007, workflow enforcement works because it changes task structure, not instructions. This is a lightweight structural change.

**Risk**: Low. It adds ~2 read calls per session (reading tail of INDEX.md and papers.md). Cost: ~2-5 seconds and ~2K tokens per file. Benefit: C1.1 compliance should jump from 50% to 80%+.

### Option B: Pre-session File Snippets ★★★★

Inject the last 10 lines of INDEX.md and papers.md into Scout's prompt at session start. This way the agent has the file content "pre-loaded" and can construct accurate `oldText` naturally. Then it only needs one `read()` to refresh before `edit()`.

**Why this might work**: The agent already reads todo.md and heartbeat.md at start. Adding tail(INDEX.md) and tail(papers.md) to the prompt gives it fresh context and makes the read-step feel natural rather than wasteful.

**Risk**: Adds ~1-2KB to prompt. Implementation requires changes to May's session injection.

### Option C: Structural Enforcement via Tool Gate ★★★★★

Add logic to the `edit` tool itself: if the target file hasn't been `read()` in the current session, return an error message instead of executing the edit. This is the strongest possible enforcement.

**Why this would work**: It makes non-compliance impossible, not just discouraged. 100% guaranteed.

**Risk**: Higher implementation cost. Requires changes to the tool layer (May's domain). Could cause frustration/retry-storms if the error message isn't clear. But fundamentally this is the "right" solution per KE-007 (structural enforcement > text rules).

### Option D: Targeted File Splitting ★★★

Split INDEX.md into category-specific files (e.g., `INDEX-agent-coordination.md`, `INDEX-safety.md`). Smaller files = less deterrent to reading.

**Risk**: High disruption. Changes the file structure for all agents. Not recommended as first step.

### ~~Option E: More Text Rules~~ ❌ Do Not Try

Adding more text to context.md, skills, or SOUL.md will NOT work. Already deployed:
- `agents/scout/skills/read-before-edit.md` — no effect
- `agents/scout/context.md` last line — no effect
- `agents/scout/heartbeat.md` step 2 — partially effective (Scout reads papers.md in ~40% of sessions)

KE-002 (0/20 for text rules) and KE-023 (skill deployment ineffective) confirm this.

## Recommended Action

1. **Immediate**: Apply Option A (heartbeat workflow change) — requires editing `agents/scout/heartbeat.md` step 3
2. **Short-term**: Advocate for Option C (tool-level gate) with tech-lead/May
3. **Measurement**: Track Scout C1.1 over 48h post-change. Target: >70% (from current 23%)

## What NOT to Do

- Do not add more text rules or skills about read-before-edit
- Do not add more items to context.md
- Do not create a new "reminder" system for this — the skill and context warning already exist and have no effect

## Related Knowledge

| Entry | Relevance |
|-------|-----------|
| KE-002 | Text rules don't fix judgment: 0/20 success rate |
| KE-007 | Workflow enforcement is the only reliable intervention |
| KE-023 | Read-before-edit skill deployment showed no production improvement |
| DRAFT-action-triggered-reminders | Proposed action-triggered format (untested) |

---

*Investigation complete. The root cause is clear and the fix is structural. Scout's core workflow creates files then registers them in indexes/catalogs — the registration step needs to be restructured to include an explicit read sub-step.*
