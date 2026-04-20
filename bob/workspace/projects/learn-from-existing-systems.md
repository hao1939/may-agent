# Project: Learn from Existing Agent Systems

**Status**: done
**Owner:** bob  
**Team:** scout (research), tech-lead (implementation)  
**Created:** 2026-04-18  

## Goal

Adopt proven patterns from existing agent systems — but ONLY after verifying they work in OUR system via gym experiments. No cargo-culting.

## The Loop (non-negotiable)

```
Research → Experiment → Verify → Adopt
```

1. **Research** — Scout studies external systems, writes pattern briefs
2. **Experiment** — Bob designs gym experiments for promising patterns
3. **Verify** — Run experiments, get real numbers
4. **Adopt** — Only implement patterns verified to improve our metrics

## Systems to Study

| System | Location | Status |
|--------|----------|--------|
| OpenClaw | `/home/hao/openclaw/` | Scout researching |
| Pi skills | TBD | Scout researching |
| Hermes agent | TBD | Scout researching |
| Evo harness | TBD | Scout researching |

## Pattern Categories

- **Enforcing tool usage** — how do other systems ensure agents use tools correctly?
- **Agent memory** — persistent context, learning across sessions, knowledge retrieval
- **Multi-agent coordination** — delegation, handoffs, shared state
- **Behavior testing** — how do they test/verify agent behavior changes?

## Experiment Template

For each pattern scout brings back, experiments follow this format:

```markdown
### Pattern: [name]
**Source:** [system name + location]
**What it does there:** [1-2 sentence description of the mechanism]
**Hypothesis:** [what it would improve in our system, e.g. "reduces FM-1.3 errors by >20%"]
**Gym test design:**
- Scenario(s): [which gym scenarios test this]
- Baseline: [current performance without pattern]
- Treatment: [how we apply the pattern]
- Trials: [N, minimum 5]
**Success criteria:** [specific threshold, e.g. "≥15pp improvement on scenario X"]
**Result:** [pending | pass N% | fail N%]
**Decision:** [pending | adopt | reject | modify-and-retest]
```

## Pattern Triage (2026-04-18)

### FM Mapping

| Pattern | Source | Maps to FM | Expected Impact | Feasibility | Rank |
|---------|--------|-----------|----------------|-------------|------|
| Dead ends memory | EvoHarness | **FM-1.3** (path guessing, repeating failures) | HIGH — 34+ wasted calls in 7 days from repeated mistakes | HIGH — just a file + context injection | **#1** |
| Fragility tracking | EvoHarness | **FM-3.3** (verification gaps on risky surfaces) | MED-HIGH — tells us where NOT to change | MED — needs tracking infra | **#2** |
| Prescreen gate | EvoHarness | **FM-2.6** (wasted effort on bad approaches) | MED — saves cost on doomed experiments | HIGH — simple 3-trial filter | **#3** |
| Dreaming/consolidation | OpenClaw | Context bloat / memory quality | MED — heartbeats already do this manually | MED — needs scoring gates | #4 |
| Layered config precedence | OpenClaw | Config/skill management | LOW — not a current pain point | HIGH | #5 |
| Surface decomposition | EvoHarness | General optimization | MED — useful framing but not directly testable | LOW — conceptual | #6 |
| Per-agent skill allowlists | OpenClaw | Over-broad capabilities | LOW — not a current FM | HIGH | #7 |

### Top 3 → Experiment Designs

---

### Pattern: Dead Ends Memory
**Source:** EvoHarness — `dead_ends.md` research notebook
**What it does there:** Each proposer iteration reads a `dead_ends.md` file listing previously-rejected approaches with reasons. Prevents re-exploring known failures.
**Hypothesis:** Injecting a structured dead-ends file into agent context reduces FM-1.3 (path guessing/flailing) errors by ≥20% on scenarios that involve path discovery or multi-attempt problem solving.
**Gym test design:**
- Scenario(s): `stale-approach-fixation`, `stale-error-misdiagnosis-v2`, `cascading-fix-trap-v2`
- Baseline: Current performance (no dead-ends file) — 5 trials per scenario
- Treatment: Add a `dead_ends.md` to agent context with 3-5 known-bad approaches for the scenario domain (NOT scenario-specific answers — general patterns like "don't guess paths, use ls first")
- Trials: 5 per scenario per arm (30 total)
**Success criteria:** ≥15pp improvement on at least 2 of 3 scenarios, no regression on canary
**Result:** pending
**Decision:** pending

---

### Pattern: Fragility Tracking
**Source:** EvoHarness — surface fragility scores (rejection rate per edit surface)
**What it does there:** Tracks acceptance/rejection rate per "surface" (system prompt, tool defs, etc). Surfaces with >50% rejection rate are flagged HIGH risk; proposer avoids them.
**Hypothesis:** Tracking which agent config surfaces (context.md, prompt.md, skills, heartbeat structure) have historically caused regressions will reduce FM-3.3 incidents by making agents more cautious about fragile surfaces.
**Gym test design:**
- Scenario(s): `compound-edit-verification`, `multi-file-verify-gap`, `partial-verification-trap`
- Baseline: Agent with no fragility info — 5 trials per scenario
- Treatment: Inject fragility ratings into context: "prompt.md edits: HIGH risk (3/4 regressions). context.md: LOW risk (0/5 regressions). heartbeat structure: CRITICAL (KE-008)."
- Trials: 5 per scenario per arm (30 total)
**Success criteria:** ≥15pp improvement on verification scenarios; agent avoids editing high-fragility surfaces when alternative exists
**Result:** pending
**Decision:** pending

---

### Pattern: Prescreen Gate
**Source:** EvoHarness — 3-task prescreen before full eval ($9 vs $75)
**What it does there:** Before running a full evaluation suite, tests a proposed change on just 3 failing tasks. If none flip to passing, the proposal is pruned immediately.
**Hypothesis:** Adding a 3-trial prescreen step before full gym batches will save ≥50% of experiment cost by pruning ineffective interventions early.
**Gym test design:**
- This is a META-experiment about our experiment process, not a gym scenario
- Method: Retroactively analyze our last 10 experiments. For each, check: would a 3-trial prescreen on failing scenarios have correctly predicted the full result?
- If ≥80% of full-eval failures would have been caught by prescreen → adopt
- Trials: Retrospective analysis (no new gym runs needed)
**Success criteria:** ≥80% of historically-failed experiments would have been correctly pruned by 3-trial prescreen
**Result:** pending
**Decision:** pending

---

## Tracking Table

| # | Pattern | Source | Found | Tested | Result | Adopted |
|---|---------|--------|-------|--------|--------|---------|
| 1 | Dead ends memory | EvoHarness | 2026-04-18 | 2026-04-18 | FAIL (0pp, 30 trials) | rejected |
| 2 | Fragility tracking | EvoHarness | 2026-04-18 | 2026-04-18 | FAIL (0pp, 15 trials) | rejected |
| 3 | Prescreen gate | EvoHarness | 2026-04-18 | 2026-04-18 | PASS (100% accuracy, 19/19 arms) | **adopted** |
| 4 | Dreaming/consolidation | OpenClaw | 2026-04-18 | 2026-04-18 | FAIL (0pp, 15 trials) | rejected |
| 5 | Layered config precedence | OpenClaw | 2026-04-18 | | | |
| 6 | Surface decomposition | EvoHarness | 2026-04-18 | | | |
| 7 | Per-agent skill allowlists | OpenClaw | 2026-04-18 | | | |

*Scout fills "Found". Bob fills "Tested/Result". Tech-lead implements "Adopted".*

## Anti-pattern

❌ "System X uses Y therefore we should"  
✅ "System X uses Y, we tested it in gym, it improved Z by N%"

## Current Status

- ✅ Scout delivered research on OpenClaw + EvoHarness (2026-04-18)
- ✅ Bob triaged 7 patterns, mapped to FMs, ranked by impact×feasibility (2026-04-18)
- ✅ Experiment designs written for top 3: dead-ends memory, fragility tracking, prescreen gate
- ⏳ Awaiting scout briefs on Pi skills + Hermes agent
- ✅ DD-769 delivered: Claude Skills + Hermes FC survey (2026-04-18)
- ✅ EXP-180 designed: Dead Ends Memory experiment (2026-04-18)
- **Next:** Run EXP-180 baseline + treatment arms

## Next Steps

1. ~~Scout delivers research briefs on pattern mechanisms~~ ✅ (OpenClaw + EvoHarness done)
2. ~~Bob triages patterns by relevance to our known failure modes~~ ✅
3. ~~Bob designs experiments for top 3 patterns~~ ✅
4. **Run experiment: Dead Ends Memory** — design dead_ends.md, run gym baseline + treatment
5. Run experiment: Fragility Tracking
6. Run experiment: Prescreen Gate (retrospective analysis)
7. Scout delivers Pi skills + Hermes briefs → triage cycle #2
8. Verified patterns go to tech-lead for implementation

## Comments

## Conclusion (2026-04-18)

**Result: 1/4 patterns adopted.** The learn-from-existing-systems project tested 4 patterns from EvoHarness and OpenClaw. Three behavioral/knowledge interventions (dead ends memory, fragility tracking, dreaming/consolidation) produced 0pp improvement across 60 total trials. The one structural process change (prescreen gate) showed 100% accuracy on 19 retrospective arms and was adopted.

**Key meta-finding (KE-256):** External system patterns don't transfer as behavioral interventions. They work in their source systems because of structural loops that force their use. When transplanted as injected knowledge/advice, agents ignore them — consistent with KE-002 (text rules 0%) and KE-007 (only workflows work). The intervention hierarchy (structural > knowledge > behavioral) appears to be a general property of LLM agents, not system-specific.

**Patterns #5-7 skipped** (layered config precedence, surface decomposition, per-agent skill allowlists) — low expected impact and the meta-finding suggests behavioral patterns won't transfer anyway.

**Adopted:** Prescreen gate — use 3-trial prescreen before full gym batches to prune ineffective interventions early.

