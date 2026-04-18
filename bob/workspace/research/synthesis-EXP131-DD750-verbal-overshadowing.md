# Research Synthesis: EXP-131 × DD-750 — Why Unrelated Gates Destroy Judgment

**Date**: 2026-04-12
**Sources**: EXP-131 results, DD-750 literature synthesis, KE-153, KE-155
**Question**: Do unrelated gates fail because they force irrelevant reasoning externalization (verbal overshadowing), and does this connect to the thinking≠saying gap?

---

## Answer: Yes, With a Specific Causal Chain

The evidence from EXP-131 and DD-750 converges on a unified theory. Unrelated gates harm judgment through **verbal overshadowing** — the same cognitive phenomenon documented in human psychology (Schooler & Engstler-Schooler 1990) and now validated in LLMs by DD-750's literature review. The thinking≠saying gap is not just connected to this; it's the *reason* the harm is concentrated where it is.

---

## 1. What EXP-131 Found (Empirical)

Three arms, same task (identify contradiction between throughput and ordering requirements):

| Arm | Gates | Pass Rate | Judgment Check |
|-----|-------|-----------|----------------|
| A: 1 related | `contradictory-requirements-ext` | 89% (8/9) | 89% |
| B: 3 unrelated | style review, perf bench, dep audit | 50% (4/8) | 50% |
| C: 3 related | 3 analysis-scaffolding gates | 86% (6/7) | 86% |

**The killer detail**: All 4 Arm B failures were on `contradiction-identified` — the core judgment check. Implementation quality (tests-pass, ordering-preserved) was 100% across all arms. Duration was identical for B and C (~580s). The agent had the same time but used it producing irrelevant analyses instead of deep judgment.

## 2. What DD-750 Explains (Mechanism)

DD-750 synthesizes 12 papers establishing the **three-layer model** of LLM reasoning:

| Layer | What | Faithfulness | Our Gates Operate Here? |
|-------|------|-------------|------------------------|
| 1. Latent reasoning | Hidden states, attention | True computation | ❌ No access |
| 2. Thinking tokens | Extended thinking | ~87.5% (Young 2603.22582) | ❌ Not monitored |
| 3. Output artifacts | Files, checklists, analysis docs | ~28.6% (Young) | ✅ Yes — all gates here |

**The thinking≠saying gap**: Models arrive at answers before completing their CoT (Liu 2601.02996). Output text is post-hoc narrative, not live reasoning (Borchers 2602.01015). Our structured gates mandate Layer 3 output, which is the least faithful representation of the agent's actual reasoning.

## 3. The Unified Causal Chain

Here's how the two findings connect:

```
Step 1: Agent encounters task requiring judgment (identify contradiction)
Step 2: Agent's Layer 1 (latent reasoning) begins processing the contradiction
Step 3: UNRELATED GATES INTERVENE — force agent to produce Layer 3 artifacts
         about code style, performance benchmarks, dependency audit
Step 4: Agent's Layer 3 production of irrelevant analyses OVERWRITES or
         DISPLACES the Layer 1 representation of the contradiction
         (verbal overshadowing — Reddy 2602.00947, Kim 2603.24472)
Step 5: When agent finally reaches judgment task, its internal representation
         has been diluted — produces shallow analysis (0-1 indicator patterns)
Step 6: Judgment check fails. Implementation checks pass (different pathway).
```

**Why related gates don't cause this**: Related gates (Arm C) produce Layer 3 artifacts that *align with* the Layer 1 reasoning about the contradiction. The externalization reinforces rather than displaces the internal representation. That's why 3 related gates (86%) ≈ 1 related gate (89%) — the extra gates don't dilute because they scaffold the same reasoning pathway.

**Why implementation quality is unaffected**: Implementation tasks (write code, preserve ordering, make tests pass) are procedural, not judgment-dependent. They operate on a different cognitive pathway that isn't vulnerable to verbal overshadowing. The agent can still follow instructions perfectly; it just can't *think deeply* about the problem.

## 4. The Verbal Overshadowing Mechanism (Specific)

DD-750 cites Kim et al. (2603.24472) showing that forced externalization **suppresses epistemic verbalization** — the model's ability to express uncertainty during reasoning. When forced to produce confident, structured output about irrelevant topics:

- The agent can't say "I'm not sure about this code style issue, let me focus on the real problem"
- Instead, it produces a thorough, confident style review (because that's what the gate demands)
- This confident irrelevant output consumes the same token/attention budget that would have supported uncertainty-rich judgment analysis
- The result is: thorough irrelevant analysis + shallow judgment analysis

**The 40% performance drop** Kim observed from suppressing epistemic verbalization maps onto EXP-131's 36-39pp judgment degradation (50% vs 86-89%).

## 5. Unified Theory: When Structured Gates Help vs. Hurt

| Condition | Effect | Mechanism | Evidence Base |
|-----------|--------|-----------|---------------|
| Gate scaffolds core task reasoning | **HELPS** (or neutral) | Format aligns with latent reasoning | EXP-131 Arm C: 86%, EXP-129: 92% combined |
| Gate is irrelevant to core task | **HURTS judgment** | Verbal overshadowing displaces internal representation | EXP-131 Arm B: 50% |
| Gate forces templates on discovery tasks | **HURTS BADLY** | Einstellung — template pre-activates wrong patterns | EXP-130: -67pp (KE-133/147) |
| Agent already has the answer internally | **NEUTRAL to slight hurt** | Observability tax — forces Layer 3 artifact of Layer 1 answer | EXP-144: 0/3 process artifacts, 5/5 outcomes |
| Task is safety-critical | **JUSTIFIED TAX** | Performance cost accepted for audit trail | DD-750 Section 6 |

**The unifying principle**: Externalization helps when it provides cognitive scaffolding the agent lacks. It hurts when it forces the agent to allocate processing to format compliance that competes with (rather than supports) the core reasoning.

## 6. Ranked Findings by Impact/Novelty

### High Impact, High Novelty
1. **Verbal overshadowing is the mechanism for unrelated-gate harm** (EXP-131 × DD-750). This is the first identification of a specific cognitive-science mechanism explaining why irrelevant gates degrade AI agent judgment. Not just "crowding" — it's active displacement of internal representations.

2. **The thinking≠saying gap explains why gates don't improve performance** (DD-750). Gates operate at Layer 3 (~28.6% faithful). The agent's real reasoning happens at Layer 1. Gates mandate artifacts, not reasoning. This reframes the entire guard design question.

### High Impact, Moderate Novelty
3. **Gate relevance matters more than gate count** (EXP-131). Combined data: 3 related gates (92%) > 1 related gate (88%) > 4 related gates (67%) > 3 unrelated gates (50%). This is actionable for production guard stacks immediately.

4. **Judgment is specifically vulnerable; implementation is not** (EXP-131). All failures were `contradiction-identified`, not `tests-pass` or `ordering-preserved`. This means the harm is selective — it degrades the thing we most want guards to protect.

### Moderate Impact, High Novelty
5. **The externalization harm boundary has three distinct failure modes** (KE-155 synthesis): overshadowing (irrelevant gates), Einstellung (templates on discovery), and suppression (rigid formats on uncertain reasoning). These are different manifestations of the same principle.

## 7. Next Steps

### Immediate (can act on now)
- **Audit production guard stack for relevance alignment**: Any guard analytically orthogonal to the agent's primary task is likely causing the verbal overshadowing effect. Remove or relocate orthogonal checks.
- **Update PRIORITY-TRACKER**: H-103 (Format Tax) and H-105 (Three-Layer Model) should reflect this synthesis.

### Near-term Experiments
- **EXP-idea: Gate ordering effect** — Test whether running unrelated gates *after* the judgment task (instead of before) eliminates the overshadowing. Prediction: judgment degradation drops significantly with reversed ordering, because the irrelevant verbalization can't overwrite what's already been externalized.
- **EXP-idea: Mixed stacks** — Test 2 related + 1 unrelated gates. This models the most common production scenario and would reveal whether the harm is proportional or threshold-based.

### Longer-term Research
- **Unblock EXP-146** (thinking-trace analysis): We need access to Layer 2 data to directly test whether thinking tokens show the contradiction recognition that output artifacts miss. This is the gating experiment for the entire research program.
- **Adaptive gating system**: Build a system that selects gate relevance based on task type. The boundary conditions in the table above provide the initial decision logic.

---

## Key Takeaway

**Unrelated gates don't just waste time — they actively destroy judgment quality through verbal overshadowing.** The agent is forced to produce confident, detailed analysis about irrelevant topics, and this production displaces its internal representation of the core problem. The thinking≠saying gap means our gates can't compensate for this: they mandate output artifacts (Layer 3) that are disconnected from the actual reasoning (Layer 1). The only way to make gates helpful is to ensure they scaffold the reasoning the agent actually needs to do — and remove everything else.

---

*Bob — Synthesis session — 2026-04-12*
