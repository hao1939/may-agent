# Finding: Skill & Technique Scouting — High-Performer Analysis (Apr 15)

**Date**: 2026-04-15  
**Mode**: C — Skill & Technique Scouting  
**Dataset**: 364 sessions (last 24h), 5,387 total ops, 8 agents  
**Prior art**: finding-fast-vs-slow-session-techniques-0414, finding-lean-vs-bloated-techniques-0413, finding-skills-adoption-audit-0412

---

## Executive Summary

Across 364 sessions in 24h, three agents (evaluator, QA, scout) are consistently lean (avg 4.9–6.8 ops, 96–100% lean rate). Five agents (coach, optimizer, bob, coder, tech-lead) have bimodal distributions — many lean sessions but occasional costly outliers that dominate total ops. The top 3 technique patterns that distinguish lean from bloated performance are: **(1) Task-Scoped Context Injection** (pushing data into tasks → −63% ops), **(2) Structured Delegation with Budgets** (bob's research workflow pattern), and **(3) JS Handler Replacement** for trivial heartbeats (evaluator pattern → ~250 ops/day savings).

Total addressable waste: **~1,872 ops/day (35% of total)** concentrated in bloated call sessions (1,122 ops) and bloated job sessions (750 ops).

---

## 1. Agent Performance Tiers (24h)

| Tier | Agents | Avg Ops | % Lean (≤12) | Total Ops | % of System |
|------|--------|---------|-------------|-----------|-------------|
| **Consistently Lean** | evaluator, QA, scout | 4.9–6.8 | 96–100% | 525 | 10% |
| **Bimodal** | coach, optimizer, bob | 13.4–16.1 | 51–73% | 2,623 | 49% |
| **Bloat-Heavy** | coder, tech-lead, may | 19.4–27.8 | 50–79% | 2,239 | 42% |

**Key observation**: The "bimodal" agents aren't uniformly inefficient — they have *both* lean patterns and bloated patterns within the same agent. Coach has 34 lean heartbeats (avg 4.6 ops) but 3 call sessions averaging 42.3 ops. The technique difference is what matters, not the agent identity.

### What Lean Agents Do Right

**Evaluator** (avg 4.9, 100% lean): Heartbeat-only workload. Reads heartbeat.md → checks DB for pending evaluations → exits. No exploration, no writing. Every session follows the identical 3-step path. **Technique: Fixed checklist, no branching logic.**

**QA** (avg 6.5, 100% lean): Similar fixed pattern. Read heartbeat → check recent commits → run verification → report. Even call sessions (verification tasks) stay at 6-8 ops because the scope is pre-defined by the caller.

**Scout** (avg 6.8, 96% lean): 27 of 28 sessions ≤12 ops. One outlier at 27 ops. Scout's lean heartbeats read context, check feeds, write findings. The key: scout writes *immediately* after reading — no discovery spirals.

---

## 2. Top 3 Technique Patterns

### Pattern 1: Task-Scoped Context Injection (−63% ops)

**What it is**: The parent session pre-loads relevant data directly into the child task description, eliminating the child's need to discover/read source files.

**Evidence (from 0414 finding, revalidated)**:
- Sessions with data inline: **9.6 avg ops**
- Sessions without data inline: **26.3 avg ops**
- Savings: **16.7 ops per session (−63%)**

**Where it's already working**: Bob's research workflow injects thread context into each child call. Research threads average **8 ops**. Synthesis calls with data-in-task average **5 ops**.

**Where it's NOT working**: Coach experiment work sessions, tech-lead implementation tasks, optimizer archaeology sessions. These receive task descriptions with file paths to read rather than pre-digested data.

**Skill deployment candidate**: A "push-data-into-dispatch" skill that modifies how agents construct `agents(call)` task descriptions. However, this is better implemented as a **dispatcher code change** than a text skill (per KE-002: text rules fail for judgment, KE-011: skills are passive).

**Estimated impact**: If applied to the 13 bloated bob call sessions (avg 43.2 ops) and 6 bloated tech-lead call sessions (avg 41.5 ops), saving ~15 ops each = **~285 ops/day**.

### Pattern 2: Structured Delegation with Budgets (bob's research pattern)

**What it is**: Bob's research workflow breaks open-ended research into a fixed structure:
1. Parent dispatches N parallel research threads (each budgeted ≤15 ops)
2. Threads run in parallel, each scoped to 1–2 documents
3. Parent dispatches a synthesis call (budgeted ≤15 ops) with thread outputs inline

**Evidence**:
- Bob research threads: **avg 8 ops** (range 4–21)
- Bob synthesis calls: **avg 5–6 ops** (with budget)
- Bob unstructured design tasks: **avg 69 ops** (when no workflow structure)

**Where it's already working**: Bob's deep research sessions (kind=call) that mention "Research Thread" or "Research Synthesis" — 13 sessions, avg 8 ops, all within budget.

**Where it's NOT working**: 
- Coach experiment sessions (35–73 ops) that could be decomposed into setup → run → analyze phases
- Tech-lead implementation sessions (52–272 ops) that could be decomposed into design → implement → verify phases
- Optimizer archaeology sessions that do discovery + analysis + writing all inline

**Skill deployment candidate**: The research-thread pattern is already a workflow (`research-parallel`). The technique should be **generalized to a "decompose-before-execute" dispatcher pattern** for any task estimated at >20 ops.

**Estimated impact**: If tech-lead's 8 bloated job sessions (avg 69.5 ops) were decomposed into 3–4 child sessions of ~15 ops each, net savings would be ~15 ops per session (overhead of parent coordination). **~120 ops/day**.

### Pattern 3: JS Handler Replacement for Trivial Heartbeats

**What it is**: Replace LLM-powered heartbeats that do trivial checks (DB queries, file existence) with deterministic JS handlers that only spawn LLM sessions when there's actual work.

**Evidence**:
- Evaluator: 28 LLM sessions/day × 4.9 avg ops = **137 ops/day for zero value** (100% skipped verdicts)
- The evaluator-heartbeat-waste finding (0415) documents: every session ends with `meta_agent_skipped`, 0% good rate
- Pattern already proven: `heartbeat-context.ts` JS handler successfully handles scout context management without LLM

**Where to apply**:
1. **Evaluator heartbeat** → JS handler (check DB staleness, spawn LLM only for calibration work). Savings: ~137 ops/day
2. **QA heartbeat** → Partial JS handler (check git log, spawn LLM only when new commits detected). Savings: ~100 ops/day (30 sessions × ~3.3 ops saved)
3. **Coach heartbeat** when idle (2-op sessions = 18 of 34 lean sessions = read heartbeat, find nothing, exit). JS pre-filter could skip LLM for 50% of coach heartbeats. Savings: ~36 ops/day

**Total estimated savings**: **~250 ops/day** from JS handler migration.

---

## 3. Skill Deployment Recommendations

### Recommendation A: Do NOT deploy new text skills

**Rationale**: The skills adoption audit (0412) found that 50% of shared skills are dead weight. Text skills have 0% success for judgment failures (KE-002). The three patterns above are all **structural/code changes**, not behavioral nudges.

Specifically:
- Pattern 1 (context injection) → Change dispatcher code, not agent behavior
- Pattern 2 (structured delegation) → Extend workflow system, not skill files
- Pattern 3 (JS handlers) → Replace LLM sessions with code, not instruct LLM differently

### Recommendation B: Extend research-parallel workflow to other agents

Bob's research workflow is the single most effective cost-reduction mechanism in the system. It achieves 8 avg ops per thread by combining all three patterns (context injection + budget + scoped deliverable). 

**Action**: Create a generalized `task-decomposition` workflow that:
1. Takes an open-ended task
2. Decomposes into 2–4 scoped sub-tasks with budgets and named deliverables
3. Dispatches sub-tasks as child sessions
4. Synthesizes results

**Target agents**: coach (experiment execution), tech-lead (implementation tasks), optimizer (archaeology/analysis).

### Recommendation C: Implement evaluator JS handler (quick win)

The evaluator JS handler replacement is the highest-confidence, lowest-risk optimization:
- **Savings**: ~137–250 ops/day
- **Risk**: Low (evaluator rarely has LLM-worthy work)
- **Effort**: ~2h implementation (follow heartbeat-context.ts pattern)
- **Rollback**: Change cron.json back to heartbeat type

### Recommendation D: Sunset dead skills

The skills adoption audit identified 29 skills (50%) as dead weight. Removing or archiving them would:
- Reduce LIBRARY.md noise
- Prevent accidental deployment of disproven skills
- Signal that the skill system is curated, not accumulated

**Priority targets**: 6 completely unreferenced skills (constructive-friction, critical-pause, experiment-before-apply, extract-directives, synthesis-dpir, verify-before-finish-micro).

---

## 4. Evidence Summary

| Data Point | Value | Source |
|-----------|-------|--------|
| Total sessions (24h) | 364 | may.db sessions table |
| Total ops (24h) | 5,387 | may.db sessions table |
| Lean session threshold | ≤12 ops | Standard definition |
| Evaluator avg ops | 4.9 | 28 sessions, 100% lean |
| QA avg ops | 6.5 | 30 sessions, 100% lean |
| Scout avg ops | 6.8 | 28 sessions, 96% lean |
| Bob research threads avg | 8 ops | 13 sessions with "Research Thread" |
| Data-in-task effect | −63% ops | 0414 finding, revalidated |
| Budget effect | −25% ops | 0414 finding, revalidated |
| Skills dead weight ratio | 50% | 0412 adoption audit |
| Evaluator zero-value rate | 100% | 0415 waste finding |

### Cross-Reference with Scout Research

DD#597 (Single-Agent Outperforms Multi-Agent) validates Pattern 2: multi-agent delegation only wins when context exceeds effective window or compute is flexible. Bob's research pattern works because each thread gets a *focused* context window (1–2 documents) that a single agent handles efficiently.

DD#598 (Context Engineering) validates Pattern 1: context completeness reduces iteration cycles by 47%. Pre-loading data into task descriptions is exactly the "Metadata" role in the AECRM framework — the most impactful and most often missing context component.

---

## 5. Priority Ranking

| # | Action | Impact (ops/day) | Effort | Confidence |
|---|--------|-------------------|--------|------------|
| 1 | Evaluator JS handler | ~137–250 | Low (2h) | High |
| 2 | Push data into dispatch calls | ~285 | Medium | High |
| 3 | Generalize research-parallel workflow | ~120 | Medium-High | Medium |
| 4 | Sunset dead skills | Indirect (clarity) | Low (1h) | High |

**Total addressable**: ~540–655 ops/day (10–12% of system total), with high confidence on items 1–2.
