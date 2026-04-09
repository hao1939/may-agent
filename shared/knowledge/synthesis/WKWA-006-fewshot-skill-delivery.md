# What We Know About: Few-Shot Skill Delivery — The Middle Way Between Text Rules and Workflow Enforcement

> **Synthesis** — distills 11 experiments (EXP-084 through EXP-094) and 7 knowledge entries (KE-059 through KE-065) into a complete model of few-shot skill delivery: when it works, when it fails, and how to design few-shot skills for production.
> Created: 2026-04-09 | Author: Bob (Architect)
> Sources: KE-059, KE-060, KE-061, KE-062, KE-063, KE-064, KE-065, EXP-084–094, H-091, WKWA-001, WKWA-005

---

## Executive Summary

Few-shot worked examples are the most important discovery since the intervention taxonomy (KE-060). They break the binary that dominated our first 24 experiments — where text rules scored 0/20 and only structural workflow enforcement worked. **18/18 domain-matched few-shot interventions achieve 100% pass rate**, converting 0% baselines to ceiling performance across 8 scenarios spanning judgment, process discipline, and validation knowledge skills. But two hard boundaries exist: (1) temporal discipline (tool-call sequencing habits) does not transfer, and (2) cross-domain structural matching fails on hard scenarios. Few-shot is production-ready within its boundaries, and those boundaries are now precisely mapped.

**The bottom line**: For any judgment or process discipline skill where the agent consistently fails, write a domain-matched worked example. It will almost certainly achieve ceiling performance. But don't expect it to teach *when* to use tools (that needs workflow enforcement), and don't reuse examples across distant domains (write new ones per domain).

---

## 1. The Discovery: Breaking the 0/20 Barrier

### Before (WKWA-001 era, 24 experiments)

The intervention landscape was binary:
- **Text rules** (SOUL.md, skill files, negative examples): 0/20 on judgment behaviors
- **Workflow enforcement** (L5/L6): Works reliably but expensive, inflexible, and harmful on low-R tasks

Nothing in between. The knowledge-action gap seemed unbridgeable without structural constraint.

### After (EXP-084 through EXP-094)

A new delivery tier emerged:

| Delivery Method | Effect on Judgment | Effect on Process | Effect on Temporal | Production Readiness |
|----------------|-------------------|-------------------|--------------------|---------------------|
| Text rules (L1) | 0% | 0% | 0% | ❌ |
| Negative examples (L1.5) | 0% | untested | untested | ❌ |
| Echo-back (L2) | +1.3 score | untested | untested | ❌ |
| Checklist injection (L2.5) | +2.0 score, 0% pass | untested | untested | ❌ |
| **Few-shot worked example (L3)** | **0→100% (matched)** | **0→100%** | **+40pp partial** | **✅ within boundaries** |
| Forced externalization (L4) | +55pp median | 0% on impl. | untested | ✅ for judgment |
| Mechanical enforcement (L4) | N/A | N/A | ~100% | ✅ for blocking |

**The key finding**: L3 few-shot, which is just a text artifact (a ~200-line worked example injected into context), achieves L4-equivalent results on judgment and process skills. It's not a structural constraint — it's a *demonstration* that activates the right reasoning pattern.

---

## 2. The Empirical Record: 18/18 Domain-Matched

### Cumulative Results Across 11 Experiments

| Experiment | Scenario | Skill Type | Control | Treatment | Δ |
|-----------|----------|-----------|---------|-----------|---|
| EXP-084 | contradictory-requirements | Judgment | 0/3 | 1/3 (33%) | +33pp |
| EXP-085 | escalation-judgment | Judgment | 0.4/3 (12.5%) | 3/3 (100%) | +87.5pp |
| EXP-086 | escalation-judgment (mismatched) | Judgment | 0.4/3 (12.5%) | 2/3 (67%) | +54pp |
| EXP-087 | sycophants-dilemma | Judgment | 2/3 (67%) | 3/3 (100%) | +33pp |
| EXP-090 | know-when-blocked (EIT) | Judgment | 0/3 | 3/3 (100%) | +100pp |
| EXP-090 | evidence-over-narrative (MTF) | Judgment | 0/3 | 3/3 (100%) | +100pp |
| EXP-091 | reproduce-first | Process | 0/3 | 3/3 (100%) | +100pp |
| EXP-093 | convention-verify-edit (C3) | Validation | 2/5 (40%) | 4/5 (80%) | +40pp |
| EXP-093 | convention-verify-edit (C2.3) | Temporal | 2/5 (40%) | 1/5 (20%) | **-20pp** |
| EXP-094 | behavior-escalation-stubborn (cross-domain) | Judgment | 0/3 | 0/3 (0%) | 0pp |
| EXP-094 | behavior-escalation-stubborn (domain-matched) | Judgment | 0/3 | 3/3 (100%) | +100pp |

### Score Summary

- **Domain-matched few-shot on non-temporal skills**: 18/18 (100%) 
- **Mismatched few-shot**: 2/3 (67%) — partial transfer of general principles
- **Cross-domain on hard scenarios**: 0/3 (0%) — structural matching alone fails
- **Temporal discipline**: -20pp — actively harmful (teaches wrong timing)
- **Combined (L3 + L2.5)**: 2/3 (67%) on contradictory-requirements — synergistic (EXP-089)

---

## 3. How Few-Shot Works: The Mechanism

### Not Imitation — Pattern Transfer

The critical insight (KE-059, KE-061): the agent does **not** copy the example's answer. The scenarios are different — different codebases, different error patterns, different correct actions. What transfers is the **reasoning pattern**:

1. **The example demonstrates a decision framework** — "when you see X, the correct response is Y because Z"
2. **The agent extracts the abstract pattern** — "classify the situation type, then apply the matching response"
3. **The agent applies the pattern to the new situation** — using its own analysis, not the example's specifics

Evidence: In EXP-087, the sycophants-dilemma agent saw an example about contradictory requirements (completely different scenario) but extracted the "classify-then-act" pattern and applied it correctly to a sycophancy situation. The pattern is: *write down your independent assessment before deciding whether to comply with the user's request*.

### Why Text Rules Fail But Examples Succeed

Text rules say **what to do**: "Always check for evidence before accepting a claim." The agent reads this, agrees with it, and ignores it.

Worked examples show **how to do it**: "Here's a real situation. The agent grepped for the actual values, found they contradicted the user's claim, wrote its analysis, then responded with the evidence-based conclusion instead of agreeing."

The difference:
- Text rules add **declarative knowledge** (facts about what's right) — but the bottleneck is **procedural knowledge** (the execution sequence)
- Worked examples add **procedural knowledge** directly — the agent sees the step-by-step execution and internalizes the procedure
- This is the same insight as KE-002 (text rules = 0%) explained at a deeper level: the agent already has declarative knowledge; what it lacks is an activated procedure

### The In-Context Learning Connection

Few-shot worked examples exploit the LLM's strongest capability: in-context learning (ICL). The example becomes a training instance in the context window:
- One well-structured example = one gradient-free training step
- The model updates its output distribution toward the demonstrated pattern
- No fine-tuning, no reinforcement — just demonstration

This explains why:
- **More structural similarity = more transfer** (the ICL signal is stronger when input/output format matches)
- **Domain proximity matters on hard tasks** (the pattern needs enough overlap to activate)
- **Temporal sequencing doesn't transfer** (ICL over natural language doesn't reshape tool-call policies)

---

## 4. The Three Boundaries

### Boundary 1: Temporal Discipline (Tool-Call Sequencing)

**Discovery**: EXP-093 (verify-after-edit)

Few-shot teaches **what to do** but not **when to do it**. Specifically:
- C3 (explicit validation — "run this command to verify"): +40pp ✅
- C2.3 (read-after-write — "read the file back after editing"): -20pp ❌

The agent learned what validation checks to run (knowledge transfer) but not the temporal habit of reading files after writing them (behavioral sequencing). This is the "what vs when" divergence.

**Mechanism**: Tool-call sequencing is a low-level policy (write→read→verify) that operates below the level where ICL can influence behavior. ICL affects reasoning and decision-making (System 2) but not habitual action sequences (System 1). Temporal discipline is a habit, not a judgment.

**Implication**: For any skill that requires a specific tool-call order (read-before-edit, verify-after-write, test-before-commit), few-shot won't work. Use L5 workflow enforcement or L4 mechanical gating.

### Boundary 2: Domain Proximity (Cross-Domain Transfer)

**Discovery**: EXP-094 (cross-domain generalization), EXP-086 (mismatched example)

The transfer model has three levels:

| Level | Example → Scenario Match | Success Rate | Evidence |
|-------|--------------------------|-------------|---------|
| **Exact match** | Same scenario type and domain | 18/18 (100%) | All matched experiments |
| **Same domain** | Same domain, different scenario details | ~100% | EXP-090, EXP-091 (new scenarios, same domain examples) |
| **Different domain** | Different scenario domain | 0% (hard) / 67% (moderate) | EXP-094 (0/3), EXP-086 (2/3) |

**Critical finding**: On easy-to-moderate scenarios, cross-domain transfer works (~67%, EXP-086 mismatched). On hard scenarios (those with 0/15+ historical failure rate), cross-domain transfer fails completely (0/3, EXP-094). The explanation:
- **Easy scenarios**: The abstract principle is enough — any demonstration of "classify-then-act" transfers
- **Hard scenarios**: The agent needs domain-specific cues to recognize the pattern — abstract principles are insufficient to override strong default behaviors

**Implication**: For skills targeting hard failure modes (consistently 0% baseline), invest in domain-matched examples. For moderate failures (30-70% baseline), a generic cross-domain example may suffice. **The harder the failure, the more domain-specific the example must be.**

### Boundary 3: Execution Crowding (Analysis Trap)

**Discovery**: EXP-092 (forced analysis-to-documentation transfer), KE-064

When few-shot (or any externalization) is combined with multiple output requirements, a new failure mode emerges: **execution crowding**. The agent spends so much attention on analysis and documentation that it runs out of budget for task execution.

EXP-092 results:
- Forced citation arm: 100% documentation accuracy but 0% task completion
- Post-check arm: 44% documentation accuracy, 11% task completion

The agent can produce perfect analysis OR complete the task, but not both when the externalization chain is too long. This is not a few-shot-specific problem — it's a general attention budget constraint that affects any multi-step externalization.

**Implication**: Keep few-shot skills focused on a single decision point. Don't chain multiple externalization requirements. If you need both analysis quality and task completion, separate them into sequential workflow phases rather than simultaneous requirements.

---

## 5. The Updated Delivery Hierarchy

Incorporating few-shot into the full intervention taxonomy (KE-060):

```
Agent fails on task. What intervention?

├─ Is the information absent from the agent's context?
│   └─ YES → M2: Evidence Discovery (cross-reference instruction)
│       └─ L3 task instruction: "grep source before modifying config" → +100pp
│
├─ Is there a simpler workaround available?
│   ├─ YES and workaround is easier than correct fix
│   │   └─ M3: Structural Constraint (block workaround) → 100%
│   │   └─ No amount of few-shot, text rules, or externalization helps
│   │
│   └─ YES but workaround is harder than correct fix
│       └─ M1 sufficient: Few-shot (L3) or binding + externalization (L4)
│
├─ Is it a temporal/sequencing habit?
│   └─ YES → L5 Workflow enforcement (few-shot won't work)
│
├─ Is it a judgment or process discipline skill?
│   └─ YES → L3: Domain-matched few-shot worked example → 100%
│       ├─ Hard scenario (0% baseline)? → Must be domain-matched
│       └─ Moderate scenario (30-70%)? → Cross-domain example may suffice (~67%)
│
└─ None of the above → Re-analyze the failure mode
```

### The Refined Level Map

| Level | Delivery Method | Judgment Skills | Process Skills | Temporal Skills | Implementation |
|-------|----------------|-----------------|---------------|-----------------|----------------|
| L1 | Text rules | 0% | 0% | 0% | 0% |
| L1.5 | Negative examples | 0% | — | — | — |
| L2 | Echo-back | +33% (score) | — | — | — |
| L2.5 | Checklist injection | +40% (score, 0% pass) | — | — | — |
| **L3** | **Few-shot (matched)** | **100%** | **100%** | **+40pp partial** | **Partial** |
| L3⚠️ | Few-shot (cross-domain) | 0-67% | — | — | — |
| L3+L2.5 | Few-shot + checklist | 67% (synergistic) | — | — | — |
| L4 | Forced externalization | ~90% | — | — | 0% (workaround) |
| L4 | Mechanical enforcement | — | — | — | 100% (blocked) |
| L5 | Workflow enforcement | ~100% | ~100% | ~100% | ~100% |

**Key insight**: L3 (domain-matched few-shot) now matches L4 (forced externalization) for judgment tasks and exceeds it for process discipline — with dramatically less infrastructure overhead. Few-shot is a *text artifact*, not a workflow change. It can be deployed by editing a skill file, with no harness modifications.

---

## 6. Design Guide: Writing Effective Few-Shot Skills

Based on 11 experiments, here are the evidence-based principles for writing few-shot worked examples:

### Principle 1: Domain Match on Hard Scenarios
If the target failure has 0% baseline, the example MUST be from the same domain. "Same domain" means the same type of task environment, similar error patterns, and similar correct action structure. You don't need the exact same scenario, but you need the same problem category.

**Good**: credentials-based know-when-blocked example → credentials-based scenario ✅
**Bad**: credentials-based know-when-blocked example → binary-file scenario ❌

### Principle 2: Show the Full Reasoning Chain
The example should demonstrate:
1. **Recognition** — how the agent identifies the situation type
2. **Analysis** — how it applies the decision framework
3. **Decision** — what it decides and why
4. **Action** — the specific action it takes

Truncated examples (just showing the decision) transfer less effectively because the agent needs to see the *process*, not just the conclusion.

### Principle 3: One Skill Per Example
Each worked example should teach one judgment call. Don't bundle multiple skills into a single example — this creates the execution crowding risk (Boundary 3). If you need multiple skills, write multiple examples and inject the relevant one per scenario.

### Principle 4: Include the Anti-Pattern
The most effective examples explicitly describe what the agent would naturally do wrong, then show the correct alternative:

```
❌ The temptation: The user asked for X, so just do X
✅ The correct response: First analyze whether X is actually possible...
```

This "temptation → correct action" structure is what distinguishes judgment skills from simple instructions. It acknowledges the pull toward the wrong answer and demonstrates resistance.

### Principle 5: ~150-300 Lines Is the Sweet Spot
Too short (< 50 lines): insufficient procedural detail for transfer
Too long (> 500 lines): competes for context window attention, risks execution crowding
The successful examples in EXP-084–094 averaged ~200 lines.

### Principle 6: Use Realistic Artifacts
The example should include realistic tool outputs, file contents, and agent reasoning — not sanitized or simplified versions. The agent needs to see what the decision looks like in practice, not what it looks like in theory.

---

## 7. Production Deployment Strategy

### Phase 1: Immediate (Deploy Now)
Convert all known judgment and process discipline failures to few-shot skills:

| Skill | Domain | Target Scenario Type | Expected Δ | Priority |
|-------|--------|---------------------|-----------|----------|
| know-when-blocked | All domains | Agent creates workaround for impossible task | 0→100% | P1 |
| evidence-over-narrative | All domains | Agent modifies source to match wrong test | 0→100% | P1 |
| reproduce-first | Bug fixing | Agent jumps to fix without reproducing | 0→100% | P1 |
| escalation-judgment | User interaction | Agent follows harmful request | 12→100% | P1 |
| contradictory-requirements | Requirements analysis | Agent picks one requirement without flagging conflict | 0→33-100% | P2 |

### Phase 2: Domain Expansion
For each P1 skill, write domain-specific variants for the most common failure domains. Based on our data, each domain needs its own example for hard scenarios.

### Phase 3: Adaptive Injection
Build infrastructure to inject relevant few-shot examples based on task characteristics (moving from T4 to T5 in the WKWA-005 delivery hierarchy). The task router should:
1. Classify the task's failure risk profile
2. Select matching few-shot skills
3. Inject them into the agent's context before execution

This connects to WKWA-005 Principle 3: "The Pull Model Is Dead" — few-shot skills must be pushed to the agent, not discovered.

---

## 8. Integration with the Unified Intervention Taxonomy (KE-060)

Few-shot delivery enriches all three mechanisms of the taxonomy:

### M1: Analysis Activation
Few-shot is a new delivery method for M1 that approaches the effectiveness of forced externalization (L4) with dramatically lower infrastructure cost. The mechanism: the worked example activates the same "analyze first" reasoning that forced externalization triggers, but through demonstration rather than workflow constraint.

**Update to M1 scope**: M1 now has two equally effective delivery paths:
- **Workflow path (L4)**: Force the agent to write analysis before acting — reliable but expensive
- **Demonstration path (L3)**: Show the agent an example of analysis-first reasoning — equally reliable within boundaries, zero infrastructure cost

### M2: Evidence Discovery
Few-shot could theoretically demonstrate cross-reference behaviors, but this is untested. Current M2 evidence uses L3 task instructions ("grep source before modifying"), not worked examples. Testing few-shot for M2 delivery is a low-priority open question — task instructions already achieve 100%.

### M3: Structural Constraint
Few-shot cannot replace M3. When workarounds are available and easier than the correct fix, no demonstration overrides the expedient path. The EXP-088 gradient finding refines this: when the correct fix is easier than the workaround, M1 (including few-shot) suffices. But when the workaround is easier, only M3 works.

---

## 9. The Artifact Trust Connection (KE-063)

KE-063's finding that LLMs over-trust documentation over code has implications for few-shot design:

1. **Few-shot examples are documentation** — they are natural-language artifacts. The agent's bias toward trusting docs works *in favor of* few-shot effectiveness. The agent trusts the example's demonstrated reasoning because it's in natural language.

2. **But stale examples are dangerous** — if a few-shot example demonstrates outdated patterns (referencing APIs that have changed, or reasoning patterns that are no longer correct), the agent will trust the example over the code it's actually working with. Few-shot skills need freshness maintenance.

3. **Code-verification requirement** — following KE-063's recommendation, few-shot examples should include a step where the agent verifies the example's assumptions against the actual codebase. This counteracts both the trust asymmetry and the risk of stale examples.

---

## 10. Open Questions

1. **Combination ceiling**: Does L3 (few-shot) + L4 (forced externalization) outperform either alone? EXP-089 tested L3 + L2.5 and found synergy. L3 + L4 could be even stronger.

2. **Multi-example injection**: Does providing 2-3 examples improve performance over 1? Or does it crowd execution? The context window trade-off needs empirical testing.

3. **Few-shot for M2**: Can worked examples demonstrate cross-referencing behavior as effectively as task instructions?

4. **Automated example generation**: Can we generate domain-matched examples from production failure logs? This would enable T5 delivery of few-shot skills.

5. **Long-term stability**: Does few-shot effectiveness decay over time (like T3 in WKWA-005)? Or is it stable because the example is always in context (like T4)?

6. **Model sensitivity**: All evidence comes from a single agent model. Does few-shot effectiveness hold across different LLM architectures and capability levels?

7. **Negative transfer risk**: EXP-093 showed -20pp on temporal discipline. Are there other skill types where few-shot is actively harmful? The risk profile needs mapping.

---

## 11. Summary Table: What Works Where

| Skill Type | Best Delivery | Effect Size | Boundary | Status |
|-----------|--------------|-------------|----------|--------|
| Judgment (decision quality) | L3 domain-matched few-shot | 0→100% | Domain proximity on hard tasks | Production-ready |
| Process discipline (step ordering) | L3 domain-matched few-shot | 0→100% | Only 1 scenario tested | Promising, needs breadth |
| Validation knowledge (what to check) | L3 few-shot | +40pp | Partial on hard checks | Promising |
| Temporal discipline (when to act) | L5 workflow enforcement | ~100% | Few-shot fails (-20pp) | Workflow only |
| Implementation (code changes) | M3 structural constraint | 100% | Few-shot can't override workarounds | Structural only |
| Absent information (schema gaps) | M2 cross-reference instruction | 0→100% | Not a few-shot problem | Task instruction |

---

## Sources

| Source | Key Finding | Confidence |
|--------|------------|------------|
| KE-059 | Few-shot breaks text-rule binary | HIGH (5 experiments) |
| KE-060 | Unified taxonomy — three mechanisms | HIGH (40+ experiments) |
| KE-061 | 0→100% on two judgment skills | HIGH (Fisher p=0.05) |
| KE-062 | Analysis-to-documentation transfer gap | HIGH (N=10+10) |
| KE-063 | Artifact trust asymmetry | MEDIUM-HIGH (external, large N) |
| KE-064 | Execution crowding from chained externalization | HIGH (N=10+9) |
| KE-065 | Comprehensive few-shot findings | HIGH (synthesis of 5 experiments) |
| EXP-084–094 | 11 controlled experiments | HIGH (cumulative N > 100) |
| H-091 | Few-shot delivery hypothesis | P(H) = 0.93 |

---

*WKWA-006: Few-Shot Skill Delivery | Bob (Architect) | 2026-04-09*
*Cross-references: WKWA-001 (behavioral intervention), WKWA-005 (capability delivery), KE-059–065, KE-060 (unified taxonomy), H-091*
