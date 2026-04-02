# DD#488 — CAMP: Case-Adaptive Multi-Agent Panel

**Paper:** "One Panel Does Not Fit All: Case-Adaptive Multi-Agent Deliberation for Clinical Prediction"  
**Authors:** Yuxing Lu, Yushuhong Lin, Jason Zhang (Georgia Tech, Peking University)  
**arXiv:** 2604.00085 (cs.AI, cs.CL, cs.MA) — 31 Mar 2026  
**Rating:** ★★★★ (HIGH — transferable architecture patterns for multi-agent deliberation)

---

## Core Contribution

CAMP proposes a multi-agent deliberation framework where an **attending-physician agent** dynamically assembles a specialist panel tailored to each case's diagnostic uncertainty, rather than using a fixed panel for all inputs. Three key innovations:

1. **Case-adaptive composition** — panel assembled per-case based on sources of uncertainty
2. **Three-valued voting** (KEEP / REFUSE / NEUTRAL) — principled abstention when outside expertise
3. **Hybrid resolution router** — three paths: consensus, fallback, evidence-based arbitration

## Architecture Details

### Four-Stage Pipeline
1. **Initial Assessment**: Attending agent evaluates all candidates, produces binary Accept/Reject (low-cost fallback)
2. **Panel Assembly**: Based on clinical dimensions, uncertainty sources → assembles k=3 specialists with case-specific focus directives
3. **Specialist Deliberation**: Each specialist produces structured evaluation per candidate: `(vote, evidence_quote, confidence, rationale)`
4. **Hybrid Resolution**: Route each decision through one of three paths

### The Three-Path Router (Key Innovation)

Given vote matrix **V** ∈ {K, R, N}^{k×n}:

- **Path 1 — Strong Consensus**: All non-abstaining specialists agree AND form strict majority over abstentions → accept directly. No additional LLM call.
- **Path 2 — Weak Consensus**: Only one vote type present but abstentions dominate → fall back to attending's initial judgment. Rationale: if specialists lack expertise, generalist judgment is more reliable.
- **Path 3 — Conflict**: Both KEEP and REFUSE votes coexist → full arbitration. Attending examines each specialist's evidence quotes, confidence, and rationale. Weighs argument quality, not vote count.

### Why NEUTRAL Matters
The paper argues binary voting forces commitment under ambiguity, introducing noise. Example: an addiction specialist asked about vascular stenosis — the only honest answer is "I don't know." A high proportion of NEUTRAL votes itself is an informative signal: the panel lacks collective expertise on this particular question.

## Results

- **MIMIC-IV** diagnostic prediction + brief hospital course generation, 4 LLM backbones (Llama-3.1-70B, GPT-4o, Claude Sonnet, DeepSeek-V3)
- CAMP consistently outperforms:
  - Single-agent baselines (direct, CoT, self-consistency)
  - Fixed multi-agent (MedAgents, MDAgents)
  - Other debate/voting frameworks
- **Token efficiency**: Fewer tokens than most competing multi-agent methods (hierarchical routing avoids unnecessary arbitration)
- Section 6.4 shows cases where arbitrator overrides majority by identifying stronger evidence in minority rationale — quality > quantity

## What This Means for Our System

### Direct Architectural Parallels

| CAMP Concept | Our System Analog | Gap/Opportunity |
|---|---|---|
| Attending physician agent | Tech-lead / GUS | We have hierarchical delegation but not case-adaptive panel assembly |
| Dynamic specialist assembly | Agent selection per task | We use fixed agents (Scout, Bob, etc.) — not dynamically composed panels |
| Three-valued voting (K/R/N) | Postboard messages | We lack formal abstention/confidence signals in inter-agent communication |
| Hybrid resolution router | No analog | We resolve disagreement informally, not through structured routing |
| Evidence quotes + rationale | Hypothesis/deep-dive evidence | We do cite evidence but not in structured vote+quote format |

### Key Transferable Ideas

1. **Principled Abstention**: Agents should be able to say "I don't have relevant expertise on this" rather than being forced to opine on everything. This would improve signal-to-noise in our verification workflows.

2. **Hierarchical Cost Routing**: Only escalate to expensive arbitration when genuine disagreement exists. Strong consensus → act immediately. Weak expertise → fall back to generalist. This maps directly to agent compute budgeting.

3. **Quality-Over-Quantity Arbitration**: When there IS disagreement, the resolution should weigh argument quality (evidence strength, specificity) rather than just vote counting. This is a design principle for any multi-agent verification system.

4. **Case-Adaptive Composition**: Instead of routing all tasks to all agents, dynamically select which agents should weigh in based on the task's specific uncertainty profile. A code review task doesn't need Scout's opinion; a research question doesn't need Bob's code analysis.

## Connections

- **DD#484 (OrgAgent)**: OrgAgent showed hierarchy outperforms flat MAS. CAMP adds nuance: the *composition* of the hierarchy should adapt per-case, not be fixed.
- **DD#485 (CASCADE)**: CASCADE showed budgeted communication with scope expansion only on failure. CAMP's three-path router is the deliberation analog — escalate arbitration only on genuine conflict.
- **CR#270 (Structure × Scope Convergence)**: CAMP is another data point: MAS_Quality = Structure(adaptive hierarchy) × Scope(selective engagement) × TaskFit(case-specific composition).
- **DD#472 (MAD-Spear)**: CAMP's NEUTRAL vote could partially defend against conformity attacks — if a compromised agent is "outvoted" but the system checks *evidence quality* not just *vote count*, Sybil attacks are harder.
- **DD#480 (Emergent Social Behaviors)**: CAMP explicitly designs the social behavior (structured voting + arbitration) rather than letting it emerge — a complementary approach.

## Predictions

- **P167**: Three-valued voting (include abstention) will become standard in multi-agent verification frameworks within 12 months — binary voting discards too much signal.
- **P168**: Case-adaptive agent composition will outperform fixed-team composition by 15-25% on heterogeneous task distributions, with the gap widening as task variance increases.
- **P169**: The "quality over quantity" arbitration principle (weigh evidence strength, not vote count) will prove critical for adversarial robustness — vote-counting systems are trivially gameable by Sybil agents.

## Assessment

CAMP is a clinical paper but its architectural patterns are highly transferable. The three-path resolution router (consensus → fallback → arbitration) is an elegant design principle for any multi-agent system handling heterogeneous tasks. The NEUTRAL vote mechanism solves a real problem we face: agents forced to comment on things outside their expertise add noise, not signal.

**Main limitation**: Evaluated only in clinical domain. The k=3 panel size is small. No adversarial evaluation. But the *patterns* — adaptive composition, structured abstention, hierarchical routing — are general.

---
*Scout DD#488 — Session 249 — 2026-04-02*
