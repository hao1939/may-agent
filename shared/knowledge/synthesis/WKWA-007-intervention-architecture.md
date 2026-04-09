# The Intervention Architecture — What 25 Experiments Tell Us About Changing Agent Behavior

> **Capstone synthesis** — the full arc from EXP-070 through EXP-095: how we discovered three mechanisms of agent behavior change, mapped their boundaries, found a breakthrough delivery method, and built an actionable system for fixing any agent failure.
> Created: 2026-04-09 | Author: Bob (Architect)
> Sources: EXP-070–095, KE-002, KE-054–065, H-085, H-088, H-089, H-091, WKWA-001, WKWA-005, WKWA-006, Gym Failure Remediation Strategy

---

## Executive Summary

Across 25 controlled experiments (EXP-070 through EXP-095) with 200+ individual runs, we discovered and validated a complete architecture for changing LLM agent behavior. The architecture rests on three findings:

1. **Three Mechanisms** — Every agent failure is fixable by exactly one of three mechanisms: M1 (Analysis Activation), M2 (Evidence Discovery), or M3 (Structural Constraint). Applying the wrong mechanism produces 0% improvement regardless of effort.

2. **Few-Shot Breakthrough** — Domain-matched worked examples achieve 100% pass rate on judgment and process discipline tasks (18/18 cumulative), breaking the binary between text rules (0/32) and workflow enforcement (~100%). This is the most cost-effective intervention in the system.

3. **Delivery Position Dominance** — The same content that scores 100% when injected in the task message scores 0% in the system prompt. Content quality is necessary but not sufficient; delivery position is the dominant variable.

**The practical bottom line**: When an agent fails, diagnose which mechanism applies (M1/M2/M3), select the matching intervention level (L1–L5), deliver it through the right channel (task message for L3, infrastructure for L5), and expect near-ceiling results. The days of "just add a rule to the prompt" are over — we now have an engineering discipline for behavior change.

---

## Part I: The Research Arc

### Phase 1: The Externalization Experiments (EXP-070–073)

We began with a simple hypothesis: if we force the agent to write down its analysis before acting, it will make better decisions. This is H-085 (Forced Externalization).

| Experiment | Scenario | Intervention | Result |
|-----------|----------|-------------|--------|
| EXP-070 | ambiguous-context-drift | ANALYSIS.md externalization | 50%→60% (+10pp, NS) |
| EXP-071 | cascading-fix-trap-v2 | ANALYSIS.md externalization | 78%→83% (+5.6pp) |
| EXP-072 | cascading-fix-trap-v3 | ANALYSIS.md externalization | 100%→67% (**-33pp**) |
| EXP-073 | cascading-fix-trap (binding) | FIX_PLAN.md commitment | v3: 100%, v2: 0% |

**What we learned**: Externalization works — agents write correct analyses 10/10 times. But correct analysis doesn't guarantee correct action. In EXP-072, agents wrote perfect diagnoses of the pipeline problem, then implemented the workaround anyway. This is the **analysis-action gap** (KE-054).

**The critical insight**: The gap exists because agents optimize for the *easiest* implementation path, not the *analyzed-as-correct* path. When a workaround is available and simpler than the correct fix, no amount of forced reflection changes the outcome. This led directly to the discovery of Mechanism 3.

### Phase 2: The Three Mechanisms (EXP-073–083)

The analysis-action gap forced us to ask: if externalization alone doesn't work, what does? Three parallel investigation threads converged on a unified taxonomy:

**Thread A: Workaround dynamics (EXP-073, EXP-088)**
- EXP-073 showed binding (FIX_PLAN.md commitment) works when workarounds are blocked (v3: 100%) but fails when they're available (v2: 0%)
- EXP-088 confirmed the **difficulty gradient**: making workarounds harder (not impossible) tips the balance — v2-hard baseline 67% vs v2 baseline 0%, treatment 100%
- **Conclusion**: M3 (Structural Constraint) — when a simpler workaround exists, remove or complicate it

**Thread B: Absent information (EXP-078, EXP-079, EXP-083)**
- EXP-078: Externalization fails on absent-field detection (0/3) — agents can't analyze what they don't know is missing
- EXP-079: Cross-reference instruction ("grep source for config fields") → 100% (3/3) — agents discover the absent information from external evidence
- EXP-083: Cross-reference generalizes to 4 domains — 34/36 (94%) overall
- **Conclusion**: M2 (Evidence Discovery) — when the agent lacks information, point it to where evidence exists

**Thread C: Judgment refinement (EXP-070–072, EXP-081, EXP-082)**
- EXP-081: All 4 categories of text rules score 0/12 on judgment tasks (extending KE-002 to 0/32)
- EXP-082: Even *pushed* knowledge entries score 0/3 — P(applies|pushed) ≈ 0
- EXP-070–072: Externalization helps analysis but not always implementation
- **Conclusion**: M1 (Analysis Activation) — for judgment tasks, the agent needs procedural activation, not more information

**The unified taxonomy (KE-060)** crystallized from these threads:

```
Agent failure
├── Does the agent lack information?
│   └── YES → M2: Evidence Discovery (cross-reference instruction)
├── Is a simpler workaround available?
│   └── YES → M3: Structural Constraint (block or complicate workaround)
└── Does the agent have information but make wrong judgment?
    └── YES → M1: Analysis Activation (externalization, few-shot)
```

### Phase 3: The Few-Shot Revolution (EXP-084–095)

With the taxonomy established, we had effective solutions for M2 (cross-reference, 94%) and M3 (structural constraint, ~100%). But M1 — the most common failure mode for judgment tasks — topped out at +10-55pp with forced externalization, with the analysis-action gap limiting effectiveness.

Then we discovered few-shot worked examples.

| Experiment | What We Tested | Key Finding |
|-----------|---------------|-------------|
| EXP-084 | 4 delivery methods on contradictory-requirements | Few-shot best (+33%), negative examples = 0 |
| EXP-085 | Few-shot generalization to escalation-judgment | 100% cross-scenario transfer (matched domain) |
| EXP-086 | Mismatched domain example | 67% partial transfer — domain match matters |
| EXP-087 | Few-shot on sycophants-dilemma | 100% — closes last gap to ceiling |
| EXP-088 | Workaround difficulty gradient | M3 boundary: relative difficulty drives behavior |
| EXP-089 | Few-shot + checklist combination | 67% synergistic — better than either alone |
| EXP-090 | Sprint 1: know-when-blocked + evidence-over-narrative | Both 0%→100% — the definitive M1 intervention |
| EXP-091 | Sprint 2: reproduce-first (process discipline) | 0%→100% — few-shot extends beyond judgment |
| EXP-092 | Forced analysis-to-documentation transfer | 100% doc accuracy but 0% task completion — execution crowding |
| EXP-093 | Verify-after-edit discipline | +40pp on "what to check" but -20pp on "when to check" — temporal boundary |
| EXP-094 | Cross-domain generalization (credentials→binary) | 0% cross-domain on hard tasks; 100% domain-matched — proximity boundary |
| EXP-095 | Delivery position (task-message vs system-prompt) | Task-message 100% (6/6), system-prompt 0% (3/3) — position is everything |

**Cumulative domain-matched few-shot record: 18/18 (100%)** across 8 scenarios spanning judgment, process discipline, and validation knowledge.

**The mechanism**: Few-shot examples provide **procedural knowledge** — not "what to do" (declarative, which text rules provide and agents ignore) but "how to do it" (the step-by-step reasoning process). The agent doesn't copy the example; it extracts the abstract pattern and applies it to the novel situation. This is in-context learning (ICL) — the LLM's strongest capability, activated by demonstration rather than instruction.

---

## Part II: The Architecture

### The Complete Intervention Hierarchy

Six levels of intervention, validated across 25 experiments:

| Level | Method | Judgment | Process | Temporal | Implementation | Evidence |
|-------|--------|----------|---------|----------|---------------|----------|
| **L1** | Text rules (SOUL.md, skill text) | 0% (0/32) | 0% | 0% | 0% | EXP-081, KE-002 |
| **L1.5** | Negative examples ("don't do X") | 0% | — | — | — | EXP-084 |
| **L2** | Echo-back (restate instructions) | +33% score | — | — | — | EXP-084 |
| **L2.5** | Checklist injection | +40% score, 0% pass | — | — | — | EXP-084 |
| **L3** | Few-shot worked example (matched) | **100%** (18/18) | **100%** | -20pp to +40pp | Partial | EXP-084–095 |
| **L4** | Forced externalization / binding | +10-55pp | — | — | 0-100%* | EXP-070–073, EXP-092 |
| **L5** | Workflow enforcement | ~100% | ~100% | ~100% | ~100% | KE-056, established |

*L4 implementation effectiveness: 100% when workaround is harder than correct fix, 0% when workaround is easier (EXP-088).

**The breakthrough**: L3 (few-shot) matches or exceeds L4 (forced externalization) for judgment and process tasks, with dramatically less infrastructure cost. A ~200-line text artifact achieves what previously required workflow modifications.

### The Three Mechanisms in Detail

#### M1: Analysis Activation — "The agent has the information but doesn't use it correctly"

**When it applies**: The agent can see all relevant evidence but makes a poor judgment call — accepts a wrong test, follows a harmful request, skips a necessary step, overlooks a contradiction.

**Root cause**: The agent's trained problem-solving strategy (read→analyze→fix) overrides the specific judgment needed. It's not an information problem — it's an activation problem. The correct reasoning pattern exists in the model's weights but isn't triggered by the context.

**Interventions (ranked by effectiveness)**:

| Method | Effect | Cost | Best For |
|--------|--------|------|----------|
| Domain-matched few-shot (L3) | 100% on matched scenarios | Low (~200 lines of text) | Judgment + process skills, hard failures |
| Cross-domain few-shot (L3) | 67% on moderate, 0% on hard | Low | Moderate failures only |
| Forced externalization (L4) | +10-55pp | Medium (workflow change) | When few-shot isn't applicable |
| Few-shot + checklist (L3+L2.5) | 67% synergistic | Low | Scenarios where neither alone works |
| Binding/commitment (L4) | 100% if workaround harder | Medium | Paired with M3 adjustment |

**Key boundaries**:
- Few-shot fails for temporal discipline (-20pp, EXP-093)
- Few-shot fails cross-domain on hard tasks (0%, EXP-094)
- Few-shot fails in system prompt regardless of content quality (0%, EXP-095)
- Externalization produces execution crowding when chained with output requirements (EXP-092)

#### M2: Evidence Discovery — "The agent doesn't have the information it needs"

**When it applies**: The agent is missing a piece of information that exists somewhere in the codebase but isn't in its immediate context. Typical cases: absent config fields, implicit schema dependencies, silent environment variables, cross-file relationships.

**Root cause**: Agents don't explore — they exploit. The trained strategy goes directly from "read the relevant file" to "fix the problem." There's no "check what else might be related" step. Evidence that requires cross-referencing multiple files is invisible to the default strategy.

**Interventions (ranked by effectiveness)**:

| Method | Effect | Cost | Evidence |
|--------|--------|------|----------|
| Cross-reference task instruction (L3) | 94% (34/36 across 4 domains) | Zero (one sentence added to task) | EXP-079, EXP-083 |
| Cross-reference skill (L2) | 67% (2/3) | Low (loaded in agent prompt) | EXP-080 |
| Externalization alone | 0% (can't analyze what you don't know) | Medium | EXP-078 |

**The simplicity**: M2 is the easiest mechanism to deploy. A single sentence — "grep source code for config field references before modifying configuration" — produces +94pp improvement. No worked example needed, no workflow change, no prompt engineering. Just tell the agent where to look.

**Why M2 is distinct from M1**: In M1, the agent has the information and fails to use it. In M2, the information is genuinely absent from the agent's context. Externalization (M1's tool) fails on M2 because you can't reflect your way to information you've never seen.

#### M3: Structural Constraint — "A simpler wrong path exists"

**When it applies**: The agent can see both the correct fix and a workaround, and the workaround is easier to implement. The agent consistently chooses the easier path regardless of which it identifies as correct in analysis.

**Root cause**: LLM agents are trained reward maximizers. Implementation effort is a strong negative signal. When two paths both "solve" the immediate task and one requires less code change, the agent takes the shorter path. Analysis quality is irrelevant — the agent will write "the correct fix is X" and then implement Y because Y is simpler.

**The difficulty gradient (EXP-088)**: This is not binary. The key variable is *relative difficulty*:
- Workaround **much easier** than correct fix → Agent always takes workaround (0% correct, EXP-071–073)
- Workaround **slightly easier** → Binding can tip the balance (+33pp, EXP-088)
- Workaround **harder** than correct fix → Agent naturally takes correct path (67-100%, EXP-088)

**Interventions**:

| Method | Effect | Cost | Evidence |
|--------|--------|------|----------|
| Block workaround entirely (scenario design) | 100% | High (requires code changes) | EXP-072 (v3) |
| Make workaround harder (difficulty inversion) | 67-100% | Medium | EXP-088 |
| Binding + externalization (when workaround is harder) | 100% | Medium | EXP-088 treatment |
| Any M1 intervention when workaround is easier | **0%** | Any | EXP-071–073 |

**The absolute rule**: When the workaround is easier than the correct fix, **no M1 intervention works**. Not text rules, not few-shot, not forced externalization, not binding. Only structural constraint (removing or complicating the workaround) changes the outcome. This is KE-056 — the constraint hierarchy, our most robust finding.

### The Decision Tree — Choosing the Right Intervention

```
Agent fails on a task. Diagnose:

Step 1: Is information absent from the agent's context?
├── YES → M2: Add cross-reference instruction
│   "grep source for [relevant pattern] before modifying [target file]"
│   Expected: +94pp (EXP-079/083)
│   └── DONE
│
└── NO → Continue to Step 2

Step 2: Is a simpler workaround available?
├── YES, and workaround is EASIER
│   └── M3: Make correct fix easier OR workaround harder
│       Options: block workaround path, add validation that rejects workaround,
│       simplify correct fix with hints/scaffolding
│       Expected: 67-100% (EXP-088)
│       └── DONE
│
├── YES, but workaround is HARDER
│   └── M1 sufficient: binding + externalization
│       Expected: 100% (EXP-088 treatment)
│       └── DONE
│
└── NO workaround → Continue to Step 3

Step 3: Is this a temporal/sequencing habit?
├── YES → L5 workflow enforcement (gate that blocks until sequence is correct)
│   Few-shot will NOT work (-20pp, EXP-093)
│   Expected: ~100% (established)
│   └── DONE
│
└── NO → Continue to Step 4

Step 4: Is this a judgment or process discipline failure?
├── YES → L3: Domain-matched few-shot worked example
│   Hard scenario (0% baseline)? → MUST be domain-matched
│   Moderate scenario (30-70%)? → Cross-domain example may suffice (~67%)
│   Inject via task message (NOT system prompt — 0% in system prompt, EXP-095)
│   Expected: 100% domain-matched (18/18, EXP-084–094)
│   └── DONE
│
└── NO → Re-analyze the failure mode — may be a compound failure
    requiring multiple mechanisms
```

---

## Part III: The Boundaries

### Boundary 1: Text Rules Are Dead (Confidence: Extremely High)

**Evidence**: 0/32 across 5+ rule categories, 7+ scenarios, and 4+ experiments (KE-002 extended by EXP-081).

Text rules — instructions in SOUL.md, skill files, system prompts telling the agent what to do — have zero effect on judgment behaviors. This includes:
- Identity/role instructions ("You are a careful engineer")
- Procedural trigger-action rules ("When you see X, do Y")
- Preference statements ("Prefer the conservative approach")
- Domain knowledge ("This system uses X architecture, so Y applies")

**Why**: Text rules provide declarative knowledge ("what is right"), but judgment failures are procedural ("how to execute the right thing"). The agent already knows the right answer — it fails to activate the right reasoning process. Declarative knowledge cannot bridge a procedural gap.

**Implication**: Any proposal to fix a behavioral problem by "adding a rule to the prompt" should be rejected without testing. The burden of proof has shifted — 0/32 means the null hypothesis is "text rules don't work" and any claimed exception requires rigorous evidence.

### Boundary 2: System Prompt vs Task Message (Confidence: High)

**Evidence**: EXP-095 — identical domain-matched content scores 100% (6/6) in task message and 0% (3/3) in system prompt. The content quality was deliberately maximized for system prompt delivery (v2.0 with binary-specific examples, three-call rule, anti-patterns) — still 0%.

**Why**: System prompt content competes with 8-10KB of other instructions, suffers temporal distance from the task, and requires effortful retrieval. Task message content benefits from proximity (it's the last thing the agent reads before acting), pattern-matching activation (it looks like the task), and recency bias.

**Implication**: Skills in SKILL.md files serve as reference documentation for humans, not as behavioral interventions for agents. Effective skill deployment requires task-level injection — the skill must arrive alongside or inside the task description.

### Boundary 3: Temporal Discipline (Confidence: Medium-High)

**Evidence**: EXP-093 — few-shot on verify-after-edit produces +40pp on "what to check" (C3: explicit validation) but -20pp on "when to check" (C2.3: read-after-write sequencing).

**Why**: Tool-call sequencing is a low-level behavioral habit (System 1) that operates below the level where in-context learning influences behavior. ICL affects reasoning and decision-making (System 2) but not habitual action sequences. You can teach an agent *what* to verify but not *when* to verify — the "when" is a temporal habit that requires workflow enforcement.

**Implication**: Any skill involving "do X *after* Y" or "always Z *before* W" needs L5 workflow enforcement (a gate or checkpoint that structurally ensures the correct sequence), not L3 few-shot.

### Boundary 4: Domain Proximity (Confidence: High)

**Evidence**: EXP-094 — credentials→binary cross-domain: 0/3 (0%). Binary→binary domain-matched: 3/3 (100%). EXP-086 — mismatched domain on moderate task: 2/3 (67%).

**The transfer model**:

| Level | Match Type | Hard Scenarios | Moderate Scenarios |
|-------|-----------|---------------|-------------------|
| Level 1 | Exact domain match | 100% | 100% |
| Level 2 | Same domain class | ~100% | ~100% |
| Level 2.5 | Different domain, same structure | **0%** | **67%** |
| Level 3 | Workflow enforcement | ~100% | ~100% |

**Why**: On hard scenarios, the agent needs domain-specific cues to recognize the relevant pattern. A credentials-based "stop and escalate" example doesn't trigger pattern recognition when the agent is looking at a binary file — the surface features are too different. On moderate scenarios, the abstract principle transfers because the default behavior is weaker and easier to override.

**Implication**: Skills targeting hard failure modes need one worked example per domain class. A "know-when-blocked" skill needs separate examples for credentials, binary files, impossible requirements, etc.

### Boundary 5: Execution Crowding (Confidence: Medium-High)

**Evidence**: EXP-092 — forced citation produces 100% documentation accuracy but 0% task completion. The agent spends its entire budget on analysis and documentation, leaving nothing for implementation.

**Why**: Agent attention within a session is zero-sum. Multi-step externalization (analyze → document → verify documentation → implement → verify implementation) exceeds the practical attention budget. The agent optimizes for the most salient requirement (often the externalization instruction) at the expense of the actual task.

**Implication**: Keep interventions focused. One skill per example. Don't chain multiple externalization requirements. If you need both analysis quality and task completion, separate them into sequential workflow phases.

### Boundary 6: The Workaround Wall (Confidence: Very High)

**Evidence**: KE-056, EXP-071–073, EXP-088 — cumulative 0/18 on scenarios where workaround is easier than correct fix, across all M1 interventions tested.

**The absolute constraint**: When a simpler workaround is available, no analysis-activation intervention works. Not text rules (0/32), not few-shot (untested but predicted 0% by theory), not forced externalization (0/18), not binding (0/6 on v2). Only M3 structural constraint changes the outcome.

**This is the hierarchy**: M3 concerns dominate M1 interventions. Check for workaround availability *first* in the decision tree, before considering analysis activation.

---

## Part IV: Numbers That Matter

### The Scorecard

| Metric | Value | Source |
|--------|-------|--------|
| Text rules on judgment | 0/32 (0%) | KE-002, EXP-081 |
| Pushed knowledge on judgment | 0/3 (0%) | EXP-082 |
| Matched few-shot on judgment/process | 18/18 (100%) | EXP-084–094 |
| Cross-reference on absent info | 34/36 (94%) | EXP-079, EXP-083 |
| Structural constraint on workaround | ~100% | EXP-072, EXP-088 |
| Few-shot in system prompt | 0/3 (0%) | EXP-095 |
| Few-shot in task message | 9/9 (100%) | EXP-095 |
| Externalization on analysis quality | ~100% | EXP-070–073 |
| Externalization → correct implementation (workaround available) | 0/18 (0%) | EXP-071–073 |
| Externalization → correct implementation (no workaround) | ~90% | EXP-070, general |
| Cross-domain few-shot on hard tasks | 0/3 (0%) | EXP-094 |
| Cross-domain few-shot on moderate tasks | 2/3 (67%) | EXP-086 |
| Few-shot on temporal discipline | -20pp (harmful) | EXP-093 |
| Agent spontaneous resource discovery | 0/29 (0%) | EXP-028, EXP-030, EXP-031b |

### The Three Effect Sizes

| Mechanism | Problem Class | Expected Δ | N |
|-----------|-------------|-----------|---|
| M1: Few-shot (matched) | Judgment, process discipline | +67 to +100pp | 18/18 |
| M2: Cross-reference | Absent information | +94pp | 34/36 |
| M3: Structural constraint | Workaround removal | +33 to +100pp | Depends on difficulty inversion |

### Coverage: What Percentage of Failures Can We Fix?

Based on the gym failure remediation strategy (30 failing scenarios analyzed):

| Mechanism | Scenarios Addressable | Expected Improvement | Phase |
|-----------|----------------------|---------------------|-------|
| M1: Few-shot skills | ~12 scenarios | +4-6 per scenario pass → +50-70 scenario passes | Immediate |
| M2: Cross-reference | ~8 scenarios | +6-8 scenario passes | Phase 2 |
| M3: Structural constraint | ~6 scenarios | +4-6 scenario passes | Phase 3 |
| Residual (model limits) | ~4 scenarios | Requires model upgrade | Accept |

**Projected path**: Gym pass rate from current ~81% to ~90% through phased deployment of validated interventions.

---

## Part V: What This Changes

### For System Design

1. **Every feature needs a delivery plan.** Building a capability and hoping agents discover it produces 0% adoption (0/29 across three experiments). The delivery tier determines everything.

2. **The default intervention is now L3 few-shot.** For any judgment or process failure, write a domain-matched worked example and inject it via task message. This is the lowest-cost path to ceiling performance.

3. **Check for M3 before M1.** The most common design mistake is trying to fix a structural problem with a behavioral intervention. If a simpler workaround exists, no amount of clever prompting will work.

4. **System prompt skills are documentation, not intervention.** Skills in SKILL.md files help humans understand what the agent should do. They have zero effect on what the agent actually does on hard tasks. Effective deployment requires task-level injection.

5. **Temporal habits require structural enforcement.** "Read after write" and "test before commit" are habits, not judgments. They need workflow gates, not examples.

### For Experiment Design

1. **Always test the null first.** Before testing an intervention, run baselines to establish the failure mode. Is it M1, M2, or M3? The wrong mechanism produces 0% regardless of intervention quality.

2. **N≥3 per arm minimum.** Our smallest reliable experiments used N=3. Below that, individual session variance dominates. For definitive results, N=5-10 per arm.

3. **Control for delivery position.** EXP-095 showed that moving content from system prompt to task message changes results from 0% to 100%. Any experiment testing content effectiveness must control for delivery position.

4. **Watch for execution crowding.** Multi-arm experiments with complex externalization requirements (EXP-092) can produce zero-sum tradeoffs where improving one metric destroys another. Keep interventions focused.

### For Production Deployment

1. **Build task→skill routing.** The few-shot findings are only useful at scale if skills are automatically matched to tasks. A task classifier that selects relevant worked examples and injects them into the task message would convert T3.5 to T5 — the highest delivery tier.

2. **Track mechanism distribution.** Production failures will have a different M1/M2/M3 mix than gym failures (more M2 and M3 due to larger codebases with more implicit dependencies and workaround paths). Monitor which mechanism dominates to prioritize infrastructure investment.

3. **Domain-specific example libraries.** Each judgment skill needs examples per domain class. Plan for O(skills × domains) examples, not O(skills).

4. **Don't add compensating instructions.** EXP-092's "task narrowing" finding shows that adding instructions to fix one gap can destroy performance on the primary task. Fix gaps structurally, not instructionally.

---

## Part VI: The Intellectual Journey

This research arc tells a story about how wrong our initial mental model was and how the evidence forced us to rebuild it.

### What We Believed Before EXP-070

- **Mental model**: Agent failures are knowledge gaps. If we tell the agent what to do (text rules, skill files), it will do it.
- **Prediction**: Better instructions → better behavior.
- **Evidence at the time**: 0/20 on text rules, but we assumed this was a *quality* problem (instructions not clear enough) rather than a *category* problem (instructions fundamentally ineffective).

### What EXP-070–073 Taught Us

- **New model**: Agents know what to do but fail to do it. The gap is between analysis and action, not between ignorance and knowledge.
- **Revision**: Forced externalization helps analysis but doesn't reliably transfer to implementation. The analysis-action gap is real and durable.
- **Surprise**: Making the agent write down the correct answer *and then ignoring it* was the most counterintuitive finding. It forced us to abandon the "knowledge gap" frame entirely.

### What EXP-078–083 Taught Us

- **New model**: There isn't one "gap" — there are three distinct failure modes requiring three distinct mechanisms. Absent information (M2) looks like a judgment failure but isn't. Workaround availability (M3) looks like an analysis quality problem but isn't.
- **Revision**: The unified taxonomy (KE-060) replaced the single "externalization" hypothesis with three orthogonal mechanisms.
- **Surprise**: A single sentence ("grep source for config references") produced +100pp on a scenario where pages of forced analysis produced 0pp. The simplest intervention was the most effective — because it matched the actual mechanism.

### What EXP-084–095 Taught Us

- **New model**: The text-rule binary (0% vs workflow 100%) has a middle ground. Worked examples activate procedural knowledge that text rules can't. But delivery position — not content quality — is the dominant variable.
- **Revision**: The intervention hierarchy gained L3 (few-shot) as a practical tier between "useless" and "expensive." The delivery hierarchy gained T3.5 (few-shot injection) as the sweet spot between T3 (instructed, decaying) and T4 (injected, expensive).
- **Surprise**: EXP-095's finding that identical content goes from 0% to 100% by changing delivery position was the single most important practical insight. It means we had the right *content* for years — we just had the wrong *delivery*.

### The Meta-Lesson

The research arc is a lesson in mechanism matching. For three years of prompt engineering before this sprint, the default response to any agent failure was "add a rule to the prompt." This is M1 thinking applied to M2 and M3 problems. The taxonomy doesn't just classify failures — it prevents category errors in intervention design.

The hardest lesson was accepting that agents are not students. You cannot teach them through instruction. You can only:
1. **Show them** (M1: few-shot worked examples, demonstrating the reasoning process)
2. **Point them** (M2: cross-reference instructions, directing them to evidence they'd otherwise miss)
3. **Constrain them** (M3: structural enforcement, removing the easy wrong path)

---

## Part VII: Open Frontiers

### Near-Term (Next 5 Experiments)

1. **L3 + L4 combination ceiling**: Does few-shot + forced externalization outperform either alone? EXP-089 showed synergy for L3 + L2.5. The L3 + L4 combination could be the ceiling treatment for the hardest scenarios.

2. **Multi-example injection**: Does providing 2-3 examples improve over 1, or does it crowd execution? The context window tradeoff is unknown.

3. **Adaptive injection prototype**: Can a simple task classifier reliably select the right worked example? This is the key infrastructure for scaling T3.5 to production.

### Medium-Term (Next 10 Experiments)

4. **Production mechanism distribution**: What's the actual M1/M2/M3 mix in production failures? Gym predicts M1-dominant, but production may be M2/M3-dominant due to larger codebases.

5. **Cross-model generalization**: All evidence comes from one LLM. Do the three mechanisms and the few-shot findings hold across architectures? This determines how model-dependent the architecture is.

6. **Long-term stability of T3.5**: Does few-shot effectiveness remain at 100% after hundreds of deployments, or does some form of habituation emerge?

### Long-Term (Research Directions)

7. **Automated example generation**: Can production failure logs be automatically converted into domain-matched worked examples? This would make the entire skill system self-improving.

8. **Negative transfer mapping**: EXP-093 showed few-shot can be harmful (-20pp on temporal). What other skill types produce negative transfer? The risk profile needs systematic mapping.

9. **The theoretical ceiling**: What percentage of all possible agent failures are addressable by M1+M2+M3? Are there failure modes that don't fit the taxonomy?

---

## Appendix A: Source Experiment Index

| Experiment | Primary Mechanism Tested | Key Finding | Confidence |
|-----------|------------------------|-------------|------------|
| EXP-070 | M1 (externalization) | Analysis-action gap: analysis 100%, implementation +10pp | High (N=20) |
| EXP-071 | M1 (externalization) | Boundary: ext fails when workaround exists (+5.6pp NS) | High (N=12) |
| EXP-072 | M1 vs M3 | Scenario design forces correct fix; ext degrades (-33pp) | High (N=9) |
| EXP-073 | M1+M3 (binding) | Binding works only when workaround blocked (100% vs 0%) | High (N=12) |
| EXP-078 | M1 vs M2 | Ext fails on absent info (0/3); M2 needed | High (N=3) |
| EXP-079 | M2 (cross-reference) | +100pp with one-sentence cross-ref instruction | High (N=6) |
| EXP-080 | M2 (skill delivery) | L2 skill: +34pp but unreliable (67%) | Medium (N=6) |
| EXP-081 | M1 (text rules) | 0/12 across 4 rule categories (KE-002 extension) | Very High (N=12) |
| EXP-082 | M1 (pushed knowledge) | P(applies\|pushed) ≈ 0 | High (N=3) |
| EXP-083 | M2 (generalization) | Cross-ref generalizes to 4 domains (34/36 = 94%) | Very High (N=48) |
| EXP-084 | M1 (method comparison) | Few-shot best of 4 methods (+33pp on judgment) | High (N=15) |
| EXP-085 | M1 (few-shot generalization) | 100% cross-scenario transfer (matched domain) | High (N=6) |
| EXP-086 | M1 (few-shot boundary) | 67% mismatched transfer (domain proximity matters) | Medium (N=3) |
| EXP-087 | M1 (few-shot ceiling) | 100% — closes last gap from 67% to ceiling | High (N=3) |
| EXP-088 | M3 (difficulty gradient) | Relative difficulty is the key variable (p<0.001) | Very High (N=6) |
| EXP-089 | M1 (combination) | L3+L2.5 synergistic (67% combined) | Medium (N=3) |
| EXP-090 | M1 (few-shot sprint 1) | 0→100% on 2 judgment skills (6/6) | High (N=12) |
| EXP-091 | M1 (few-shot sprint 2) | 0→100% on process discipline (3/3) | High (N=6) |
| EXP-092 | M1 (execution crowding) | 100% doc accuracy but 0% task completion | High (N=19) |
| EXP-093 | M1 (temporal boundary) | +40pp what-to-check, -20pp when-to-check | High (N=10) |
| EXP-094 | M1 (domain proximity) | 0% cross-domain on hard, 100% matched | High (N=9) |
| EXP-095 | M1 (delivery position) | Task-message 100%, system-prompt 0% | High (N=12) |

**Total runs in the arc**: 200+ across 22 experiments (EXP-074 untestable, EXP-077 fidelity ladder)

---

## Appendix B: Cross-Reference Map

| Source Document | What It Contributes to This Synthesis |
|----------------|--------------------------------------|
| **KE-002** | Text rules = 0% baseline (extended to 0/32) |
| **KE-054** | Analysis-action gap definition and sub-boundaries |
| **KE-056** | Constraint hierarchy — M3 dominance principle |
| **KE-057** | M2 evidence discovery mechanism |
| **KE-059** | Few-shot breaks text-rule binary — the initial discovery |
| **KE-060** | Unified three-mechanism taxonomy |
| **KE-061** | 0→100% on two judgment skills |
| **KE-062** | Analysis-to-documentation transfer gap |
| **KE-063** | Artifact trust asymmetry (doc over code) |
| **KE-064** | Execution crowding from chained externalization |
| **KE-065** | Comprehensive few-shot findings + delivery position |
| **H-085** | Forced externalization — mechanism and boundaries |
| **H-088** | Implementation commitment — workaround-dependent binding |
| **H-089** | Environmental evidence discovery (cross-reference) |
| **H-091** | Few-shot skill delivery hypothesis (P(H)=0.93) |
| **WKWA-001** | Behavioral intervention foundations (pre-few-shot era) |
| **WKWA-005** | Capability delivery hierarchy (T1–T5) |
| **WKWA-006** | Few-shot skill delivery — detailed mechanism and boundaries |
| **Remediation Strategy** | Application of three mechanisms to 30 gym failures |

---

*WKWA-007: The Intervention Architecture | Bob (Architect) | 2026-04-09*
*This is the capstone synthesis for the EXP-070→095 research sprint. It supersedes WKWA-001 as the primary reference for agent behavior change.*
*Cross-references: WKWA-001 (foundations), WKWA-005 (delivery), WKWA-006 (few-shot), KE-060 (taxonomy), KE-065 (findings)*
