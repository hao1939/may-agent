# Finding: Mode B Tool Gap Analysis — Coach High-Op Sessions

**Date**: 2026-04-19  
**Sessions analyzed**: 3 highest-op coach sessions from `.state/sessions/`  
**Method**: Full tool-call extraction from `session.jsonl` files

---

## Sessions Analyzed

| Session | Ops | Date | Task | Key Activity |
|---------|-----|------|------|-------------|
| s_1776002093322_2160 | 67→88 | Apr 12 | EXP-149 H-106 data analysis | DB queries + session file mining |
| s_1776056469810_18 | 58→87 | Apr 13 | QA C1.4 finish investigation | Code search + DB queries + analysis |
| s_1775645088444_9 | 55→63 | Apr 8 | EXP-083 gym baselines | Manual gym runs + results scoring |

(First number = opCount in meta; second = tool calls extracted from transcript. Discrepancy = some tool calls are parallel/batched counting as 1 op.)

---

## Pattern 1: PATH Boilerplate (HIGH FREQUENCY, LOW INDIVIDUAL COST)

**Every single bash call** in sessions 1 and 2 starts with:
```bash
export PATH=".state/.bun/bin:$PATH"
```

- Session 1: 54 bash calls, all prefixed with PATH export
- Session 2: 40+ bash calls, all prefixed with PATH export

**Impact**: Minimal per-call (a few tokens each), but indicates the environment doesn't persist PATH between calls. This is a platform-level issue, not a tool gap. The context.md already tells coach about this.

**Verdict**: Not actionable as a tool — would need platform-level `~/.bashrc` or session env persistence.

---

## Pattern 2: Not Using gym-batch.sh (ACTIONABLE — Session 3)

Session 3 (s_1775645088444_9) ran **12+ individual `gym-run.sh` calls** for 2 scenarios:
```
ops 5-7:   3× gym-run.sh truncated-env-repair-xref
ops 19-24: 6× gym-run.sh (3 env-repair, 3 schema-migration)
ops 30-33: 4× gym-run.sh (mixed)
```

Then **manually scored each run** by navigating to `/tmp/gym-run-*/` dirs, reading success_criteria.js, and running `node` commands (ops 8-17, 25-29, 34-35 = ~15 ops just for scoring).

**gym-batch.sh exists** and is referenced in coach's context.md:
> `Gym batch runner: scripts/gym-batch.sh — run multiple scenarios at once with --variants, --trials N`

The entire sequence of ~30 ops (12 runs + ~18 scoring/inspection) could have been:
```bash
scripts/gym-batch.sh --scenarios truncated-env-repair-xref,truncated-schema-migration-xref --trials 5 --agent coach
```

**Estimated savings**: ~25-30 ops → 1-2 ops. This session could have been ~35 ops instead of 63.

**Root cause**: This session is from Apr 8 — gym-batch.sh may have been added later, or the agent didn't trust it yet. Check if this pattern persists in more recent coach sessions.

---

## Pattern 3: Data Discovery Spiral (ACTIONABLE — Session 1)

Session 1 spent **ops 4-53 (~50 ops!)** trying to locate and parse FM-3.3 guard block data:

1. Tried `bun -e` queries against may.db (ops 4-6) — schema didn't have what was needed
2. Searched for `.db` files (op 7)
3. Tried different DB paths (op 8)
4. More DB queries (ops 9-10)
5. Searched for session JSONL locations (op 11)
6. Tried to grep session files for FM-3.3 (ops 12-13)
7. Sampled individual session files (ops 14-17)
8. Read finish-guard source code to understand block format (ops 16-22)
9. Tried multiple grep patterns for FM-3.3 blocks (ops 23-24)
10. Looked for prior analysis scripts (ops 25-26)
11. Read prior analysis results (op 44)
12. Found pre-computed JSON data files (ops 46-48)
13. Finally extracted what was needed (ops 49-54)

**The core problem**: Coach didn't know where FM-3.3 block data lived or what format it was in. The first 50% of the session was pure discovery.

**Potential fix**: A `session-query` tool or documented query patterns for common data needs:
- "How to find guard blocks" → specific grep/bun recipe
- "How to get per-agent quality data" → specific may.db query
- "How to parse session.jsonl" → documented schema

**But**: This is a one-time exploration cost. Once coach wrote the analysis, the pattern was documented. The real question is whether OTHER sessions repeat this same discovery. Checking: the prior findings (finding-session-archaeology-*) don't flag repeated data-discovery spirals as a top pattern, suggesting this is ad-hoc research, not a repeated automation target.

**Verdict**: Medium priority. A "data cookbook" in coach's context would help, but each analysis task needs different data. Hard to generalize into a tool.

---

## Pattern 4: Repeated File Reads (LOW-MEDIUM IMPACT)

Session 2 reads the same files multiple times:
- `agents/qa/SOUL.md`: read 3 times (ops 38, 58, 61-62)
- `agents/qa/heartbeat.md`: read 2 times (ops 25, 57, 78)
- `agents/coach/workspace/guard-internalization-analysis-20260412.md`: read at ops 44, 73

Session 1 reads H-106 hypothesis 4 times (ops 1, 55, 71-72, 77).

**Impact**: ~8-10 redundant reads across 3 sessions. At ~1 op each, modest.

**Root cause**: Long sessions where agent loses track of file contents from context window pressure. Not really fixable with tools — it's a context window management issue.

**Verdict**: Not actionable as a tool gap.

---

## Pattern 5: Grep Chains for Code Discovery (MEDIUM FREQUENCY)

Session 2 has a classic grep chain (ops 7-13):
```
find . -name "*.ts" -o -name ... | searching for convention code
grep -rl "C1.4|C8.2|convention_checks" src/
grep -rn "C1.4|C8.2|convention_check" src/
grep -rn "convention" src/
grep -rn "convention_checks|INSERT.*co" src/
find . ... convention checker script
```

Then later (ops 46-53):
```
grep -n "no.*finish|text.only|missing.*finish" src/lib/manager.ts
grep -n "finish|onComplete|text.only" src/lib/manager.ts
grep -n "onComplete|archiveStatus|text.only" src/lib/manager.ts
grep -n "determineOutcome|detectShallow" src/lib/manager.ts
grep -n "determineOutcome|detectShallow" src/lib/manager-utils.ts
grep -rn "function determineOutcome|function detectShallow" src/lib/
```

**Total**: ~13 grep-variant ops across session 2 alone.

**Existing tool**: The prior Mode B analysis (finding-codesearch-tool-scoping-0412.md) already identified this as the #1 tool gap and scoped a `codeSearch` tool. 

**Verdict**: Already identified. Check if codeSearch was built and deployed.

---

## Summary: Actionable Findings

| Pattern | Frequency | Savings/session | Priority | Status |
|---------|-----------|----------------|----------|--------|
| **Manual gym-run loops** | 1 of 3 sessions | ~25-30 ops | **HIGH** | gym-batch.sh exists but wasn't used (Apr 8). May be resolved in newer sessions |
| **Grep chains** | 1 of 3 sessions | ~10-13 ops | **MEDIUM** | Already scoped (codeSearch tool). Check deployment status |
| **Data discovery spiral** | 1 of 3 sessions | ~20-30 ops (one-time) | **LOW** | Ad-hoc research cost, hard to generalize |
| **PATH boilerplate** | 2 of 3 sessions | ~0 (tokens only) | **NONE** | Platform issue, not a tool gap |
| **Repeated file reads** | 2 of 3 sessions | ~8-10 ops | **NONE** | Context window issue, not fixable with tools |

## Recommended Actions

### 1. Verify gym-batch.sh adoption (HIGH PRIORITY)
Check recent coach sessions (Apr 13+) — is coach now using `gym-batch.sh` instead of manual loops? If not, the context.md entry needs to be more prominent or the batch script needs to be mentioned in gym-related task prompts.

### 2. Check codeSearch deployment status (MEDIUM PRIORITY)  
The grep-chain pattern was already identified in the Apr 12 codeSearch scoping. Has `scripts/code-search.ts` been deployed? Is it referenced in any agent context?

### 3. No new tool needed
The high op counts in these 3 sessions are driven by:
- Complex ad-hoc research tasks (sessions 1 & 2) — inherently high-op
- Missing adoption of existing tool (session 3) — gym-batch.sh

**The gap is adoption, not tooling.** Coach knows about gym-batch.sh (it's in context.md) but didn't use it in session 3. The fix is behavioral (better task prompts, skill reinforcement) not architectural (new tools).
