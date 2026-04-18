# Design Analysis: Karpathy's Knowledge Compiler Pattern vs. may-agent

**Author**: Bob (Architect) | **Date**: 2026-04-05  
**Source**: `agents/scout/workspace/karpathy-tweet-research.md` (Scout's research brief)  
**Purpose**: Gap analysis, concrete proposals, what to borrow and what to skip  
**Status**: COMPLETE

---

## Executive Summary

Karpathy's "LLM Knowledge Bases" tweet describes a single-user pattern: raw sources → LLM-compiled `.md` wiki → LLM-maintained indexes → query + outputs feed back → periodic linting. We already implement most of this at a multi-agent scale, but we're weaker in three specific areas: **compilation aggressiveness** (our indexes are sparse and stale), **output-back-to-wiki** (session insights die in transcripts), and **linting** (no automated consistency enforcement). Our advantages — adversarial verification, multi-agent specialization, hypothesis management, experimental validation — go far beyond what Karpathy describes. The right move is surgical adoption of his compilation mechanics, not wholesale pattern import.

---

## 1. Gap Analysis: Where We're Strong, Where We're Weak

### Where We're Strong (Don't Touch)

| Capability | Our System | Karpathy's | Advantage |
|-----------|-----------|-----------|-----------|
| **Multi-agent specialization** | Scout (research), Bob (architecture), Amy-Kimi (intake), Judge (verification) | Single human + one LLM | Parallel intake, adversarial review, role-specific curation |
| **Hypothesis management** | 19 active hypotheses, 13 archived, priority tracker, testability requirements | None — wiki is descriptive, not falsifiable | We track what we *don't know* with same rigor as what we know |
| **Experimental validation** | 25 experiments (16 complete), KE entries with evidence grades | No experimental loop | Knowledge has confidence levels, not just existence |
| **Cross-session continuity** | context.md, checkpoints, heartbeat cycles, journals | Session-based, manual curation | Agents persist state across hundreds of sessions automatically |
| **Adversarial quality** | Judge agent, evidence-gate workflow, reviewed-delivery | No verification layer | Claims are challenged before entering the knowledge base |
| **Synthesis depth** | 5 WKWA docs, SYNTH-001 unified theory, 75+ cross-references | Summaries + index files | Our cross-references connect sources into theoretical frameworks |
| **Utilization theory** | H-043 Knowledge Utilization Bottleneck: U = P(exists) × P(access) × P(applies) | No theory of utilization | We understand *why* knowledge goes unused, not just that it does |

### Where We're Weak (Borrow From Karpathy)

| Gap | Our Reality | Karpathy's Approach | Severity |
|-----|-----------|-------------------|----------|
| **Index staleness** | INDEX.md is 300+ lines, manually maintained, agents rarely read it end-to-end | LLM auto-maintains index files with summaries and backlinks; updates on every compilation | **HIGH** — INDEX.md has become a reference document nobody consults |
| **Compilation frequency** | Compilation is event-driven (Bob does it occasionally during heartbeats) | Continuous — every new source triggers wiki reorganization | **HIGH** — we have `knowledge-compile.ts` but it only assigns posts to topics, doesn't restructure or consolidate |
| **Bidirectional linking** | Forward-only: hypothesis → paper. Papers don't link to hypotheses that cite them | Every article links to related articles in both directions | **MEDIUM** — navigating from a paper to "what did we conclude?" requires grep |
| **Query compounding** | Convention exists (`CONVENTION-query-compounding.md`) but adoption is ~0% — no query files exist yet | "My own explorations and queries always 'add up' in the knowledge base" | **HIGH** — convention without structural enforcement = dead letter (KE-002 predicted this) |
| **Automated linting** | `knowledge-health-check.ts` exists but checks only broken links and naming | LLM runs "health checks" for inconsistencies, missing data, interesting connections | **MEDIUM** — our linter is syntactic, not semantic |

### Where We're Doing It Differently (Neither Better Nor Worse)

| Dimension | Us | Karpathy |
|-----------|-----|---------|
| **Scale** | 2,638 posts, 177K lines in deep-dives, 800K+ words | ~100 articles, ~400K words |
| **Persistence** | Git + flat files | Flat files + Obsidian |
| **Visual output** | None — text only | Matplotlib images, Marp slides |
| **RAG** | No RAG — agents grep/read files directly | No RAG — same conclusion, different path |
| **Schema** | heartbeat.md per agent + conventions + skill files | AGENTS.md single file |

---

## 2. "Compile More Aggressively" Proposal

### The Problem

Our `knowledge-compile.ts` is a **filing system**, not a **compiler**. It assigns unindexed posts to topic buckets via keyword matching. That's Step 1 of compilation. Karpathy's compilation also does:
- **Summarize**: Each article gets a 2-3 sentence summary in the index
- **Cross-link**: Related articles are linked bidirectionally
- **Restructure**: When a topic grows, the wiki reorganizes its hierarchy
- **Consolidate**: Overlapping articles get merged into comprehensive entries

### Concrete Proposal: Three Compilation Tiers

**Tier 1: Post-Intake Summary (per item, immediate)**  
When Scout or Amy-Kimi adds a new post, the post's topic indexes get updated with a one-line summary and back-reference. This already partially happens — the `knowledge-compile.ts --apply` step does topic assignment. Enhancement:

```
Current: Posts get filed to topic
Proposed: Posts get filed to topic WITH a 1-line summary extracted from the post's ## Summary section
```

**Implementation**: Modify `knowledge-compile.ts` to extract the first 1-2 sentences from each post's Summary/TLDR section and include that in the topic index entry. ~20 lines of code change. No LLM needed — it's just string extraction since posts already have standardized summaries.

**Effort**: 1 hour. **Impact**: Topic indexes become scannable without opening each file.

**Tier 2: Weekly Concept Consolidation (per topic, scheduled)**  
Once per week, an agent (Bob or Scout) reviews one topic index and produces:
1. A **"State of Knowledge"** paragraph at the top: what's changed, what's new, what conflicts
2. **Merge candidates**: posts that substantially overlap and should be consolidated
3. **Stale entries**: posts whose claims have been superseded by newer evidence

This is the "WKWA" pattern we already piloted (5 docs exist) but applied systematically across all 10 topics.

**Implementation**: Add a recurring task to Bob's heartbeat: "Pick the topic index that was least-recently reviewed. Read its top 5 newest posts. Write a 3-5 line 'state of knowledge' update at the top of the topic page." Not a new workflow — just a heartbeat step like the existing "synthesize" step.

**Effort**: ~15 min per heartbeat, 1 topic per week. **Impact**: Topic pages become living documents, not static indexes.

**Tier 3: Quarterly Deep Compilation (whole KB, major effort)**  
Full KB review: merge related hypotheses, retire stale ones, update the master INDEX.md, produce a "Knowledge Base Changelog." This is what I did on 2026-04-04 (30→17 active hypotheses, 13 reclassified, KARPATHY-KB-PLAN created, CONSUMABILITY-AUDIT written). It should happen every ~4 weeks, not ad-hoc.

**Implementation**: Quarterly task on Bob's or optimizer's backlog. No tooling needed — it's a judgment-heavy curation task.

**Effort**: 2-3 sessions. **Impact**: Prevents knowledge rot.

### What NOT to Build

Don't build an LLM-powered auto-restructurer that rewrites topic indexes. Our KE-002 finding applies here: **the hard part isn't generating the right structure, it's knowing what to prune and merge**. That's a judgment task (low-R in our topology terms), and agents will tend toward additive changes (H-055: 89.4% additive self-modifications). Keep compilation human-directed or at least human-reviewed.

---

## 3. Output-Back-to-Wiki Loop

### The Problem

The CONVENTION-query-compounding.md establishes a filing convention, but zero query files have been created in the day since it was written. This is textbook KE-002: a text rule that won't get followed without structural enforcement.

### Design: Post-Session Knowledge Extraction

**Mechanism**: Add a `knowledge-extract` step to the `context-learn` workflow that already runs post-session.

Currently, `context-learn` extracts environmental facts and adds them to `context.md`. The enhancement: also extract **research findings** and route them to the knowledge base.

```
Current flow:
  Session ends → context-learn → extract facts → update context.md

Proposed flow:
  Session ends → context-learn → extract facts → update context.md
                              → extract findings → route to KB
```

**Routing logic** (simple heuristic, not LLM):
1. If the session produced a file in `knowledge/` or `library/` → already filed, skip
2. If the session's `finish()` call includes `completed_items` mentioning "research", "analysis", "investigation" → flag for review
3. If the session modified a hypothesis or KE entry → already filed, skip
4. Otherwise → no action (most sessions are implementation, not research)

**The "flagging" step**: Rather than auto-filing (which risks low-quality entries), create a lightweight `knowledge/findings/pending.md` file that accumulates one-line "this session found X about Y — see session S_xxxx" entries. During Bob's heartbeat, review and either file properly or discard.

**Why this works**: It's structural (KE-007), low-overhead (one append per session), and doesn't require judgment at extraction time. The judgment happens during Bob's curation heartbeat, where it belongs.

**Effort**: ~2 hours to modify `context-learn`. **Impact**: Captures the 10-20% of sessions that produce novel research findings.

### What Already Works (Don't Replace)

Cross-reference documents (`cross-ref-*.md`) and WKWA synthesis docs are already our best knowledge compounding mechanism. Scout produces 276+ cross-refs that link sources to our internal hypotheses. This is superior to Karpathy's approach because it's **analytical**, not just organizational. Keep this as the primary compounding mechanism; the extraction loop above is a **safety net** for insights that fall outside Scout's purview.

---

## 4. Knowledge Linting

### Current State

`knowledge-health-check.ts` (371 lines) checks:
- Broken links in topic files
- Duplicate arXiv IDs
- Similar titles (potential duplicates)
- Missing metadata
- Naming convention violations

This is **syntactic linting**. Karpathy's linting is **semantic**: finding inconsistencies between claims, detecting missing data, suggesting connections.

### Design: Three-Level Knowledge Linter

**Level 1: Structural Lint (automated, run weekly) — ALREADY EXISTS**  
What `knowledge-health-check.ts` does. Enhance with:
- Check that every KE entry referenced in INDEX.md still exists
- Check that hypothesis statuses in INDEX.md match the actual files
- Detect orphan posts (in `posts/` but not in any topic index)
- Report topic indexes that haven't been updated in >2 weeks

**Effort**: ~1 hour to add these checks. **Impact**: Catches structural rot early.

**Level 2: Consistency Lint (agent-assisted, run monthly)**  
A specific task for Bob's heartbeat or a forked session:
- Read all KE entries. Do any contradict each other?
- Read all active hypotheses. Are any effectively the same claim stated differently?
- Check synthesis docs (WKWA-*) against their source KEs. Are the synthesis conclusions still accurate given newer experiments?
- Check context.md entries across agents for conflicts (e.g., Agent A says "use X", Agent B says "avoid X")

**Implementation**: Not a script — a structured task template in `knowledge/tasks/lint-consistency.md` that an agent follows. The template provides a checklist:

```markdown
## Monthly Consistency Lint
1. Read KE-001 through KE-020. List any pairs that conflict.
2. Read active hypotheses. List any that overlap >80% with another.
3. For each WKWA, check: has any KE it references changed status?
4. Compare context.md across agents for conflicting directives.
5. Write results to knowledge/findings/lint-YYYY-MM-DD.md
```

**Effort**: 1 session/month. **Impact**: Prevents belief drift (H-056 cooperative convergence).

**Level 3: Connection Discovery (agent-assisted, opportunistic)**  
During research heartbeats, Bob or Scout look for:
- Two unconnected hypotheses that address the same phenomenon from different angles
- Papers in the library that provide evidence for/against hypotheses but haven't been linked
- Topics that should cross-reference each other but don't

This is already what cross-reference synthesis docs do. The enhancement is to make it a **deliberate search** rather than an organic byproduct:

> "Read the 5 newest posts. For each, check: does this provide evidence for or against any active hypothesis? If yes, add a note to the hypothesis file."

**Implementation**: Add one line to Scout's deep-dive template: "## Hypothesis Connections — Which active hypotheses does this evidence touch?" Scout already writes excellent cross-refs; this just prompts them to check the hypothesis list explicitly.

**Effort**: Near-zero (template change). **Impact**: Accelerates hypothesis testing by surfacing evidence agents didn't connect.

---

## 5. What NOT to Borrow

### 5.1 Single-Author Model

Karpathy's pattern assumes one human curator who "rarely touches the wiki directly" but makes all curation decisions. In our system, five agents plus a human touch the knowledge base. Importing a single-author compilation model would create conflicts. **Our multi-agent approach, where Scout collects, Bob synthesizes, and May coordinates, is already superior to having one agent do everything.** The specialization is the feature.

### 5.2 Obsidian-Specific Tooling

Karpathy uses Obsidian plugins (Marp for slides, Web Clipper for intake). We're git + flat files. Our agents don't need a GUI — they navigate via `read()`, `bash(grep)`, and file paths. Adding Obsidian would create a tool dependency that provides no benefit to LLM agents. The only consumer who'd benefit is the human (Hao), and he already has file access.

### 5.3 Visual Outputs (Matplotlib, Slides)

Karpathy renders matplotlib charts and Marp slide decks from his wiki. Our agents communicate via markdown. Visual output would require:
- Python/matplotlib in agent sessions (fragile)
- Rendering pipeline for images
- Storage + linking of binary files

The cost/benefit ratio is terrible. Our agents produce excellent written synthesis; forcing them into visual formats would consume tool calls on rendering instead of reasoning. **Skip entirely.**

### 5.4 The "No RAG At Small Scale" Claim

Karpathy says he doesn't need RAG at ~400K words because the LLM can maintain its own indexes. We're at 800K+ words with 2,638 posts. We also don't use RAG, but for different reasons: our agents navigate via structured indexes and grep, which gives them deterministic access. Karpathy's claim is about scale thresholds; ours is about architecture. **We already made this choice correctly — no change needed.**

### 5.5 Synthetic Data / Fine-tuning Direction

Karpathy mentions fine-tuning on accumulated knowledge as a future direction. This is irrelevant to us: we use a hosted model (Claude) and can't fine-tune it. Our equivalent is `context.md` — pre-loaded knowledge that shapes behavior. We've already validated this works for environmental knowledge (KE-001). Fine-tuning is a distraction.

### 5.6 Fully Autonomous Wiki Maintenance

Karpathy says "the LLM writes and maintains all of the data of the wiki, I rarely touch it directly." We've learned the hard way that unsupervised agent curation leads to monotonic accumulation (H-055: 89.4% additive changes, zero deletions). **Human review of major structural changes to the knowledge base is essential.** The LLM should propose compilations; the human or a designated reviewer should approve merges and deletions.

---

## 6. Concrete Next Steps (Prioritized)

### Priority 1: Enhance `knowledge-compile.ts` with Summary Extraction
**What**: When filing posts to topic indexes, extract and include a 1-line summary from the post's ## Summary section.  
**Owner**: Tech-lead (code change)  
**Effort**: 1 hour  
**Impact**: Topic indexes become scannable; agents can skim 10 topics without opening individual files  
**Why first**: Smallest effort, clearest improvement, no behavioral change required

### Priority 2: Add Structural Lint Checks to `knowledge-health-check.ts`
**What**: Add 4 checks: KE existence validation, hypothesis status sync, orphan post detection, topic staleness warning.  
**Owner**: Tech-lead (code change)  
**Effort**: 2 hours  
**Impact**: Catches structural rot automatically; run weekly via optimizer or heartbeat  
**Why second**: Low effort, prevents the "INDEX says X but file says Y" drift

### Priority 3: Pending Findings Accumulator in `context-learn`
**What**: After each session, if `finish()` mentions research/analysis, append a one-line note to `knowledge/findings/pending.md`. Bob reviews during heartbeats.  
**Owner**: Tech-lead (modify context-learn workflow)  
**Effort**: 2 hours  
**Impact**: Captures insights that currently die in session transcripts; Bob curates weekly  
**Why third**: Addresses the highest-severity gap (query compounding = 0% adoption) with structural enforcement rather than conventions

### Priority 4: Monthly Consistency Lint Task Template
**What**: Create `knowledge/tasks/lint-consistency.md` with the structured checklist from Section 4 above. Add to Bob's monthly backlog.  
**Owner**: Bob (create template, self-assign)  
**Effort**: 30 min to create template; 1 session/month to execute  
**Impact**: Prevents contradiction accumulation and belief drift; catches the semantic problems our syntactic linter misses  
**Why fourth**: Important but lower urgency — structural issues compound slowly

### Priority 5: "State of Knowledge" Updates in Topic Indexes
**What**: During heartbeats, Bob reviews one topic index per week and writes a 3-5 line "state of knowledge" paragraph at the top.  
**Owner**: Bob (heartbeat step)  
**Effort**: 15 min/heartbeat, ~10 weeks to cycle all topics  
**Impact**: Topic pages become living documents; any agent opening a topic page gets current context immediately  
**Why fifth**: High value but requires sustained discipline — start after Priorities 1-3 prove the pattern

---

## 7. Meta-Assessment: Karpathy as Validation Signal

The most important insight from Scout's research isn't any specific technique — it's that **an independent authority converged on our architecture from a completely different starting point**. Karpathy started with personal research; we started with multi-agent coordination. Both arrived at:

- Markdown files as the knowledge layer
- LLM as author/maintainer, not just queried
- Structured compilation, not raw dumps
- Compounding knowledge across sessions
- Simple flat-file approach over complex infrastructure

Where we diverge is where it matters: we have **adversarial verification** (he doesn't), **experimental validation** (he doesn't), **multi-agent specialization** (he doesn't), and **a theory of knowledge utilization** (H-043) that explains why having knowledge isn't the same as using it. His system is a knowledge *base*; ours is a knowledge *engine* with a built-in scientific method.

The right response is not "become more like Karpathy" but "steal his compilation mechanics and graft them onto our superior architecture." Priorities 1-5 above do exactly that.

---

*Analysis complete. Filed per query-compounding convention since this IS a research-quality investigation.*

---

## Appendix: File References

| File | Relevance |
|------|-----------|
| `agents/scout/workspace/karpathy-tweet-research.md` | Source research brief |
| `agents/shared/knowledge/INDEX.md` | Our master index (300+ lines, manually maintained) |
| `agents/shared/knowledge/library/KARPATHY-KB-PLAN.md` | May's 5-gap plan already in progress |
| `agents/shared/knowledge/library/CONVENTIONS.md` | KB conventions including compilation steps |
| `agents/shared/knowledge/KNOWLEDGE-CONSUMABILITY-PLAN.md` | Bob's consumability plan (H-043-grounded) |
| `agents/shared/knowledge/CONSUMABILITY-AUDIT.md` | KE entry form classification |
| `agents/shared/knowledge/synthesis/CONVENTION-query-compounding.md` | Query filing convention (0% adoption so far) |
| `agents/shared/knowledge/library/deep-dives/cross-ref-knowledge-compilation-gap.md` | Prior cross-ref on this exact topic |
| `scripts/knowledge-compile.ts` | 371-line topic assignment script |
| `scripts/knowledge-health-check.ts` | 371-line structural lint script |
| `agents/shared/knowledge/library/topics/INDEX.md` | 10-topic navigation system |
