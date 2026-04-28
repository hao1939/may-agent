# Skill Injection Plan: From 0% Usage to Inline Delivery

**Date**: 2025-06-25
**Context**: skill-usage.md found 0/10 sessions where agents read skill files. This plan fixes that.

## Root Cause Analysis

### How agents currently get skills
Skills are referenced in `context.md` via `📘` markers:
```
📘 **Error Handling**: Read `agents/shared/skills/error-handling/SKILL.md` — brief summary
```

This pattern **tells agents to read a file** but agents don't proactively read referenced files. The `📘` line itself is loaded (it's in context.md), but the SKILL.md content requires an extra `read()` call that agents never make.

### Evidence: the pattern already exists but doesn't work
- **Bob**: 11 skill references in context.md (both shared/ and local). None read in observed sessions.
- **Scout**: 14 skill references. None read.
- **Optimizer**: 7 skill references. None read.
- **Amy**: 7 skill references. None read.

### Why "Read X" doesn't work
1. Agents prioritize task execution over preparatory reading
2. The `📘` summaries feel sufficient — agents think they "got it" from the one-liner
3. No enforcement mechanism checks whether the file was actually read
4. Reading a skill file costs a turn, and agents are budget-conscious

## The Fix: Inline Skill Content Directly

**Instead of**: `📘 Read agents/shared/skills/X/SKILL.md — brief hint`
**Do**: Paste the 3-5 actionable rules from the skill directly into context.md

### Why this works
- Context.md content is **guaranteed loaded** — it's the agent's system prompt
- No extra read() call needed
- The adoption hierarchy confirms this: `SOUL.md inline > per-agent skills/ > shared skills/ passive` (KE-011)
- Bob's most effective rules (C1.1 read-before-edit, C1.7 verify-before-finish) are already inlined as `⚡` blocks — and those DO influence behavior

### Trade-off
- Context.md gets longer (each inlined skill adds ~100-200 tokens)
- But the alternative (0% usage) means the skill tokens in SKILL.md files are 100% wasted anyway

## Pilot: 3 Skills × 3 Agents

### Selected Skills (highest-impact, most verified)

**1. Verification** (v1.3.0) — Core rules to inline:
```
## Verification Rules
- Every deliverable must have a tool-call proving correctness (read/grep/test output)
- Trust `details.status` field, not text summaries
- If verification fails, STOP — do not claim success
- "I verified it" without a tool call is NOT verification
```

**2. Evidence Over Narrative** (v1.0.0) — Core rules to inline:
```
## Evidence Over Narrative Rules
- Before changing code that passes tests, ask: "What failing test justifies this change?"
- Before re-reading/re-scanning, ask: "What evidence shows something changed?"
- When narrative (comments, task desc) conflicts with runtime evidence (test output, file content), trust runtime evidence
- Run evidence-gathering FIRST, then decide action
```

**3. Tool Discipline** (v1.0.0) — Core rules to inline:
```
## Tool Discipline Rules
- Before edit(): read() the target file in this session (80% fail rate without)
- After bash(): check exit code — 0=success, nonzero=failure, don't guess
- Never call finish() or bash() with empty arguments
- After any tool error: report exact error, don't swallow it
```

### Selected Agents

| Agent | Why | Current skill refs | Injection location |
|-------|-----|-------------------|-------------------|
| **Bob** | Most active coder, highest session volume | 11 refs (0 read) | `## Active Skills` section |
| **Amy** | High session volume, diverse tasks | 7 refs (0 read) | After `⚡ BEFORE CALLING finish()` |
| **Optimizer** | Measures system health, should model good behavior | 7 refs (0 read) | `## Active Skills` section (already exists) |

### Injection Format

Replace `📘` pointer lines with inlined content blocks. Example for optimizer's context.md:

**Before:**
```
📘 **Error Handling**: Read `agents/shared/skills/error-handling/SKILL.md` — brief summary
```

**After:**
```
📘 **Error Handling** (from shared/skills/error-handling):
- When a tool call fails: report the EXACT error message, don't summarize or swallow
- Retry at most once with a fix; if still failing, escalate (finish partial/blocked)
- Never say "it should work" — run it and check
```

### What NOT to change
- Keep the `📘` prefix and skill name for traceability
- Keep the source path reference (for humans maintaining the system)
- Don't inline entire SKILL.md files — extract only the 3-5 actionable rules
- Don't remove any existing `⚡` blocks (those already work)

## Measurement Plan

After injection, measure in the next 10 sessions per agent:
1. **Behavioral compliance**: Do agents follow the inlined rules? (grep session logs for evidence)
2. **Compared to baseline**: The 0/10 usage rate from skill-usage.md is the baseline
3. **Side effects**: Did context.md length increase cause any truncation issues?

## Next Step

Execute the pilot: edit 3 agents' context.md files to inline the top 3 skills. This is ~15 minutes of work. Then wait 1-2 days and measure.
