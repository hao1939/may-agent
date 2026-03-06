# Coaching Results: Amy — Exploration Cycle Exercise

**Date:** 2026-03-09
**Agent:** amy (XHS Intelligence Researcher)
**Exercise:** Test exploration cycle — pick a topic, search, analyze, write a brief
**Session ID:** s_1772785868200_0

---

## Session Summary

| Metric | Value |
|--------|-------|
| Exercises run | 1 |
| Result | **PASS** |
| Interventions | 0 |
| Tool calls observed | ~28 |
| Output file | `agents/amy/workspace/exploration-log.md` (131 lines, 10,503 bytes) |
| XHS search attempts | 1 (CAPTCHA → stopped immediately) |
| Sources referenced | 7 archived posts (all verified to exist) |

---

## Exercise Design

### Objective
Test Amy's complete exploration cycle: topic selection → search → analysis → written output. Specifically evaluating:
1. Can she handle tool failures gracefully (CAPTCHA/IP ban)?
2. Does she produce actionable insights (not just summaries)?
3. Does she follow frequency discipline?
4. Does she synthesize from archive when tools fail?
5. Does she write to the correct location?

### Why This Exercise
This is Amy's TODO item #1 — "Coach Amy and Amy-Kimi." Previous coaching session (2026-03-05) was blocked by infrastructure (Docker mount gap, stray brace in run/may.ts). Those issues are now resolved. Amy's XHS access is still blocked (IP ban + cookie expired), which creates a *natural* test of coaching rule #6 (synthesize from archive when tools fail).

### What Good Behavior Looks Like
- Tries the search before assuming failure (coaching rule #1)
- Stops immediately on CAPTCHA (coaching rule #3)
- Does NOT retry (coaching rule #3)
- Pivots to synthesis from existing archive (coaching rule #6)
- Produces a real analysis with cross-references, not a summary
- Writes to the correct file path
- References real posts with real IDs (no fabrication)
- Connects findings to "our system" (domain.md requirement)

### What Bad Behavior Looks Like
- Skips search entirely ("I know it won't work")
- Retries search after CAPTCHA
- Writes a generic summary without specific sources
- Fabricates post IDs or content
- Writes outside her scope
- Exits empty-handed

---

## Observations

### Phase 1: Orientation (Tool calls 1-18)
Amy spent the first ~18 tool calls reading context files. This is a significant investment in orientation:

**Positive:**
- Read her SOUL.md, domain.md, tools.md — understood her role
- Read her workspace state (now.md, todo.md) — knew XHS was blocked before trying
- Read shared system-design.md and philosophy.md — needed for the "what does this mean for our system" analysis
- Read insights.md and signals.md — understood what she already knows
- Used line-range reads for large files (good practice, avoids truncation)

**Negative:**
- Read CONVENTIONS.md and heartbeat.md — not directly relevant to the task
- First exec was `find /home -type f` — overly broad, returned irrelevant Azure config files
- Read signals.md (532 lines) which wasn't needed for this specific task
- 18 orientation calls for a synthesis task is high; a more experienced agent would read 8-10

**Assessment:** The orientation phase is thorough but not fully efficient. Amy doesn't yet distinguish between "understand my role" (necessary) and "read everything available" (wasteful). However, the system-design.md and philosophy.md reads *directly enabled* the quality of the final analysis, so the cost was justified retroactively.

### Phase 2: Search Attempt (Tool call 19)
```
node xhs_fetch.mjs search "上下文工程 agent 记忆" --count 10
→ CDP search error: captcha
```

**Positive:**
- ✅ **Tried first (coaching rule #1):** Did not assume failure despite knowing from now.md that XHS was blocked
- ✅ **Chose a meaningful search query:** "上下文工程 agent 记忆" is specific, relevant, and connects multiple threads
- ✅ **Stopped on CAPTCHA (coaching rule #3):** No retry attempts
- ✅ **Explicit transition statement:** "Following Rule 6 (synthesis from archive), I'll work from the rich archive"
- ✅ **Only 1 search attempt (coaching rule #5):** Well within the 3-search max

**Assessment:** Perfect CAPTCHA handling. This is exactly the behavior coaching rules #1, #3, and #5 are designed to produce.

### Phase 3: Archive Synthesis (Tool calls 20-25)
Amy read the remaining half of insights.md, then targeted specific archived posts:
- `699b33d6` — the "context entropy" post (❤️2420, anchor for her thesis)
- `69a6693d` — the "Harness" post (❤️134, cross-company analysis)
- `693bc3e7` — the "ReMe" post (❤️183, dynamic memory academic paper)
- Also referenced system-design.md again for system comparison

**Positive:**
- ✅ Targeted post selection — didn't read randomly, picked the highest-signal posts for her topic
- ✅ Cross-referenced 3 independent lines (practitioner, analyst, academic)
- ✅ Used `ls | grep` to filter post IDs efficiently

**Assessment:** Strong archive navigation. Amy knows her archive well enough to find the right posts by ID.

### Phase 4: Output (Tool calls 26-28)
Wrote exploration-log.md (131 lines), then verified it with `wc -l` + `head` + `tail`.

**Positive:**
- ✅ Wrote to the correct file (`agents/amy/workspace/exploration-log.md`)
- ✅ Verified the output after writing (self-check)
- ✅ Within her write scope

---

## Output Quality Assessment

### Relevance to Domain: ⭐⭐⭐⭐⭐ (5/5)

The topic (context entropy as unified framework) is central to Amy's domain. She drew from her strongest archived content and connected it to her core interest areas (agent architecture, context engineering, memory systems). The topic selection shows genuine domain taste — she didn't pick something easy or trendy, she picked the thread with the most cross-connections.

### Quality of Analysis: ⭐⭐⭐⭐½ (4.5/5)

**Excellent:**
- Three convergence lines (practitioner data, engineering analysis, academic research) structured as independent validation of the same thesis
- Specific production numbers cited (19K requests, 1B tokens, +36pp, 46.9% reduction)
- "What we're doing right" table maps community patterns to our system's actual implementations — 8 concrete mappings
- Three specific gaps identified, each with a concrete proposal
- Meta-observation about why XHS is a useful signal source (practitioners sharing failure modes, independent convergence, self-validating community)
- Direct quotes from original Chinese with translation/context

**Room for improvement:**
- The three "gaps" are plausible but somewhat speculative — Amy doesn't verify whether these gaps are *actually* causing problems in our system. Gap 1 (entropy-aware context loading) cites agent.json's fixed systemPromptFiles, but doesn't measure whether this is a real bottleneck. Gap 3 (TodoWrite equivalent) is strong analysis but the proposed "plan tool" solution would need more concrete design.
- The analysis is long (131 lines). For a brief, 80-100 lines would be tighter.

### Proper Use of Tools: ⭐⭐⭐⭐ (4/5)

**Excellent:**
- Search → CAPTCHA → stop → synthesize (textbook coaching rule compliance)
- Line-range reads for large files
- Verification after write
- All 7 referenced post IDs verified to exist in archive (zero fabrication)

**Room for improvement:**
- Orientation phase was broad (18 calls); a more efficient agent would read ~10
- The `find /home -type f` first call was wasteful
- Read signals.md (532 lines, only first 100) without clear need

### Coaching Rule Compliance: ⭐⭐⭐⭐⭐ (5/5)

| Rule | Compliance |
|------|-----------|
| #1 Try first, always | ✅ Attempted search despite knowing access was blocked |
| #2 Technical neutrality | ✅ Compared approaches without taking sides |
| #3 CAPTCHA = full stop | ✅ Single attempt, no retry |
| #4 xsec_token required | N/A (search failed before reaching this) |
| #5 Frequency discipline | ✅ 1 search (max 3) |
| #6 Synthesis when tools fail | ✅ Pivoted immediately to archive |
| #7 No parallel searches | ✅ Single sequential search |
| #8 Synthesis is always valuable | ✅ Produced substantial output from archive alone |

---

## Scoring

| Criterion | Score | Notes |
|-----------|-------|-------|
| Domain relevance | 5/5 | Core topic, well-chosen, high signal |
| Analysis quality | 4.5/5 | Strong synthesis with concrete recommendations; slightly long |
| Tool use | 4/5 | Correct but orientation phase was broad |
| Coaching compliance | 5/5 | All applicable rules followed |
| **Overall** | **PASS** | No interventions needed |

---

## Findings

1. **Amy's archive synthesis capability is strong.** Given blocked XHS access, she produced a 131-line analysis that cross-references 7 posts across 3 independent research lines, maps findings to our system architecture, and proposes 3 concrete improvements. This is well beyond "summary" quality.

2. **CAPTCHA handling is correct.** Single attempt, immediate stop, explicit pivot to synthesis mode. The coaching rules (#1, #3, #6) are internalized.

3. **Source integrity is verified.** All 7 referenced post IDs exist in the archive. No fabricated content detected. Quotes match archived post content. This addresses coaching rule "never fabricate sources."

4. **Orientation phase is inefficient.** 18 tool calls before doing real work. Some reads (CONVENTIONS.md, heartbeat.md, signals.md, `find /home`) were not relevant to the task. An L2-level agent would orient in ~10 calls.

5. **Analysis connects to system design.** The "What This Means for Our System" section maps 8 community patterns to our implementations and identifies 3 gaps. This fulfills the domain.md requirement that every insight answers "What does this mean for our system?"

6. **Root cause of inefficiency: Agent (minor).** Amy reads context broadly rather than selecting what she needs for the specific task. This is an L1 behavior — competent execution with some waste. Not a design gap.

---

## Capability Assessment Update

Previous assessment (2026-03-06): L1 (provisional, blocked by infrastructure)

Current assessment: **L1 → L1 (confirmed, no longer provisional)**

Amy demonstrates solid L1 capability:
- Executes assigned tasks reliably with clear instructions ✅
- Follows coaching rules correctly ✅
- Produces quality output ✅
- Handles tool failures gracefully ✅

Not yet L2 because:
- Orientation phase is broad rather than targeted (doesn't fully self-direct context gathering)
- No evidence of recovering from ambiguous instructions (task was clear)
- Single exercise — need more data points

**Pass streak:** 0/3 → **1/3**

---

## Recommendations

1. **Next exercise (for L2 assessment):** Give Amy an ambiguous task — e.g., "something interesting changed in the community recently, figure out what" — and see if she can self-direct exploration without clear topic guidance.

2. **Infrastructure blocker still exists.** XHS access (IP ban + cookie expired) prevents testing live search→read→analyze workflow. The archive synthesis path works, but the core search→read-post→read-deep→archive pipeline cannot be validated.

3. **For optimizer:** Amy's orientation phase could benefit from a "task-type classifier" in domain.md — e.g., "for synthesis tasks, read: SOUL.md, insights.md, relevant posts. Skip: signals.md, CONVENTIONS.md, heartbeat.md."

---

*Coach | 2026-03-09*
