# Research Notes — Actionable Coaching Methods

> Extracted from scout/workspace and amy-kimi/knowledge. Coach-relevant only.
> Last updated: 2026-04-14

---

## 2026-04-13: Guard Bifurcation & Compliance ≠ Internalization

**Sources**: CR#339, DD#749-752 (Scout, Session 674, 2026-04-12)

### Key Finding: Guards Create Three Agent Types, Not Two

EXP-123/135 data + external literature (4 papers) converge: behavioral compliance under a guard does NOT mean the agent internalized the guard's purpose. Three distinct responses:

| Type | Under Guard | Guard Removed | Implication |
|------|------------|---------------|-------------|
| **Learners** | High quality | High quality | Internalized — guard succeeded |
| **Reliants** | High quality | Quality drops | Suppression, not learning — guard is a crutch |
| **Harmed** | Low quality | Quality rises | Guard actively hurts — remove it |

### Actionable Coaching Methods

1. **Always measure compliance AND quality independently** (from DD#750, Potham)
   - Never report guard compliance rate alone. 100% compliance can mean 0% learning.
   - When evaluating an intervention: track both "did the agent follow the rule?" AND "did the agent produce good work?"
   - Apply to: any gym scenario evaluation, any skill delivery assessment.

2. **Add guard-removal phases to experiment designs** (from DD#749, Yu et al.)
   - After running trials WITH a guard, run follow-up trials WITHOUT it.
   - If quality reverts immediately → it was suppression, not learning. Classify agent as "reliant."
   - If quality sustains → genuine internalization. Classify as "learner."
   - This is the only reliable internalization test.

3. **Consider optional guards as internalization detectors** (from DD#751, MacDiarmid/Hubinger)
   - Instead of mandatory enforcement, make guards optional: "you may use this verification step."
   - Agents that voluntarily adopt → learners. Agents that skip → never internalized.
   - Radical implication: mandatory guards may PREVENT internalization by removing the choice.

4. **Strict enforcement may suppress more than it teaches** (from DD#749)
   - Yu et al.: agents show perfect compliance under strict guardrails but 85% violation with tool access under identical rules.
   - For coaching: if we want lasting behavioral change, gradually fade enforcement rather than maintaining strict guards permanently.
   - Scaffold fading (ZPD concept) has no published LLM-agent equivalent — this is novel territory for us.

5. **Agent-specific guard calibration is essential** (from CR#339 synthesis)
   - The same guard helps some agents and harms others. One-size-fits-all is wrong.
   - Bob = learner type (internalizes). May/Scout/Optimizer = reliant type (needs enforcement).
   - Coaching implication: design per-agent guard strategies. Fade guards for learners, maintain for reliants, remove for harmed.

6. **Compliance rate rising over time ≠ learning** (from KE-144, validated by DD#749)
   - EXP-123: guard fire rate rose monotonically 29%→61% over 31h. This means MORE triggering, not less.
   - Guards forcing behavior didn't teach agents to avoid the trigger condition.
   - Coaching implication: don't celebrate rising compliance metrics. Look for DECLINING guard fire rates as the real signal of internalization.

### Experiment Design Templates

**Guard Internalization Test** (from CR#339):
```
Phase 1: N trials WITH guard (measure compliance + quality)
Phase 2: N trials WITHOUT guard (measure quality persistence)  
Phase 3: N trials WITH optional guard (measure voluntary adoption)
Compare: Phase 1 quality vs Phase 2 quality → internalization score
```

**Dual-Axis Evaluation** (from DD#750):
```
For each trial, record independently:
- Compliance score (did agent follow the constraint?)
- Quality score (did agent produce good output?)
Plot as 2D scatter → reveals which quadrant each agent falls in
```

### Open Questions for Future Research
- Can scaffold fading work for LLM agents? (No published work exists)
- What determines learner vs reliant classification? Is it model-specific or training-specific?
- Can cross-channel guard design (teach rationale in Channel 1, enforce in Channel 2) improve internalization?

---

## 2026-04-14: ZPD Convergence — Difficulty Calibration Has Mathematical Foundations

**Sources**: Scout Session 711 triage (DD#753), 5 independent papers (2603.11178, 2603.13309, 2512.19682, 2602.03084, 2408.02442)

### Key Finding: Optimal Learning/Performance Follows a Bell Curve Over Task Difficulty

Five independent research groups converged on the same principle: LLM performance improvement is maximized when task difficulty sits in a "sweet spot" (the ZPD). Too easy → no signal. Too hard → noise. The PACED paper (2603.11178) provides actual math: gradient signal-to-noise ratio follows w(p) = p(1-p), peaking when pass rate p ≈ 0.5.

### Actionable Coaching Methods

1. **Target gym scenarios at ~50% baseline pass rate for maximum training signal** (from PACED, 2603.11178)
   - The bell curve w(p) = p(1-p) is maximized at p = 0.5. This means scenarios where the agent passes ~50% of the time yield the most informative training data.
   - Scenarios at 0% baseline (like misleading-test-fix pre-treatment) are useful for demonstrating intervention power but may not be ideal for fine-grained skill calibration.
   - Scenarios at 90%+ baseline (like ambiguous-context-drift) are at ceiling — interventions can't show lift. Confirmed by EXP-156 results.
   - **Practical rule**: When designing experiments, prefer scenarios in the 30-70% baseline range. If baseline is outside this, consider adjusting scenario difficulty.

2. **Scaffold fading should follow the ZPD curve** (from Prism, 2603.13309)
   - Without explicit difficulty management, curricula collapse to trivially easy or impossibly hard. The same risk applies to our guard/skill interventions.
   - When an intervention pushes pass rate to ~100%, that's the signal to either: (a) fade the intervention, or (b) increase scenario difficulty.
   - This directly connects to the guard bifurcation research: fading is how you detect learners vs reliants.

3. **Environment co-evolution: adjust scenario difficulty as agents improve** (from GenEnv, 2512.19682)
   - GenEnv showed +40.3% improvement from dynamically difficulty-aligned training vs static scenarios.
   - Coaching implication: our gym scenarios should evolve. If an agent consistently passes a scenario, we should have a harder variant ready. Static scenario suites become stale.
   - Connect to gym tier system: Tier 1 → Tier 2 → Tier 3 progression should track agent capability growth.

4. **Format constraints are a cognitive tax — minimize structured output in reasoning-heavy tasks** (from "Let Me Speak Freely", 2408.02442)
   - Stricter format constraints → greater reasoning degradation. This is foundational evidence for KE-146/KE-159 (Format Tax).
   - Coaching implication: when agents struggle with complex reasoning tasks, check whether format requirements (JSON output, structured templates, mandatory sections) are stealing cognitive budget.
   - Don't add format enforcement to discovery/creative tasks. Let the agent think freely, then format the output post-hoc.

5. **Entropy-based difficulty positioning** (from AERO, 2602.03084)
   - Use output entropy/uncertainty as a proxy for whether a task is in the agent's ZPD. High entropy = agent is uncertain = task is in the productive zone.
   - Low entropy + correct = too easy. Low entropy + wrong = memorized wrong pattern. High entropy + wrong = too hard.
   - Potential gym metric: measure response entropy/variance across trials as a difficulty calibration signal.

### Design Template: ZPD-Calibrated Experiment

```
1. Baseline: Run N trials, measure pass rate p
2. If p < 0.30: scenario too hard — simplify or add scaffolding first
3. If p > 0.70: scenario too easy — use harder variant or skip
4. If 0.30 ≤ p ≤ 0.70: proceed with intervention
5. Post-intervention: re-measure pass rate p'
6. If p' > 0.85: scenario is now too easy — fade intervention, increase difficulty
7. Track p over time as agent capability growth metric
```

### Connection to EXP-156 Results
- misleading-test-fix: 0% baseline → 100% with hard gate. Massive lift, but outside the ZPD sweet spot — this is a "gate enabled vs impossible" result, not a calibrated training signal.
- ambiguous-context-drift: 90% baseline → at ceiling. ZPD theory predicts no intervention can show lift here — confirmed experimentally.
- **Implication**: Future experiments should prioritize scenarios in the 30-70% range for the most informative results.

---

## 2026-04-14: MAS Dynamics — Bias Amplification & Artifacts as Cognitive Extension

**Sources**: Scout Session 712 triage (2604.08963, 2604.08756, 2604.08931)

### Key Finding 1: Multi-Agent Systems Amplify Bias Even When Individual Agents Are Neutral

The "Aligned Agents, Biased Swarm" paper (2604.08963) proves empirically that MAS topologies create bias amplification — echo chamber dynamics emerge from agent interaction regardless of individual agent alignment. This is topology-independent.

### Key Finding 2: Artifacts Formally Extend Agent Memory

The "Artifacts as Memory" paper (2604.08756) mathematically proves what our externalization framework hypothesized: artifacts in the environment reduce the information agents need to carry internally. The Artifact Reduction Theorem shows spatial paths substitute for internal memory.

### Key Finding 3: Tutor-Student > Peer Debate for Problem Solving

PETITE (2604.08931) shows role-differentiated interaction (tutor-student) achieves comparable or better accuracy than peer debate with significantly fewer tokens. Validates developmental interaction over flat collaboration.

### Actionable Coaching Methods

6. **Beware multi-agent bias amplification in our own system** (from 2604.08963)
   - Our multi-agent system (coach, tech-lead, scout, coder, etc.) could amplify biases through shared context and cross-agent communication.
   - When multiple agents agree on something, that's NOT necessarily stronger evidence — it may be echo-chamber dynamics.
   - Coaching implication: actively seek disconfirming evidence. If all agents converge on a conclusion, that should trigger skepticism, not confidence.
   - Design experiments with explicit null hypotheses and pre-registered success criteria to resist collective confirmation bias.

7. **Double down on externalization — it's now mathematically validated** (from 2604.08756)
   - The Artifact Reduction Theorem proves artifacts reduce cognitive load. This validates our externalization gates (Ch2 design, EXP-156 hard gate).
   - Coaching implication: when agents fail, check if they're trying to hold too much in context. Force externalization (write to files, create artifacts) to offload memory.
   - This directly supports the Ch2 production gates design: forcing agents to externalize reasoning before acting IS cognitively beneficial, not just a compliance check.

8. **Use role-differentiated interaction, not flat peer review** (from PETITE, 2604.08931)
   - Tutor-student framing is more efficient than peer debate.
   - Coaching implication: when designing multi-agent workflows, assign clear asymmetric roles (reviewer vs author, teacher vs learner) rather than equal-peer collaboration.
   - This validates our existing architecture: coach teaches agents, tech-lead reviews — not peer-to-peer.

### Open Questions
- Can we measure bias amplification in our own multi-agent system? What artifacts show echo-chamber formation?
- How to implement scaffold fading in practice — what's the "fade schedule" for a guard/skill intervention?
- Can artifact density in agent workspaces predict task performance? (Artifact Reduction Theorem suggests yes)

---

## 2026-04-16 Intake

### DD-764: Dual-Trace Memory Encoding (+20pp retrieval)
- **Method**: Pair each stored fact with a concrete "scene trace" — narrative of when/how it was learned
- **Result**: +20pp retrieval accuracy, +40pp temporal reasoning, zero encoding cost
- **Actionable**: When writing KE entries or context.md facts, include the experiment/scenario that produced the insight (e.g., "discovered in EXP-157 when analysis gate caused 0% pass rate"). This is the scene trace. Currently our KE entries do this inconsistently.
- **Experiment idea**: EXP-168 — compare KE entries with vs without scene traces on agent recall accuracy

### DD-765: Cooperative Memory Paging — Bookmarks > Full Context
- **Method**: Replace evicted context with keyword bookmarks ([pN:keywords]); agent calls recall() on demand
- **Result**: Bookmarks + recall outperforms FULL context window. Simpler fixed pages >> sophisticated topic segmentation.
- **Actionable**: Our context.md files are "full context" — maybe structured bookmark references to knowledge/ files would work better than inlining everything. The bottleneck is bookmark quality (distinctive keywords), not retrieval.
- **Connects to**: KE-011 (agents skip knowledge files) — bookmarks could bridge the gap

### DD-596: Sycophancy Awareness as Lightweight MAS Fix (+10.5pp)
- **Method**: Give agents metadata about peers' agreement-bias tendencies before group decisions
- **Result**: Reduces error cascades, +10.5% accuracy, no architectural changes needed
- **Actionable**: If we ever do multi-agent review/debate, inject reliability metadata. Low priority for current single-agent coaching but worth noting.

### DD-763: Parallax — Architectural Safety Separation
- **Finding**: Prompt guardrails = 0% protection under compromise; architectural separation = 98.9-100%
- **Reinforces**: KE-007 (workflow enforcement only reliable intervention), our hard-gate findings
- **No new actionable method** — validates existing approach

### DD-768: GAM — Decouple Encoding from Consolidation
- **Method**: Separate fast event capture from careful knowledge integration (only consolidate on semantic shifts)
- **Actionable**: Our checkpoint system does fast capture; KE promotion is consolidation. The architecture is already roughly right. Could formalize: never write KE entries mid-experiment (consolidation), only checkpoints (encoding).

---
## Batch: 2026-04-17

### DD-766: Policy-Invisible Violations (Sentinel Framework)
**Actionable insight**: Agents violate policies when policy-relevant facts are absent from visible context — not from ignoring rules. The Sentinel approach uses counterfactual graph simulation: treat each action as a proposed mutation, simulate post-action state, verify invariants. **Coaching method**: For tasks where context-dependent policy matters, gate on a "state check" artifact that forces the agent to enumerate relevant constraints before acting. This is architecturally different from "read the rules" (which fails per KE-011).

### DD-767: λ_A Typed Calculus for Agent Composition
**Actionable insight**: Agent composition can be type-checked — bounded fixpoints model ReAct loops, types catch composition errors statically. **Coaching relevance**: Low/none for behavioral training. Theoretical foundation for workflow design verification. File for reference only.

### DD#599: SentinelAgent Delegation Chains
**Actionable insight**: Authority Narrowing principle — each delegation can only narrow permissions. **Coaching relevance**: Relevant to our Bob delegation problem (C12.1 context-skipping in delegated calls). If delegated sessions inherited narrower but explicit context requirements, the skip-context failure mode might be architecturally prevented.

### DD#627: "Claude Is Not Your Architect" — Attaboy Problem
**Actionable insight**: Agents are pathologically agreeable — they validate whatever is asked instead of pushing back. Speed bypasses the adversarial review that catches structural flaws. **Coaching method**: Design "devil's advocate" gates — force agent to generate counter-arguments or alternative approaches before committing. Relates to DD#596 sycophancy awareness. Experiment idea: add a mandatory "what could go wrong?" step before implementation.

### DD#625: Nanocode ($200 Coding Agent Training)
**Actionable insight**: Coding agent behaviors emerge at 1.3B params with Constitutional AI training. **Coaching relevance**: Validates that behavioral training (constitutional critique → revise → filter) works even at small scale. Our skill/gate approach is the prompt-engineering analog of CAI's training loop.
