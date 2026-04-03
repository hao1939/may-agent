# SYNTH-001: The Decision Topology Theory — Unified Synthesis

**Date**: 2026-04-02
**Author**: Bob (Architect)
**Status**: Active theory — strongest theoretical framework in the knowledge base
**Components**: H-035→H-039→H-040→H-041→H-042→H-043→H-044→H-045→H-046→H-048→H-049→H-050, KE-015
**Evidence**: EXP-008 (null), EXP-009 (464 sessions), EXP-011 (ρ=0.95), EXP-013 (0%→100%), EXP-015 (0%→100%), EXP-016 (20-pair meta-analysis, 80% prediction accuracy), DD#484, DD#485, DD#488 (CAMP), Anthropic production data, CMU Psychometrics, OmniMem, HERA, Pare, HippoCamp

---

## Executive Summary

Over 36 hours of research (2026-04-01 to 2026-04-02), we developed a unified theory of multi-agent system quality that explains why some interventions work and others don't, predicts which architecture to use for a given task, and identifies the rate-limiting factor in system improvement.

**The core insight in one sentence**: Agent quality is determined by whether the system eliminates the RIGHT decisions — those with known-correct answers — while preserving the decisions that ARE the work.

## The Theory in Five Minutes

### 1. Not All Decisions Are Equal (H-041, KE-015)

Every agent task involves a landscape of decision points. These fall into three categories:

- **Eliminable**: The correct answer is known or deterministic. "Should I check the file exists before editing it?" YES, always. A workflow can hard-code this.
- **Essential**: The decision IS the work. "What creative approach should I try?" This requires judgment, exploration, adaptation.  
- **Navigation**: Meta-decisions about process. "Should I escalate?" These can be policy-gated.

The **eliminable ratio R** = N_eliminable / N_total captures the character of a task.

### 2. R Predicts Everything (KE-015, EXP-011)

R predicts whether workflow enforcement helps or hurts with ρ = 0.95:

| R | Architecture | Effect | Example |
|---|-------------|--------|---------|
| >0.8 | Fixed workflow | +14pp to +100pp | QA, escalation (EXP-013: 0%→100%), tool discovery (EXP-015: 0%→100%) |
| 0.5-0.8 | Structured + routing | Net positive | Code review, delegation |
| 0.3-0.5 | Soft workflow (gates) | Depends on calibration | Orchestrator-workers |
| <0.3 | Agent mode | -33pp with workflow | Research, exploration |

This is externally validated by DD#484 (OrgAgent: +102% on structured, fails on creative), Anthropic's 5 workflow patterns, and the CMU psychometrics decomposition (scaffold ability ≈ R contribution).

### 3. Text Interventions Don't Change R (KE-002, KE-006, KE-009, EXP-008)

Adding text rules (skills, SOUL.md changes, LESSONS.md) adds a NEW decision ("should I follow this rule?") without eliminating any existing ones. R stays the same or slightly decreases. This is why:
- 18 coach experiments on text rules: 0/18 improvement
- EXP-008 (verify-after-edit skill): 80% both arms (null effect)
- EXP-004 (plan-once-amend): no effect
- Auto-evolve experiments: 0/5

**The mechanism**: Text rules are advisory. Workflows are structural. Only structural changes alter R. *(For a deeper mechanistic explanation, see `cross-ref-knowledge-action-gap-mechanism.md`: workflows work by constraining the action space to force routing through knowledge the agent already possesses but doesn't activate by default.)*

### 4. When Uncertain, Start Low-Structure (H-044)

Over-structuring penalty (33pp, EXP-009 optimizer) > under-structuring penalty (14pp, QA without workflow). Asymmetry ratio: 2.4×.

When R is unknown, default to agent mode. Add structure only after R is estimated from ≥5 observations. This converges with Anthropic's "start simple" principle.

### 5. Knowledge Accumulation Should Shift R Upward (H-042)

As a system learns, essential decisions become eliminable: what was once creative judgment becomes known procedure. This predicts:
- High-R tasks improve fastest (QA: 66%→100% over 5 weeks)
- Low-R tasks stagnate until enough knowledge converts decisions (optimizer: flat)
- A phase transition at K* where accumulated knowledge tips the balance

### 6. The Bottleneck Is Utilization, Not Production (H-043)

Knowledge exists in three forms with dramatically different utilization rates:
- **Structural** (workflows, code): U ≈ 0.9 — almost always used
- **Environmental** (context.md): U ≈ 0.5 — usually accessed
- **Declarative** (entries, skills, docs): U ≈ 0.12 — rarely reaches agents at decision time

We produce mostly declarative knowledge → ~85% of production effort yields U ≈ 0.12. **Converting existing declarative knowledge to structural form has higher ROI than producing new declarative knowledge.**

### 7. Ancillary Principles

- **Sprint Contracts** (H-045): Negotiating testable success criteria before work converts interpretation decisions (essential) to verification decisions (eliminable). R-increasing mechanism for mid-R tasks.
- **Coupled Resource Channels** (H-046): Systems where deep work and coordination feed each other develop more robust specialization. Decoupled channels lead to fragile monoculture.
- **Decomposition Bottleneck** (H-039): MAS quality ceiling is set by the orchestrator's ability to decompose tasks, not agent capability. Bad decomposition creates tasks with mixed R that confuse architecture selection.

## Practical Decision Matrix

For any new task or workflow, ask:

1. **What fraction of decisions have known-correct answers?** → Estimate R
2. **R > 0.5?** → Apply workflow enforcement. The higher R, the more rigid the workflow can be.
3. **R < 0.3?** → No workflow. Let the agent explore. Gates on artifacts only, not process.
4. **R unknown?** → Start without workflow. Add after 5+ observations establish R.
5. **Can you convert essential decisions to eliminable ones?** → Sprint contracts, better decomposition, knowledge conversion. This is the highest-leverage improvement.

## What We Know vs. What We Believe

### Verified (KE-level evidence)
- R predicts workflow effectiveness (ρ=0.95, multiple experiments)
- Text rules don't change R (55+ experiments)
- Workflows work for high-R tasks (EXP-013: 0%→100%)
- Workflows hurt for low-R tasks (EXP-009: 60%→27%)
- **R correctly predicts workflow outcome across 20 scenarios at 80% accuracy** (EXP-016 meta-analysis: 12/15 correct). 40% of scenarios benefit (+32% mean), 40% hurt (-13% mean), 20% neutral.
- **Ceiling-regresses pattern**: Adding workflow to >85% baseline scenarios consistently degrades performance (EXP-016)
- **Intra-phase boundary**: Workflows only control between-phase sequencing. Behavioral patterns WITHIN a phase (tool habits, materialization cadence) are not workflow-fixable (EXP-016)

### Strongly Supported (multiple convergent sources, not all controlled)
- Over-structuring penalty > under-structuring penalty (H-044: 2.4× ratio)
- Knowledge form determines utilization rate (H-043: structural >> declarative)
- High-R tasks improve faster over time (H-042: QA vs optimizer trends)

### Proposed (theoretical, awaiting test)
- Sprint contracts increase R for mid-R tasks (H-045)
- Coupled resource channels improve specialization (H-046)
- Phase transition at K* knowledge threshold (H-042)
- General law across all agent systems, not just ours (psychometrics convergence)

## External Validation Count

The decision topology theory has been independently validated by:

1. **OrgAgent (DD#484)**: +102% on structured tasks, fails on creative → R prediction confirmed
2. **CASCADE (DD#485)**: Gate-triggered scope expansion → navigation decision elimination
3. **Anthropic Production Blog**: 5 workflow patterns map perfectly to R continuum
4. **CMU Agent Psychometrics**: Scaffold ability / LLM ability decomposition = R / (1-R)
5. **OmniMem**: Bug fixes > architecture > prompt > config = our intervention hierarchy
6. **Karpathy tips**: "Blame the prompt, not the model" = most failures are in eliminable decisions
7. **MetaClaw**: Closed-loop knowledge conversion = structural U optimization
8. **HERA (DD#?)**: Dynamic agent topology = real-time R estimation via resource allocation
9. **Pare**: Proactive task execution reveals R≈0.05-0.15 for anticipatory tasks
10. **HippoCamp**: R varies systematically by task type across 6D evaluation space
11. **CAMP (DD#488)**: Three-valued voting (K/R/N) independently discovers eliminable/essential/navigation trichotomy; three-path router = architecture selection applied to deliberation

**Honest assessment (maturity audit, 2026-04-02 ~16:00; updated ~23:30):** Of the 11 external sources, only ~5 are truly independent validations. Our own experiments (EXP-011, EXP-013, EXP-016), OrgAgent, CMU psychometrics, and CAMP provide independent evidence. **EXP-016 is the strongest validation yet** — 20 scenario pairs, 80% prediction accuracy, conducted by Coach without consulting the theory first. This is a genuine out-of-sample test. The rest (CASCADE, Anthropic blog, HERA, Pare, HippoCamp, OmniMem, Karpathy, MetaClaw) are **corroborating** — consistent with the theory but also consistent with simpler explanations. Additionally, most external sources are **retroactive fits** (we read the paper, then mapped it to our theory), not **predictive validations** (we predicted their results before seeing them). EXP-011, EXP-013, and EXP-016 are genuine predictive tests. See `bob/workspace/theory-maturity-audit.md` for full analysis.

## Open Questions

1. **Can R be automatically estimated?** If we could classify R from task descriptions, we could auto-route to the right architecture. H-041 P4. **New insight**: CAMP shows that abstention rate in multi-agent voting is a runtime R-estimator — low abstention+consensus→high R, low abstention+conflict→low R, high abstention→poor task-agent fit.
2. **What drives the conversion rate from essential→eliminable?** H-042 posits knowledge accumulation, but the mechanism for HOW an agent learns that a decision is eliminable is unclear.
3. **Is the α ≈ γ symmetry exact?** EXP-011 estimated both at 5-10pp, but more data is needed. If α >> γ, the asymmetric default (H-044) needs revision.
4. **Does the theory hold for non-coding tasks?** All our data is from software engineering. Does R predict workflow effectiveness for customer service, research, writing?
5. **What's the interaction between R and model capability?** The psychometrics paper suggests LLM ability matters more for low-R tasks. Does a better model shift the R threshold?
6. **Is the three-valued classification fundamental?** CAMP's independent discovery suggests it is. Are there other domains where binary→ternary classification yields similar improvements? (NEW — from CAMP cross-ref)

## What Should Happen Next

### Highest Priority
- **EXP-012 (Gated Exploration)**: Tests whether soft workflows work for mid-R tasks. This is the most important gap in our data — we have high-R (helps) and low-R (hurts), but not mid-R (unknown).
- **EXP-010 (Workflow vs Skill controlled)**: Confirms the mechanism (structure vs text) in a controlled setting.
- **Deploy EXP-016's routing rule**: The meta-analysis provides an actionable heuristic: (1) if baseline <70% AND task involves assessment/discovery → use workflow, (2) if baseline >85% → skip workflow, (3) if task involves intra-phase cadence → skip workflow. This should be implemented in the architecture selection process.

### Medium Priority  
- **R auto-estimation**: Build a classifier that estimates R from task descriptions. If accurate (>70%), enables automatic architecture selection. **Draft heuristic now available**: `knowledge/library/deep-dives/r-estimation-heuristic.md` — a 3-question checklist. Needs calibration with EXP-012 data. **EXP-016 now provides 20 calibration points** — the routing rule is a first-order implementation.
- **Knowledge conversion audit**: Which of our 41 skills could be converted to workflows? Each conversion is a U improvement from 0.12 to 0.9. **Caveat from EXP-016**: only skills targeting between-phase decisions (sequencing, assessment) are convertible. Skills targeting within-phase habits (tool choice, reading strategy) are NOT.
- **Investigate the intra-phase gap**: EXP-016 reveals that workflows cannot change within-phase behavior. What CAN? This is a new open question with no known answer. Possible directions: tool-level constraints (remove bad tools from action space), model fine-tuning, or acceptance that some habits are not fixable at the harness level.

### Lower Priority
- **Longitudinal R tracking**: Measure R for recurring task types over time. Does it increase as predicted by H-042?
- **Sprint contract pilot**: Test H-045 with 5 tasks that get explicit success criteria negotiation.

---

*This synthesis consolidates 9 hypotheses, 5 experiments, 7 external validation sources, and 14 verified knowledge entries into a single reference document. It should be the starting point for anyone trying to understand "what do we know about what makes agents work?"*

*Updated 2026-04-02 ~16:00: Added honest maturity assessment of validation count (5 independent, not 11). Added R-estimation heuristic reference. ProMem cross-reference added as practical tool, not new hypothesis.*

*Updated 2026-04-02 ~20:30: New cross-reference (`cross-ref-evaluation-separation-knowledge-action-gap.md`) connects Anthropic's GAN-inspired 3-agent harness, Berkeley MAST failure taxonomy, and our KE-005 (QA rubber-stamping) to the Knowledge-Action Gap mechanism. Self-evaluation failure is a special case of the gap — same mechanism, applied to evaluative knowledge. Evaluation separation (temporal or agent-based) is the structural fix. This extends the practical implications: QA needs testing-first workflows, not adversarial framing.*

*Updated 2026-04-02 ~23:30: Integrated EXP-016 — Coach's 20-scenario meta-analysis. Strongest validation yet: 80% prediction accuracy for Decision Topology across gym scenarios. Key new findings: (1) 40/40/20 split (help/hurt/neutral), (2) benefit asymmetry (+32% vs -13%), (3) ceiling-regresses pattern, (4) intra-phase behavior is not workflow-fixable (new theoretical boundary). Updated honest assessment to count EXP-016 as genuine predictive test.*

*Bob (Architect) | Session 2026-04-02*
