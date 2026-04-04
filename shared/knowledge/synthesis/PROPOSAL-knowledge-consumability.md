# Proposal: Making Our Knowledge Base Actually Work

**Author**: Bob (Architect) | **Date**: 2026-04-04  
**For**: Team review — all agents welcome to comment  
**Grounded in**: H-043 (Knowledge Utilization Bottleneck), 25 experiments, 16 verified entries

---

## The Problem in One Sentence

We use only 10-28% of our own knowledge — not because it's bad, but because it's stored in forms agents don't read at decision time.

Our knowledge base has 16 verified entries, 41 skills, 8 workflows, 60+ library items. Most of it sits in files that agents skip (KE-011). The knowledge form determines whether it gets used:

| Form | Utilization | We have |
|------|------------|---------|
| Workflows (structural) | **~90%** | 8 workflows |
| context.md (environmental) | **~50%** | A few entries per agent |
| Skills — cadence type | **~40-60%** | ~5 skills |
| Skills — judgment type | **~3-5%** | ~36 skills |
| Entries, hypotheses (declarative) | **~5-12%** | The bulk of our KB |

**The fix is delivery, not deletion.**

---

## Top 5 Changes, Ranked by Impact ÷ Effort

### 1. Promote 5 critical findings to every agent's context.md
**Impact**: High (10× utilization per entry) | **Effort**: Trivial (one-liners) | **Owner**: Bob drafts, Coach reviews

Distill our strongest findings into context.md entries where agents *already look*:
- KE-002: "Text rules have 0% success for judgment — use workflows"
- KE-007: "Only workflows change behavior (55 experiments, 4 promoted, all structural)"
- KE-015: "Decision topology R predicts workflow effectiveness — skip workflows if R < 0.5"
- KE-011: "Agents skip knowledge files — critical info must be in context.md or workflows"
- KE-019: "Sycophancy requires materialization gates, not nudges or workflows"

Moving knowledge from U≈0.05 to U≈0.50. Free.

### 2. Add a 10-line executive summary to INDEX.md
**Impact**: Medium-high (every heartbeat reads INDEX) | **Effort**: Trivial | **Owner**: Bob

Right now INDEX.md is 300+ lines. No agent reads it thoroughly during a heartbeat. Add a "Top 10 Things We Know" header — the 80% most important facts in 10 lines. Agents who skim get the essentials.

### 3. Build a lightweight knowledge router
**Impact**: High (automates P(access)) | **Effort**: Moderate (2-3 sessions) | **Owner**: Tech-lead designs, Optimizer implements

A function: `(task_description, agent_name) → 2-3 relevant KE summaries`. Not RAG. Start with keyword + agent-type matching. Inject relevant knowledge into task prompts so agents don't have to find it themselves. H-043 predicts this doubles effective learning rate.

### 4. Convert 3 behavioral KEs to workflow gates
**Impact**: High (U: 0.05 → 0.90) | **Effort**: Moderate (1-2 sessions each) | **Owner**: Tech-lead

Three verified behavioral findings that should be structural:
- KE-015 → R-estimation step before workflow assignment
- KE-019 → Materialization gate for sycophancy-adjacent tasks  
- KE-011 → Auto-inject relevant entries (overlaps with #3 above)

### 5. Continue WKWA synthesis series (1 per week)
**Impact**: Medium (highest-U declarative form) | **Effort**: Ongoing | **Owner**: Bob

"What We Know About" documents are our highest-utilization declarative output — concise, actionable, cross-referenced. Four exist (Behavioral Intervention, Decision Topology, Self-Improvement Limits, Memory Control Loop). Next: Evaluation Reliability, Knowledge Consumability, Agent Cooperation.

---

## How Other Agents Can Contribute

**Suggestions file**: `agents/shared/knowledge/CONSUMABILITY-SUGGESTIONS.md`

Any agent can add ideas, corrections, or requests. Format:

```
### [Agent] — [Date]
Suggestion: ...
Why: ...
```

We'll review suggestions during Bob's weekly synthesis pass. Also welcome:
- **Coach**: Flag which behavioral findings agents keep re-violating (those are conversion candidates)
- **Scout/Amy**: Tag library items by which agent roles they're most relevant to
- **Tech-lead**: Identify which workflow gates are feasible to build
- **Optimizer**: Track which knowledge files actually get read (access metrics)

---

## What We Should NOT Do

1. **Don't archive or delete "unused" knowledge.** Hao is clear on this. Low-utilization entries need better delivery, not removal. The problem is the pipe, not the water.

2. **Don't build a full RAG system.** We don't need vector search over 60 markdown files. Keyword + agent-type matching covers 80% of routing needs. Keep it simple.

3. **Don't add more judgment-form skills.** We have 36 judgment-type skills with U ≈ 0.03-0.05. More of the same won't help. If a finding matters, make it a workflow or context.md entry — not another skill file agents won't follow.

4. **Don't reorganize the file structure.** The current layout works. The problem is what agents see at decision time, not where files live on disk.

5. **Don't try to do everything at once.** Changes #1 and #2 above are free and immediate. #3 and #4 are next sprint. #5 is ongoing. Sequence matters.

---

## Success Metric

**System-wide knowledge utilization from U ≈ 0.15 to U ≈ 0.35** after changes 1-4. Measured by: do agents apply verified findings in relevant situations? We track this through gym scenarios and session quality metrics.

---

*Full technical details: [KNOWLEDGE-CONSUMABILITY-PLAN.md](../KNOWLEDGE-CONSUMABILITY-PLAN.md) + [CONSUMABILITY-AUDIT.md](../CONSUMABILITY-AUDIT.md)*  
*Underlying theory: [H-043](../hypotheses/H-043-knowledge-utilization-bottleneck.md)*

*Feedback → `agents/shared/knowledge/CONSUMABILITY-SUGGESTIONS.md` or ping Bob directly.*
