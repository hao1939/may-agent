# Audit: agents/shared/ Dead Weight

**Date**: 2026-04-12  
**Auditor**: tech-lead  
**Method**: `grep -rl` across all agents/ for filename/path references; manual review of content

## Summary

`agents/shared/` contains **5,587 files** using **~47MB**. The bulk (5,401 files / 45MB) is `knowledge/`, which is a legitimate knowledge base. However, there's significant dead weight in protocols, federation, deep-dives, skills patterns, and stale standalone files.

**Key finding**: 72 skill files inflate reference counts (527 "refs" each) because `knowledge/library/` entries reference `SKILL.md` generically. Real skill adoption in agent heartbeats/contexts is **near zero** — only 2 skills are referenced, and both point to non-existent files.

---

## Section-by-Section Audit

### 1. protocols/ (4 files, 44K)

| File | Agent Refs | Verdict |
|------|-----------|---------|
| escalation.md | 7 path refs | ✅ KEEP — referenced by escalation infrastructure |
| workflow-first.md | 5 path refs | ✅ KEEP — referenced in agent docs |
| metrics-framework.md | 0 refs | 🗑️ DELETE — zero references anywhere |
| self-improvement-mechanics.md | 0 refs | 🗑️ DELETE — zero references anywhere |

### 2. federation/ (4 files, 28K) + federation.md + federation.yaml

| File | Refs | Verdict |
|------|------|---------|
| federation/ dir | 7 refs (mostly in workspace analysis docs) | ⚠️ REVIEW — instance-config.json and heartbeats/local.json are actively written by infrastructure, but the feature is experimental/unused |
| federation.md | 2 refs | ⚠️ Part of experimental feature |
| federation.yaml | 0 refs (only git index) | 🗑️ DELETE — zero code references |

**Note**: Federation heartbeats/local.json is actively updated (last_seen: 2026-04-12T18:23) — so infrastructure writes to it even if nothing reads it meaningfully. The whole federation subsystem is scaffolding for a feature that never shipped.

### 3. Top-Level Standalone Files

| File | Refs | Verdict |
|------|------|---------|
| bulletin.md | 133 md, 1 ts | ✅ KEEP — loaded by agents-auto-commit.ts |
| common-sense.md | 209 md, 2 ts | ⚠️ BLOATED — 209 refs but NOT in any agent's heartbeat.md or context.md. Loaded by convention-check.ts. May be over-referenced in knowledge/library. |
| research-digest.md | 25 refs | ✅ KEEP — active research aggregation |
| README.md | 71 refs | ✅ KEEP |
| db-schema.md | 1 ref | ⚠️ LOW USE — only referenced by optimizer workspace |
| knowledge-essentials.md | 1 ref | 🗑️ CANDIDATE — 1 ref from old audit file |
| standing-orders.md | 1 ref | 🗑️ CANDIDATE — 1 ref from old audit file |
| research-digest.md.backup.20260404061555 | 0 refs | 🗑️ DELETE — stale backup, 28KB |

### 4. may-agent-docs/ (33 files, 352K)

Mostly healthy — these are system documentation. One dead file:

| File | Refs | Verdict |
|------|------|---------|
| simplify-binary-deployment.md | 0 refs | 🗑️ DELETE |
| design/phase5-digest-context-injection.md | 1 ref | ⚠️ LOW — likely stale design doc |

All other files have 2+ references and are legitimate system docs.

### 5. skills/ (72 files, 808K)

**Critical finding**: The skill system has near-zero real adoption.

- **72 SKILL.md files** each show ~527 "references" — but 257 of those come from `knowledge/library/` entries that generically mention skills. Inflated metric.
- **Only 2 skills** are referenced in any agent's heartbeat.md or context.md: `read-before-edit.md` and `deliverable-checklist.md` — **both are MISSING files** (ghost references).
- The skill-lifecycle.ts workflow has 101 refs but that's from knowledge entries, not actual invocations.

| Category | Files | Verdict |
|----------|-------|---------|
| SKILL.md files (formal skills) | 39 | ⚠️ Infrastructure exists but adoption is zero |
| patterns/ | 5 | ⚠️ LOW USE — most have 1-2 refs |
| Standalone .md skills | 12 | Mixed — some referenced, some not |
| LIBRARY.md | 1 | ✅ KEEP |
| DELIVERY-GUIDE.md | 1 | 🗑️ DELETE — 0 refs |

**Recommendation**: Don't delete the skills themselves yet — they're part of the skill-lifecycle system. But DELIVERY-GUIDE.md and unused patterns/ files are dead.

### 6. deep-dives/ (9 files, 80K)

| Verdict | Count |
|---------|-------|
| 🗑️ ALL zero refs | 9/9 |

Every deep-dive (DD-710 through DD-716, CR-326, CR-327) has **zero external references**. These were research outputs that were never linked or used.

### 7. research/ (7 files, 60K)

| File | Refs | Verdict |
|------|------|---------|
| dd617-coordination-primacy.md | 1 | ⚠️ LOW |
| dd616-agent-qmix.md | 1 | ⚠️ LOW |
| dd618-six-birds-agenthood.md | 1 | ⚠️ LOW |
| cr310-coordination-topology-convergence.md | 1 | ⚠️ LOW |
| dd620-knowledge-packs-kv-cache-injection.md | 0 | 🗑️ DELETE |
| dd619-actionnex-virtual-outage-manager.md | 0 | 🗑️ DELETE |
| dd621-tool-illusion-rethinking-tool-use.md | 0 | 🗑️ DELETE |

### 8. research-projects/ (12 files, 184K)

Most are referenced (2-9 refs). One dead:

| File | Refs | Verdict |
|------|------|---------|
| primer-behavior-escalation-stubborn.md | 0 refs | 🗑️ DELETE |
| gstack-software-factory.md | 1 ref | ⚠️ LOW |

### 9. daily-digests/ (25 files, 108K)

Active system — new digests generated through April 11. Referenced by 5 non-digest files. However, **digests older than 2 weeks** (March 17-29, 13 files) serve no ongoing purpose and could be archived.

### 10. knowledge/ (5,401 files, 45MB)

The elephant in the room. Breakdown:

| Subdir | Files | Size | External Refs |
|--------|-------|------|---------------|
| library/ | 4,500 | ~30MB | 106 refs |
| experiments/ | 448 | ~10MB | 52 refs |
| entries/ | 159 | — | 33 refs |
| findings/ | 150 | — | 3 refs |
| hypotheses/ | 93 | — | — |
| synthesis/ | 27 | — | 23 refs |
| fewshot-examples/ | 6 | — | 6 refs |
| archive/ | 5 | — | — |
| conventions/ | 1 | — | — |
| incidents/ | 2 | — | — |
| summaries/ | 1 | — | — |

**Notable**: `library/` alone is 4,500 files / ~30MB — it's a research library with deep-dives (1,508), posts (2,685), cross-references (49), synthesis (39), topics (11). This is amy-kimi's research output. It has 106 external refs, so it IS used, but the file count is enormous.

`findings/` has 150 files but only 3 external refs — borderline dead.

### 11. tasks/ (1 file, 8K)

`consolidate-memory.md` — 24 refs. ✅ KEEP.

### 12. escalations/ (1 file, 8K)

`README.md` — placeholder ("History: none yet"). Part of escalation protocol. ✅ KEEP.

### 13. workflows/ (8 files, 88K)

All actively used. `implement-and-review.ts` has 39 refs but **dead since March 29** per prior audit — refs are from old docs, not active use.

---

## Deletion Candidates (Safe to Delete Now)

### Tier 1: Zero references, clearly dead
| File | Size | Reason |
|------|------|--------|
| `research-digest.md.backup.20260404061555` | 28K | Stale backup |
| `protocols/metrics-framework.md` | ~8K | Zero refs |
| `protocols/self-improvement-mechanics.md` | ~8K | Zero refs |
| `deep-dives/` (entire dir) | 80K | All 9 files have zero refs |
| `research/dd620-knowledge-packs-kv-cache-injection.md` | ~8K | Zero refs |
| `research/dd619-actionnex-virtual-outage-manager.md` | ~8K | Zero refs |
| `research/dd621-tool-illusion-rethinking-tool-use.md` | ~8K | Zero refs |
| `research-projects/metaclaw-poc/primers/primer-behavior-escalation-stubborn.md` | — | Zero refs |
| `may-agent-docs/simplify-binary-deployment.md` | — | Zero refs |
| `skills/DELIVERY-GUIDE.md` | — | Zero refs |
| `federation.yaml` | — | Zero code refs |

**Estimated savings**: ~160K, 15 files

### Tier 2: Near-zero references, need validation
| File | Refs | Notes |
|------|------|-------|
| `knowledge-essentials.md` | 1 (old audit) | Likely obsoleted by knowledge/ system |
| `standing-orders.md` | 1 (old audit) | Check if still relevant |
| `db-schema.md` | 1 | Could be useful reference — keep for now |
| `daily-digests/2026-03-17` through `2026-03-29` | 5 total | 13 files, archive-worthy |
| `knowledge/findings/` | 3 refs for 150 files | High dead ratio |

### Tier 3: Systemic issues (not delete, but redesign)
- **Skills system**: 72 files, zero adoption in heartbeats/contexts. The skill-lifecycle workflow produces skills nobody loads. The entire skills/ dir is 808K of mostly unused output.
- **knowledge/library/**: 4,500 files, 30MB. Amy-kimi's research library. Referenced but enormous. Could benefit from archival/compaction.
- **federation/**: Scaffolding for unshipped feature. Infrastructure actively writes to it (heartbeats/local.json) but nothing meaningful reads it.

---

## Recommended Actions

1. **Immediate**: Delete Tier 1 files (15 files, ~160K) — zero risk
2. **This week**: Archive daily-digests older than 14 days; validate Tier 2 files with owners
3. **Design review**: Skills adoption problem — either fix the loading mechanism or stop producing skills
4. **Future**: Consider compaction strategy for knowledge/library/ (4,500 files is a lot for grep to scan)
