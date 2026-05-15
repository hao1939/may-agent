# Finding: Coder Success Patterns — What High-Quality Sessions Do Differently

**Mode**: C (Skill & Technique Scouting)  
**Date**: 2026-04-15  
**Data window**: 48h, 15 evaluated coder sessions  
**Focus**: Techniques from top-performing sessions (q≥0.8, eff≥0.7)

## Executive Summary

Analyzed 15 recent coder sessions and their transcripts. The top 2 sessions (q=0.9/eff=0.78 and q=0.8/eff=0.7) share 3 distinguishing techniques that the lower-performing sessions lack: **state-first verification** (check what already exists before acting), **code-search as primary navigation** (not guessing paths), and **single-pass editing** (batch edits in one turn). These patterns are codifiable and could transfer to other agents.

## Data: Session Quality Distribution (48h, n=15)

| Session | Ops | Quality | Efficiency | Task Type | Verdict |
|---------|-----|---------|------------|-----------|---------|
| s_..5571764 | 10 | 0.90 | 0.78 | persistent-task verification | good |
| s_..4209606 | 18 | 0.80 | 0.70 | bug fix (verify-wrap) | good |
| s_..4409725 | 17 | 0.80 | 0.45 | bug fix (verify-wrap) | good |
| s_..5016906 | 36 | 0.78 | 0.64 | feature (metrics system) | good |
| s_..9992416 | 33 | 0.78 | 0.62 | review-merge | good |
| s_..6729664 | 15 | 0.72 | 0.62 | feature build | acceptable |
| s_..4235203 | 11 | 0.70 | 0.60 | bug fix (verify-wrap) | acceptable |
| s_..3684439 | 19 | 0.55 | 0.45 | bug fix (verify-wrap) | acceptable |
| s_..5899738 | 27 | 0.45 | 0.35 | fix retry | poor |
| s_..7325738 | 3 | 0.25 | 0.55 | blocked by perms | poor |

**Key stat**: Top-2 sessions average 14 ops with q=0.85; bottom-5 average 17 ops with q=0.44. Fewer ops AND higher quality — not a tradeoff.

## Pattern 1: State-First Verification (most impactful)

### What the best session did (s_..5571764, 10 ops, q=0.9)
Tool sequence: `bash(ls) → bash(cat design) → read(file1) → read(file2) → bash(tsc) → bash(git status) → bash(seed script) → bash(tests) → bash(git log) → bash(wc -l + grep) → finish`

The session was iteration 3 of a persistent task. Instead of re-implementing anything, coder's **first 4 calls** were all reads/checks:
1. `ls` to verify files exist on disk
2. `cat` to read the design spec (what *should* exist)
3. Two `read` calls to confirm file contents match spec
4. Only then: `tsc`, test run, seed script, git log

**The anti-pattern** (seen in q=0.55 sessions): Jump straight into editing, then discover the prior iteration already did the work → wasted edits → rollback → confusion.

### Codifiable rule
> Before writing any code in a persistent-task iteration, verify the current state with 2-3 read/ls commands. If the previous iteration's work is already committed, your job is verification, not re-implementation.

**Transfer potential**: HIGH for any agent doing iterative/persistent work. Could be added to persistent-task workflow preamble.

## Pattern 2: code-search.sh as Primary Navigation

### What good sessions did (s_..4209606, s_..6729664)
Both sessions used `scripts/code-search.sh` as their primary way to find relevant code:
```
code-search.sh 'agentName' --path 'src/**/*.ts' -C 3
code-search.sh 'ctx\.agent' --path 'src/lib/workflow-tool.ts' -C 5
```

This yields precise context lines without reading entire files. The 18-op session (q=0.8) used code-search 3 times in its first 6 calls, pinpointing the exact lines to change before any editing began.

### The anti-pattern (seen in lower-quality sessions)
Sessions that don't use code-search tend to:
- `read` entire files (hundreds of lines, wastes context window)
- Guess file paths wrong → ENOENT → retry (2-4 wasted ops)
- Miss related code in other files (only fix one site, miss another)

### Codifiable rule
> For bug fixes: use code-search.sh to find all occurrences of the relevant symbol/pattern BEFORE reading any file. This gives you the full scope of changes needed.

**Transfer potential**: MEDIUM. code-search.sh is already in coder's context.md. Other agents may not have access to it or know about it.

## Pattern 3: Single-Pass Batch Editing

### What the q=0.72 session did well (s_..6729664, 15 ops)
Tool sequence excerpt: `... → edit → edit → edit → edit → edit → bash(tsc) → bash(test) → ...`

Five consecutive edits in one turn, then a single verification pass. No interleaving of read-edit-read-edit-read-edit. The coder gathered all context upfront, planned all changes, executed them as a batch, then verified once.

### The anti-pattern (seen in q=0.45 session s_..5899738, 27 ops)
Interleaved pattern: `read → edit → bash(tsc fails) → read → edit → bash(tsc fails) → read → edit → bash(tsc passes)`. Each edit-verify cycle costs 3-4 ops; batching 5 edits into one turn saves 8-12 ops.

### Codifiable rule  
> After gathering context, make ALL related edits before running verification. Don't verify after each individual edit — batch them and verify once.

**Transfer potential**: HIGH. This is applicable to any agent that makes code changes. Already partially captured in coder's `verify-after-edit` skill but not framed as "batch first, verify once."

## Pattern 4: Finish-Gate Awareness (negative pattern)

### The #1 waste source across ALL coder sessions
Of 15 sessions, **9 (60%) had finish() gate issues** adding 1-5 ops each:
- Deliverable-integrity gate: claimed files as deliverables despite no writes (3 sessions)
- Post-write verification missing: needed extra verify pass (2 sessions)
- Uncommitted changes blocking finish (2 sessions)  
- Ghost deliverables: finish() with files that don't exist (2 sessions)

**The top-2 sessions both had gate friction** — s_..5571764 had 1 extra finish attempt (still only 10 ops total), s_..4209606 had 3 extra finish attempts (pushed to 18 ops from an ideal ~14).

### Implication
Gate compliance overhead is ~2-4 ops per session, unavoidable with current guards. This means the "true" coder efficiency is better than metrics show — subtract 2-4 from every op count for gate overhead.

## Actionable Recommendations

### 1. Add state-check to persistent-task workflow preamble
**Impact**: Could save 3-8 ops in ~30% of persistent-task sessions  
**Effort**: Low — add 2-3 lines to the persistent-task workflow template  
**Implementation**: Inject "Step 0: Verify current state before making changes" into persistent task context

### 2. Promote code-search.sh to all agents
**Impact**: Could save 2-4 ops per code-investigation task  
**Effort**: Low — add to shared context or agent context.md files  
**Status**: Already in coder's context.md but absent from other agent contexts

### 3. Document "batch-edit-then-verify" pattern as shared skill
**Impact**: Could save 4-8 ops in multi-edit sessions  
**Effort**: Low — extract from coder's practice into shared skill  
**Note**: The existing `verify-after-edit` skill focuses on *always verifying* but doesn't mention *batching edits first*

### 4. Reduce finish-gate friction (system-level)
**Impact**: Would save 2-4 ops across 60% of sessions  
**Effort**: Medium — requires evaluating which gates catch real bugs vs. create friction  
**Note**: This is a design tradeoff, not a simple fix. Gates do catch real errors (ghost deliverables, missed verification). But the cost is high.

## Cross-Reference with Existing Findings

- **finding-coder-20op-scouting-0415.md**: Identified gate friction and persistent-task costs. This finding adds the *positive* patterns that the lean sessions use.
- **finding-coder-efficiency-patterns-0415.md**: Identified 5 waste patterns from bloated sessions. This finding complements with 3 success patterns from lean sessions.
- **finding-coder-efficiency-scouting-0415.md**: Distribution analysis. This finding adds qualitative transcript-level analysis.

**Key differentiation**: Prior findings focused on what goes wrong. This finding focuses on what goes right — extractable techniques from the best sessions.
