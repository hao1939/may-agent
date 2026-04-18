# H-043: The Knowledge Utilization Bottleneck — Accessibility Limits Topology Evolution

**Status**: Empirically Supported — P(H) 0.62 → 0.85 (11 evidence sources, 3 predictions confirmed by experiment)
**Priority**: High — identifies rate-limiting factor in system improvement
**Proposed by**: Bob (Architect)
**Date**: 2026-04-02
**Depends on**: H-042 (Topology Evolution), H-041 (Decision Topology), KE-011 (Knowledge files are passive)

## Hypothesis

**The rate at which a multi-agent system's decision topology evolves (R increase per unit time) is bounded not by knowledge production but by knowledge utilization — the probability P(access) that the right knowledge reaches the right agent at the right decision point.**

### Formal Statement

H-042 predicts: dR/dt = learning_rate × essential_decisions_encountered

But the *effective* learning rate depends on a utilization factor U:

```
dR/dt = U × knowledge_production_rate × conversion_efficiency
```

Where U = P(relevant_knowledge_exists) × P(agent_accesses_it) × P(agent_applies_it_correctly)

**Current system estimate** (updated 2026-04-05 with EXP-030/EXP-031b evidence): 
- P(exists) ≈ 0.7 (we have 20 verified entries + 41 skills + 7 workflows)
- P(accesses) varies dramatically by delivery mechanism:
  - **Available/hinted**: ≈ 0.0 (EXP-030: 0/6 nudge, EXP-031b: 0/2 task hint — see XREF-zero-discovery)
  - **Instructed (heartbeat)**: ≈ 0.04-0.10 (EXP-028: decays to floor within 7 days)
  - **Injected (system prompt)**: ≈ 0.70-0.90 (skills loaded directly)
  - **Injected (task context)**: ≈ 1.0 (explicitly provided) — but see P(applies) below
  - **Automatic (infrastructure)**: ≈ 1.0 (workflows)
- P(applies correctly) varies by knowledge type:
  - **Structural (workflows)**: ≈ 0.9 (agent has no choice)
  - **Factual/environmental**: ≈ 0.5-0.8 (KE-001 works)
  - **Judgment-declarative (pushed, text rules)**: ≈ 0.0 (EXP-082: 0/3 applied injected knowledge; KE-002: 0/32 text rules)
  - **Judgment-declarative (pushed, few-shot)**: ≈ 0.3-0.5 (EXP-084: worked examples produce measurable behavioral change; see KE-059, H-091)
  - **Judgment-declarative (available)**: ≈ 0.0 (not accessed, so moot)
- **U ≈ 0.03-0.15** (revised down from 0.10-0.28) — most knowledge is in "available" form with P(access) ≈ 0

This means: **70-90% of existing knowledge is wasted** — it exists but doesn't reach agents at decision time. Adding more knowledge without improving delivery is subject to severe diminishing returns.

### The Four Knowledge Forms (updated 2026-04-04 per EXP-022/H-059)

Not all knowledge representations are equal at converting decisions. EXP-022 revealed that declarative knowledge has a critical subcategory:

| Form | P(access) | P(applies) | U | Example |
|------|-----------|------------|---|---------|
| **Structural** (workflow, code) | ~1.0 | ~0.9 | **~0.9** | code-review-loop forces review phase |
| **Declarative — cadence** (temporal/frequency constraints) | ~0.7 | ~0.6 | **~0.4-0.6** | "Write within first 3 tool calls" — agent counts and complies |
| **Environmental** (context.md, SOUL.md) | ~0.8 | ~0.6 | **~0.5** | "sqlite3 not available" prevents wrong tool choice |
| **Declarative — few-shot** (worked examples, checklists) | ~1.0 | ~0.3-0.5 | **~0.3-0.5** | Worked example in injected_context — agent pattern-matches |
| **Declarative — judgment** (cognitive/evaluative constraints) | ~0.3 | ~0.1 | **~0.03-0.05** | "verify after edit" skill — agent reads but doesn't follow |

**Key refinement (H-059)**: Declarative knowledge splits into cadence skills (targeting when/how-often, U ≈ 0.4-0.6) and judgment skills (targeting what/how-to-think, U ≈ 0.03-0.05). The mechanism: cadence compliance decisions have high R (self-verifiable by counting), while judgment compliance decisions have low R (require self-evaluation). See H-059 for full analysis.

**Key refinement (H-091, EXP-084)**: Judgment-type knowledge can be partially rescued by delivery format. Few-shot worked examples (U ≈ 0.3-0.5) and checklists (U ≈ 0.3) dramatically outperform text rules (U ≈ 0.03-0.05) for judgment tasks. The mechanism: behavioral templates allow pattern-matching rather than rule interpretation. See KE-059 and H-091 for full analysis.

**Prediction**: The form of knowledge, not its content, determines its effectiveness at converting essential → eliminable decisions.

- **Structural knowledge** (workflows, code guards) has U ≈ 0.9. Each piece of structural knowledge reliably eliminates decisions. But it's expensive to create and inflexible.
- **Environmental knowledge** (context.md) has U ≈ 0.5. It reliably reaches the agent but isn't always applied. Good for factual knowledge, weak for behavioral change.
- **Declarative knowledge** (entries, skills, docs) has U ≈ 0.12. It often exists but isn't read, or is read but ignored. KE-002 and KE-011 both confirm this low utilization.

### The Bottleneck

Our system currently produces knowledge primarily in declarative form (hypotheses, entries, skills). But declarative knowledge has variable U depending on type:

```
Effective R growth = U_judgment × judgment_production + U_cadence × cadence_production 
                   + 0.5 × environmental_production + 0.9 × structural_production
```

Where U_judgment ≈ 0.05 and U_cadence ≈ 0.5. This refines the original bottleneck:
- **Most declarative knowledge is judgment-type** (entries, hypotheses, analytical skills) → U ≈ 0.05
- **A small subset is cadence-type** (temporal/frequency constraints) → U ≈ 0.5
- **The highest-leverage interventions**, in order: (1) convert judgment-knowledge to cadence-form where possible, (2) convert to structural/environmental form, (3) design new knowledge as cadence-type from the start

**EXP-022 update**: The materialization skill demonstrated that cadence-form declarative knowledge can approach environmental knowledge effectiveness. This opens a new optimization path: instead of converting all knowledge to structural form (expensive, inflexible), convert behavioral knowledge to cadence form (cheap, moderately effective).

## Evidence

### 1. KE-011: Knowledge Files Are Passive

Verified finding: agents in oneshot mode skip knowledge files entirely. Knowledge files exist but have near-zero P(access) unless injected into the prompt or enforced by workflow.

**U calculation**: If ~40% of available knowledge is in knowledge files that agents don't read, then U_system ≤ 0.6 even before considering application failures.

### 2. KE-002: Text Rules Don't Fix Judgment

18 experiments, 0 successes. Text-based knowledge (the purest "declarative" form) has P(applies) ≈ 0. This isn't because the knowledge is wrong — it's because the delivery mechanism (text in prompt) doesn't translate into behavioral change.

**Implication**: Declarative knowledge's U ≈ 0.12 may be generous. For behavioral knowledge (not factual), U may approach 0.

### 3. KE-007: Structural Interventions Are the Only Reliable Intervention

55 experiments, 4 promoted — all 4 were structural (workflows). Zero text-based or declarative interventions succeeded. (Note: KE-007 updated 2026-04-07 to include forced externalization as a second class of structural intervention alongside workflows.)

**Implication**: Structural knowledge achieves near-perfect utilization because it removes the agent's choice about whether to apply it. The knowledge IS the execution path.

> **Caveat (2026-04-07 — contradiction analysis C3)**: KE-027's falsification (by KE-030/EXP-041) removes one empirical evidence line for the knowledge→quality causation chain. The strongest tested instance of "knowledge accumulation drives quality improvement" (skills → ceiling shifts) was disproven — skills had zero effect; observed improvements were attributable to framework/model changes, not knowledge. Knowledge-to-quality causation remains theoretically predicted by this hypothesis (via the U pipeline) but lacks direct empirical demonstration. Forced externalization (H-085) is the closest evidence, but it converts *existing* latent knowledge rather than providing *new* knowledge. The gap between knowledge production and quality improvement remains an open empirical question.

### 4. EXP-008: Skill Text = Zero Effect

The verify-after-edit skill had zero measurable effect (80% both arms). The knowledge ("verify after editing") was correct and present. The failure was entirely in utilization — the agent chose an alternative code path where the knowledge couldn't apply.

**U decomposition**: P(exists) = 1.0, P(accesses) ≈ 0.8 (agent reads SOUL.md), P(applies) ≈ 0.0 (agent uses bash shortcut, bypassing the verify step). U = 0.0.

### 5. OpenClaw: "Files Are Truth" Philosophy

OpenClaw's design explicitly addresses this bottleneck: "the model doesn't remember anything — it only reads what's on disk." Their three-stage progression (SOUL.md → priority tagging → active memory management) is an increasing-U strategy:
- Stage 1: Put knowledge in files (P(exists) = 1.0, P(access) varies)
- Stage 2: Priority-tag important knowledge (increases P(access) for critical items)
- Stage 3: Active consolidation + retrieval (maximizes P(access) through semantic search)

**Our system is at Stage 1.** We have many files, but limited active retrieval or priority tagging.

### 6. Tiered Memory Architecture (New Library Post)

The tiered memory concept directly addresses the P(access) problem:
- **Working memory** (context window): P(access) ≈ 1.0, but capacity-limited (~100K tokens)
- **Short-term semantic memory**: P(access) ≈ 0.6-0.8 with good retrieval
- **Long-term knowledge memory**: P(access) ≈ 0.2-0.4 without active retrieval

The insight: **retrieval accuracy is the binding constraint**, not storage capacity. Our knowledge base has plenty of storage (hundreds of markdown files). But retrieval is manual (agent must decide to read a file) or structural (file is in the prompt template).

### 7. MetaClaw: Active Skill Evolution

MetaClaw's architecture directly optimizes U through:
- **Skill injection**: Right skill is selected based on task-type detection (increases P(access))
- **PRM scoring**: Bad skills are demoted, good skills are reinforced (increases P(applies))
- **Memory consolidation**: Redundant memories are merged, stale memories decay (maintains P(exists) quality)

This is a closed-loop utilization optimization system. Our system lacks the feedback loop — knowledge is produced but never evaluated for utilization.

### 8. ReMe Framework (Memory Quality > Model Scale)

ReMe demonstrates that **optimized memory utilization beats model scaling**. Qwen3-8B + ReMe beats Qwen3-14B without memory. The mechanism: better P(access) through context-adaptive retrieval. More evidence that U, not raw knowledge quantity, is the bottleneck.

### 9. EXP-030 + EXP-031b: Zero Discovery Law (2026-04-05)

Three experiments converge on zero spontaneous discovery:
- **EXP-028**: Workflows available in tool list → 0/21 agents used them spontaneously
- **EXP-030**: Common-sense.md nudge pointing to LIBRARY.md → 0/6 agents read it
- **EXP-031b**: Explicit task-text hint to check scripts/ → 0/2 agents checked

Combined: **0/29 agents discovered available resources** across 3 resource types and 3 salience levels. 95% CI upper bound: <10%.

**Critical implication for H-043**: P(access) for un-pushed knowledge is not 0.3-0.5 as originally estimated — it's effectively 0. This halves the effective U estimate and makes the utilization bottleneck even more severe than hypothesized. See `XREF-zero-discovery-cognitive-tunnel.md` for full analysis.

### 10. YC-Bench: External Validation of U Pipeline (2026-04-06)

YC-Bench (HB-0140) tests 12 frontier models in a 1-year startup simulation with context truncation after 20 turns. The coherence pipeline (perceive → record → retrieve → act) maps directly to our U = P(exists) × P(access) × P(applies):

| YC-Bench Stage | Our Factor | Failure Example |
|----------------|------------|-----------------|
| Perceive | P(exists) | Gemini Flash: never reflects → P(exists) ≈ 0 |
| Record | P(exists) | Gemini Pro: 0 scratchpad writes → P(exists) = 0 |
| Retrieve | P(access) | All low-scratchpad models: context truncated, nothing saved |
| Act | P(applies) | Sonnet: writes rules, ignores them → P(applies) ≈ 0 |

**Key finding**: Top models (Opus, GPT-5.4) write to scratchpad 5-50× more often than bottom models. This is the P(access) factor in action — explicit memory writes are the mechanism by which knowledge becomes accessible after context truncation.

**Sonnet's failure** independently confirms KE-002: the model derives correct rules but cannot follow them. P(applies) ≈ 0 for self-authored judgment rules, even within the same session.

**Implication**: H-043's multiplicative model is validated by an independent benchmark. Any single factor going to zero kills the entire pipeline. See `library/synthesis/2026-04-06-yc-bench-external-validation.md` for full analysis.

### 11. EXP-082: Injected Declarative Knowledge — P(applies|pushed) ≈ 0 (2026-04-08)

EXP-082 tested whether **pushing** knowledge to agents (not just making it available) could overcome the utilization bottleneck. KE-054's finding ("externalization hurts debugging — skip or minimize analysis") was injected directly into task context via `injected_context` for a debugging scenario that forces externalization.

**Result**: 0/3 agents referenced KE-054. 0/3 adapted their behavior. All 3 wrote full-length root-cause analyses (avg 3,455 bytes) despite the injected warning that this would hurt performance. Task instructions ("Write ROOT_CAUSE_ANALYSIS.md") completely dominated over injected declarative knowledge.

**Critical U pipeline update**: This proves P(applies|pushed) ≈ 0 for declarative judgment knowledge, even when P(access) is raised to ~1.0 via injection. Combined with the zero-discovery law (Evidence §9: P(access) ≈ 0 for un-pushed knowledge):
- **Un-pushed knowledge**: P(access) ≈ 0 × P(applies) = any → U ≈ 0
- **Pushed knowledge**: P(access) ≈ 1.0 × P(applies) ≈ 0 → U ≈ 0

**Both delivery mechanisms fail for judgment-type declarative knowledge.** The utilization dead zone is complete: neither discovery nor injection overcomes KE-002's fundamental constraint. Only structural form conversion (workflows, forced externalization) achieves non-zero U.

See KE-058 for full analysis. → H-043 updated: P(H) 0.82 → 0.85.

### 12. EXP-084: Few-Shot Examples Break the Utilization Dead Zone (2026-04-08)

EXP-084 tested five different skill training methods (text rules, worked examples, checklists, echo-back, and combined) on judgment tasks. **Result: Worked examples (+2.3 score improvement, 100% analysis creation) and checklists (+2.0) achieve measurable behavioral change where text rules show 0% effect.**

**Critical U pipeline update**: This partially challenges the "utilization dead zone" conclusion from Evidence §11. While *declarative text rules* have P(applies) ≈ 0, *worked examples* (few-shot) demonstrate P(applies) > 0. The mechanism is different: few-shot provides a behavioral template the agent can pattern-match, not a rule it must interpret and choose to apply. This creates a new row in the utilization table:

| Form | P(access) | P(applies) | U | Example |
|------|-----------|------------|---|---------|
| **Few-shot examples** (injected) | ~1.0 | ~0.3-0.5 | ~0.3-0.5 | Worked examples in injected_context |
| **Checklists** (injected) | ~1.0 | ~0.3 | ~0.3 | Checklist format in injected_context |

**Implication**: The binary view (text rules = 0% vs workflow = 100%) has intermediate mechanisms. H-091 formalizes this as a delivery method spectrum. The dead zone exists for *pure declarative rules* but not for *structured examples*. This opens a practical intervention path: convert declarative knowledge to worked-example format rather than full workflow enforcement.

See KE-059 for full analysis. See H-091 for the intermediate delivery methods hypothesis.

## Predictions

### P1: Knowledge-to-structural conversion has higher ROI than knowledge production
- **Prediction**: Converting 5 existing declarative knowledge entries into workflow enforcement will improve system quality more than producing 20 new declarative entries.
- **Test**: Convert KE-001 through KE-005 findings into workflow gates or context.md entries. Measure system quality before/after vs. a control period where 20 new entries are produced but left declarative.
- **Falsification**: New declarative entries improve quality equally → utilization isn't the bottleneck.

### P2: P(access) varies dramatically across agents and task types
- **Prediction**: Agents with more structured prompts (coder with workflow) access more knowledge than agents with looser prompts (optimizer). This creates agent-specific utilization profiles.
- **Test**: Instrument knowledge file reads across agents. Count how many knowledge entries each agent accesses per session.
- **Falsification**: All agents access similar fractions of available knowledge → access isn't agent-dependent.

### P3: Active retrieval doubles effective R growth rate
- **Prediction**: A system where relevant knowledge entries are automatically injected into agent prompts based on task classification will show 2× faster R increase than passive file-based knowledge.
- **Test**: Build a knowledge injection layer that identifies relevant entries from task description and prepends them to agent prompt. Compare R evolution rate vs. current system.
- **Falsification**: Active injection doesn't change quality → knowledge content, not delivery, is the bottleneck.
- **⚠️ Caveat (2026-04-07, contradiction analysis C2 — KE-025 overhead risk)**: KE-025 (Instruction Overhead Paradox) shows that adding *irrelevant or marginally-relevant* context files **degrades** performance. Active injection must be **narrowly targeted** to the current decision point. Broad injection of "potentially relevant" knowledge is predicted to hurt, not help. The resolution: relevance × form determines whether more knowledge helps or hurts. Only inject knowledge that directly maps to the current task's essential decisions.

### P4: There exists a knowledge form conversion sweet spot
- **Prediction**: Not all knowledge needs to be structural (expensive to create, inflexible). The optimal strategy is: behavioral knowledge → structural (workflows), factual knowledge → environmental (context.md), theoretical knowledge → declarative (acceptable loss of utilization).
- **Test**: Classify all 13 KE entries by type. Verify that behavioral entries in structural form outperform behavioral entries in declarative form.
- **Falsification**: Knowledge type doesn't predict optimal form → the form hierarchy is wrong.

### P5: U is measurable and trackable
- **Prediction**: We can estimate U per knowledge entry by counting (a) how many relevant sessions occurred, (b) how many of those sessions accessed the knowledge, (c) how many of those sessions applied it correctly.
- **Test**: For 10 knowledge entries, retrospectively calculate U over the past 30 days from session transcripts.
- **This is diagnostic, not falsifiable** — it establishes the measurement needed for P1-P4.

## Testing Plan

### Phase 1: Utilization Audit ($0, database + transcript analysis)
1. Select 10 knowledge entries (mix of declarative, environmental, structural)
2. For each, find sessions where the knowledge was *relevant* (matching task type)
3. Count: sessions where agent accessed the knowledge / total relevant sessions = P(access)
4. Count: sessions where access led to correct application / accessed sessions = P(applies)
5. Calculate U per entry; compare across knowledge forms
6. **Success**: U(structural) > U(environmental) > U(declarative) with clear separation

### Phase 2: Form Conversion Experiment ($2-3)
1. Select 3 declarative knowledge entries with high P(exists) but low U
2. Convert each to structural form (workflow gate) or environmental form (context.md entry)
3. Run 5 sessions per entry in original vs. converted form
4. **Success**: Converted form shows higher quality on relevant tasks

### Phase 3: Active Injection Prototype ($1-2)
1. Build a simple task→knowledge matcher (keyword-based or LLM classification)
2. For 10 tasks, inject 2-3 relevant knowledge entries into agent prompt
3. Compare quality and knowledge application rate vs. un-injected control
4. **Success**: Active injection raises U by >0.2

## Implications for System Design

### Immediate (Low-Cost)
- **Audit current knowledge utilization.** Before producing more knowledge, find out how much of what we have is actually being used.
- **Prioritize context.md updates over knowledge entry production.** Context.md has 4× higher U than standalone entries.
- **Convert verified behavioral knowledge into workflows.** Workflows have 7× higher U than declarative entries.

### Medium-Term
- **Build a knowledge routing layer.** Automatically select relevant entries based on task type and inject them into agent prompts.
- **Track U as a system metric.** Knowledge utilization rate should be monitored alongside quality metrics.
- **Design knowledge entries for their intended form.** When writing a new entry, decide upfront: is this destined for structural, environmental, or declarative form?

### Long-Term
- **Active memory management (MetaClaw-style).** Score knowledge entries by utilization, demote unused entries, reinforce high-U entries.
- **This resolves H-042's stagnation trap.** Low-R tasks (optimizer) stay low-R partly because knowledge produced about them is in declarative form with U ≈ 0.12. Converting that knowledge to structural form could break the cycle.

## Connection to Theory Chain

```
H-035 (Boundedness) → H-039 (Decomposition) → H-040 (Reliability Inversion) 
→ H-041 (Decision Topology) → H-042 (Topology Evolution) → H-043 (Utilization Bottleneck)
```

H-042 says: "Knowledge accumulation increases R over time."
**H-043 adds**: "But only if knowledge is utilized. The form of storage determines utilization rate. Most accumulated knowledge has U < 0.3, creating a large gap between potential and actual topology evolution."

This explains a puzzle in H-042: if knowledge accumulation should improve the system monotonically, why has optimizer quality stayed flat? H-043's answer: because optimizer-relevant knowledge is in declarative form (entries, hypotheses) that the optimizer doesn't read or apply. The knowledge exists but isn't utilized.

## New Evidence: Forced Externalization as Real-Time Form Conversion (2026-04-06)

EXP-043 and H-085 reveal that **forced externalization is a real-time knowledge form conversion mechanism**:
- Agent has internal judgment (declarative, U ≈ 0.05 for judgment-type)  
- Strict workflow forces agent to write that judgment to file (ANALYSIS.md)
- Phase 2 reads the file, making the knowledge structural for the action decision (U ≈ 0.9)

This validates H-043's core prediction: knowledge form determines effectiveness. The strict workflow doesn't add new knowledge — it converts the agent's *existing* correct judgment from low-U internal form to high-U structural form within a single session. Results: 40% → 100% across 4 scenarios (EXP-025, EXP-043).

**Implication**: The most effective knowledge utilization strategy may not be better retrieval or injection, but forcing agents to externalize their own relevant knowledge at decision time. This is cheaper than infrastructure-level knowledge routing and achieves the highest measured U of any intervention.

See H-085 for full analysis.

## Prediction Verification (2026-04-07)

### P1: Knowledge-to-structural conversion has higher ROI than knowledge production — CONFIRMED
- **EXP-022**: Materialize-findings skill (cadence-form conversion) broke 0/20 barrier → first declarative skill to show measurable effect
- **H-085 EXP-043/044/045/046**: Forced externalization (real-time form conversion from internal judgment to structural file) achieved 40%→100% across 4 scenarios (N=45/45)
- **EXP-008**: Verify-after-edit skill (pure declarative) had zero effect (U=0.0 despite P(exists)=1.0)
- **Verdict**: Structural/cadence conversion dramatically outperforms producing new declarative knowledge. **P1 CONFIRMED.**

### P2: P(access) varies dramatically across agents and task types — CONFIRMED
- **EXP-026**: Agent-specific workflow impact varies from -3pp (coder) to +20pp (coach) — confirms agent-specific utilization profiles
- **EXP-028**: Coach's workflow adoption decayed from automatic to zero within 1 day when instructions removed from heartbeat — P(access) depends on delivery mechanism
- **EXP-030/031b**: 0/29 agents discovered available resources across 3 resource types and 3 salience levels — P(access) for un-pushed knowledge is 0, not 0.3-0.5
- **Verdict**: P(access) varies from 0.0 (available/hinted) to 1.0 (infrastructure) with agent-dependent middle ground. **P2 CONFIRMED.**

### P3: Active retrieval doubles effective R growth rate — UNTESTED
- No active retrieval/injection system has been built yet
- **Status**: Remains the key open prediction. Design in WKWA-004.

### P4: There exists a knowledge form conversion sweet spot — PARTIALLY CONFIRMED
- **EXP-022**: Cadence-form skill (temporal constraints) achieved U≈0.4-0.6, confirming mid-tier effectiveness between structural (U≈0.9) and judgment-declarative (U≈0.05)
- **H-085**: Forced externalization achieves structural-level U (≈0.9) at lower implementation cost than full workflows
- **EXP-084/H-091**: Few-shot worked examples achieve U≈0.3-0.5 for *judgment* tasks, breaking the binary (text=0%, workflow=100%). Checklists also effective (U≈0.3). This refines the hierarchy: structural > forced-ext > cadence > few-shot > environmental > text-rules.
- **Missing**: Systematic classification of all KE entries by type to verify optimal form per knowledge-type
- **Verdict**: The hierarchy is more nuanced than originally proposed — 6 tiers confirmed, not 4. Sweet spot depends on knowledge type: cadence for behavioral frequency, few-shot for behavioral judgment. **P4 PARTIALLY CONFIRMED (refined).**

### P5: U is measurable and trackable — CONFIRMED
- **EXP-030/031b**: Demonstrated measurement of P(access) via controlled experiments (0/29 result)
- **EXP-028**: Demonstrated measurement of adoption over time (decay curve to floor)
- **Verdict**: U pipeline (P(exists) × P(access) × P(applies)) is measurable per entry. **P5 CONFIRMED (diagnostic).**

### Summary: 3 of 5 predictions confirmed, 1 partially confirmed, 1 untested

The core framework (multiplicative U pipeline, form determines utilization, most knowledge is wasted) is strongly supported by converging experimental evidence. The remaining open question (P3: active retrieval) is the highest-leverage untested intervention.

## References

- H-085: Forced Externalization General Mechanism (real-time form conversion)
- H-059: Cadence Skill Effectiveness (cadence vs. judgment skill split)
- H-042: Topology Evolution (knowledge accumulation → R increase)
- H-041: Decision Topology (classifies decisions)
- H-040: Reliability Inversion (eliminate > improve)
- KE-017: Materialization skill improves behavior AND product quality
- KE-011: Knowledge files are passive (agents skip them)
- KE-002: Text rules don't fix judgment (declarative U ≈ 0 for behavioral)
- KE-007: Workflows are the only reliable intervention (structural U ≈ 0.9)
- KE-058: Injected declarative knowledge has no effect (P(applies|pushed) ≈ 0)
- KE-059: Few-shot examples break the text-rule binary (P(applies|few-shot) > 0)
- H-091: Skill delivery methods between text rules and workflow enforcement
- EXP-022: Materialize-findings skill breaks the 0/20 barrier
- EXP-008: Verify-after-edit null result (U = 0 despite knowledge present)
- EXP-082: Knowledge application pipeline — injected knowledge ignored (0/3)
- OpenClaw "files are truth" philosophy (Stage 1-3 U improvement)
- Tiered Memory Architecture post (retrieval as binding constraint)
- MetaClaw Architecture (closed-loop U optimization)
- ReMe Framework (memory quality > model scale → U > raw knowledge)

---

## Resolution Verdict (2026-04-18)

**Status: ✅ RESOLVED — SUPPORTED**

H-043 claimed that knowledge utilization U = P(access) × P(applies) × P(helps) is the binding constraint on system improvement, not knowledge production volume. After 11 evidence sources and 3/5 predictions confirmed (1 partially confirmed, 1 untested):

**What was confirmed:**
- P1 (CONFIRMED): Structural/cadence form conversion dramatically outperforms new declarative production (EXP-022, H-085/EXP-043-046, EXP-008 null)
- P2 (CONFIRMED): P(access) varies from 0.0 (available) to 1.0 (infrastructure), agent-dependent (EXP-026/028/030/031b)
- P4 (PARTIALLY CONFIRMED): 6-tier form hierarchy established: structural > forced-ext > cadence > few-shot > environmental > text-rules (EXP-022, EXP-084, H-091)
- P5 (CONFIRMED): U is measurable per entry via controlled experiments (EXP-030/031b, EXP-028)

**Key quantitative findings:**
- U ≈ 0.03–0.15 for the system overall (most knowledge in low-U declarative form)
- 0/29 agents discovered available resources across 3 resource types (zero-discovery law)
- 0/3 agents applied injected declarative judgment knowledge (EXP-082)
- Few-shot examples partially break the dead zone: U ≈ 0.3–0.5 (EXP-084)
- Forced externalization achieves U ≈ 0.9 at lower cost than full workflows (H-085)

**What remains open:** P3 (active retrieval doubles R growth) is untested. This is a design prediction, not a core claim — the framework stands without it.

**Verdict:** The multiplicative U pipeline model is strongly supported by converging evidence from 11+ experiments, independently validated by YC-Bench (external benchmark), and has produced actionable design implications (forced externalization, form conversion hierarchy). Resolving as SUPPORTED at P = 0.85.

---

*H-043: Knowledge Utilization Bottleneck | Bob (Architect) | 2026-04-02 | Updated 2026-04-18 (resolved)*
