# Knowledge System Audit — Complexity vs. Value

**Date**: 2026-04-13  
**Lens**: Full end-to-end trace of how knowledge flows through the system  
**Method**: Read every source file, counted storage, traced call paths

---

## Executive Summary

The knowledge system has **7 distinct subsystems** across **5,407 files (45MB)** of knowledge artifacts. Only **3 subsystems are actively wired** into agent sessions. The research-db/SQLite pipeline syncs data that nothing queries. The `library/` directory (35MB — 78% of all knowledge storage) is never read by any TypeScript code. The active path is sound but the dormant mass creates maintenance burden and cognitive overhead.

---

## Architecture Map

```
Session Start
  │
  ├─ System Prompt (static, cache-friendly)
  │   ├─ SOUL.md (per-agent identity)
  │   ├─ common-sense.md (shared rules)
  │   ├─ standing-orders.md (direct orders)
  │   ├─ knowledge-essentials.md ◄─── TIER 1: ~25 lines, always injected
  │   └─ skills/*.md (behavioral patches)
  │
  ├─ Session Context (first user message, volatile)
  │   ├─ context.md ◄─── Written by context-learn post-session
  │   ├─ memory.jsonl (episodic, last N entries)
  │   ├─ active-recall warnings ◄─── From ERROR_LOG.jsonl
  │   ├─ routeKnowledge() ◄─── TIER 2: 1-3 bullets from knowledge-index.json
  │   └─ routeFewShotExamples() ◄─── Regex-triggered examples (coder/optimizer only)
  │
  └─ On-demand reads ◄─── TIER 3: Agent reads knowledge/*.md during session
```

### Post-Session Learning
```
session_end → evaluateTask → bus.emit("context-learn")
  → learnFromSessionLLM() [primary] / learnFromSession() [mechanical fallback]
    → writes agents/<name>/context.md
      → loaded next session as "What You Know" section
```

---

## The 7 Subsystems

### 1. Knowledge Essentials (ACTIVE ✅)
- **File**: `agents/shared/knowledge-essentials.md`
- **Injected**: Always, in system prompt (Tier 1)
- **Size**: ~25 lines, manually curated
- **Verdict**: Clean, valuable. The right approach for universal truths.

### 2. Knowledge Router (ACTIVE ✅)
- **Files**: `src/lib/knowledge-router.ts` + `agents/shared/knowledge/knowledge-index.json`
- **Injected**: Per-task, in session context (Tier 2)
- **Coverage**: 60 entries indexed out of 162 entries total (37% coverage)
- **How it works**: Keyword matching against task text → returns 1-3 one-line summaries
- **Cost**: ~50 tokens per session
- **Verdict**: Good mechanism, but 63% of entries are unreachable through routing.

### 3. Few-Shot Router (ACTIVE ✅)
- **Files**: `src/lib/fewshot-router.ts` + `agents/shared/knowledge/fewshot-examples/` (6 files)
- **Injected**: Per-task, in session context (coder + optimizer agents only)
- **How it works**: Regex patterns on task text → inject full example sessions
- **Verdict**: Phase 1 scope, working correctly. Could expand to more agents later.

### 4. Active Recall (ACTIVE ✅)
- **File**: `src/lib/active-recall.ts`
- **Injected**: Per-session, warnings in session context
- **How it works**: Reads `ERROR_LOG.jsonl` per agent, surfaces recent failure patterns
- **Verdict**: Clean, useful safety net.

### 5. Context Learning (ACTIVE ✅)
- **File**: `src/lib/context-learn.ts`
- **Triggered**: Post-session via event bus from `may.ts`
- **Output**: `agents/<name>/context.md` (1-2KB per agent)
- **Verdict**: Well-structured with LLM + mechanical fallback. The main feedback loop.

### 6. Research DB / SQLite Sync (DEAD CODE 🗑️)
- **Files**: `src/lib/research-db.ts` + `agents/may/handlers/research-sync.ts`
- **What it does**: Syncs 162 entries + 93 hypotheses + 450 experiments to SQLite every 30min
- **Who reads it**: **Nobody.** The 5 query functions (`queryKnowledgeEntries`, `queryHypotheses`, `queryExperiments`, `getResearchSummary`, `findRelatedWork`) are **never called** from outside `research-db.ts`.
- **References**: `growth.ts` and `manager.ts` reference the DB tables in schema creation, but the query functions have zero callers.
- **Verdict**: **Dead pipeline.** Syncing ~700 files into SQLite for queries that nobody runs. The cron job consumes CPU and disk every 30 minutes for nothing.

### 7. Knowledge Library (DEAD WEIGHT 🗑️)
- **Path**: `agents/shared/knowledge/library/`
- **Size**: **35MB, 4,501 files** (78% of all knowledge storage)
- **Code references**: Zero TypeScript files import or read from this directory.
- **Agent references**: Referenced in amy-kimi's SOUL.md, context.md, and heartbeat.md. Some optimizer workspace docs mention it.
- **Contains**: insights-archive files, deep-dives, cross-references, Karpathy KB plans, health check scripts, covered_ids.txt, dedup reports
- **Verdict**: **Historical archive, not a live system.** No runtime code reads it. If amy-kimi needs library access, she reads the files directly during sessions (Tier 3). But nothing routes agents to these files, so they're only discovered by accident.

---

## Dormant Storage Breakdown

| Directory | Files | Size | Read by code? | Read by agents? |
|-----------|-------|------|---------------|-----------------|
| entries/ | 162 | 1.6MB | research-db (sync only) | Tier 2 (37%), Tier 3 |
| experiments/ | 450 | 6.2MB | research-db (sync only) | Tier 3 only |
| hypotheses/ | 93 | 1.1MB | research-db (sync only) | Tier 3 only |
| findings/ | 150 | 652K | **Never** | Tier 3 only |
| library/ | 4,501 | 35MB | **Never** | Occasionally (amy-kimi) |
| synthesis/ | 27 | 436K | **Never** | Tier 3 only |
| topic-index/ | ~10 | ? | **Never** | Tier 3 only |
| INDEX.md | 1 | 32K (737 lines) | **Never** | Tier 3 only |
| conventions/ | ~1 | 8K | **Never** | Tier 3 only |

The INDEX.md (737 lines) partially overlaps with knowledge-index.json (60 entries). Both index the same entries/ directory. INDEX.md is for human/agent reading; knowledge-index.json is for the router.

---

## Key Problems

### Problem 1: 63% of entries unreachable via routing
The knowledge-index.json only covers 60/162 entries. The other 102 are only discoverable if an agent happens to read INDEX.md or browse the entries/ directory. This means most verified knowledge never reaches agents automatically.

**Impact**: Medium. The existing audit (KNOWLEDGE-APPLICATION-AUDIT.md) already found 76.8% dormancy.

### Problem 2: Research DB is a write-only pipeline
`research-sync` runs every 30 minutes, parsing ~700 markdown files and upserting them into SQLite. But the 5 query functions have zero callers. This is a perfect example of speculative infrastructure — built for a future that hasn't materialized.

**Impact**: Low (wastes some CPU) but high cognitive overhead (3 source files, 1 handler, 5 query functions, 3 DB tables, cron entry — all dead).

### Problem 3: library/ is 78% of knowledge storage with zero code integration
35MB of files that no runtime code reads. Even the agents who reference it (amy-kimi) have no systematic way to discover relevant content — they'd have to browse thousands of files.

**Impact**: Disk only, but it inflates the perception of the knowledge system's complexity.

### Problem 4: Duplicate indexing (INDEX.md vs. knowledge-index.json)
Two parallel indexes for the same entries. INDEX.md is manually maintained (737 lines); knowledge-index.json is also manually maintained (60 entries). They can drift apart. Neither is auto-generated from the other.

**Impact**: Low but a maintenance trap.

---

## Recommendations

### Immediate (safe, obvious wins):

1. **Disable research-sync cron job** — Set `enabled: false` in the cron config. The data it produces has zero consumers. Can re-enable if/when someone builds query features.

2. **Archive library/ to a separate location** — Move 35MB of files to `agents/shared/knowledge/archive/library/` or a git-ignored backup. No runtime code will break.

3. **Archive findings/, synthesis/, topic-index/** — Same story. Zero code readers.

### Medium-term (one session each):

4. **Expand knowledge-index.json** from 60 to cover all 162 entries — Or at least the verified ones. This is the actual value lever: more entries indexed = more knowledge reaching agents automatically.

5. **Auto-generate knowledge-index.json from entries/** — A build-time script that reads entry headers and produces the JSON index. Eliminates the INDEX.md ↔ knowledge-index.json drift problem and the manual maintenance burden.

6. **Delete research-db.ts** — If research-sync stays disabled for a month with no complaints, remove the code, the cron handler, and the DB tables.

### Architecture note:

The 3-tier knowledge delivery model (essentials → routed → on-demand) is sound. The problem isn't the architecture — it's the accumulated dead weight around it. The active subsystems (knowledge-essentials, knowledge-router, fewshot-router, active-recall, context-learn) are well-designed and working. The dead weight (research-db, library/, findings/, synthesis/) creates the illusion of a much more complex system than what's actually running.

---

## Lines of Code in Active vs. Dead Knowledge Subsystems

| Subsystem | LoC | Status |
|-----------|-----|--------|
| knowledge-router.ts | ~80 | ACTIVE |
| fewshot-router.ts | ~70 | ACTIVE |
| active-recall.ts | ~90 | ACTIVE |
| context-learn.ts | ~360 | ACTIVE |
| research-db.ts | ~200 | DEAD |
| research-sync.ts (handler) | ~50 | DEAD |
| **Total active** | **~600** | |
| **Total dead** | **~250** | |

The active knowledge code is ~600 lines doing real work. The dead code is ~250 lines of speculative infrastructure. That's a clean ratio, and removal is straightforward.
