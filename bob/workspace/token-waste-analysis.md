# Token Waste Analysis: May-Agent Sessions

**Date**: 2026-04-09  
**Scope**: Last 100 sessions across all agents  
**Total cost analyzed**: $56.33  

## Executive Summary

Input tokens dominate cost at a 29.4:1 ratio vs output tokens. Three waste sources account for an estimated **$37-40 in avoidable cost** out of $56.33 total (65-70%):

1. **Zero prompt caching on Claude** — $33.51 potential savings (60%)
2. **Duplicate file reads** — ~$3.90 direct + multiplicative context bloat
3. **Oversized tool results** — ~$2.50+ from system_status and 50KB+ file reads

## Data Sources

- `.state/sessions/*/session.jsonl` — full conversation logs with usage metrics
- `.state/sessions/*/meta.json` — session metadata (agent, model, etc.)
- `.state/sessions/*/receipts.jsonl` — tool call receipts

---

## Waste Source #1: Zero Prompt Caching on Claude Sessions

### Finding
81 of 100 sessions have **0% cache hit rate**. All Claude Opus 4.6 sessions (coach, bob, may, optimizer, scout, tech-lead) show zero caching. Only GPT-5.2 sessions (qa, evaluator) achieve 79-80% cache hit rates.

### Evidence

| Agent | Model | Input Tokens | Cached | Cache Rate |
|-------|-------|-------------|--------|-----------|
| coach | claude-opus-4.6 | 6,814,799 | 0 | 0.0% |
| bob | claude-opus-4.6 | 5,154,651 | 0 | 0.0% |
| may | claude-opus-4.6 | 1,671,944 | 0 | 0.0% |
| optimizer | claude-opus-4.6 | 1,206,898 | 0 | 0.0% |
| qa | gpt-5.2 | 310,140 | 1,162,368 | 78.9% |
| evaluator | gpt-5.2 | 142,363 | 575,104 | 80.2% |

### Cost Impact
- 15.3M Claude input tokens at full price ($3/Mtok) = $45.90
- With 80% caching: 80% at $0.30/Mtok = $3.67 + 20% at $3/Mtok = $9.18 = $12.85
- **Potential savings: ~$33.51 (60% of total cost)**

### Root Cause
The Anthropic API supports prompt caching via cache control breakpoints on system messages and conversation prefixes. These don't appear to be configured. Every turn re-processes the entire conversation history at full input token price.

### Fix: Enable Anthropic Prompt Caching
**Implementation**: Add `cache_control: {"type": "ephemeral"}` breakpoints to:
1. The system prompt (stable across turns)
2. The conversation history prefix (grows but previous turns are stable)

**Expected impact**: 60-80% cache hit rate on multi-turn sessions, saving ~$33/100 sessions.

**Effort**: Low — Anthropic SDK configuration change in the API call layer.

---

## Waste Source #2: Duplicate File Reads Within Sessions

### Finding
107 instances of the same file being read 2+ times in a single session. **5.15 MB of redundant content** injected into context windows.

### Worst Offenders

| File | Reads/Session | Sessions | Wasted Bytes |
|------|:---:|:---:|---:|
| `knowledge/INDEX.md` (51KB) | 5-7x | 7 | ~1.5 MB |
| `bob/workspace/todo.md` (51KB) | 4-6x | 5 | ~1.1 MB |
| `hypotheses/PRIORITY-TRACKER.md` (28KB) | 5-6x | 6 | ~0.6 MB |
| `entries/KE-060-...taxonomy.md` (22KB) | 6x | 1 | ~94 KB |
| `hypotheses/H-085-...mechanism.md` (31KB) | 4x | 1 | ~84 KB |

### Cost Impact
- 5.15 MB ÷ 4 bytes/token ≈ 1.3M tokens direct waste
- At $3/Mtok: ~$3.90 in direct read costs
- **Multiplicative effect**: Each re-read bloats the context window, making ALL subsequent turns more expensive. A 51KB re-read in turn 5 costs ~12.5K tokens on every subsequent turn.

### Root Cause
1. **Read-before-edit pattern**: Agents read a file, make changes, then re-read to verify — but also re-read before each subsequent edit
2. **Compaction amnesia**: After context window compaction, agents lose track of what files they've already read and re-read them
3. **Large index files**: INDEX.md and todo.md are 51KB each — far too large for repeated full reads

### Fixes

**Fix 2a: Split large index files** (Structural)
- Break `INDEX.md` (51KB) into topic-specific sub-indices (there are already topic pages)
- Break `todo.md` into active/archive sections; only load the active section
- Target: No single frequently-read file > 15KB

**Fix 2b: Partial read patterns** (Behavioral)
- Use `read(path, offset, limit)` or `bash grep` to read only relevant sections
- Add to agent context: "For INDEX.md and todo.md, use grep to find relevant sections instead of reading the full file"

**Fix 2c: Compaction-aware file tracking** (Infrastructure)
- After compaction, include a note: "Files already in context: [list]" so agents don't re-read
- Or: tool-level deduplication that returns "File unchanged since last read at turn N" for re-reads

---

## Waste Source #3: Oversized Tool Results

### Finding
`system_status` returns ~130KB per call (the largest tool results in the entire dataset). Large `read()` results (>50KB) account for 67 instances. Together, 398 tool results >10KB (14% of calls) dominate total result bytes.

### Evidence

| Tool | Calls | Total MB | Avg | P90 | Max | >10KB | >50KB |
|------|------:|--------:|----:|----:|----:|------:|------:|
| read | 628 | 8.20 | 13.7K | 50.6K | 51.2K | 255 | 67 |
| bash | 1,758 | 5.96 | 3.6K | 6.9K | 51.0K | 139 | 42 |
| system_status | 6 | 0.74 | 130K | 130K | 130K | 6 | 6 |
| edit | 173 | 0.39 | 2.4K | 5.0K | 10.0K | 0 | 0 |
| agents | 74 | 0.24 | 3.5K | 5.1K | 56.8K | 3 | 1 |

### Cost Impact
- system_status: 780KB ÷ 4 ≈ 195K tokens → ~$0.59
- Large reads (>50KB): 67 × 50KB ÷ 4 ≈ 837K tokens → ~$2.51
- Combined with context multiplication: significantly higher actual cost

### Fixes

**Fix 3a: Truncate system_status output** (Infrastructure)
- Current: dumps all 1000+ active sessions with full details
- Proposed: Summary view by default (active count, recent completions, health indicators) — target <5KB
- Add `detail` parameter for full dump when needed

**Fix 3b: Auto-summarize large read results** (Infrastructure)  
- For files >20KB, return a structured summary + "use offset/limit for specific sections"
- Or: enforce the existing `limit` parameter in `read()` more aggressively

**Fix 3c: Large file warnings** (Behavioral)
- Add to context.md: "INDEX.md is 51KB. Use `bash rg 'pattern' path` instead of reading it whole."
- Track file sizes and warn agents before reading large files

---

## Additional Findings

### 4. Context Window Growth
Sessions grow from ~7K tokens (turn 1) to 48K+ tokens by turn 30-50.

| Turn Bucket | Sessions | Avg Input | Growth Ratio |
|------------|--------:|----------:|------------:|
| 1-5 | 100 | 6.9K | 1.0x |
| 10 | 64 | 5.9K | 0.9x* |
| 20 | 35 | 7.4K | 1.1x* |
| 30 | 19 | 15.3K | 2.2x |
| 50 | 9 | 17.5K | 2.5x |

*Medians are lower due to compaction; averages are pulled up by sessions with large tool results

### 5. Long Sessions Dominate Cost
- 9 sessions (50+ turns): $26.50 = **47% of total cost**
- 19 sessions (30+ turns): $37.84 = **67% of total cost**
- Splitting long sessions into shorter ones would reduce context accumulation

### 6. System Prompt Overhead
- First message averages 11.6KB across all sessions
- Active recall: present in 67% of sessions, averaging 2.8KB
- Persistent context ("What You Know"): present in 100% of sessions
- Task history: present in 100%, averaging 2.2KB
- These are small relative to conversation growth but add up: ~300K tokens across 100 sessions

### 7. Per-Agent Cost Distribution
| Agent | Sessions | Cost | % of Total |
|-------|--------:|------:|----------:|
| coach | 24 | $23.39 | 41.5% |
| bob | 22 | $17.89 | 31.8% |
| may | 8 | $6.19 | 11.0% |
| optimizer | 9 | $4.05 | 7.2% |
| qa | 8 | $1.86 | 3.3% |
| tech-lead | 10 | $1.03 | 1.8% |
| scout | 8 | $1.01 | 1.8% |
| evaluator | 8 | $0.88 | 1.6% |

---

## Recommended Action Priority

| # | Fix | Savings Est. | Effort | Priority |
|---|-----|-------------|--------|----------|
| 1 | Enable Anthropic prompt caching | ~$33/100 sessions (60%) | Low | **P0** |
| 2 | Truncate system_status output | ~$0.59 direct | Low | P1 |
| 3 | Split INDEX.md and todo.md | ~$3-5 (reduces re-reads + context bloat) | Medium | P1 |
| 4 | Add file-size awareness to context | ~$2-3 (reduces large reads) | Low | P1 |
| 5 | Compaction-aware file tracking | ~$1-2 (reduces post-compaction re-reads) | Medium | P2 |
| 6 | Encourage shorter sessions | Indirect (reduces context growth) | Low | P2 |

**Total addressable waste: ~$37-40 per 100 sessions (65-70% of cost)**

---

## Methodology Notes

- Token counts from `usage` fields in session.jsonl assistant messages
- Byte-to-token conversion estimated at 4 bytes/token
- Cost rates: Claude Opus input $3/Mtok, cached $0.30/Mtok, output $15/Mtok
- Cache savings assume 80% hit rate achievable (based on GPT-5.2 agent performance)
- "Multiplicative" context bloat effects are noted but not fully quantified
