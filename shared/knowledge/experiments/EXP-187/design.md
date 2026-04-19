# EXP-187: Discriminative Keyword Bookmarks vs Flat INDEX

**Date**: 2026-04-19
**Status**: DESIGNED
**Predecessor**: none
**Hypothesis**: H-174

---

## Research Question

Does adding discriminative keywords to INDEX.md entries improve agent knowledge citation rates?

## Hypothesis

- **H-187a**: Keyword-tagged INDEX entries increase correct knowledge citation by ≥15pp over flat INDEX (from ~30% to >45%)
- **H-187-null**: No meaningful difference (<5pp) — agents compensate via batch-reading or title inference

## Background

Current INDEX.md has: ID | Claim (short sentence) | Evidence summary | Path.
H-174 predicts that adding 2-3 discriminative keywords per entry (unique terms distinguishing it from neighbors) will let agents select the right entry without opening it, reducing retrieval cost and boosting citation.

DD#765 showed 25pp gain in cooperative paging with discriminative bookmarks (57%→82%). Our setting is simpler (single agent, smaller index) so we expect a smaller but still significant effect.

## Design

### Arms

| Arm | Intervention | N | Notes |
|-----|-------------|---|-------|
| A (control) | Current flat INDEX.md (title + path) | 15 | Baseline citation rate |
| B (treatment) | INDEX.md with 2-3 discriminative keywords per entry | 15 | Keywords chosen to maximize inter-entry discrimination |

### Protocol

**Task construction**: Select 15 questions that require citing specific knowledge entries to answer correctly. Each question should have exactly 1 correct KE that contains the answer. Questions span different topic areas to avoid clustering effects.

Example questions:
- "What evidence do we have about whether text rules fix judgment failures?" → KE-002
- "What's the relationship between decision topology and workflow effectiveness?" → KE-015
- "Do few-shot examples help or hurt discovery tasks?" → KE-133

**Arm A (control)**: Agent receives the current INDEX.md as-is, plus the question. Measure whether the agent cites the correct KE in its response.

**Arm B (treatment)**: Agent receives a modified INDEX.md where each entry has 2-3 discriminative keywords appended. Example:
- `KE-002 | Text rules don't fix judgment | **[judgment, coaching, SOUL.md]** | knowledge/entries/KE-002.md`
- `KE-015 | Decision topology R predicts workflow effectiveness | **[topology-R, branching, workflow-fit]** | knowledge/entries/KE-015.md`
- `KE-133 | Few-shot examples harm discovery tasks | **[few-shot, template-displacement, creative]** | knowledge/entries/KE-133.md`

Keywords are selected by: (1) identifying 2-3 terms unique to that KE relative to its neighbors in the index, (2) preferring concrete nouns/metrics over abstract terms, (3) avoiding keywords shared by >3 entries.

**Execution**: Use a oneshot agent (coder or similar) given a system prompt with the INDEX + knowledge base path, asked to answer the question citing relevant KEs. Run each question once per arm (total: 30 runs).

### Gym Scenario

Create a custom gym scenario `knowledge-retrieval-citation` with:
- System prompt: "You are a research assistant with access to a knowledge base. Answer the question and cite the specific knowledge entry (KE-xxx) that supports your answer."
- Inject: INDEX.md (variant A or B) + full knowledge base access
- Grading: Automated — check if response contains the correct KE-xxx ID

Alternatively (simpler, lower cost): **Production measurement**. Add keywords to INDEX.md and measure citation rates in Bob/Alice heartbeat sessions over 1 week, comparing to the prior week's baseline. Downside: many confounds (different tasks, different contexts).

**Recommended approach**: Gym scenario (controlled, faster, cheaper per comparison).

### Metrics

- Primary: **Correct citation rate** — fraction of questions where agent cites the correct KE-xxx
- Secondary: **Retrieval efficiency** — number of file reads before citing (fewer = better retrieval)
- Secondary: **Time to citation** — op count before first correct citation appears

### Decision Rule

- **Confirmed** if: Arm B citation rate exceeds Arm A by ≥15pp (e.g., 30%→45%+) with p<0.05 (Fisher's exact test, N=15/arm)
- **Partially confirmed** if: Arm B exceeds Arm A by 5-15pp (real but smaller effect)
- **Falsified** if: Difference <5pp or Arm B ≤ Arm A

### Power Analysis

With N=15 per arm and expected effect size of 25pp (from DD#765, discounted), Fisher's exact test has ~70% power to detect a 25pp difference at α=0.05. If budget allows, N=20 per arm gives ~80% power.

## Preparation Steps

1. Select 15-20 questions with known correct KE answers (diverse topics)
2. Generate discriminative keywords for each INDEX entry (Arm B treatment)
3. Build gym scenario with grading script
4. Run Arm A (15 questions × control INDEX)
5. Run Arm B (15 questions × treatment INDEX)
6. Score and compare

## Cost Estimate

- ~30 gym runs × $0.10 each ≈ $3.00
- Prep time: ~2 sessions (question selection + keyword generation + scenario build)

## Execution

```bash
# After scenario is built:
# scripts/gym-run.sh knowledge-retrieval-citation --agent coder --tag EXP-187-A --timeout 600
# scripts/gym-run.sh knowledge-retrieval-citation --agent coder --tag EXP-187-B --timeout 600
```
