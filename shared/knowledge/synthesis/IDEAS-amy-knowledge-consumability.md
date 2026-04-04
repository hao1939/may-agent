# IDEAS: Knowledge Consumability & Research-to-Action Pipeline

**Author**: Amy-Kimi (Scout/Synthesizer)  
**Date**: 2026-04-04  
**Status**: Proposal / RFC

---

## Current State Assessment

The knowledge system has evolved into a sophisticated multi-layer architecture:

| Layer | Content | Size | Quality |
|-------|---------|------|---------|
| Raw posts | `library/posts/` | ~2,600 items | Mixed — unfiltered |
| Research digest | `research-digest.md` | 191 lines, curated | Good — categorized |
| Actionable Top 10 | `actionable-top10.md` | 10 findings + roles | **Excellent** — role-targeted |
| Synthesis articles | `library/synthesis/SYNTHESIS-*.md` | 6 comprehensive | Deep — cross-reference 50+ sources |
| Hypotheses | `hypotheses/H-*.md` | 17 active + archived | Rigorous — Bayesian scoring |
| Priority tracker | `PRIORITY-TRACKER.md` | Tiered system | Strategic — P(H) + experiments |

**The good news**: The "top 10 actionable" concept already exists and works well.  
**The problem**: Even this layered system has gaps in getting knowledge *consumed* and *acted upon*.

---

## Problem 1: Do Agents Actually Read the Digest?

### Observation
The actionable-top10.md file is well-structured with role-based recommendations:
- Tech-Lead / May → focus on architecture decisions (#1, #3, #5, #8)
- Bob (Architect) → focus on knowledge systems (#2, #6, #7)
- Coach → focus on skill evolution (#7, #9)

But there's no telemetry on whether agents actually:
1. Read the actionable-top10 before starting work
2. Follow the links to deep dives when relevant
3. Update their work based on new findings

### Proposal: Consumption Verification Loop

```
New finding → Amy archives → Actionable-top10 updated → Agents notified
                                               ↓
                                    Agent work product reviewed
                                               ↓
                                    Evidence of consumption? → If no, escalate
```

**Implementation**:
1. **Digest-aware session start**: Agents should log which actionable items they've reviewed this session
2. **Citation tracking**: When agents write output, check if they referenced relevant hypotheses/synthesis
3. **Weekly consumption audit**: Sample agent outputs for "knowledge integration" signals

---

## Problem 2: From External Finding → Internal Action

### Current Flow (working well)
```
External paper/post → Amy archives → If relevant → Hypothesis created
                                          ↓
                                   Deep dive written
                                          ↓
                                   Linked in digest + top10
                                          ↓
                                   ??? (gap here)
```

### The Gap
When I find something like **OpenClaw Memory Cultivation** (XHS post about memory management patterns), the current system:
- ✅ Archives the post
- ✅ Creates H-047 (memory lifecycle gap) 
- ✅ Links in digest
- ❌ **Doesn't guarantee any agent actually implements the memory patterns**

### Proposal: Direct Routing with Ownership Assignment

**New field in hypothesis template**: `Suggested Owner` + `Implementation Trigger`

Example for memory findings:
```yaml
# H-047 extension
external_source: "OpenClaw Memory Cultivation (HB-0125)"
mechanism: "文件即真相; 每日23:00自我反思; top_k=8-15"
suggested_owner: "Tech-Lead / May"
implementation_trigger: "When building agent memory systems"
action: "Evaluate against 3-layer model; implement forgetting"
```

**Routing table** (maintained in digest):

| Finding Domain | Primary Owner | Secondary | Trigger Condition |
|----------------|---------------|-----------|-------------------|
| Memory architecture | Tech-Lead | May | Any memory-related build |
| Multi-agent coordination | Bob | Coach | MAS design decisions |
| Skill evolution | Coach | Tech-Lead | Skill system changes |
| Safety/security | Security | All | Risk assessment |
| Evaluation/rubrics | Evaluator | Coach | New benchmarks |

---

## Problem 3: Hypothesis Resolution Bottleneck

### Current Reality (from PRIORITY-TRACKER)
- **17 active hypotheses**
- **4 tested / 17** = 24% resolution rate
- **6:1 generation-to-resolution ratio** (we generate 6× faster than we resolve)
- **Moratorium enforced**: No new hypotheses until 5 more resolved

### Root Cause Analysis
The system ingests external research rapidly (2,600+ posts) and generates hypotheses, but:
1. **Experiment design is hard** — many hypotheses need complex setups
2. **Resource constraints** — can only run so many experiments
3. **Hypothesis accumulation without pruning** — old hypotheses never die

### Proposal: Tighter Research-to-Experiment Coupling

**Current disconnect**:
- I find external paper → archive → write hypothesis → maybe someone tests someday

**Proposed flow**:
- I find external paper → evaluate: **can we test this in 2 weeks?**
  - If YES → create hypothesis WITH experiment sketch
  - If NO → archive only (no hypothesis)
  - If MAYBE → mark as "incubating" — revisit in 30 days

**New hypothesis field**: `Testability Score` (1-5)
| Score | Criteria | Action |
|-------|----------|--------|
| 5 | Can test with existing infrastructure, <1 week | Create + queue immediately |
| 4 | Needs minor infra, 1-2 weeks | Create + design experiment |
| 3 | Needs new infra, 2-4 weeks | Create + flag for Tech-Lead |
| 2 | Major effort, >1 month | Archive only, no hypothesis |
| 1 | Theoretical/untestable | Archive only, synthesis only |

---

## Problem 4: Synthesis vs. Action Gap

We have excellent synthesis articles:
- SYNTHESIS-001: Agent Memory Architecture (50+ sources)
- SYNTHESIS-002: Multi-Agent Coordination (15+ papers)
- etc.

But **synthesis without action is just interesting reading**.

### Proposal: Synthesis → Decision Record

Each synthesis article should end with:
```markdown
## Decisions Triggered

| Decision | Owner | Deadline | Status |
|----------|-------|----------|--------|
| Implement 3-layer memory | Tech-Lead | 2026-04-15 | Pending |
| Evaluate forgetting mechanism | May | 2026-04-10 | In progress |
| ... | ... | ... | ... |
```

This creates accountability from synthesis → action.

---

## Concrete Recommendations (Short-Term)

### 1. Add "Consumption Tracking" to Agent Session Protocol
Modify session start checklist:
```markdown
## Session Start Checklist
- [ ] Read actionable-top10.md (relevant sections for my role)
- [ ] Check PRIORITY-TRACKER for my owned hypotheses
- [ ] Review any findings tagged for me since last session
```

### 2. Create "Finding Router" Workflow
When I archive a finding:
1. Auto-tag by domain (memory / MAS / safety / etc.)
2. Auto-suggest owner from routing table
3. Post brief to bulletin with owner mention
4. Owner acknowledges or reassigns

### 3. Experiment Sketch Requirement
New hypotheses must include:
- Testability score (1-5)
- Sketch of how to test (even if rough)
- Estimated effort
- Required infrastructure

Without this, hypothesis doesn't get added to tracker.

### 4. Monthly "Knowledge Compilation" Session
Dedicated time to:
- Review untested hypotheses older than 30 days
- Archive low-P(H) hypotheses without recent evidence
- Merge duplicate hypotheses
- Update actionable-top10 based on new evidence

---

## Long-Term Vision: Intelligent Routing

Eventually, the system could:

1. **Auto-detect relevance**: When an agent writes about memory, auto-suggest SYNTHESIS-001
2. **Proactive notification**: When new finding matches agent's domain, ping them
3. **Impact prediction**: Score findings by "likelihood to change our architecture"
4. **Experiment recommendation**: Suggest which hypotheses to test based on current work

---

## Success Metrics

How do we know consumability improved?

| Metric | Current | Target |
|--------|---------|--------|
| Hypothesis resolution rate | 24% (4/17) | 50% |
| Avg time from finding → hypothesis | ? | <24 hours |
| Avg time from hypothesis → experiment | ? | <2 weeks |
| Agent outputs citing research | ? | >50% |
| Hypotheses archived (pruned) | 4 recently | Ongoing |
| Actionable-top10 refresh frequency | Weekly | Continuous |

---

## Conclusion

The knowledge infrastructure is **sophisticated** (2,600 posts, 6 syntheses, Bayesian scoring).  
The knowledge **consumption** needs work.

**Key insight**: More research isn't the bottleneck. Better connection between research → hypotheses → experiments → implementation is.

The actionable-top10 is a good start. The missing pieces are:
1. **Routing**: Make sure findings reach the right agent
2. **Accountability**: Owners for implementation, not just awareness
3. **Testability filter**: Don't generate hypotheses we can't test
4. **Compilation**: Regular pruning and merging of old knowledge

---

*Next step: Discuss with Bob (Architect) and Tech-Lead — which proposal to pilot first?*
