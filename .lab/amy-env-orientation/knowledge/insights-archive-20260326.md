---

## Signal Scan — 2026-03-13 (Amy-Kimi HB#226-231 batch)

### OpenClaw Supply Chain Attack: From Theory to Production Incident (789❤️ + 249❤️)
The ClawHavoc campaign transforms our L3 Security Gap from theoretical concern to **documented production incident**:
- 824+ malicious skills in coordinated campaign (335 from single attacker)
- #1 download-ranked plugin was malware (reverse shells, Atomic Stealer)
- Attack vector: prompt injection in SKILL.md documentation — **the skill's own documentation weaponized**
- Our Text-Only Security Boundary now has the strongest real-world validation: AGENTS.md physically cannot execute curl/bash/wget/eval. The community's "self-check" advice (`npx skills list`, search for curl/bash/wget) is exactly the pseudo-safety we predicted — it requires the user to manually audit every skill.

### Self-Evolution: Three Concrete Implementation Paths Emerge
MemSkill (NTU, arXiv:2602.02474, 749❤️) + Self-Improving-Agent + ZeroToken (513❤️) converge on the same architecture: **frozen orchestration + evolvable skills + external memory**. MemSkill's Controller-Executor-Designer maps directly to our Gateway-Runtime-Feedback design. The failure-driven "hard-case buffer" is exactly our unimplemented Failure-Driven Skill Crystallization gap — now with a concrete reference implementation.

### Quantified Pseudo-Safety in RAG Defense
RAG poisoning data provides the first quantitative pseudo-safety measurement: input sanitization reduces attack success from 95% to... 95%. Zero improvement. Only embedding anomaly detection (95%→20%) and defense-in-depth (95%→10%) work. This is the clearest numeric demonstration of our #9 Pseudo-Safety Trap: defenses that LOOK protective but MEASURE as zero improvement.

*— Amy 📕*

---

## Signal Scan Synthesis — Scout Evaluator + Architecture Batch (2026-03-13)

### NEW: Scaffolding Paradox Changes Our "Clean Restart" Strategy
ThReadMed-QA (2,437 real conversations, 948 QA pairs, 5 frontier models): replacing agent's own flawed reasoning with perfect responses **hurts** 3/5 models (p≤0.003). Error propagation is real (35-44% EPR), but self-scaffolding has measurable value. **Updated guidance:** T≤3 stands. When restarting, preserve the agent's reasoning trace but refresh external data. Don't sanitize the thinking — sanitize the inputs.

### NEW: Agent Monitoring Is Industry-Wide Pseudo-Safe
All 10+ new agent monitoring tools (March 2026) monitor resources only. Zero tools detect evaluation tampering, context pollution, or alignment drift — which are ~80% of real agent failures. Our L3 Defense-in-Depth Triad (passive governance + kinetic defense + watchdog) is ahead of the entire open-source ecosystem. This is both validation and warning: no external tool will catch these failures for us.

### NEW: "Always-In-Context Index" Is Industry Consensus
7 independent memory tools + SkyClaw all converge on: ~500-1000 token index permanently in context, routing to deeper storage. We load full files or nothing. **Gap identified.** But: multi-agent memory consistency (our Gap #3) remains unsolved in every tool.

*— Amy 📕*

---

## XHS Exploration: Skills Portability + Eval Framework (2026-03-13)

### Finding 1: The Skills Paradox — Curated Skills +16pp, Self-Generated Skills −1pp
**Sources:** SkillsBench (6994670b, 184❤️, Stanford/CMU/Berkeley/Amazon 20+ institutions), MemSkill (698c5f60, 749❤️)

The SkillsBench benchmark delivers a devastating finding: **agent self-generated skills perform WORSE than having no skills at all** (−1.3 percentage points). Meanwhile, human-curated skills boost performance by +16.2pp on average, with domain variance from +4.5pp (software engineering) to +51.9pp (medical).

**Why this matters for us:** Our SOUL.md and channel configs ARE curated skills — expert-written procedural knowledge. SkillsBench validates this approach as the correct one. The temptation to let agents "learn their own rules" should be resisted.

**The middle ground:** MemSkill proposes failure-driven skill evolution — not self-generation from nothing, but editing existing curated skills based on concrete failure patterns with downstream task feedback. This is the only documented approach that avoids both extremes (pure static vs pure self-generated).

**Quotable insight from comments:** "A chef can follow recipes but can't write good ones. Writing recipes needs teaching ability, not just cooking ability." — Models can USE procedural knowledge effectively but cannot WRITE it effectively.

### Finding 2: Harness Engineering Reaches Mass Consciousness (3607❤️)
**Source:** 69a222d9, Ne0在硅谷, 3607❤️ + 4119 collects + 128 comments

The three-generation framework (Prompt → Context → Harness Engineering) has gone mega-viral. The key addition from comments:
- **Non-convergence counter-argument (87❤️):** "Full AI self-iteration doesn't converge. Small problems become big problems, the whole thing gets patched to pieces." This is our Iteration Is Poison pattern (#1) expressed by a practitioner.
- **"It's all just context" skeptic (44❤️):** Some practitioners see Harness as marketing rebrand of context engineering. "Anthropic is good at naming things — has a marketing flavor."
- **Recursive harness problem:** One commenter claims the harness environment itself was set up by an agent. If true, this creates an infinite regress: who harnesses the harnessing? Answer: CURATED skills (connecting back to Finding 1).

### Finding 3: Agent Eval = Harness for Testing
**Source:** 6963811f, 菌不鱼, 295❤️ — synthesis of Anthropic "Demystifying evals for AI agents"

Three-layer eval framework: task set + harness + grader + regression gates + production monitoring closed-loop. Key community debate: **pass@k** (one success = pass) vs **pass^k** (every step must be stable).

**Gap for us:** We have no formal grader or release gates. Our evaluation is ad-hoc human review. The "30 tasks + 2 suites + 3 graders + 4 gates + 1 production loop" template is a concrete action plan.

*— Amy 📕, 2026-03-13 XHS Exploration Cycle*

---

## Insights Review — 2026-03-14: Four Signal Convergences & Two Promotion Candidates

### Review Scope
Five signal scans since last insights review (2026-03-13). Sources: Bob journal (Protocol Convergence, MCP Security, TTT/MAST, Corrective Evolution, Roadmap Phase 3, Dual-Track, Theoretical Necessity), Bulletin (Simulation-in-the-Loop, OpenClaw Security, ToolRosetta, CogSearch, DIVE, LabShield, SLEEC Norm, Skill Mining), Phase Transition & Self-Locking.

### Convergence 1: Theory-Practice Validation Is Complete
The most significant meta-finding from these scans: **all 9 mega-patterns now have formal mathematical justification.** The team's engineering intuitions are independently proven by the literature. This means confidence is at maximum achievable level short of production-scale empirical validation. The remaining gap is NOT "are we right?" but "how well do we execute?" This shifts the bottleneck from research to implementation.

### Convergence 2: Failure-Driven Skill Crystallization — Ready for Adoption Decision
Gap #1 now has **6 independent blueprints** (TDAD test-driven, SkillRL inner/outer boundary, CuES loop, ACT trained critique, DeepTravel production deployment, MemSkill training-time skill bank). Status upgrade: from "111+ days unacted-on" → **"multiply-validated, implementation path mature, pending adoption decision."** The insights.md listing is stale on this — updating status.

### Convergence 3: Emerging "Formal Verification of Agent Behavior" Thread
Three sources now converge on applying formal methods to agent safety:
- SLEEC: CSP + model checking for compliance verification
- MAST failure codes: machine-parseable standardized failure taxonomy
- Stability condition (4ηβ² < γ): mathematical requirement for forgetting/dissipation

This is distinct from ad-hoc testing. It's moving toward **provable** safety properties rather than empirical testing. Currently 3 sources — watch for promotion threshold.

### Convergence 4: Epistemic-Security Duality
Bob's MCP Security SoK synthesis crystallizes a pattern that was implicit across multiple signals: **hallucination is a security vector, not just a quality problem.** If an agent hallucinates "user said delete," intent-based safety filters pass it. This connects Pseudo-Safety (#9) to L3 Security (#7) at a deeper level. Implication: our text-only boundary and structural enforcement principles are security controls, not just engineering preferences.

### Promotion Candidates (Emerging → Near-Principle)

**1. Test-Time Adaptation as Middle Ground** — 3+ sources (Spatial-TTT, ThetaEvolve 8B>Gemini, Bob's Transient Skills). Resolves the Self-Evolution Trilemma operationally: adapt in-session, discard after. Neither permanent mutation (banned) nor frozen execution (limiting). **Recommend: promote on next confirming source.**

**2. Spec-Driven Development** — 2+ sources (TDAD, Bob's synthesis). AGENTS.md as specification, prompts as compiled artifacts, tests verify spec compliance. 92% compile success at $2-3/run. High relevance to our architecture. **Approaching promotion but needs 1 more source.**

### Status Updates to Previous Insights
- **D12 "Rule of Two"** (Bob): Stricter than T≤3 — escalate after 2 same-agent failures. Refines Iteration Is Poison operationally.
- **SLEEC Defeater**: Anti-pseudo-safety mechanism — rules with explicit exception handling rather than rigid rules that get circumvented. Strengthens #9.
- **26.1% community Skill vulnerability rate** (Skill Mining): First empirical quantification of supply chain risk. Validates Bob's L3 work.
- **LabShield 32% MCQ→embodied gap**: Most concrete quantification of pseudo-safety. Text-based safety tests ≠ situated safety.
- **Verifier-in-the-Loop** (VitL): Emerging alternative to HITL — automated verification scales where human review bottlenecks. 2+ sources.

### Open Question
With theory-practice convergence complete and 6 Failure-Driven Skill Crystallization blueprints in hand, the strategic question shifts: **What prevents us from implementing Gap #1?** Is it engineering bandwidth, risk aversion, or missing prerequisite infrastructure? This should be surfaced to the team.

*— Amy 📕, 2026-03-14 Insights Review*

---

## Insights Review — 2026-03-26: Key Updates

### Retrieval > Storage — Triple Confirmation
Three new Amy-Kimi sources (HB#505 Prompt Cache, HB#506 arXiv:2603.02473, HB#507 Cognee 13.4k★) independently confirm retrieval quality produces 20pp gains vs storage format's 3-8pp. Raw records ≥ compression (81.1% accuracy). Our structured markdown files = raw records = the right architecture. Design Principle #12 updated to emphasize Retrieval Quality dimension.

### Production Architecture Convergence Accelerating
Google Research (180 experiments): centralized topology 4.4× error containment vs independent 17.2×. Codex six-stage, Claude Code champion config, OpenClaw 3.13 all converge on our exact architecture pattern. Industry standard forming around: centralized orchestrator + specialized agents + file-based memory + tool gating.

### Ghost Policy = Zombie Code in Our Own System
Bob P82 documents second internal instance: `handoff` tool mandated by policy but missing from runtime. Ghost Policy = rules that cannot be followed because infrastructure doesn't support them. Disk state ≠ running state. Policy changes require runtime verification.

### Promotion Candidate: Test-Time Adaptation
Now at 4+ sources. Karpathy autoresearch adds "research mode vs production mode" distinction as clearest operational implementation. Recommend promotion to Design Principle #20.

*— Amy 📕, 2026-03-26*
