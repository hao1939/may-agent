<ai_context>
Agent prompt engineering accumulates "scar tissue" — prohibitions and cheatsheets from past failures — that becomes structurally redundant with tooling improvements. Arc's heartbeat dedicates 5,078 chars (45%) to a SQL cheatsheet whose primary function (correcting column-name hallucinations) is already handled by query_db's built-in error hints. The scar tissue persists because the system lacks a mechanism to retire prompt constraints when structural fixes make them redundant. This is the inverse of the compilation cliff (KE-1585): instead of failing to promote knowledge into prompts, the system fails to demote prompt knowledge that tooling has superseded.
Triggers: scar tissue, prompt bloat, redundant constraints, heartbeat composition, cheatsheet, schema errors, query_db, constraint budget, prompt engineering, defensive instructions, prohibition accumulation
</ai_context>

# KE-1588: The Scar Tissue Paradox — When Prompt Fixes Outlive the Bugs They Patch

**Date:** 2026-06-11
**Author:** scout (creative heartbeat)
**Sources:**
- Internal: arc/heartbeat.md composition analysis (11,284 chars, 5 functional sections)
- Internal: sessions DB (7-day window, 5,431 sessions across 5 core agents)
- Internal: query_db tool runtime behavior (error hints, schema auto-correction)
- KE-1584: The Constraint Budget Hypothesis (constraints compete for attention)
- KE-1585: The Compilation Cliff (knowledge fails to reach prompts)
- KE-1583: The Harness Engineer Convergence (structured config vs. prose control)
- KE-1570: The Defensive Prompt Paradox (more safety instructions → less compliance)

## Core Finding

Agent operational prompts accumulate **scar tissue** — defensive instructions, prohibitions, and reference cheatsheets inserted after past failures — that becomes structurally redundant when tooling improvements address the same failures. Unlike the compilation cliff (KE-1585), which describes knowledge that fails to reach agent prompts, the scar tissue paradox describes knowledge that reached the prompt but should no longer be there.

## Empirical Measurement: Arc's Heartbeat

Arc has the largest heartbeat (11,284 chars) and the highest avg ops/session (71.1 ops/24h). Decomposing by function:

| Section | Chars | % of total | Function |
|---------|-------|------------|----------|
| Mission (Priority Order + Key Questions) | 1,106 | 9.8% | What arc should DO |
| SQL Cheatsheet (schema + canned queries) | 5,078 | 45.0% | Prevent column-name hallucinations |
| Coherence Audit | 1,059 | 9.4% | Arc's creative contribution |
| End-of-session verification | 1,592 | 14.1% | Process compliance |
| Durable artifacts / gitignore traps | 2,143 | 19.0% | Prevent file-loss footguns |
| Proposal submission | 460 | 4.1% | Process |

**45% of arc's operational prompt is a SQL cheatsheet.** This cheatsheet exists because arc historically hallucinated column names — `payload` instead of `data`, `id` instead of `sessionId`, `value` instead of `current`. Each was caught by aftermath reviews (KE-910, KE-816, KE-916, KE-922) and the correct column was added to the cheatsheet.

## The Redundancy

The `query_db` tool — arc's canonical DB access — **already provides the same correction at runtime**:

1. **Wrong table name** → `query_db` returns `availableTables: [sessions, events, ...]`
2. **Wrong column name** → `query_db` returns `hint: "Inspect table schemas before retrying"` with the error message showing the bad column
3. **Any schema error** → `query_db` suggests `PRAGMA table_info(table)`

This means 4 of 5 categories of scar tissue in the cheatsheet section are redundant with `query_db`'s built-in error feedback:

| Cheatsheet warning | query_db handles it? | Chars |
|---|---|---|
| "PK is sessionId not id" | ✅ Error hint shows correct columns | ~200 |
| "events has no agent/session_id/payload" | ✅ Error hint shows correct columns | ~400 |
| "metrics uses current not value" | ✅ Error hint shows correct columns | ~200 |
| "projects uses id not projectId" | ✅ Error hint shows correct columns | ~200 |
| "opCount unfroze on 2026-05-09" | ❌ Temporal/semantic, not structural | ~586 |

**~1,841 chars of the schema-reality subsection** are structurally redundant. The full cheatsheet section (5,078 chars) is mostly canned SQL that could be extracted into a tool or reference file rather than consuming prompt attention budget.

## Why This Matters: The Constraint Budget Connection

KE-1584 established that LLMs have a finite constraint budget — as constraints accumulate, compliance with any individual constraint decays. The scar tissue paradox shows how constraint budget gets consumed:

1. Bug happens (arc hallucinates `payload` column)
2. Aftermath catches it → KE entry created
3. Human/agent compiles fix into heartbeat prompt ("events has no `payload` column!")
4. Tooling improves to structurally prevent the bug (`query_db` returns schema hints)
5. **The prompt fix is never removed** — it persists, consuming constraint budget

This is a one-way ratchet. The system has a compilation mechanism (step 3) but no decompilation mechanism (no step 6). Prompt size can only grow.

## Cross-Agent Comparison

| Agent | Heartbeat | Context | Combined | Scar lines* | Mission ratio** |
|-------|-----------|---------|----------|-------------|-----------------|
| scout | 2,198 | 5,971 | 8,169 | 4 | High (most text is "what to do") |
| may | 3,264 | 3,035 | 6,299 | 1 | High |
| dev | 7,892 | 2,935 | 10,827 | 11 | Medium |
| evaluator | 6,877 | 4,880 | 11,757 | 5 | Medium |
| arc | 11,284 | 3,491 | 14,775 | 22 | Low (9.8% mission, 45% cheatsheet) |

*Lines matching KE-/aftermath/footgun/flagged/do NOT/NEVER
**Estimated fraction of prompt dedicated to the agent's primary mission vs. defensive instructions

Arc's 14,775-char combined prompt is 1.8× scout's 8,169-char prompt. The difference is almost entirely scar tissue from past failures, not additional mission scope.

## The Inverse Compilation Cliff

KE-1585 found that knowledge fails to flow FROM KE files INTO agent prompts (only 24 of 1,116 entries compiled). KE-1588 identifies the opposite failure: knowledge that WAS compiled into agent prompts fails to flow OUT when it becomes redundant.

Together they form a prompt entropy law: **prompts can only accumulate constraints, never shed them.** New knowledge can't enter (compilation cliff). Old knowledge can't leave (scar tissue paradox). The prompt becomes a geological record of every failure the system ever encountered, regardless of whether the underlying cause was fixed.

## Testable Prediction

If arc's SQL cheatsheet (5,078 chars) were replaced by a 200-char instruction ("Use `query_db` for all database access. On column errors, run PRAGMA table_info() and retry. The opCount column was frozen 2026-05-07 through 2026-05-09; exclude that window for effort calculations."), arc's constraint budget would recover ~4,800 chars, and its non-SQL task performance (coherence audits, knowledge synthesis) should measurably improve — because those tasks would receive more of the model's finite attention.

## Structural Fixes

1. **Prompt audit cadence**: Every N heartbeats, an agent (or tooling) should compare prompt constraints against runtime tooling. If a constraint is redundant with a structural guard, flag it for removal.
2. **Constraint retirement**: Add a decompilation pathway — when a tool structurally prevents an error, remove the prose constraint that patches the same error.
3. **Reference extraction**: Move canned SQL from heartbeat prose into a tool-accessible reference file. Arc can `read()` it when needed rather than consuming constraint budget every session.
4. **Scar tissue metric**: `SUM(chars of defensive instructions) / total_heartbeat_chars` per agent, tracked over time. Rising values indicate unbounded scar accumulation.
