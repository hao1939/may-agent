# Finding: What Makes Lean Sessions Lean?

**Date**: 2026-04-13  
**Mode**: C — Skill & Technique Scouting  
**Dataset**: 390 successful sessions (last 24h), split into lean (≤15 ops, n=277), mid (16-50, n=95), bloated (>50, n=18)  
**Analysis**: 5 lean and 7 bloated sessions examined in detail via session.jsonl tool call sequences  

## Hypothesis

> Lean sessions front-load their plan and avoid exploratory file reads, while bloated sessions spiral in discovery loops.

**Verdict: Partially confirmed.** The discovery-spiral pattern is real, but the dominant factor is **delegation** — lean sessions spawn child sessions rather than doing work inline.

---

## Key Findings

### 1. Delegation Is the #1 Separator

| Metric | Lean (≤15 ops) | Bloated (>50 ops) |
|--------|----------------|-------------------|
| Sessions with children | 24 | 1 (of 18) |
| Avg parent ops when delegating | 3-9 | N/A — they don't delegate |
| Total child ops spawned | 21-69 per parent | N/A |

**Pattern**: Lean heartbeats read context (3-5 ops), identify work, then `agents(call)` to spawn a child session that does the actual work. The heartbeat itself stays lean. Bloated sessions attempt to do everything in a single session — context reading, analysis, investigation, and deliverable writing all inline.

**Example**: Optimizer heartbeat `s_1776009222915_2215` used 5 ops itself but spawned a child that used 55 ops. The work got done; the heartbeat stayed lean. Meanwhile `s_1776009266093_2221` (the child) did 55 ops of analysis work inline because it was already the delegated session.

**Implication**: Bloated heartbeats (scout 78 ops, coach 58 ops, optimizer 57 ops) are doing work that should be delegated. Work sessions, by contrast, are legitimately doing work — the question is whether they can break into sub-tasks.

### 2. Discovery Spirals in Bash

| Metric | Lean | Bloated |
|--------|------|---------|
| Max consecutive bash streak | 3-7 calls | 13-31 calls |
| Bash % of total calls | 30-68% | 80-93% |
| Search/grep calls | 0-12 | 10-25 |

Bloated sessions enter "discovery spirals" — sequences of 13-31 consecutive bash calls, mostly `grep`, `find`, and DB queries. Each result leads to another question. The session accumulates knowledge incrementally but doesn't synthesize or write until very late.

**Bloated bash categories (sampled)**:
- `s_1776002050846_2157`: 54 bash, of which 19 search + 12 DB queries = 57% discovery
- `s_1776003865427_2174`: 54 bash, of which 25 search = 46% pure file searching
- `s_1776009266093_2221`: 57 bash, of which 23 DB queries = 40% data mining

### 3. Late-Write Anti-Pattern

| Metric | Lean | Bloated |
|--------|------|---------|
| First write/edit position | 30-36% through session | 38-91% through session |
| Median first write | Position 4 of 11 | Position 54 of 76 |

Lean sessions write early — within the first 3-4 tool calls. They front-load just enough context to start producing, then iterate. Bloated sessions delay writing until they feel they've "fully understood" the space, leading to excessive pre-write exploration.

**Lean example**: `s_1776055959436_11` (5 ops) — read, read, read, **write**, bash, bash, bash, write, finish. Three reads, then immediately write.

**Bloated example**: `s_1776002093322_2160` (67 ops) — read, read, read, bash×39, read, bash×15, read, bash×2, checkpoint, bash×2, read, bash×3, read, agents, bash×2, read, bash, read×3, bash×2, **write**, read, edit×3. 76 reads/searches before first write.

---

## Three Concrete Techniques That Lean Sessions Use

### Technique 1: Delegate-Don't-Do (for heartbeats)
**What**: Read context (2-5 ops), identify work items, spawn child sessions via `agents(call)` or `agents(fork)`. Never do substantive analysis in the heartbeat itself.

**Evidence**: 24 lean sessions spawned children vs 1 bloated session. Average parent ops: 3-9. This is already the natural pattern for optimizer and tech-lead heartbeats but NOT for scout (0 children ever — fork broken) or coach heartbeats.

**Addressable bloat**: 5 of 18 bloated sessions are heartbeats that should have delegated (scout 78, coach 58, optimizer 57, optimizer 55, tech-lead 84 was a work session dispatched from heartbeat). Potential savings: ~200 ops/day shifted from heartbeats to properly-scoped child sessions.

### Technique 2: Write-Within-5 (for analysis sessions)
**What**: Produce your first write/edit within the first 5 tool calls. Start with a skeleton/outline, then fill in details. This prevents open-ended exploration.

**Evidence**: Lean sessions write at position 3-4 of ~11. Bloated sessions at position 21-76 of ~76. The act of writing early forces you to commit to a structure, which constrains subsequent queries to targeted gap-filling rather than open exploration.

**Anti-pattern addressed**: The "I need to understand everything before I write" mindset that leads to 20-30 consecutive bash calls of incremental discovery.

### Technique 3: Bash-Streak Circuit Breaker (for all sessions)
**What**: After 5 consecutive bash calls without a read/write/edit, stop and synthesize what you've learned into a write or checkpoint. Then decide if you need more discovery.

**Evidence**: Lean max bash streak: 3-7. Bloated max bash streak: 13-31. The inflection point appears to be around 7-8 consecutive bash calls — beyond that, each additional call has diminishing returns and often explores tangential questions.

**Mechanism**: This doesn't need to be enforced by tooling — it's a self-check pattern. "Have I done 5+ bash calls in a row? Time to write what I know."

---

## Task-Type Breakdown

Not all bloat is equal. Average ops by task type:

| Task Type | Count | Avg Ops | Bloated (>50) |
|-----------|-------|---------|---------------|
| heartbeat | 128 | 10.6 | 3 (2.3%) |
| experiment | 93 | 12.3 | 2 (2.2%) |
| optimizer_work | 52 | 19.7 | 5 (9.6%) |
| tech_lead_lens | 56 | 16.3 | 3 (5.4%) |
| work_session | 14 | 19.6 | 1 (7.1%) |

**Optimizer work sessions are the most bloat-prone** (9.6% >50 ops). This is because Mode A (Session Archaeology) and Mode B (Tool Gap Analysis) involve open-ended investigation. Mode D (Workflow Health) is naturally lean (13 ops) because it has a fixed checklist to work through.

---

## Agent-Level Patterns

| Agent | Avg Ops | Bloated % | Key Factor |
|-------|---------|-----------|------------|
| evaluator | 6.8 | 0% | Fixed task scope, schema-driven |
| qa | 9.5 | 0% | Fixed checklist, bounded audit |
| bob | 12.6 | 3.4% | Workflow phases enforce budgets |
| coach | 13.4 | 4.3% | Usually bounded, except investigations |
| may | 13.5 | 2.4% | Dispatch-focused, delegates well |
| scout | 14.6 | 3.7% | Post-fix; was 78 ops with inline research |
| tech-lead | 18.7 | 10.3% | Lens audits are open-ended |
| optimizer | 20.8 | 8.5% | Mode A/B encourage exploration |

**Bob's workflow phases enforce leanness**: Bob's workflow sessions average 7.8 ops vs 15.1 for direct sessions. The Phase 1/2/3 budget caps ("BUDGET: 15 TOOL CALLS MAX") are working as intended.

---

## Relationship to Existing Skills

| Skill | Lean Correlation | Notes |
|-------|-----------------|-------|
| `plan-once-amend` | Moderate | Lean sessions don't re-plan; they execute |
| `budget-before-act` | Strong | Bob's budget caps directly reduce ops |
| `deliverable-checklist` | Moderate | Forces early commitment to outputs |
| `state-check-before-action` | Weak | More about correctness than efficiency |

**Missing skill gap**: No existing skill addresses discovery-spiral prevention or write-early patterns. The closest is `budget-before-act` but it's budget-level, not technique-level.

---

## Recommendations

1. **Don't optimize heartbeat bloat by adding skip logic** (this was already tried and removed). Instead, ensure heartbeats delegate properly. The 5 bloated heartbeats in 24h are the real target.

2. **Consider a "Write-Within-5" pattern** for investigation sessions (Mode A, Mode B, Lens audits). This is a content-level addition to session instructions, not a structural change.

3. **Bash-streak awareness** could be added to agent context.md as a self-check heuristic. No tooling enforcement needed — just awareness that >5 consecutive bash calls is a signal to pause and write.

4. **Bob's workflow budget caps are a proven model** (7.8 avg ops vs 15.1 direct). Consider adapting this pattern for optimizer work sessions and tech-lead lens sessions.
