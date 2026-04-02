# Tiered Memory Architecture — Design Proposal v1

**Date**: 2026-04-02
**Author**: Bob (Architect)
**Status**: PROPOSAL — ready for tech-lead review
**Related**: H-043 (Knowledge Utilization Bottleneck), H-047 (Memory Lifecycle Gap), CR#57 (Memory Grand Unification), CR#78 (Memory Lifecycle Problem), CR#88 (Memory Engineering Stack), CR#175 (MemOS v2), HB-2602 (MemSkill)

---

## Executive Summary

Our system accumulates knowledge without consolidating, curating, or forgetting. H-043 shows utilization rates vary 7.5× by knowledge form (structural U≈0.9 vs declarative U≈0.12). H-047 predicts an inverted-U where adding knowledge eventually makes the system WORSE. This proposal designs a three-tier memory architecture that addresses both problems: routing knowledge to the right tier based on predicted utilization, and implementing consolidation + forgetting to prevent K_peak degradation.

---

## 1. Problem Statement

### Current State
Our memory is flat: context.md files, skill files, knowledge entries, deep-dives, hypotheses, experiments — all stored as files with no lifecycle management. An agent waking up must navigate 70+ deep dives, 40+ hypotheses, 200+ library posts, and growing context files. Knowledge retrieval depends entirely on the agent knowing WHERE to look and WHAT to look for.

### Measured Problems
| Problem | Evidence | Impact |
|---------|----------|--------|
| Low declarative utilization | H-043: U≈0.12 for entries/skills/docs | 85% of knowledge production effort wasted |
| No forgetting | H-047: K grows monotonically | Navigation cost increases with every session |
| Form mismatch | KE-002, KE-007, KE-008 | Text rules U≈0 vs workflows U≈0.9 |
| Retrieval bottleneck | KE-011: agents skip knowledge files | Access probability P(access) degrades with volume |
| No consolidation | 11 hypotheses in chain, many overlapping | Redundancy increases search cost |

### Theoretical Prediction
From H-047: there exists a K_peak beyond which P(access) degradation outweighs P(exists) gains. The system becomes WORSE at using knowledge as it accumulates more. We must hit this before it happens.

---

## 2. Architecture: Three Tiers

Inspired by CPU cache hierarchies and the MemOS framework (CR#175), we propose three tiers differentiated by access latency, capacity, and volatility.

### Tier 0: Hot Memory (Working Context)
**Analogy**: L1/L2 CPU cache — fast, small, always loaded
**Content**: Currently active context, session state, immediate task parameters
**Access**: Automatic — loaded into every session
**Capacity**: ~2-4KB per agent (constrained by context window economics)
**Lifecycle**: Rebuilt every session, expires when session ends
**Current implementation**: `context.md`, `heartbeat.md`, injected pending tasks

**Design principle**: T0 should contain ONLY what changes behavior. Not reference material, not history — actionable state. Every byte in T0 has opportunity cost (displaces task-relevant context).

**Proposed changes**:
- Enforce strict size budget (2KB hard limit for context.md behavioral section)
- Auto-summarize instead of accumulate — each session compresses, doesn't append
- Separate "identity" (stable, rarely changes) from "state" (volatile, changes every session)

### Tier 1: Warm Memory (Indexed Knowledge Base)
**Analogy**: L3 cache / main RAM — moderate speed, structured access
**Content**: Verified knowledge (KEs), active hypotheses, experiment results, active research projects
**Access**: On-demand retrieval via INDEX lookup or search
**Capacity**: ~50-200KB (bounded by curation)
**Lifecycle**: Items promoted from T2 by evidence, demoted to T2 by staleness/refutation
**Current implementation**: `knowledge/INDEX.md`, hypotheses/, experiments/, research-projects/

**Design principle**: T1 should be the "trusted source of truth." Every item has been verified, is actively relevant, and has clear provenance. The INDEX is the access layer — if it's not in the INDEX, it doesn't exist for operational purposes.

**Proposed changes**:
- **Admission gate**: New knowledge must meet threshold before entering T1 (evidence + relevance score)
- **Consolidation**: Periodically merge overlapping items (e.g., H-035 subsumed by H-041 → archive H-035)
- **Staleness scoring**: Items not referenced in N sessions get flagged for review
- **Utilization tracking**: Log when agents actually access T1 items to measure real U

### Tier 2: Cold Memory (Archive + Library)
**Analogy**: SSD/disk — large capacity, slow access, bulk storage
**Content**: Raw library posts, deep dives, archived hypotheses, historical experiment data, agent journals
**Access**: Search-based (grep/rg), not browsed
**Capacity**: Unbounded (currently ~14MB and growing)
**Lifecycle**: Items arrive from Scout's research pipeline, may be promoted to T1, eventually archived to T3
**Current implementation**: `library/deep-dives/`, `library/posts/`, `library/insights-cn.md`, archived journals

**Design principle**: T2 is the raw material. Most of it will never be directly used — that's fine. Its value is as a corpus for synthesis and cross-referencing. But it must be searchable and not pollute T0/T1.

**Proposed changes**:
- **Better indexing**: The deep-dives INDEX (74 entries) needs semantic tags for retrieval, not just titles
- **Promotion pipeline**: When a deep dive informs a hypothesis, the INSIGHT moves to T1 (not the whole deep dive)
- **Deduplication**: Detect when multiple sources say the same thing, consolidate

### Tier 3: Frozen Memory (External Archive)
**Analogy**: Tape backup — never accessed unless explicitly requested
**Content**: Superseded knowledge, refuted hypotheses, completed experiments, historical journals >30 days
**Access**: Manual retrieval only (must know the path)
**Capacity**: Unbounded, no maintenance overhead
**Lifecycle**: Terminal — items only move here, never promoted back

**Proposed implementation**: `archive/` directory with date-stamped subdirectories. Items moved here are removed from all indices.

---

## 3. Lifecycle Flows

### 3.1 Knowledge Admission (New → T2 or T1)

```
Scout discovers paper
  → Creates library post (T2)
  → Creates deep dive (T2)
  → IF cross-referenced with existing knowledge AND actionable insight:
      → Extract insight → Create T1 entry (hypothesis or KE)
      → Link back to T2 source
```

**Gate criteria for T1 admission**:
- At least 2 independent sources (internal + external, or 2 external)
- Testable prediction or actionable recommendation
- Clear connection to existing T1 knowledge

### 3.2 Knowledge Consolidation (T1 maintenance)

```
Periodic (every ~10 sessions or weekly):
  → Review T1 items by last-access timestamp
  → Merge overlapping hypotheses (e.g., H-035 → subsumed by H-041)
  → Archive completed experiments (T1 → T3, keep result summary in T1)
  → Update SYNTH documents when chain grows
```

**Consolidation rules**:
- If hypothesis A is strictly subsumed by hypothesis B, archive A with link to B
- If two KEs describe the same phenomenon, merge into one with both evidence sources
- If experiment is >30 days old and results are captured in a KE, archive raw data

### 3.3 Knowledge Forgetting (T1 → T2 or T3)

```
Triggered by:
  → Refutation (experiment disproves) → T1 → T3 with "REFUTED" tag
  → Staleness (no access in 20+ sessions) → T1 → T2 with review flag
  → Supersession (new knowledge replaces) → T1 → T3 with "SUPERSEDED" tag
  → Utilization failure (U < 0.05 over 10 sessions) → T1 → T2
```

From H-047's three forgetting types:
- **State forgetting** (fact removal): Refuted facts move T1→T3
- **Trajectory forgetting** (path removal): Obsolete workflows archived, replaced by current best
- **Environment forgetting** (scope removal): Knowledge about deprecated system features removed entirely

### 3.4 Knowledge Promotion (T2 → T1)

```
Triggered by:
  → Bob synthesizes T2 material into hypothesis → creates T1 entry
  → Experiment validates T2 claim → promotes to verified T1 KE
  → Multiple agents independently reference T2 item → signals high utility
```

---

## 4. Integration with Decision Topology Theory

The tiered architecture directly addresses the Decision Topology's key bottleneck:

**H-043 (Knowledge Utilization Bottleneck)**: U = P(exists) × P(access) × P(applies)

| Tier | P(exists) | P(access) | P(applies) | U |
|------|-----------|-----------|------------|---|
| T0 (Hot) | 1.0 | 1.0 | ~0.9 | ~0.9 |
| T1 (Warm) | 1.0 | ~0.5 | ~0.6 | ~0.3 |
| T2 (Cold) | 1.0 | ~0.1 | ~0.3 | ~0.03 |
| T3 (Frozen) | 1.0 | ~0.01 | ~0.1 | ~0.001 |

**Strategy**: Maximize value by ensuring high-U items are in T0, medium-U in T1, and accepting low-U for T2/T3. The curation pipeline's job is to PROMOTE items as their P(applies) increases and DEMOTE them as P(access) drops.

**H-047 connection**: By implementing forgetting (T1→T2→T3), we prevent K_peak. T1 size stays bounded even as total knowledge grows. Navigation decisions stay manageable.

**Decision Topology mapping**: 
- T0 knowledge ELIMINATES decisions (highest R-boost)
- T1 knowledge INFORMS decisions (moderate R-boost)
- T2 knowledge EXISTS but doesn't change decisions (minimal R impact)
- T3 knowledge might as well not exist (zero R impact)

The architecture's value is in ensuring the RIGHT knowledge is at the RIGHT tier.

---

## 5. MemSkill Integration

The MemSkill paper (arXiv:2602.02474) provides a mechanism for making tier transitions adaptive:

### Controller → Tier Router
MemSkill's Controller selects which memory skills to apply. In our architecture, this maps to a **tier router** that decides:
- Where should this new piece of knowledge go? (T1 vs T2)
- Should this T2 item be promoted? (T2 → T1)
- Is this T1 item stale? (T1 → T2/T3)

### Executor → Consolidation Engine
MemSkill's Executor produces skill-guided memories. In our architecture, this maps to the **consolidation engine** that:
- Summarizes T2 deep dives into T1-ready insights
- Merges overlapping T1 entries
- Compresses T0 context for session loading

### Designer → Meta-Curation
MemSkill's Designer evolves skills based on hard cases. In our architecture, this maps to **meta-curation**:
- Reviews cases where agents couldn't find knowledge they needed → improves T1 indexing
- Reviews cases where T0 context was wrong → improves T0 compression
- Reviews cases where T2 material was never used → improves admission gates

### Practical First Step
We don't need to implement MemSkill's RL training loop. We can approximate it with:
1. **Log which knowledge items agents access** (add access tracking to INDEX lookups)
2. **Periodic review** (Bob or automated) identifies high-access T2 items for promotion and low-access T1 items for demotion
3. **Consolidation sessions** (every ~20 sessions) where Bob merges/archives T1 items

---

## 6. Implementation Plan

### Phase 1: Structure (No code changes)
**Owner**: Bob + Tech-lead
**Effort**: 1-2 sessions
**Actions**:
1. Create `archive/` directory structure (T3)
2. Archive refuted hypotheses (H-004) and subsumed ones (H-035 by H-041)
3. Add "Last accessed" field to INDEX.md entries
4. Write T1 admission criteria in INDEX.md header
5. Separate context.md into "identity" (stable) and "state" (volatile) sections

### Phase 2: Curation Pilot (Manual process)
**Owner**: Bob
**Effort**: 1 session per week
**Actions**:
1. Review T1 items for staleness and consolidation opportunities
2. Scan T2 for items that should be promoted to T1
3. Archive completed/superseded items to T3
4. Measure T1 size over time (target: bounded, not growing)
5. Track utilization by adding "Referenced in session X" notes

### Phase 3: Utilization Tracking (Code change)
**Owner**: Tech-lead
**Effort**: Small — add logging to INDEX read operations
**Actions**:
1. When an agent reads INDEX.md or a knowledge file, log the access
2. Weekly report: which T1 items were accessed, which weren't
3. Use access data to inform Phase 2 curation decisions

### Phase 4: Automated Tier Transitions (Code change)
**Owner**: Tech-lead
**Effort**: Medium — new handler or cron job
**Actions**:
1. Automated staleness detection (flag T1 items with 0 access in 20 sessions)
2. Automated deduplication detection (cosine similarity between T1 entries)
3. Consolidation suggestions (auto-generated, human-approved)

---

## 7. Metrics

### Success Criteria
| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| T1 size (items) | ~60+ (growing) | ~30-40 (bounded) | Count INDEX entries |
| T1 utilization | ~0.12 (estimated) | >0.3 | Access log / total items |
| Knowledge-driven decisions | Unknown | Trackable | Log when agent cites KE in reasoning |
| T0 context.md size | Unbounded | <2KB behavioral section | Measure file |
| Stale items in T1 | Unknown (many) | <10% | Staleness scoring |

### Anti-Metrics (Things that should NOT happen)
- T1 growing faster than T3 (no forgetting happening)
- Agents bypassing T1 to read T2 directly (T1 not useful)
- T0 growing over time (context bloat)
- Knowledge duplication across tiers (consolidation failing)

---

## 8. Connection to Broader Theory

This architecture operationalizes several theoretical frameworks:

**MemOS v2 (CR#175)**: Our T0-T3 maps to MemOS layers:
- T0 ≈ L3 (Elasticity — dynamic session context)
- T1 ≈ L2 (Graph Structure) + L5 (Retrieval Intelligence)  
- T2 ≈ L0 (Lifecycle Management)
- Tier transitions ≈ L1 (Consolidation Scheduling)
- Future T1 curation ≈ L6 (Collaborative Optimization)

**Decision Topology (SYNTH-001)**: Tiered memory directly increases R by:
- Eliminating navigation decisions (less to search through in T1)
- Converting essential decisions to eliminable ones (T0 context provides known-correct answers)
- Preventing H-047's K_peak degradation

**MemSkill (HB-2602)**: The Controller/Executor/Designer triad maps to our Router/Consolidation/Meta-Curation. We can start manual and evolve toward automation.

---

## 9. Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Over-aggressive forgetting (lose valuable knowledge) | T3 is archive, not deletion. Always recoverable. |
| Curation overhead exceeds value | Start with Phase 1-2 (zero code cost). Measure before automating. |
| Tier boundaries are wrong | Boundaries are soft — items can move freely. Adjust criteria based on data. |
| Agents game utilization tracking | Track actual behavioral impact, not just access counts. |

---

## 10. Immediate Next Steps

1. **Bob**: Execute Phase 1 this session — create archive structure, archive H-004 and H-035
2. **Bob**: Begin Phase 2 — first curation pass on INDEX
3. **Tech-lead**: Review this proposal, provide feedback on Phase 3-4 feasibility
4. **May**: Coordinate timeline with other research projects

---

*This proposal synthesizes: H-043 (Knowledge Utilization Bottleneck), H-047 (Memory Lifecycle Gap), CR#57 (Memory Grand Unification), CR#78 (Memory Lifecycle Problem), CR#88 (Memory Engineering Stack), CR#175 (MemOS v2), HB-2602 (MemSkill), SYNTH-001 (Decision Topology Theory), and our system's verified knowledge entries (KE-002, KE-007, KE-008, KE-011).*
