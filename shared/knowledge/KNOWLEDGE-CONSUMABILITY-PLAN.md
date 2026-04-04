# Knowledge Consumability Plan

**Author**: Bob (Architect) | **Date**: 2026-04-04  
**Requested by**: Hao (via May) | **Grounded in**: H-043, KE-002, KE-007, KE-011, KE-015, KE-018, KE-019, H-059, DD#514  
**Goal**: Make our knowledge base consumable by agents — not by archiving/deleting, but by improving delivery and discoverability.

---

## The Problem (30-second version)

We produce knowledge faster than we consume it. H-043 estimates utilization U ≈ 0.10-0.28: **70-90% of our knowledge exists but never reaches agents at decision time.** Adding more knowledge without fixing delivery has diminishing returns.

The root cause isn't that knowledge is bad — it's that **knowledge form determines utilization rate**:

| Knowledge Form | Utilization (U) | Example |
|---------------|-----------------|---------|
| Structural (workflow, code) | ~0.9 | code-review-loop forces review phase |
| Environmental (context.md) | ~0.5 | "sqlite3 not available" prevents wrong tool |
| Declarative — cadence | ~0.4-0.6 | "Write within first 3 tool calls" (H-059) |
| Declarative — judgment | ~0.03-0.05 | "verify after edit" — read but ignored (KE-002) |

Most of our knowledge base is declarative-judgment form. That's where U ≈ 0.05.

---

## Phase 1: Immediate Wins (This Week, $0)

### 1.1 Knowledge Entry Triage — Tag Every Entry by Delivery Form

**Owner**: Bob  
**Effort**: 1 session  
**What**: Go through all 16 KE entries + 41 skills and tag each with:
- **Current form**: structural / environmental / cadence-declarative / judgment-declarative
- **Optimal form**: what form would maximize U for this knowledge?
- **Conversion cost**: trivial / moderate / hard

This creates the roadmap for everything else. We can't improve what we haven't classified.

**Deliverable**: `knowledge/CONSUMABILITY-AUDIT.md` — a table of all knowledge items with form tags and conversion priorities.

### 1.2 Promote Top-5 Findings to context.md

**Owner**: Bob + Coach  
**Effort**: 30 minutes  
**What**: Identify the 5 most decision-relevant verified findings (KE entries) that agents should always have access to. Distill each into a 1-line context.md entry.

The evidence says environmental knowledge (context.md) has U ≈ 0.5 vs declarative U ≈ 0.05. Moving critical findings to context.md is a 10× utilization boost for free.

**Candidates** (preliminary):
1. KE-002: "Text rules don't fix judgment — use workflows for behavioral change" → all agents
2. KE-007: "Workflows are the only proven behavioral intervention" → tech-lead, coach
3. KE-015: "Decision topology R predicts workflow effectiveness — don't add workflows where R < 0.5" → tech-lead
4. KE-011: "Knowledge files are passive — agents skip them unless injected" → optimizer, tech-lead
5. KE-019: "Sycophancy requires materialization gates, not nudges" → coach

**Deliverable**: PRs to each agent's context.md with distilled KE findings.

### 1.3 INDEX.md Consumability Pass

**Owner**: Bob  
**Effort**: 1 session  
**What**: The INDEX is 300+ lines. No agent reads 300 lines on a heartbeat. Restructure INDEX.md with:
- **Top 10 facts every agent should know** (5-line summary at the top)
- **"What's changed since you last looked"** section (last 7 days of updates)
- **Topic-based navigation** (already exists via topics/ — make it more prominent)

The goal: an agent skimming INDEX.md in 30 seconds gets the 80% most important information.

**Deliverable**: Restructured INDEX.md with executive summary header.

---

## Phase 2: Structural Conversions (Next 2 Weeks, Low Cost)

### 2.1 Convert Behavioral KEs to Workflows

**Owner**: Tech-lead  
**Effort**: 1-2 sessions per conversion  
**What**: For each KE entry tagged "behavioral" in the audit (Phase 1.1), design a workflow enforcement. Priority order based on how often agents encounter the relevant decision:

| KE | Current Form | Target Form | Conversion |
|----|-------------|-------------|------------|
| KE-002 | Entry (declarative) | Already informed coach's workflow approach | Already applied |
| KE-007 | Entry (declarative) | Workflow selection heuristic | Code: when task has R > 0.5, suggest workflow |
| KE-011 | Entry (declarative) | Injection mechanism | Code: auto-prepend relevant KEs to prompts |
| KE-015 | Entry (declarative) | R-estimation step in workflow selection | Code: R-check before workflow assignment |
| KE-019 | Entry (declarative) | Materialization gate pattern | Workflow: strict gate for sycophancy-adjacent tasks |

Each conversion should be tested (A/B or gym) before deployment.

### 2.2 Knowledge Routing Layer (Lightweight)

**Owner**: Tech-lead + Optimizer  
**Effort**: 2-3 sessions  
**What**: Build a simple task→knowledge matcher that, given a task description, identifies 2-3 relevant knowledge entries and prepends them to the agent prompt.

**NOT** a full RAG system. Start with:
- Keyword matching: task contains "workflow" → inject KE-007, KE-015
- Agent-type matching: coder tasks → inject coder-relevant KEs; coach tasks → inject behavioral KEs
- Scenario matching: gym scenario name → inject relevant experiment results

H-043 Prediction P3 says this should double effective R growth rate. We can test it.

**Deliverable**: `src/lib/knowledge-router.ts` — a function that takes (task_description, agent_name) → returns relevant KE summaries.

### 2.3 "What We Know About" Synthesis Pipeline

**Owner**: Bob  
**Effort**: Ongoing (1 WKWA per week)  
**What**: Continue the WKWA synthesis series. Each WKWA distills scattered hypotheses/experiments/entries into one actionable guide. Current:
- WKWA-001: Behavioral Intervention ✅
- WKWA-002: Decision Topology ✅  
- WKWA-003: Self-Improvement Limits ✅
- WKWA-004: Memory Control Loop ✅

**Next priorities**:
- WKWA-005: Knowledge Consumability (this plan, formalized)
- WKWA-006: Evaluation Reliability (H-054, KE-005, DD#493)
- WKWA-007: Agent Cooperation Patterns (DD#505, DD#512, DD#513, CASCADE)

WKWAs are the highest-U form of our research output because they're (a) concise, (b) action-oriented, (c) referenced from INDEX.md.

---

## Phase 3: Active Knowledge Management (Month 2+, Moderate Cost)

### 3.1 Knowledge Freshness Tracking

**Owner**: Optimizer  
**Effort**: 2-3 sessions  
**What**: Add metadata to each knowledge entry:
- `last_accessed`: when an agent last read this entry
- `last_relevant`: when a session where this knowledge was relevant last occurred
- `utilization_score`: estimated U based on access patterns

Entries with low utilization get flagged for form conversion (Phase 2.1) or consolidation (merge into a WKWA).

**This is NOT deletion.** It's triage for improvement. Low-U entries need better delivery, not removal.

### 3.2 Per-Agent Knowledge Profiles

**Owner**: Bob + Tech-lead  
**Effort**: Design session + implementation  
**What**: H-043 Prediction P2 says P(access) varies by agent. Build agent-specific knowledge views:

| Agent | Primary Knowledge Needs | Delivery Method |
|-------|------------------------|-----------------|
| Coder | KE-001, KE-004, coding skills | context.md + workflow gates |
| Coach | KE-002, KE-007, KE-015, behavioral findings | context.md + experiment results injection |
| Optimizer | KE-003, KE-013, system metrics | Dashboard summaries |
| Bob | All hypotheses, library items | INDEX.md + topic pages |
| Tech-lead | Design decisions, KE entries | Briefs + knowledge routing |
| Scout | Library gaps, emerging research | Topic pages + research agenda |

Each agent's heartbeat or task prompt gets a curated knowledge injection instead of hoping they'll read INDEX.md.

### 3.3 Inspired by DD#514: Uncertainty Annotations

**Owner**: Bob  
**Effort**: Design proposal  
**What**: DD#514 (AI-Supervisor) uses uncertainty annotations U ∈ {0,1} on all knowledge graph nodes. We already have this implicitly (Verified / Adopted / Theoretical) but could make it explicit:

| Confidence | U | Criteria | Action |
|-----------|---|----------|--------|
| Verified | 0.0 | Experimental evidence, replicated | Trust and cite |
| Supported | 0.3 | Some evidence, not replicated | Use with caution |
| Proposed | 0.7 | Theoretical, untested | Don't rely on for decisions |
| Speculative | 1.0 | No evidence | Research pointer only |

Adding U-scores to INDEX.md entries helps agents quickly judge how much to trust each piece of knowledge.

---

## Phase 4: Aspirational (Quarter+)

### 4.1 Active Memory Management

Draw from WKWA-004's 4-layer memory architecture:
- **Layer 1** (CraniMem): Gated writes — not everything goes to long-term memory
- **Layer 2** (Store Routing): Route knowledge to the right store by type
- **Layer 3** (RCR-Router): Per-agent filtered views of the knowledge base
- **Layer 4** (Governed Memory): Quality enforcement, schema validation

### 4.2 Knowledge Compilation Pipeline

From cross-ref-knowledge-compilation-gap: the system accumulates knowledge 6× faster than it resolves it. Build an automated compilation step:
1. Merge redundant entries
2. Flag contradictions
3. Promote well-supported claims
4. Archive stale items

This is the "forgetting" mechanism H-047 predicts we need.

---

## Success Metrics

| Metric | Current | Target (Phase 1+2) | Target (Phase 3+4) |
|--------|---------|--------------------|--------------------|
| U (system-wide utilization) | ~0.15 (est.) | ~0.35 | ~0.60 |
| % of KEs in agent context.md | 0/16 = 0% | 5/16 = 31% | 10/16 = 62% |
| Agent knowledge access rate | Unknown | Measured via Phase 3.1 | Optimized |
| INDEX.md scan time | ~5 min (300 lines) | ~30 sec (top summary) | Personalized per agent |
| Time from KE creation to agent adoption | Unknown (often never) | < 7 days | < 2 days |

---

## Who Does What

| Agent | Phase 1 | Phase 2 | Phase 3 |
|-------|---------|---------|---------|
| **Bob** | 1.1 Audit, 1.2 Context promotion, 1.3 INDEX restructure | 2.3 WKWA pipeline | 3.2 Agent profiles (design), 3.3 U-annotations |
| **Tech-lead** | — | 2.1 Workflow conversions, 2.2 Knowledge routing | 3.2 Agent profiles (impl) |
| **Coach** | 1.2 Context promotion (review) | — | 3.1 Utilization tracking (behavioral entries) |
| **Optimizer** | — | — | 3.1 Freshness tracking |
| **Scout** | — | — | Feed knowledge routing with topic tags |

---

## Connection to Theory

This plan operationalizes H-043's core insight: **the bottleneck is delivery, not production**. Every phase targets one component of U = P(exists) × P(access) × P(applies):

- **Phase 1**: Increases P(access) by putting knowledge where agents already look (context.md, INDEX header)
- **Phase 2**: Increases P(applies) by converting declarative knowledge to structural/environmental form
- **Phase 3**: Creates measurement infrastructure so we can track U and optimize systematically
- **Phase 4**: Builds the automated machinery to maintain high U as the knowledge base grows

H-059 (cadence skills) showed us that knowledge form matters more than content. This plan applies that lesson system-wide.

---

*Plan v1.0 | Bob (Architect) | 2026-04-04 | Grounded in H-043, 16 KE entries, 25 experiments, DD#514*
