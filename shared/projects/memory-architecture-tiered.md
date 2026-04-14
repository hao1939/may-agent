# Research Project: Memory Architecture — Tiered Memory & Consolidation

**Status**: research  
**Owner**: Bob (architecture), Tech-lead (implementation)  
**Sources**:
- MetaClaw 5-type memory system
- BACKFILL-007 multi-agent memory architecture analysis
- OpenClaw "files are truth" philosophy  
- Amy-Kimi tiered memory research (HB-0502)
**Started**: 2026-04-02

---

## Core Problem

Our agents use flat context.md files that grow unboundedly. No differentiation between working memory (current session), short-term memory (recent sessions), and long-term knowledge (proven patterns). No consolidation or forgetting.

## Current State

- `context.md` per agent — flat fact list, manually curated
- `knowledge/` directories — long-form docs, never pruned
- `LESSONS.md` — append-only, never consolidated
- `workspace/` — working artifacts, manually cleaned

## Borrowable Ideas

### Idea 1: Three-Tier Memory (from Amy-Kimi research + MetaClaw)
**What**: Split into working memory (session), episodic memory (recent sessions), semantic memory (consolidated knowledge).
**Why it matters**: Working memory should be volatile (cleared each session). Episodic memory decays. Semantic memory is permanent but consolidated.
**Effort**: High — requires architectural changes to how agents load context.

### Idea 2: Memory Consolidation (from MetaClaw)
**What**: LLM periodically merges related facts, removes duplicates, strengthens frequently-accessed entries.
**Why it matters**: Our context.md files have obvious duplication and stale entries.
**Effort**: Medium — extend context-learn.ts with a consolidation pass.

### Idea 3: "Files Are Truth" Discipline (from OpenClaw)
**What**: The model remembers nothing between sessions. All state is on disk. Treat every file read as the source of truth.
**Why it matters**: We already follow this pattern but inconsistently. Some agents rely on compacted context from previous turns.
**Effort**: Low — this is a behavioral/prompt change.

## Findings Log

### 2026-03-16 — BACKFILL-007 analysis
- Compared 8 memory strategies across multi-agent literature
- Hierarchical memory consistently outperforms flat
- Distillation-based approaches (LLM summarizes → stores summary) beat raw storage

### 2026-04-02 — Amy-Kimi tiered memory post
- Working + short-term semantic + long-term knowledge tiers
- Semantic-aware retrieval: +40% efficiency vs keyword matching
- Key insight: retrieval quality matters more than storage quantity

### 2026-04-02 — OpenClaw memory philosophy
- "3 stages of maturity: survival → smooth → self-evolving"
- We're between survival and smooth
- Self-evolving requires automated memory management (our gap)

### 2026-04-06 — Hippo Memory (DD#559)
- **Most complete open-source implementation of biologically-inspired agent memory**
- Implements all 7 hippocampal mechanisms: two-speed learning, decay, retrieval strengthening, emotional tagging, sleep consolidation, schema acceleration, interference detection
- Architecture: Buffer (bounded, 20 max) → Episodic (7-day half-life, retrieval strengthening) → Semantic (consolidated patterns)
- SQLite backbone + markdown mirrors (git-trackable, human-readable)
- Cross-tool portability: imports from ChatGPT, CLAUDE.md, .cursorrules, any markdown
- Benchmark: 78% → 14% trap rate over 50-task sequence (vs static memory: no improvement)
- Key validation: **active forgetting improves agent performance** — directly addresses our "no forgetting" gap
- Confidence tiers (verified/observed/inferred/stale) provide epistemic metadata we currently lack
- See DD#559 for full analysis. Connects to DD#539 (MemCoder), DD#540 (Steve-Evolving), DD#545 (APEX-EM)

### 2026-04-07 — LLMA-Mem Lifelong Memory Scaling (DD#578)
- **LANDMARK finding**: Memory-enabled small teams outperform memory-less large teams under cost constraints
- **Memory-Parallelism Substitution Principle**: For fixed compute budgets, adding memory depth is more cost-effective than adding agents when tasks have high temporal correlation
- Supports multiple **memory topologies**: private, shared, hierarchical, selective sharing — optimal choice depends on task structure
- Non-monotonic scaling: larger teams DON'T always produce better long-term performance. Coordination overhead dominates.
- **Proposed scaling law**: Performance(N, M, t) ≈ f(N)·g(M,t) − h(N)·c(t) — memory reduces context degradation c(t), shifting optimal team size downward
- Validates our tiered architecture: hierarchical topology mirrors episodic→semantic consolidation
- Gap: no adversarial memory analysis (poisoning), no governance of what gets remembered, static topology selection
- **Key implication for OpenClaw**: Our ~4-agent architecture may be OPTIMAL if we invest in memory depth. This validates prioritizing memory infrastructure over adding more agents.
- See DD#578 for full analysis. Connects to DD#559 (Hippo), DD#567 (M-Flow), DD#469 (MemCollab), CR#290 (Scaling Paradox)

## Next Steps

1. **Design: What would tiered memory look like for us?**
   - Bob to propose architecture (builds on existing persistence.ts)
   - Consider: what goes in each tier? How does consolidation work? What triggers decay?
   - Hippo Memory (DD#559) provides a concrete reference implementation of all 7 mechanisms
   - Owner: Bob

2. **Quick win: Add consolidation to context-learn.ts**
   - Merge duplicate facts, remove stale entries (>30 days untouched)
   - Owner: Tech-lead

3. **NEW — Evaluate Hippo Memory as infrastructure** (R79)
   - Test `hippo sleep` consolidation on our context.md files
   - Measure decay + retrieval strengthening vs flat context
   - Assess cross-agent memory sharing for replacing manual curation
   - Owner: Tech-lead or Bob
