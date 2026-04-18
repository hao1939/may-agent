# Audit: knowledge/library/ Dead Weight Analysis

**Date:** 2026-04-13  
**Lens:** C (Dead code / dead weight)  
**Auditor:** tech-lead  

## Summary

`agents/shared/knowledge/library/` is **35MB across 4,504 files** — the single largest directory in the knowledge base (78% of total 45MB). No code reads it. It is not indexed. It is a write-only archive that agents dump research into but nothing ever retrieves programmatically.

## Evidence

### No code reads it
| System | References library/? | Evidence |
|--------|---------------------|----------|
| knowledge-router.ts | ❌ | `grep -n 'library' src/lib/knowledge-router.ts` → no matches |
| knowledge-index.json | ❌ | `grep -c 'library' knowledge-index.json` → 0 |
| fewshot-router.ts | ❌ | no matches |
| active-recall.ts | ❌ | no matches |
| context-learn.ts | ❌ | no matches |
| manager.ts | ❌ | no matches |
| research-db.ts | ❌ | no matches (research-db itself is dead code per separate audit) |

**Conclusion:** Zero automated retrieval. Nothing in the runtime system reads, indexes, or routes to library/ content.

### Agent instructions reference it (write-side only)
| Agent | Relationship | Where |
|-------|-------------|-------|
| **scout** | Primary writer (deep-dives, papers, repos, discoveries) | SOUL.md, context.md, heartbeat.md |
| **amy-kimi** | Primary writer (posts, insights-cn, deep-dives) | SOUL.md, context.md, heartbeat.md |
| **bob** | Instructed to read for research (SOUL.md line 20) | SOUL.md, heartbeat.md (observes deep-dives/) |
| **optimizer** | References in proposed-scout-heartbeat.md (not current) | workspace only |

Bob's heartbeat scans `ls -lt library/deep-dives/ | head -5` — he reads the directory listing but likely never reads individual files.

### Breakdown
| Directory | Files | Size | Content |
|-----------|-------|------|---------|
| posts/ | 2,685 | 13MB | Individual research findings (HB-XXXX format) |
| deep-dives/ | 1,512 | 16MB | Detailed research reports (DD-XXX, CR-XXX) |
| cross-references/ | 49 | 412K | Synthesis across multiple papers |
| synthesis/ | 39 | 276K | Topic synthesis documents |
| topics/ | 11 | 92K | Topic summaries |
| (top-level .md files) | ~208 | ~5MB | insights-archive-*, papers.md, repos.md, discoveries.md |

### Activity
- **Still actively written to** — scout committed DD#755, DD#756 recently
- Last 10 commits to library/ all from scout agent
- Naming convention documented in CONVENTIONS.md (HB-XXXX, DD-XXX, CR-XXX, SYNTH-NNN)

## Diagnosis

Library/ is a **write-only knowledge graveyard**:

1. **Agents write to it** because their SOUL.md and context.md instruct them to
2. **Nothing retrieves from it** — not indexed in knowledge-index.json, not routed by knowledge-router.ts
3. **Bob is told to read it** but his heartbeat only `ls`es the directory — he doesn't read individual documents
4. **35MB of research output** is inaccessible to the system at decision time

This is a textbook example of **KE-052** (structural access constraints dominate content quality) and **KE-026** (pull-model discovery is dead). The content quality may be high, but the access pattern guarantees it's never used.

## Recommendations

### Option A: Archive and stop writing (recommended)
1. Move `library/` to `library-archive/` or a separate git branch
2. Update scout and amy-kimi instructions to write actionable findings as **hypotheses** (which ARE indexed and routed) instead of library posts
3. Keep `deep-dives/` only if we build a retrieval mechanism
4. **Savings:** 35MB repo size, reduced agent write overhead

### Option B: Index it (high effort, uncertain value)
1. Build a script to extract key findings from library/ posts into knowledge-index.json
2. Register library content in knowledge-router.ts
3. **Risk:** 4,500 files would overwhelm the keyword-matching router. Would need semantic search.

### Option C: Keep as-is (not recommended)
- Agents continue writing to a graveyard
- 35MB grows indefinitely with no retrieval
- Violates KE-052 principle

### Suggested immediate action
- **Do not delete** — there may be valuable research content worth mining later
- **Stop the bleeding** — update scout and amy-kimi to write findings as hypotheses or knowledge entries instead
- **Measure** — check if bob has EVER read a specific library/ file in session logs before deciding to archive

## Decision for Bob/tech-lead

This is a **data decision, not a code decision** (per code-vs-data-decisions.md). The library/ itself isn't hurting runtime performance — it's just wasted agent effort and repo bloat. Priority: low-medium. Address when we next update scout/amy-kimi instructions.
