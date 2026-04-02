# OpenClaw Stability: 4 Principles from 2 Months of User Pain

**Source**: insights-archive-kimi-2026-03-17d.md (HB#1972)
**Date**: 2026-03-17
**Original**: XHS @愚园路十二妹 — "让 OpenClaw 真正稳定的 4 个关键"
**Metrics**: 17♥ / 37⭐ — low engagement but extremely high signal-to-noise
**Type**: Practitioner wisdom — battle-tested stability principles

---

## Context

This post comes from a user who spent **2 months and hit 100+ problems** before distilling these 4 principles. Low engagement suggests the audience wasn't ready for this level of specificity — but the content is among the most practically valuable in the entire corpus.

---

## Principle 1: High-Frequency Files Must Be Short

**The 5 high-frequency files** (loaded every conversation): SOUL.md, AGENTS.md, USER.md, TOOLS.md, MEMORY.md

| Problem | Mechanism | Solution |
|---------|-----------|----------|
| Long files | Less space for conversation | Keep each file focused, <500 tokens ideal |
| Early compression trigger | Memory loss accelerates | Move verbose content to daily/ directories |
| MEMORY.md bloat | 500→5000 words = guaranteed problems | Index + key decisions only; raw logs go elsewhere |

> "HEARTBEAT.md is NOT a high-frequency file — only cron reads it. Write it as long as you want."

---

## Principle 2: Single File, Single Responsibility

| File | Responsibility | Boundary Dissolution Risk |
|------|---------------|--------------------------|
| SOUL | Personality | Stuffing scheduling rules into SOUL |
| USER | User preferences | Putting tool config in USER |
| AGENTS | Workflow/process | Mixing memory logic into AGENTS |
| MEMORY | Memory/knowledge | Placing system instructions in MEMORY |

**Litmus test**: Delete one file → only ONE capability disappears. Others unaffected.

---

## Principle 3: Memory Through Distillation, Not Accumulation

```
daily/ (raw logs) → periodic distillation → MEMORY.md (≤1000 words)
```

> "The goal of memory is not 'how much you stored' but 'how much you can find.'"

Everyone whose MEMORY.md grew from 500 to 5000 words experienced problems — 100% correlation.

---

## Principle 4: Persona Drift Is 90% Caused by Compression ⭐⭐⭐

**This is the single most important finding — and almost nobody talks about it.**

**The mechanism chain**:
```
Conversation too long → triggers compaction → early conversation compressed to summary → agent suddenly "becomes a different person"
```

> "It's not that your prompt was written poorly — your conversation context was cut."

**Solutions**:
1. **Write-before-reply**: When a key decision happens, immediately write it to a memory file (before responding to the user)
2. **current-task.md**: Maintain a file recording current state — survives compaction
3. **Post-compression recovery**: First thing after compaction = read state file to restore

---

## Cross-Validation with Other Findings

| Principle | Validated By |
|-----------|-------------|
| High-freq files short | Vercel 8KB experiment (BACKFILL-003): passive injection must be concise to maintain cache hits |
| Single responsibility | NikolaFu 6-category analysis: boundary dissolution = reliability failure mode |
| Memory distillation | AutoRefine (Alibaba): unmaintained knowledge bloats 4.5x, utilization drops 8.9x |
| Persona drift from compression | Summer Yue incident: context compression lost guardian instructions; same mechanism, different symptom |

---

## Actionable Implications

These principles apply to ANY agent system, not just OpenClaw:

1. **Measure your high-frequency file sizes** — set alerts if they exceed thresholds
2. **Audit file responsibilities** — each file should fail the "delete test" cleanly
3. **Implement distillation as infrastructure** — not as a suggestion, but as a scheduled process
4. **Design for compaction survival** — assume context WILL be compressed; critical state must persist outside conversation
