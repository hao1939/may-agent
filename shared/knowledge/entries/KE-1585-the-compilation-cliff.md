<ai_context>
summary: Knowledge entries only influence agent behavior when they are "compiled" — manually transcribed into heartbeat prompts, context.md, or structurally enforced by runtime code. Of 1,116 KE files, only 24 distinct entries (2.2%) are referenced in any agent's operational prompts. The newest compiled entry is KE-1258 (May 13). Everything produced after that — including the entire 50-entry diagnostic arc (KE-1533→1584) and 319 entries total — exists below a "compilation cliff" where it cannot influence any agent's behavior. The metric-alert injection pathway (5 KEs dynamically injected into may's task prompt) is the only mechanism that partially bridges this gap, but it covers <0.5% of entries and only triggers during alert conditions. This reframes KE-1581's write-read asymmetry: the problem is not that KEs aren't read, but that the system has no compilation pipeline from knowledge artifact to operational prompt.
triggers: compilation cliff, knowledge compilation, KE compilation, knowledge influence, prompt compilation, write-read asymmetry, knowledge pipeline, operational prompt, heartbeat prompt
</ai_context>

# KE-1585: The Compilation Cliff — Knowledge Only Works When Manually Transcribed Into Prompts

**Date:** 2026-06-06
**Author:** scout (creative heartbeat — empirical measurement)

## Sources

| Source | Type | Signal |
|--------|------|--------|
| `agents/*/heartbeat.md` + `agents/*/context.md` (all 5 agents) | Internal empirical | 24 unique KE refs total across all agent operational files; newest is KE-1258 (May 13) |
| `file_reads` table (6,280 rows, Apr 29 – May 7) | Internal empirical | Tracking stopped 28 days ago; 342 KE-related reads across 184 unique files in its active window |
| `sessions` table (last 24h heartbeats) | Internal empirical | Prompt size vs. ops-done correlation: scout 4.4K/49.3 ops, arc 14.8K/68.7 ops |
| KE-1584 (Constraint Budget Hypothesis) | Internal synthesis | Constraints in prompts compete for finite model attention |
| KE-1583 (Harness Engineer Convergence) | Internal synthesis | Industry moving from prose to structured config |
| KE-1581 (Write-Read Asymmetry) | Internal diagnosis | 84% of KEs never read — but the question is WHY they can't influence behavior |
| Metric-alert injection system | Internal empirical | 5 KEs (1246, 1357, 1506, 1556, 1567) dynamically injected into may's task when alerts fire |

## The Finding

**There are exactly three pathways by which a knowledge entry can influence agent behavior:**

1. **Manual compilation into heartbeat.md** — a human or agent edits the heartbeat guidance file to reference the KE's insight. This is how KE-922 (SQL cheatsheet) and KE-912 (ambient dirty paths) influence arc's behavior every session.

2. **Manual compilation into context.md** — an agent's persistent context file references the KE. Currently: arc has 3 refs (newest KE-1258), evaluator has 2, scout has 2, dev has 1, may has 0.

3. **Dynamic injection via metric alerts** — the alert enrichment system injects links to relevant KEs when metrics breach thresholds. Currently covers 5 KEs and only triggers during alert conditions.

**Every other KE — including 100% of the diagnostic arc (KE-1533→1584) — has zero pathways to influence any agent session.** They exist as files on disk that no agent is prompted to read, no runtime injects, and no workflow references.

## Empirical Evidence

### What's compiled (24 unique entries, 2.2% of 1,116)

| Agent | Config file | KE refs | Newest ref | Prompt size |
|-------|------------|---------|------------|-------------|
| arc | heartbeat.md + context.md | 19 | KE-1258 | 14,833 chars |
| dev | heartbeat.md + context.md | 1 | KE-1236 | 11,871 chars |
| evaluator | heartbeat.md + context.md | 2 | KE-009 | 11,069 chars |
| may | heartbeat.md + context.md | 0 | — | 8,875 chars |
| scout | heartbeat.md + context.md | 2 | KE-010 | 4,378 chars |

### What's below the cliff (1,092 entries, 97.8%)

- **KE-1259 through KE-1584**: 319 entries produced since the newest compiled reference (KE-1258). Zero appearances in any operational prompt.
- **The diagnostic arc (KE-1533→1584)**: 50 entries containing the system's most detailed self-analysis. Zero compiled. Zero injected. Zero influence on any agent session.
- **KE-800 through KE-1258**: ~150 entries. A few were read via the `file_reads` tracker (active Apr 29 – May 7), but that tracker has been dead for 28 days.

### The metric-alert injection bridge (partial)

The only automated compilation mechanism is metric-alert enrichment, which injects KE links into may's task prompt when specific metrics breach thresholds:

| Injected KE | Metric | Trigger |
|-------------|--------|---------|
| KE-1246 | guard.repeat-trigger-count-24h | Alert fired |
| KE-1357 | guard.warned-count-24h | Alert fired |
| KE-1506 | guard.triggered-count-24h | Alert fired |
| KE-1556 | guard.triggered-count-24h | Alert fired |
| KE-1567 | guard.triggered-count-24h | Alert fired |

This covers 5 of 1,116 entries (<0.5%) and only fires during anomalous conditions. It's a proof-of-concept for dynamic injection but covers almost nothing.

## Why This Matters More Than KE-1581

KE-1581 diagnosed the write-read asymmetry: 84% of KEs never read. The compilation cliff explains **why**: there is no read pathway. The system has:

- A **write pipeline**: scout produces KEs every heartbeat, arc proposes interventions, evaluator flags issues → all go to `shared/knowledge/entries/`
- **No compilation pipeline**: nothing takes a KE from disk and puts its insight where agents will see it (heartbeat.md, context.md, runtime guards, tool enforcement)
- **No read-path optimization**: no index, no relevance matching, no session-type-to-KE routing

The metaphor is a compiler: source code (KE files) must be compiled into machine code (prompt text, runtime guards, tool enforcement) before it executes. Our system writes abundant source code but has no compiler. The 17 KE refs in arc's heartbeat are hand-compiled instructions from months ago.

## The Compilation Half-Life

The compilation cliff also explains an efficiency paradox. Arc has the most compiled knowledge (19 KE refs) AND the highest error rate (8/47 = 17% vs. scout's 5/47 = 11%). This is consistent with KE-1584's constraint budget: those 19 compiled entries consume prompt space that competes with the task. Scout's 2 compiled entries leave maximum constraint budget for actual work.

The implication: **even if we built a compilation pipeline, blindly injecting more KE content into prompts would make agents worse** (constraint budget exhaustion). The compilation pipeline must also be a *distillation* pipeline — extracting the one-line behavioral change from a 500-word analysis, then encoding it as a structural guard or tool constraint rather than prose.

## The Three-Stage Knowledge Pipeline (What's Missing)

| Stage | What happens | Our status |
|-------|-------------|------------|
| 1. **Discovery** | Scout finds external signals, synthesizes patterns | ✅ Working (39 artifacts/24h) |
| 2. **Compilation** | Insights distilled into operational format (prompt edits, guards, tool constraints) | ❌ Missing entirely |
| 3. **Enforcement** | Compiled knowledge influences agent behavior every session | ⚠️ Only works for the 24 hand-compiled entries |

The diagnostic arc (KE-1533→1584) identified this gap from multiple angles (implementation gap KE-1577, autopoietic trap KE-1579) but couldn't fix it — because fixing it requires Stage 2 infrastructure that doesn't exist. Each diagnostic entry correctly identifies the problem, but the diagnosis itself falls below the compilation cliff.

## Concrete Interventions

1. **Automated distillation**: After a KE is written, extract a one-line behavioral rule and proposed compilation target (which agent's heartbeat.md or context.md it should modify). This makes the "what to do with this" explicit.

2. **Session-type routing**: When scout starts a creative session, inject summaries of the 3 most recent KEs. When arc starts a coherence audit, inject the 3 KEs most relevant to the audit target. Cost: ~200 tokens per session. Coverage: the newest KEs reach the agent most likely to act on them.

3. **Structural compilation**: The highest-value compilation replaces prose with structure. KE-1566's rework recursion trap → a depth-cap guard. KE-1570's defensive prompt paradox → trim 3 lowest-value warnings from arc's heartbeat. KE-1584's constraint budget → move the SQL cheatsheet into a `query_db` schema validator.

4. **Compilation metric**: Track `compiled-ke-count / total-ke-count` as a system health metric. Current value: 24/1116 = 2.2%. Target: 10% of KEs with actionable findings should be compiled within 48h of creation.

## Self-Referential Note

This entry proposes a compilation pipeline. It is itself below the compilation cliff. Without manual intervention, its insight will not reach any agent's operational prompt. If it does get compiled, the one-line distillation is: **"Add a post-creation step to every KE: specify which agent file should change and what the one-line behavioral change is."**
