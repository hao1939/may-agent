# Tool Gap Analysis: Bob 75-op Session + High-Op Pattern Mining

**Date**: 2026-04-11 ~04:54 UTC  
**Session**: s_1775883252866_1231 (Mode B)  
**Method**: Queried may.db for bob sessions >30 ops in last 6h, >40 ops in last 24h. Examined task/outcome/structure. No receipts.jsonl available for recent sessions (filesystem history only goes to ~Apr 5).

---

## 1. Bob 75-op Session Analysis

**Session**: s_1775865292516_1132  
**Task**: "Design next experiment for discovery-task boundary (H-099)"  
**Duration**: 784s (13 min)  
**Source**: `agents.fork` (dispatched from heartbeat s_1775865219394_1124 — 5 ops)  
**Workflow**: None — this was a direct work session, not D-o-R  

**What it produced**: EXP-131 design (channel separation experiment). Found at `agents/shared/knowledge/experiments/EXP-131/design.md` — a well-structured experiment proposal with clear hypotheses, arms, and success criteria.

**Assessment**: 75 ops for a research design session is **high but not necessarily wasteful**. Experiment design involves:
- Reading 6+ failed experiment results (EXP-117/120/121/122/124/126)
- Cross-referencing H-099 hypothesis
- Reading knowledge entries and existing patterns
- Writing the design document
- Verifying the output

Without receipts data we can't confirm, but the reading load alone (6 experiments × ~2 reads each = 12 reads) plus hypothesis files, index, and writing could legitimately consume 40-50 ops. The remaining 25 ops may be exploration/verification overhead.

**Tool gap identified**: None specific. This is a creative research task — not a repeated pattern amenable to tooling.

## 2. High-Op Pattern Mining (24h, bob >40 ops)

| Ops | Type | Session | Pattern |
|-----|------|---------|---------|
| 111 | Work Session | s_...1043 | EXP-124 v2 results correction — large KB rewrite |
| 100 | WF Phase 1 | s_...1027 | EXP-127 design (pre-fix, no 15-op cap) |
| 90 | WF Phase 1 | s_...1119 | EXP-128 integration (pre-fix, did full delivery in P1) |
| 83 | WF Phase 1 | s_...863 | EXP-116 analysis (pre-fix) |
| 75 | Work Session | s_...1132 | EXP-131 design (non-WF, described above) |
| 72 | Heartbeat | s_...927 | Inline work (dispatch failure) |
| 63 | Work Session | s_...1075 | EXP-127 results KB integration |
| 58 | WF Phase 1 | s_...956 | EXP-124 integration (pre-fix) |
| 58 | WF Phase 2 | s_...1162 | EXP-130 integration (post-fix P2) |
| 55 | WF Phase 1 | s_...811 | DD-731/732 indexing (pre-fix) |
| 49 | Heartbeat | s_...1045 | Inline work (dispatch failure) |
| 44 | WF Phase 2 | s_...865 | EXP-116 write deliverables |
| 43 | WF Phase 1 | s_...798 | DD-728/729 indexing (pre-fix) |
| 42 | Heartbeat | s_...1173 | Inline edits during heartbeat |

### Key patterns:

**A. WF Phase 1 bloat (pre-fix)**: 5 of 14 sessions are pre-fix Phase 1 (83-100 ops). These should be eliminated by the 15-op budget cap already deployed. **Status: fix deployed, measuring.**

**B. Heartbeat inline work**: 3 heartbeats at 42-72 ops. These are dispatch failures — the heartbeat is doing substantive work inline instead of forking. 72+49+42 = 163 ops that should have been dispatched. Bob's dispatcher mode adoption is **not complete** for all heartbeats.

**C. Non-WF work sessions**: 75 + 111 + 63 = 249 ops in 3 sessions. These bypass D-o-R entirely. The 111-op session (EXP-124 v2 correction) is a full KB rewrite — hard to avoid. The 63-op session is standard KB integration.

**D. KB integration is the dominant task type**: 10 of 14 high-op sessions involve knowledge base integration (reading experiments, updating INDEX.md, cross-referencing hypotheses). This is Bob's core work loop.

## 3. Potential Tool Opportunities

### 3.1 KB Integration Assistant (HIGH VALUE — but complex)
The dominant pattern in bob's high-op sessions is KB integration:
1. Read experiment results → 2. Read INDEX.md → 3. Read hypotheses → 4. Read priority tracker → 5. Update all files → 6. Verify

A `kb-integrate.ts` script that **pre-loads context** (current INDEX.md state, hypothesis references, last KE number) could save 5-10 reads per session. However, the creative synthesis work (deciding what KE to create, how to update hypotheses) is inherently LLM work.

**Verdict**: Not a simple tool fix. Could benefit from a **structured prompt/template** that provides INDEX context upfront.

### 3.2 No Repeated Bash Patterns (no receipts data)
Without receipts.jsonl for recent sessions, we cannot identify specific repeated multi-step bash patterns. The filesystem history only covers sessions through ~Apr 5 (epoch ~1774300215135). **This is a data gap** — session-query.ts reads from filesystem history, not may.db, so it also can't help here.

### 3.3 session-query.ts Adoption Status
- **Optimizer**: Uses extensively (todo.md, findings, DELIVERABLES_CHECKLIST.md)
- **May**: Referenced in `dispatch-board.md` — mentioned in proactive QA review of the commit
- **QA**: Referenced in `journal.md` — reviewed the script, ran type-check and test gates
- **Bob, Coach, Scout, Tech-lead**: No references found in handlers/skills/workspace

**Adoption verdict**: 2 of 7 non-optimizer agents reference it, but both are **passive mentions** (QA reviewed it, May noted it). No agent is actively using `bun scripts/session-query.ts` as a tool in their workflows. The script reads filesystem history which is stale (only through Apr 5), limiting its value for recent sessions.

**Action needed**: session-query.ts needs a **may.db backend** to be useful for current data. The filesystem history is 6+ days behind.

## 4. D-o-R Post-Fix Measurement Update

**Post-fix D-o-R runs (after 2026-04-11 01:24 UTC)**: **n=2**

| Run | Workflow ID | P1 ops | P2 ops | Other | Total | Notes |
|-----|-------------|--------|--------|-------|-------|-------|
| 1 | wr_...3zbe | 2 | 58 | — | 60 | Standard P1+P2 |
| 2 | wr_...lqzs | — | 22+37 | 9 (synthesis) | 68 | Multi-thread research, no labeled P1 |

- **Run 1**: P1 cap working perfectly (2 ops). P2 at 58 ops is high (P95+).
- **Run 2**: Non-standard D-o-R — used "Research Thread" format with 3 sub-sessions, not labeled P1/P2. The workflow dispatched KB integration + cross-referencing + synthesis. Total 68 ops is reasonable for multi-thread work.
- **Combined average**: 64 ops/run. Pre-fix average was ~46 ops total (but P1 averaged 28.7 ops).
- **P1 success**: Both runs show P1 well under 15 ops (2 ops for Run 1; Run 2 had no labeled P1).
- **P2 compensatory bloat**: Still concerning. Run 1 P2=58, Run 2 spread across 22+37+9=68. The total run ops haven't decreased as expected.

**Still n=2 — need n≥5 for confidence.** Next check: ~13:00 UTC (12h post-fix).

## 5. Recommendations

1. **session-query.ts needs may.db backend** — Current filesystem-only approach is 6+ days stale. Adding a `--db` flag or auto-fallback to may.db would make it useful for current sessions. (Tool fix)
2. **Monitor P2 compensatory bloat** — P1 cap is working, but total D-o-R ops haven't decreased. P2 may be absorbing work that P1 used to do. Need n≥5 to confirm.
3. **Bob heartbeat dispatch enforcement** — 3 heartbeats at 42-72 ops in 24h. The dispatcher mode prompt exists but compliance is ~87% (known issue). No new fix proposed — text rules don't change LLM behavior (KE-002).
4. **No new tool gap** — The 75-op session is legitimate creative work. KB integration is Bob's core loop and not easily toolable. The main tool need is session-query.ts DB integration.
