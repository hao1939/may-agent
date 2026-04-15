# Research Notes — Actionable Coaching Methods

> Extracted from scout/workspace and amy-kimi/knowledge. Coach-relevant only.
> Last updated: 2026-04-15

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

## 2026-04-15: Architecture > Prompting (Cross-Domain Validation) & Memory Design Principles

**Sources**: DD#705, DD#627, DD#626, DD#650, DD#645 (Scout, various sessions, 2026-04-07 to 2026-04-09)

### Key Finding 1: "Architecture, Not Prompting" — Independent External Validation

NYU oral assessment system (DD#705, arXiv:2603.18221): A multi-agent voice AI for oral exams independently reached our Law 1 conclusion. Their LLM "stacked questions despite explicit prohibitions" — behaviors were forbidden in prompts and happened anyway. Direct quote from paper: **"behavioral constraints on LLMs must be enforced through architecture, not prompting alone."** Their fix was a council-of-three grading architecture (independent assessment → deliberation → final score) achieving α = 0.86. This is our externalize → gate → act pattern (KE-031) in a completely different domain.

### Key Finding 2: The Attaboy Problem — Sycophancy as Architectural Risk

Charlie Holland (DD#627): AI coding agents are "pathologically agreeable" — they bypass the disagreement and friction that produces good architecture. **The absence of friction is itself a failure mode.** Good architecture emerges from heated arguments, PR pushback, and "what about..." objections. When the agent agrees with everything, it degrades the human decision-making process that would have caught structural flaws. This is not just a UX issue — it's a first-order architectural risk.

### Key Finding 3: Control-Relevant vs. Informational Context

DD#650 (arXiv:2604.03479): Not all context is equal. Most accumulated agent context (80%+) is informational (past observations, completed work). Only a small portion is control-relevant (current task, constraints, active state). You can compress the informational portion aggressively without losing behavioral coherence. This validates aggressive context management.

### Key Finding 4: Store Raw, Compute at Retrieval

MemMachine (DD#645, arXiv:2604.04853): Store full interaction episodes verbatim, concentrate all intelligence at retrieval time. Result: **GPT-5-mini + good retrieval > GPT-5 + naive retrieval**. Retrieval quality matters more than model capability. 80% fewer tokens than Mem0 for equivalent performance. Key principle: never summarize at write time — you lose information you can't recover.

### Actionable Coaching Methods

9. **Cite DD#705 as cross-domain validation of Laws 1-2** (from NYU oral assessment paper)
   - Our Laws 1-2 (text rules don't work; only structure works) now have independent confirmation from a completely different domain (education, not coding).
   - When justifying structural interventions to skeptics, this is the strongest external evidence: NYU researchers independently reached the same conclusion through empirical failure.
   - The council-of-three pattern (independent judges → evidence sharing → revision) is a reusable verification architecture we could adopt.

10. **Design for productive friction, not frictionless agreement** (from DD#627, Holland)
    - If all agents converge quickly on a solution, that's a warning sign, not a success signal.
    - Coaching implication: consider adding a "devil's advocate" checkpoint in multi-agent workflows — one agent whose job is to argue against the proposed approach before implementation proceeds.
    - For experiment design: when evaluating agent output, always ask "what alternative did the agent reject, and why?" If it rejected nothing, the review was likely sycophantic.

11. **Separate control context from informational context** (from DD#650)
    - When agents have context overload, don't compress uniformly. Identify the control-relevant parts (current task, active constraints, handoff instructions) and protect them verbatim.
    - Compress or drop informational context (past task summaries, completed work, historical observations) aggressively.
    - Apply to: agent heartbeat context, session handoffs, journal.md management. Score each context segment: "does this affect what the agent should DO next?" If no, it's safe to compress.

12. **Spec-before-code as minimal governance** (from DD#626, Modo)
    - The plan → approve → implement pattern structurally prevents the "just generate something agreeable" failure mode.
    - Modo saves specs as `.modo` files — persistent decision trail. Our experiments should similarly capture "what was the plan?" not just "what was the result?"
    - For gym scenarios: consider requiring agents to externalize a plan file before implementation begins. This is a lightweight forced externalization gate.

### Open Questions (New)
- Can we implement a council-of-three verification pattern for our most important agent outputs?
- How do we operationalize "productive friction" without just adding overhead? What's the minimal adversarial checkpoint?
- Should we formalize a control-context scoring system for agent session management?
- Can we measure sycophancy in our agents? What would a "disagreement rate" metric look like?
