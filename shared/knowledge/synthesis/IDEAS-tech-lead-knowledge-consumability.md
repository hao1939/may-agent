# IDEAS: Knowledge Consumability — Infrastructure Perspective

**Author**: Tech-Lead | **Date**: 2026-04-04  
**Context**: H-043 (U ≈ 0.10-0.28), KNOWLEDGE-CONSUMABILITY-PLAN.md Phase 2.2  
**Requested by**: Hao — "What's technically feasible for task-aware knowledge injection?"

---

## The Current Injection Architecture

I traced through `manager.ts` to map exactly where knowledge enters an agent's context today:

### System Prompt (stable, KV-cache friendly)
1. **SOUL.md** — agent identity (~3-7KB)
2. **common-sense.md** — shared rules (~2KB)
3. **skills/*.md** — behavioral patches (varies: 2KB for optimizer, **94KB for coach**)
4. **Runtime environment** — paths, tool list (~500B)

### First User Message (per-session, volatile)
5. **Task history** — last 20 sessions (~4KB)
6. **Active recall** — failure pattern warnings (conditional)
7. **Checkpoint** — resume state (conditional)
8. **contextFiles** — per-agent config files (varies)
9. **context.md** — persistent learned facts (~1-2KB)
10. **The actual task** — heartbeat, delegation, etc.

**Total before task**: 12-100KB depending on agent (coach is the outlier at ~100KB from skills).

The key insight: **there is no knowledge-aware component anywhere in this pipeline.** The system tells agents `Knowledge index: knowledge/INDEX.md (read when you need references)` — a passive pointer that KE-011 confirmed agents ignore. The entire 4400-file knowledge base is behind a manual door that nobody opens.

---

## Three Approaches, Ranked by Feasibility

### Approach 1: Static Keyword→File Mapping (Trivial, Zero LLM Cost)

**What**: A JSON map from task keywords to knowledge file paths. When `buildSessionContext()` runs, scan the task text for keywords and prepend matching KE summaries.

```typescript
// knowledge-router.ts (conceptual)
const ROUTES: Record<string, string[]> = {
  "workflow":      ["KE-007-summary.md", "KE-015-summary.md"],
  "skill":         ["KE-002-summary.md", "KE-006-summary.md"],
  "experiment":    ["KE-010-summary.md"],
  "delegate":      ["KE-003-summary.md", "KE-013-summary.md"],
  "context.md":    ["KE-001-summary.md", "KE-004-summary.md"],
  "sycophancy":    ["KE-019-summary.md"],
};

function routeKnowledge(task: string, agent: string): string[] {
  const matches: Set<string> = new Set();
  for (const [keyword, files] of Object.entries(ROUTES)) {
    if (task.toLowerCase().includes(keyword)) {
      files.forEach(f => matches.add(f));
    }
  }
  return [...matches].slice(0, 3); // cap at 3 to limit bloat
}
```

**Where it hooks in**: Inside `buildSessionContext()`, after checkpoint injection and before returning:
```typescript
// After context.md loading (line ~600 in manager.ts)
const knowledgeSnippets = routeKnowledge(task, name);
if (knowledgeSnippets.length) {
  ctxLines.push('', '## Relevant Knowledge (auto-injected)');
  for (const snippet of knowledgeSnippets) { /* load and append */ }
}
```

**Pros**:
- Zero LLM cost. Zero latency.
- Lives in the first user message (volatile section), so no KV-cache impact.
- The audit already provides the mapping table (CONSUMABILITY-AUDIT.md "Cross-Reference" section).
- Easy to maintain: one JSON file that any agent can update.

**Cons**:
- Keyword matching is crude — "workflow" in "I investigated how workflows are architected" would trigger injection even if irrelevant.
- Doesn't handle novel task descriptions that use different vocabulary.
- Requires creating distilled "summary" versions of each KE (1-3 lines each).

**My assessment**: This is the right starting point. It's ~50 lines of code, zero risk, and we can measure P(access) improvement immediately. The keyword mapping from Bob's audit already exists. Build this first, measure, iterate.

### Approach 2: Agent-Type Profile Routing (Low Cost, More Targeted)

**What**: Instead of (or in addition to) keyword matching, use the agent name to inject a curated knowledge profile. Each agent gets a static list of 3-5 "always relevant" KE summaries.

```typescript
const AGENT_PROFILES: Record<string, string[]> = {
  "tech-lead": ["KE-007-summary.md", "KE-015-summary.md", "KE-013-summary.md"],
  "coach":     ["KE-002-summary.md", "KE-007-summary.md", "KE-010-summary.md"],
  "coder":     ["KE-001-summary.md", "KE-004-summary.md"],
  "optimizer": ["KE-003-summary.md", "KE-011-summary.md", "KE-013-summary.md"],
  "bob":       [],  // Bob reads everything anyway
  "scout":     [],  // Scout discovers, doesn't consume existing KEs
};
```

**Where it hooks in**: Same injection point. The agent profile is the "always" layer; keyword matching is the "sometimes" layer. Combined:

```
Injected knowledge = AGENT_PROFILE[agent] ∪ KEYWORD_MATCHES[task]  (capped at 5)
```

**Pros**:
- Addresses H-043 P2 (agent-specific utilization profiles).
- No keyword false positives — profile entries are always relevant.
- Curated by humans (Bob's audit already classifies per-agent needs).

**Cons**:
- Profile entries add to every session even when irrelevant to the specific task.
- But at 1-3 lines per KE summary × 3-5 entries = 15-75 lines → ~500-2000 bytes. Negligible vs current prompt sizes.

**My assessment**: Do this alongside Approach 1. The two are complementary and together they cover both "always relevant" and "task-relevant" knowledge. Still zero LLM cost.

### Approach 3: LLM-Based Classifier (High Cost, Highest Accuracy)

**What**: Before the agent session starts, make a cheap LLM call to classify the task and select relevant knowledge entries.

```typescript
async function classifyTask(task: string, candidateKEs: KESummary[]): Promise<string[]> {
  const response = await cheapModel.prompt(`
    Task: ${task}
    Available knowledge entries: ${candidateKEs.map(k => k.id + ': ' + k.oneLiner).join('\n')}
    Which 3-5 entries are most relevant? Return IDs only.
  `);
  return parseIds(response);
}
```

**Pros**:
- Handles novel vocabulary, semantic matching, indirect relevance.
- Could reason about task structure (e.g., "this task involves delegation even though it doesn't say 'delegate'").

**Cons**:
- **Adds latency to every session start** (~1-3s for a cheap model call).
- **Adds cost** (~$0.001-0.01 per session, but we have hundreds/day).
- **Breaks the deterministic flow** — LLM errors could inject irrelevant knowledge or miss critical entries.
- **KV-cache concern**: If injection varies per session (LLM non-determinism), the first user message changes more, but this is already the volatile section so no cache impact.
- **Circular dependency**: We'd need the LLM classifier to work reliably before we can improve knowledge consumption. But the classifier itself is an LLM task subject to the same utilization problems.

**My assessment**: Not worth it now. Approaches 1+2 will get us from U≈0.15 to probably U≈0.30-0.35 for minimal effort. The LLM classifier adds complexity for marginal accuracy improvement. Revisit in Phase 4 if static routing proves insufficient.

---

## Prompt Bloat: The Real Constraint

This is where I want to push back on the "inject more knowledge" framing.

### Current Token Budgets

| Agent | System Prompt | Session Context | Total Pre-Task | Room for Injection |
|-------|--------------|-----------------|---------------|-------------------|
| tech-lead | ~11KB | ~7KB | ~18KB | Plenty (~5KB safe) |
| coder | ~23KB | ~5KB | ~28KB | Moderate (~3KB safe) |
| coach | ~100KB | ~6KB | ~106KB | **Tight — already huge** |
| optimizer | ~9KB | ~5KB | ~14KB | Plenty (~5KB safe) |
| bob | ~12KB | ~7KB | ~19KB | Plenty (~5KB safe) |

Coach is the canary. At 94KB of skills alone, coach's prompt is already bloated. Adding more knowledge to coach would push us further into the "attention dilution" zone where the LLM starts ignoring later sections.

### The Injection Budget Rule

I'd propose a hard cap: **knowledge injection should add no more than 2KB (~500 tokens) per session.** That's:
- 3-5 KE summaries × 2-4 lines each × ~100 bytes/line = 600-2000 bytes
- Well within the "negligible" range for all agents
- Forces us to distill knowledge into one-liners (which is itself a utilization improvement — shorter = more likely read)

If we need to inject more than 2KB, that's a signal we should convert those entries to context.md (environmental form) or workflows (structural form) instead.

### Where Injection Lives Matters

The injection MUST go in the first user message (where `buildSessionContext` already lives), NOT in the system prompt. Reasons:
1. **KV-cache discipline**: System prompt must be identical across sessions for cache reads. Task-dependent injection would invalidate the cache.
2. **Recency bias**: LLMs attend more to recent context. Knowledge injected just before the task has higher P(applies) than knowledge buried in the system prompt.
3. **The session context section is already the "variable" part** — adding 500-2000 bytes there doesn't break any existing patterns.

---

## Concrete Implementation Plan

### Step 1: Create KE Summary Files (1 session, $0)

For each of the 16 KE entries, write a 1-3 line distilled summary. Store in `knowledge/summaries/`:

```
# KE-007: Only Workflows Change Behavior
55 experiments tested. Only 4 interventions succeeded — all were structural workflows.
Text rules, skills, SOUL.md edits, and negative examples have 0% success rate for behavioral change.
Action: When you need to change agent behavior, build a workflow, not a text rule.
```

~100-200 bytes each. 16 summaries = ~2-3KB total file.

### Step 2: Build knowledge-router.ts (~50 lines, 1 hour)

A pure function: `routeKnowledge(task: string, agentName: string) → string[]`
- Combines agent profile (always-inject) + keyword matching (task-inject)
- Returns file paths to relevant summaries, capped at 5
- No LLM, no network, no side effects

### Step 3: Hook into buildSessionContext() (~10 lines)

After context.md loading, before return:
```typescript
const snippets = routeKnowledge(task, name);
if (snippets.length > 0) {
  ctxLines.push('', '## Relevant Knowledge (auto-injected)');
  for (const path of snippets) {
    const content = loadFile(path);
    if (content) ctxLines.push(content);
  }
}
```

### Step 4: Measure (~1 week observation)

Track how often agents reference injected knowledge in their sessions. Compare quality on tasks where knowledge was injected vs. before injection existed. This is H-043's Phase 3.1 (utilization measurement).

### Estimated Impact

- **P(access)**: 0.3 → 0.7 for the 16 KE entries (they're now in the prompt, not behind a manual door)
- **P(applies)**: Stays at 0.5-0.8 for environmental knowledge (it's in the prompt but LLMs don't always follow)
- **U improvement**: From ~0.15 to ~0.35 — roughly what the consumability plan targets for Phase 1+2

---

## What Won't Work (and Why)

### "Just make INDEX.md better"

Bob's plan includes an INDEX.md restructure (Phase 1.3). I'm skeptical this alone moves the needle. Even a perfect INDEX.md requires the agent to:
1. Decide to read it (most don't — KE-011)
2. Scan 300+ lines to find what's relevant
3. Then go read the actual entry file
4. Then apply the knowledge

That's 4 voluntary steps. The whole point of injection is to skip steps 1-3. A better INDEX.md helps agents who already seek knowledge, but those aren't the ones causing the U≈0.15 problem.

### "Put everything in context.md"

context.md has U≈0.5, much better than declarative. But it has no concept of task-relevance — every fact is shown every session. If we promoted all 16 KEs to context.md, that's 16 × 2 lines = 32 extra lines per session, most of them irrelevant to any given task. That's wasteful and contributes to attention dilution.

The right strategy: promote 3-5 *universally relevant* facts to context.md (as Bob suggests), and use task-aware injection for the rest. The two mechanisms are complementary, not competitive.

### "Full RAG / vector search"

Overkill for 16 KE entries and ~60 knowledge files. Vector search makes sense at 10,000+ documents. At our scale, a hand-curated routing table is faster, cheaper, and more accurate than embedding-based retrieval. We can maintain it manually with minimal effort.

---

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Prompt bloat degrades task performance | Low (2KB is small) | Hard cap at 2KB injection; monitor session quality |
| False positive injection (irrelevant knowledge shown) | Medium | Cap at 3-5 entries; use agent profiles for precision |
| Maintenance burden of routing table | Low | Table is small (~20 entries); any agent can update it |
| Agents start "relying" on injection, stop reading knowledge files | Medium | This is actually fine — if injection works, we don't need agents to manually browse files |
| KV-cache invalidation | None | Injection goes in user message, not system prompt |

---

## Connection to Bob's Plan

This document covers **Phase 2.2** of the consumability plan (Knowledge Routing Layer). My proposal:
- Phase 1.2 (context.md promotion): Yes, do it. I'll adopt the relevant KEs into my context.md. ← Complementary to injection
- Phase 2.2 (routing layer): This document IS the design. Static routing, not LLM classifier. ~60 lines of code.
- Phase 3.2 (per-agent profiles): Already incorporated into Approach 2 above. Not a separate phase — it's part of the routing config.

**I'm ready to build Steps 2-3 (knowledge-router.ts + hook) whenever we have the KE summaries from Step 1.** Or I can write the summaries myself — each one takes 2 minutes.

---

## Summary

| Question | Answer |
|----------|--------|
| Task-aware injection feasible? | Yes. ~60 lines in manager.ts, zero LLM cost. |
| Best approach? | Static keyword→file mapping + agent profiles. Not LLM classifier. |
| Prompt bloat concern? | Real but manageable. 2KB hard cap. Goes in user message (volatile section). |
| Better INDEX.md enough? | No. INDEX.md requires agents to voluntarily seek knowledge, which is the exact behavior KE-011 says they don't do. |
| Expected U improvement? | 0.15 → 0.35 (matching consumability plan target). |
| What I need to start? | Distilled 1-3 line summaries of each KE entry. Can write these myself. |

---

*IDEAS-tech-lead-knowledge-consumability.md | Tech-Lead | 2026-04-04*
