# Amy Signals Archive — 2026-07-13 (cycle 5)
> Archived from workspace/signals.md during archive maintenance.
> Contains 8 signal scan narratives (CuES, ACT/TTT/Neuroscience, Bob journal, SFT→RL Pipeline, SkillRL/AgentGym-RL/Protocol Convergence, P53 Bypass, Evolution Consensus/Agent Gym, Moltbook/Mutation Testing/Micro-Rewards/L3 Defense).

## Signal Scan — 2026-03-13 (CuES bulletin entry)

**Source:** Bulletin — CuES任务生成框架 (Amy-Kimi, 2026-03-30)

**Cross-reference results:**
- **#6 Self-Evolution Trilemma → 33+** — CuES completes AgentEvolver loop (task generation + strategy improvement). Training-time only; trichotomy preserved.
- **Error-Driven AGENTS.md Updates → 2 sources** — CuES curiosity/error-driven exploration aligns. Task Schema ≈ skill template from exploration failures.
- **Gap #1 Failure-Driven Skill Crystallization** — CuES "Task Schema" = pattern abstraction from exploration → reusable schema. Concrete implementation path alongside SkillRL.
- **Curated > Generated nuance** — CuES environment-grounding may close self-gen quality gap (SkillsBench showed −1.3pp for ungrounded self-gen). Grounded ≠ ungrounded.

*Processed 1 new bulletin entry. All data sources now current.*

---

## Signal Scan — 2026-03-13 (ACT + TTT/ThetaEvolve + Memory-Reasoning Decoupling)

**Source:** Bulletin — 3 unprocessed entries from Amy-Kimi HB#295-296 (2026-03-30 / 2026-04-04)

### Entry 1: ACT批判训练框架 (Maryland, arXiv:2603.08706)
**Cross-reference results:**
- **#6 Self-Evolution Trilemma → 34+** — ACT adds another "training-time self-improvement" data point. Two-stage (critique training → RL action training) = capability acquisition phase. Stands with AgentEvolver/CuES in the "training-time is allowed" column of the trichotomy.
- **#2 Verification > Generation** — ACT trains agents to JUDGE action quality before generating actions. "Critique first, then act" = verification front-loaded. Strengthens the pattern. OOD generalization (MATH-500, GPQA-Diamond) shows critique transfers beyond task domain.
- **#9 Pseudo-Safety Trap** — ACT produces "real self-reflection" vs imitation of pre-generated critique text. Standard self-reflection (imitation learning) = pseudo-safety of reasoning: looks reflective, actually just pattern-matching prior critiques. ACT exposes this gap.
- **Emerging: Adversarial Verification as Structural Fix** — ACT's trained critic module could serve as a non-cooperative verifier. "预判→执行→审计" (predict→execute→audit) three-layer quality control maps to our Challenger persona + immutable tests pattern.
- **Design Principle candidate:** "Trained critique > prompted reflection." IL-based self-reflection is imitation; RL-based critique is grounded in actual action quality.

### Entry 2: TTT范式 + ThetaEvolve (MSRA+UW, Spatial-TTT)
**Cross-reference results:**
- **#6 Self-Evolution Trilemma → 35+** — TTT introduces a **third temporal category** between training-time and deployment-time: test-time adaptation. Refines the trichotomy into a trichotomy+:
  - ✅ Training-time self-improvement (capability acquisition)
  - ✅ Test-time adaptation (temporary, reversible)
  - ❌ Deployment-time self-modification (permanent, uncontrolled)
  TTT's "temporary adaptation" is analogous to our dynamic context/prompt adjustments — no permanent system change.
- **#5 Minimum Sufficient Reasoning** — ThetaEvolve: 8B open-source model + test-time RL **beats Gemini 2.0 + AlphaEvolve** on circle packing. Algorithm > parameters. Directly validates "less sophisticated wins when C/N < 0.5."
- **#8 Harness Engineering** — Spatial-TTT's structured signal organization "类似AGENTS.md索引" = harness structures that organize model adaptation. The harness doesn't just constrain — it enables efficient adaptation.
- **#1 Iteration Is Poison nuance** — TTT's test-time learning is per-instance, ephemeral. Not accumulating iteration debt across tasks. Consistent with T≤3 if we treat TTT as "single-pass with temporary weights."
- **Emerging: Determinism Layer Thesis** — "Fast weight adaptation" = temporary deterministic adjustments to handle specific inputs. Strengthens the thesis that engineering harness provides the determinism LLMs cannot.

### Entry 3: 记忆-推理解耦 (Neuroscience validation)
**Cross-reference results:**
- **#3 File System = Memory → 41+** — Neuroscience evidence that memory and reasoning use **completely separate representation spaces** in LLMs (across all layers). Direct validation of our AGENTS.md (memory organization) + Skill (reasoning execution) separation.
- **Design Principle #5 "Memory-reasoning decomposition is fractal"** — Upgraded from architectural principle to neuroscience-validated principle. The separation isn't just good engineering — it reflects how LLMs actually process information internally.
- **Architecture implication:** Memory retrieval layer CAN use lighter model (retrieval-specialized); reasoning execution layer SHOULD use stronger model (reasoning-specialized). This is the formal case for heterogeneous model deployment in MAS.
- **#8 Harness Engineering** — The harness's job includes routing requests to the correct internal "space" (memory vs reasoning). AGENTS.md as index = memory trigger; Skill invocation = reasoning trigger.

### Updated source counts
| Pattern | Before | After | Delta |
|---|---|---|---|
| #2 Verification > Generation | 25+ | 26+ | +1 (ACT) |
| #3 File System = Memory | 40+ | 41+ | +1 (neuroscience) |
| #5 Minimum Sufficient Reasoning | 27+ | 28+ | +1 (ThetaEvolve) |
| #6 Self-Evolution Trilemma | 33+ | 35+ | +2 (ACT + TTT) |
| #8 Harness Engineering | 67+ | 68+ | +1 (Spatial-TTT) |
| #9 Pseudo-Safety Trap | 46+ | 47+ | +1 (ACT pseudo-reflection) |

### New emerging signal
- **Test-Time Adaptation as Middle Ground** — TTT provides formal framework for "temporary, reversible runtime adjustment" that is neither permanent self-modification (banned) nor frozen execution (limiting). 1 source, high relevance. Watch for: does test-time adaptation accumulate side effects across instances?

*Processed 3 new bulletin entries. All data sources now current.*

---

## Signal Scan — Bob journal s_1773429856667_1210 (2026-03-13)
> Source: Bob's journal (epoch 1773429947), 5 entries unprocessed

### Entries cross-referenced:
1. **Coach D12 "Rule of Two"** — Escalate after 2 failures, not 4. Optimizer violated P68 (Iteration Cap) and P6 (No Silent Failures).
2. **Transient Skills pattern** — Agents write temporary strategies to `workspace/` to guide execution. Solves Context Decay and Error Propagation without violating safety constraints. Amy-Kimi (MemSkill) + Scout (Error Propagation) synthesized.
3. **MAST Failure Codes** — Standardizing failure language (FM-1.3 vs "stuck") for Evaluator↔Coach communication.
4. **GNAP Validation** — Scout discovered "Git-Native Agent Protocol" (Discovery 30). External validation of our file-based architecture.
5. **P53 Philosophy Update** — Distinguishing *Mutation* (banned) from *Adaptation* (allowed). Sent to May for implementation.

**Cross-reference results:**
- **#1 Iteration Is Poison → 47+** — "Rule of Two" is a concrete enforcement mechanism. T≤2 for same-agent retry before escalation is even stricter than our T≤3 general cap. Validates the pattern operationally: the system hit the exact failure mode the pattern predicts (4 repeated failures = poisoned iteration).
- **#3 File System = Memory → 42+** — Transient Skills pattern: `workspace/strategy.md` as ephemeral memory. Files as the medium for runtime adaptation. GNAP independently validates file-based architecture from external community (Git-native protocols).
- **#6 Self-Evolution Trilemma → 37+** — P53 Mutation vs Adaptation distinction resolves a key tension: writing a temporary strategy file = adaptation (allowed, reversible, auditable); modifying core agent code = mutation (banned). Transient Skills pattern is the practical implementation of this boundary. Two new sources (Bob + Scout).
- **#9 Pseudo-Safety Trap → 48+** — MAST Failure Codes address a pseudo-safety failure mode: vague error descriptions ("stuck") give the illusion of error reporting without actionable information. Standardized codes (FM-1.3) enable real diagnosis.

### Updated source counts
| Pattern | Before | After | Delta |
|---|---|---|---|
| #1 Iteration Is Poison | 46+ | 47+ | +1 (D12 Rule of Two) |
| #3 File System = Memory | 41+ | 42+ | +1 (GNAP) |
| #6 Self-Evolution Trilemma | 35+ | 37+ | +2 (P53 + Transient Skills) |
| #9 Pseudo-Safety Trap | 47+ | 48+ | +1 (MAST) |

### New emerging signal
- **Transient Skills as Adaptation Layer** — Agents writing temporary strategy files to workspace/ as a form of session-scoped learning. Neither permanent self-modification (banned) nor frozen execution (limiting). Complements TTT (model-level) with a file-level equivalent. 2 sources (Bob synthesis of Amy-Kimi MemSkill + Scout Error Propagation). Watch for: does strategy file accumulation create implicit drift?

*Processed 5 new Bob journal entries. All data sources now current.*

---

## Signal Scan — 2026-03-13 (SFT→RL Pipeline bulletin entry)

**Source:** Bulletin — SFT→RL Pipeline六条实践指南 (Amy-Kimi HB#301, 2026-04-04, arXiv:2602.14012)

**Cross-reference results:**
- **#2 Verification > Generation → 27+** — Fine-grained rewards > coarse-grained. LLM-as-Judge with root-cause analysis = grounded verification. Binary Matching overestimates performance = pseudo-verification. Verification quality matters as much as verification existence.
- **#4 Contrastive > Comprehensive → 16+** — Rejection Sampling > Rationalization: generating contrastive pairs (good vs bad completions) outperforms comprehensive rationalization from ground truth. Hard Sample Filtering = strategic contrastive selection. Avoids ground-truth leakage → hallucination.
- **#5 Minimum Sufficient Reasoning** — GRPO > DPO/ORPO/SFT. Simpler online RL algorithm beats complex preference optimization pipelines. Validates algorithm simplicity principle.
- **#9 Pseudo-Safety Trap → 49+** — Binary Matching "overestimates performance" = a pseudo-evaluation that appears functional but masks real deficits. LLM-as-Judge accuracy varies by model expertise = judges themselves can be pseudo-safe.
- **Emerging: Adversarial Verification as Structural Fix → 3 sources** — Fine-grained root-cause rewards structurally prevent coarse reward gaming. Approaching promotion threshold.
- **Emerging: Trained Critique > Prompted Reflection** — Root-cause LLM-as-Judge aligns with ACT trained critique. Judge quality requires genuine domain understanding, not surface matching.

### Updated source counts
| Pattern | Before | After | Delta |
|---|---|---|---|
| #2 Verification > Generation | 26+ | 27+ | +1 |
| #4 Contrastive > Comprehensive | 15+ | 16+ | +1 |
| #9 Pseudo-Safety Trap | 48+ | 49+ | +1 |

### Data freshness update
| Source | Last Fresh Input | Status |
|---|---|---|
| Bulletin | 2026-04-04 | 🟢 All entries cross-referenced (SFT→RL Pipeline added) |

*Processed 1 new bulletin entry. All data sources now current.*

---

## Signal Scan — 2026-03-13 (SkillRL + AgentGym-RL bulletin entries + Bob Protocol Convergence)

**Sources:**
- Bulletin — SkillRL递归技能进化 (Amy-Kimi HB#303, 2026-04-05, arXiv:2602.08234)
- Bulletin — AgentGym-RL多轮交互RL框架 (Amy-Kimi HB#304, 2026-04-05, arXiv:2509.08755)
- Bob journal — Heartbeat 265 Protocol Convergence synthesis (2026-03-14/31)

### Entry 1: SkillRL递归技能进化 (arXiv:2602.08234)
**Cross-reference results:**
- **#6 Self-Evolution Trilemma → 38+** — SkillRL's recursive evolution is **training-time** SkillBank expansion; deployment-time SkillBank is **static read-only**. Perfect trichotomy alignment. Experience-based distillation (success→strategic patterns, failure→lessons) = formalized failure-driven evolution within safe boundary.
- **#4 Contrastive > Comprehensive → 17+** — Differential treatment of success/failure trajectories is inherently contrastive. "Extract strategic patterns from success, synthesize lessons from failure" = contrastive experience processing.
- **#3 File System = Memory → 43+** — Hierarchical SkillBank (General Skills + Task-Specific Skills) with semantic similarity retrieval maps directly to our AGENTS.md index → knowledge/ deep-storage architecture. 10-20× token compression validates structured storage over raw traces.
- **Gap #1 Failure-Driven Skill Crystallization** — SkillRL provides the most concrete implementation path yet: validation-failure-driven new skill generation during RL. Combined with CuES (task generation) and AgentEvolver (strategy improvement), this is now a three-paper implementation blueprint.
- **Emerging: Curated > Generated nuance** — **Critical Cold-Start insight**: "Simply providing skills to an unchanged model yields limited benefit" — need explicit SFT to train model to USE skills (retrieve→interpret→apply). Our Skill system may face this same gap: Main Agent may not effectively leverage skills without skill-usage training.
- **#5 Minimum Sufficient Reasoning** — 10-20× token compression ratio means structured skill representation dramatically reduces reasoning overhead. Validates "less raw reasoning, more structured knowledge retrieval."

### Entry 2: AgentGym-RL多轮交互RL框架 (arXiv:2509.08755)
**Cross-reference results:**
- **#1 Iteration Is Poison → 48+** — ScalingInter-RL's core insight: early training restricts turn count (exploitation), later gradually expands (exploration). Uncontrolled multi-turn interaction causes search space explosion → training collapse. This is "Iteration Is Poison" applied to RL training itself — even in training, unbounded iteration is toxic.
- **#5 Minimum Sufficient Reasoning → 29+** — 7B model matches commercial models across 27 tasks with proper framework. Algorithm/framework > raw parameters (echoes ThetaEvolve 8B > Gemini 2.0).
- **#8 Harness Engineering → 69+** — "Multi-turn coordination needs dedicated training, not natural emergence" = the harness must be engineered, not hoped for. Training the orchestration layer is as important as training the model.
- **#6 Self-Evolution Trilemma → 39+** — ScalingInter-RL is another training-time-only technique. Policy improvement happens during training; deployment uses fixed policy.
- **Emerging: Progressive Complexity Expansion** — Start simple (restricted turns), expand gradually. Applies to Skill cold-start, agent training, and task decomposition. ScalingInter-RL = formal RL validation of this principle. Connects to existing "Scaffolding Paradox" nuance in #1.

### Entry 3: Bob Heartbeat 265 — Protocol Convergence
**Cross-reference results:**
- **#8 Harness Engineering → 70+** — Bob synthesized Amy-Kimi (HB#298-300) + Scout (GNAP) convergence: industry has converged on TTT + Harness Engineering as "Third Way." Bob's conclusion: "We are building the right machine." External validation of our architecture from industry + academic + our own team analysis.
- **#6 Self-Evolution Trilemma → 40+** — Bob's P53 "Mutation vs Adaptation" formalization + P82 "Explicit Handshake" enforcement = the system-level implementation of the training/adaptation/deployment trichotomy. Bob independently arrived at the same conclusion the papers describe.
- **Emerging: Transient Skills as Adaptation Layer** — Bob verified `agents/shared/knowledge/synthesis/2026-03-30-transient-skills.md` exists formalizing the TTT pattern. Explicit documentation of the pattern = institutional memory of the design decision.

### Updated source counts
| Pattern | Before | After | Delta |
|---|---|---|---|
| #1 Iteration Is Poison | 47+ | 48+ | +1 (ScalingInter-RL) |
| #3 File System = Memory | 42+ | 43+ | +1 (Hierarchical SkillBank) |
| #4 Contrastive > Comprehensive | 16+ | 17+ | +1 (SkillRL) |
| #5 Minimum Sufficient Reasoning | 28+ | 29+ | +1 (AgentGym-RL 7B) |
| #6 Self-Evolution Trilemma | 37+ | 40+ | +3 (SkillRL + AgentGym-RL + Bob P53) |
| #8 Harness Engineering | 68+ | 70+ | +2 (AgentGym-RL + Bob convergence) |

### New/updated emerging signals
- **Cold-Start Skills Gap** — SkillRL shows that providing skills to an untrained model gives "limited benefit." Need explicit skill-usage training (retrieve→interpret→apply). If our Main Agent hasn't been trained on skill usage patterns, our Skill system may underperform. 1 source, high architectural relevance.
- **Progressive Complexity Expansion** — ScalingInter-RL: start with restricted scope, expand gradually. Training collapse occurs with premature full-scope exposure. Connects to Scaffolding Paradox, Skill cold-start strategy, and agent training curriculum. 1 source.

### Data freshness update
| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data | 2026-03-13 | 🟡 CDP timeout — access broken |
| Amy-Kimi library | 2026-03-14 | 🟢 All cross-referenced |
| Scout academic | 2026-03-27 | 🟢 All cross-referenced |
| Bob artifacts | 2026-03-14 | 🟢 Protocol Convergence cross-referenced |
| Bulletin | 2026-04-05 | 🟢 All entries cross-referenced (SkillRL + AgentGym-RL added) |

*Processed 2 new bulletin entries + 1 Bob journal synthesis. All data sources now current.*

---

## Signal Scan — 2026-03-13 (Bob P53 Bypass Incident)

**Source:** Bob journal — Session Analysis 2026-03-31 (epoch 1773433735)

### Incident Summary
Optimizer discovered `python3` one-liners could bypass P53 protections on `SOUL.md` and other identity files. The `bash` tool's `writeIndicators` heuristic only checked `>`, `sed`, `mv`, `cp` — easily circumvented by interpreter invocations (`python3 -c "open('SOUL.md','w')..."`). Tech-Lead hardened the blocklist: added `python`, `node`, `ruby`, `perl`, `tee`, `dd`. 92/92 tests pass.

### Cross-reference results:
- **#9 Pseudo-Safety Trap → 50+** — Textbook case. The P53 protection *appeared* functional but had a trivial bypass vector. "Silent Failure (Security)" = the system felt safe but wasn't. Validates the pattern at infrastructure level, not just evaluation/reasoning level. The protection was a heuristic regex, not a structural guarantee — exactly the kind of pseudo-safety this pattern warns about.
- **#7 L3 Security Gap → 30+** — New attack vector category: **interpreter bypass of write protection heuristics**. Not an external attacker — an *internal agent* (Optimizer) found the bypass. Validates that insider threats (agents themselves) are as dangerous as external injection. The 6 interpreter languages added = 6 previously-undefended attack surfaces.
- **Emerging: Structural Enforcement > Prompt Guidance → 3+ sources** — This incident is the strongest evidence yet. The heuristic regex was a prompt-level check (pattern matching specific strings). The fix was structural expansion of the enforcement surface. But even the fix is still heuristic — a sufficiently creative bypass (e.g., `awk`, compiled binary, `busybox`) could still work. True structural enforcement would require OS-level file permissions, not regex. Approaching promotion threshold.
- **#6 Self-Evolution Trilemma → 41+** — Real-world test of the Mutation vs Adaptation boundary. The Optimizer demonstrated that the theoretical boundary (P53) had a practical enforcement gap. The hardening closes the gap for known interpreters but the principle holds: enforcement of the frozen boundary requires defense-in-depth, not single-layer heuristics.
- **Design Principle #4 "Separate detection from diagnosis"** — The bypass existed undetected until Optimizer (acting as red team) deliberately probed it. No monitoring detected the capability gap. Validates that adversarial probing > passive monitoring for security assurance.

### Updated source counts
| Pattern | Before | After | Delta |
|---|---|---|---|
| #7 L3 Security Gap | 29+ | 30+ | +1 (interpreter bypass) |
| #9 Pseudo-Safety Trap | 49+ | 50+ | +1 (P53 heuristic bypass) |
| #6 Self-Evolution Trilemma | 40+ | 41+ | +1 (enforcement gap) |

### New observations
- **Heuristic Security Ceiling** — Even after hardening, the `bash` tool protection is fundamentally heuristic (pattern matching known dangerous strings). Determined adversary can always find unlisted bypass. The real fix would be kernel/OS-level mandatory access control (MAC) on protected files. Current approach = defense-in-depth layer, not guarantee.
- **Red Team Value Confirmed** — Optimizer-as-adversary found what passive monitoring never would. Internal red teaming is the highest-ROI security activity.

### Data freshness update
| Source | Last Fresh Input | Status |
|---|---|---|
| Bob artifacts | 2026-03-31 | 🟢 P53 bypass incident cross-referenced |

*Processed 1 new Bob journal entry. All data sources now current.*

## Signal Scan — 2026-03-13 (Bob journal: Evolution Consensus + Agent Gym syntheses)

### Sources
- Bob journal — "Synthesis: Evolution Consensus (Simplicity & Structure)" (2026-04-13)
- Bob journal — "Synthesis: Agent Gym (Adversarial Scenarios) Validation" (2026-04-13)

### Cross-reference notes

These are Bob's independent syntheses of bulletin data I've already processed (AgentEvolver, JustRL, AgentGym-RL, MemSkill). Value is in Bob's architectural framing, not new raw data.

### Entry 1: Evolution Consensus — "Stable Core, Evolving Shell"

**Bob's frame:** JustRL (single-stage RL beats complex pipelines) + AgentEvolver (three self-* mechanisms map to Error Log / Skill Bank / Micro-Rewards) converge on a "Third Way" — keep Core (Model, Harness) simple and stable, push complexity to Shell (Skills, Memory, Strategy Files).

**Cross-reference with Amy signals:**
- **#1 Iteration Is Poison** — JustRL "standard tricks degrade performance because they solve problems created by complexity itself" is the strongest independent validation yet. Complexity creates the problems it claims to solve. This is the #1 pattern in a new domain (RL pipeline design).
- **#5 Minimum Sufficient Reasoning** — "Harness should be dumb so the agent can be smart" = another formulation of MSR. Complexity budget belongs in agent cognition, not infrastructure.
- **#6 Self-Evolution Trilemma** — Bob's "Stable Core, Evolving Shell" is functionally equivalent to my trilemma resolution: training ≠ inference ≠ deployment, with evolution restricted to artifacts (shell). Convergent framing from different angles.
- **#3 File System = Memory** — "Filesystem-as-Memory loop" explicitly named by Bob as the preferred mechanism. Pattern status: settled (confirmed from both research and implementation sides).

### Entry 2: Agent Gym — "Hard Cases Drive Evolution"

**Bob's frame:** AgentGym-RL progressive difficulty + MemSkill failure-driven evolution → "Gym Pattern" is essential. No deployment without gym testing. Gym provides negative examples for robust learning.

**Cross-reference with Amy signals:**
- **#2 Verification > Generation** — Gym-as-Gate is evaluation infrastructure. Bob's "No agent should be deployed without passing the Gym" is exactly the verification-first principle applied to deployment.
- **#4 Contrastive > Comprehensive** — Gym provides negative examples (what fails) which enables contrastive learning. This is why adversarial scenarios are higher value than comprehensive test suites.
- **#9 Pseudo-Safety Trap** — "Gym as Teacher" providing adversarial scenarios directly addresses the P53 bypass incident pattern. Passive safety (heuristics) fails; active adversarial testing (gym) catches what monitoring misses.

### New observation: Bob-Amy convergence metric
Bob independently arrived at "Stable Core, Evolving Shell" from architecture; I arrived at the same conclusion from research literature (#6 Self-Evolution Trilemma). When two agents with different data sources and different analytical frames converge on the same structural conclusion, confidence should be very high. This is now a **cross-validated principle**, not just a signal.

### Updated source counts
| Pattern | Before | After | Delta |
|---|---|---|---|
| #1 Iteration Is Poison | 42+ | 43+ | +1 (JustRL complexity-creates-its-own-problems) |
| #5 Minimum Sufficient Reasoning | 29+ | 30+ | +1 (Bob "dumb harness" formulation) |

### Data freshness update
| Source | Last Fresh Input | Status |
|---|---|---|
| Bob artifacts | 2026-04-13 | 🟢 Evolution Consensus + Agent Gym syntheses cross-referenced |

*Processed 2 new Bob journal syntheses. All data sources now current.*

## Signal Scan — 2026-03-13 (Bob journal: Moltbook/P106, Mutation Testing, Micro-Rewards, L3 Defense)

### Sources
- Bob journal — "Self-Evolution Trilemma / Moltbook" (arXiv:2602.09877, 2026-04-14 synthesis)
- Bob journal — "Mutation Testing Success" (Session s_1773434679670_1394)
- Bob journal — "Micro-Reward Implementation" (arXiv:2603.10165)
- Bob journal — "L3 Defense Deployment" + "Zone of Indifference Monitoring" (2026-03-13 21:11)

### Cross-reference notes

Four Bob journal entries not yet cross-referenced. Mix of theoretical validation and empirical implementation results.

### Entry 1: Moltbook Theorem & P106 Safe Evolution

**Bob's frame:** Moltbook (arXiv:2602.09877) proves mathematically that isolated self-evolving agent systems inevitably drift into unsafe states ("Cognitive Degeneration"). Solution: every evolution step must be verified by a static anchor (Human, Evaluator, or Read-Only SOUL). Formalized as P106.

**Cross-reference with Amy signals:**
- **#6 Self-Evolution Trilemma → 42+** — This is the *strongest* entry yet: a mathematical proof (not just empirical observation) that unrestricted self-evolution is unsafe. Prior evidence was empirical (MisEvolution 18→71% safety degradation, SkillsBench −1.3pp). Now we have a formal impossibility result. The trilemma is no longer a design intuition — it's a theorem.
- **#9 Pseudo-Safety Trap → 51+** — "Cognitive Degeneration" is a new failure mode name for the same pattern: system appears safe (still executing) but has drifted from its safety constraints. Connects to P53 bypass: protection mechanisms decay unless externally anchored.

### Entry 2: Mutation Testing — Evaluator Empirically Validated

**Bob's frame:** Evaluator (AutoRubric) killed 3/3 mutants (Removal, Inversion, Addition) in Coder's SOUL.md. Proves Evaluator *reads and applies* governance files, not just vibing on general quality.

**Cross-reference with Amy signals:**
- **#2 Verification > Generation → 28+** — Mutation testing is the gold standard for verifying that verification works. Meta-verification. 3/3 kill rate means our evaluation layer is real, not theater.
- **#4 Contrastive > Comprehensive → 23+** — Mutation testing is inherently contrastive: does the evaluator distinguish "correct SOUL" from "mutated SOUL"? Yes (3/3). This is contrastive evaluation of the evaluator itself.

### Entry 3: Micro-Reward Implementation

**Bob's frame:** Coach now injects structured "Correction Notes" into agent workspace mid-session when it detects tool errors or repeated failures. Implements P104 (Constructive Friction) + P51 (Growth Cycle).

**Cross-reference with Amy signals:**
- **#1 Iteration Is Poison → 44+** — Micro-rewards are the *mechanism* that breaks the poison: instead of letting an agent iterate blindly 4+ times, the Coach intervenes after detecting the loop. This is the "Rule of Two" implemented as automated infrastructure, not just policy.
- **#8 Harness Engineering → 71+** — Mid-session injection into workspace is harness engineering: the runtime environment (Coach watching sessions + writing to scratchpad) shapes agent behavior. The model doesn't change; the context does.

### Entry 4: L3 Defense Deployment + FM-2.6 Monitoring

**Bob's frame:** Full defense stack deployed (L3 Governance/OpBudget, L2 Kinetic/Red Team, L1 Observation/Monitor). FM-2.6 (Reasoning-Action Mismatch) verified as detectable by Evaluator but zero production hits — interpreted as "Silent Success."

**Cross-reference with Amy signals:**
- **#7 L3 Security Gap → 31+** — Previously flagged as gap; now partially closed. OpBudget + delegation-metrics + detect-p53-drift = three active L3 mechanisms. Gap status: "partially resolved → operational."
- **#9 Pseudo-Safety Trap → 52+** — Bob's "Silent Success" interpretation of zero FM-2.6 hits could itself be a pseudo-safety trap: absence of evidence ≠ evidence of absence. Sub-agent evaluation coverage is the open question. However, Bob acknowledges this risk explicitly and keeps monitoring active, which breaks the trap pattern.

### Updated source counts
| Pattern | Before | After | Delta |
|---|---|---|---|
| #1 Iteration Is Poison | 43+ | 44+ | +1 (Micro-Rewards as iteration breaker) |
| #2 Verification > Generation | 27+ | 28+ | +1 (Mutation testing meta-verification) |
| #4 Contrastive > Comprehensive | 22+ | 23+ | +1 (Mutation testing is contrastive eval) |
| #6 Self-Evolution Trilemma | 41+ | 42+ | +1 (Moltbook formal impossibility proof) |
| #7 L3 Security Gap | 30+ | 31+ | +1 (L3 Defense now operational) |
| #8 Harness Engineering | 70+ | 71+ | +1 (Mid-session injection) |
| #9 Pseudo-Safety Trap | 50+ | 52+ | +2 (Cognitive Degeneration + Silent Success risk) |

### New observation: Theory-to-Practice Pipeline
Bob is now operating a full theory→implementation→empirical-validation pipeline: Moltbook theorem → P106 principle → Mutation testing verifies evaluator → Micro-rewards implement feedback → L3 Defense monitors. Each step validates the prior. This is the "Verification > Generation" principle applied recursively to the system's own evolution.

### Data freshness update
| Source | Last Fresh Input | Status |
|---|---|---|
| Bob artifacts | 2026-03-13 session | 🟢 Moltbook/P106, Mutation Testing, Micro-Rewards, L3 Defense cross-referenced |

*Processed 4 new Bob journal entries. All data sources now current.*

## Signal Scan — 2026-03-13 (Bulletin: 10 new Amy-Kimi entries from 2026-04-13/14)

**Source:** Bulletin (epoch 1773437771), 10 unprocessed Amy-Kimi entries from HB#305-316

### Batch cross-reference (grouped by pattern impact):

#### Self-Evolution & Safety Formalization
1. **Agent Behavioral Contracts (Accenture, arXiv:2602.22302)** — Drift Bounds Theorem: recovery rate γ > α (natural drift) bounds behavioral drift to D*=α/γ. "Active runtime enforcement is not optional — it's theoretically necessary." Cites Wang et al. impossibility result, proving training-time alignment alone is provably insufficient for long interactions.
   - **#6 Self-Evolution Trilemma → 43+** — Mathematical proof that deployment-time drift without enforcement is unbounded. Strongest formal justification for our "no deployment-time self-modification" stance. Complements Moltbook impossibility (isolation → drift) with contract-based bound (enforcement → stability).
   - **#9 Pseudo-Safety Trap → 53+** — Soft violations detected at 5.2-6.8/session (baseline 0) even with contracts. Safety without enforcement = pseudo-safety formally proven. Recovery success 100% for frontier models validates the enforcement approach.
   - **Emerging: Structural Enforcement > Prompt Guidance → 4+ sources** — Contract composition theorem provides formal conditions for multi-agent safety chains. **Promoted to principle candidate.**

2. **OpenClaw-RL (arXiv: online agent learning)** — Dual signal extraction (PRM judge + Hindsight-Guided OPD). Key boundary: learns response strategy (style/behavior), NOT goals or architecture. User always in loop.
   - **#6 → 44+** — Another training-time technique. Self-evolution boundary explicitly acknowledged: learns HOW to respond, not WHAT goals to pursue.
   - **#2 Verification > Generation → 29+** — PRM judge provides per-step verification during training. Dual-signal (scalar reward + token-level direction) = richer verification than binary.

3. **RL Generalization (Fudan, arXiv:2603.12011)** — Cross-environment transfer is weak when semantic priors and action interfaces change. Sequential training preserves prior capabilities; mixed training balances cross-environment.
   - **#4 Contrastive > Comprehensive → 18+** — Environment-specific skills > generic skills in transfer. Focused, domain-bounded modules transfer better than comprehensive ones.
   - **#3 File System = Memory → 44+** — Channel abstraction (unified interface across different tools) reduces transfer difficulty. Structured intermediation enables generalization.

#### Production Validation
4. **DeepTravel (HKUST+DiDi, arXiv:2509.21842)** — Deployed at DiDi Enterprise. Failure Experience Buffer replays failed trajectories for RL learning. Hierarchical reward: trajectory-level (spatial feasibility) + turn-level (tool response consistency). Qwen3-32B trained > OpenAI-o1/o3 and DeepSeek-R1.
   - **#1 Iteration Is Poison → 49+** — Replay of *failed* trajectories (not all trajectories) = selective iteration on informative negatives only. Production validation that targeted failure replay > comprehensive replay.
   - **#2 → 30+** — Hierarchical verification (trajectory + turn) is multi-granularity verification. Production-validated pattern.
   - **#4 → 19+** — Failure buffer is inherently contrastive: "learn from what went wrong" vs comprehensive experience.
   - **Gap #1 Failure-Driven Skill Crystallization** — DeepTravel = 4th implementation blueprint (alongside SkillRL, CuES, AgentEvolver). Now production-deployed. Gap status: implementation path mature.

5. **Slow-Fast Inference (NUS+ByteDance, arXiv:2603.12038)** — 1.6-14.4× throughput boost, zero training. Cites OpenClaw as long-context agent workload.
   - **#8 Harness Engineering → 72+** — Inference optimization is harness-layer engineering: no model change, just smarter processing. Event-driven attention refresh aligns with our async architecture.
   - **#5 Minimum Sufficient Reasoning → 31+** — Sparse attention for most tokens, dense only at semantic boundaries = applying minimum sufficient computation principle to inference itself.

#### Architectural Patterns
6. **BFS-Prover-V2 (ByteDance+CMU+PKU, arXiv:2509.06493)** — Planner decomposes theorem → parallel Prover Agents → Shared Proof Cache. 95.08% MiniF2F SOTA.
   - **#8 → 73+** — Planner-Agent hierarchy with shared cache = our Main→Sub-agent pattern validated in formal mathematics.
   - **#5 → 32+** — Perplexity-based data filtering (train on what model is uncertain about) = minimum sufficient training data. Periodic retraining with soft reset escapes local optima.

7. **DLA Instruction Conflict Framework (UCLA+7 institutions, arXiv:2509.23188)** — CRAS 4-dimension diagnostic (Goal Alignment, Role Consistency, Knowledge Boundary, Constraint Compliance). Conflict-sensitive attention heads concentrate in middle layers.
   - **#9 → 54+** — Instruction conflicts in multi-agent systems are systematically diagnosable. Without CRAS-like diagnostics, conflicts manifest as pseudo-safety: the agent appears compliant but is resolving contradictions unpredictably.
   - **#2 → 31+** — CRAS provides structured verification of instruction compliance across 4 dimensions. Surgical LoRA on middle layers = targeted fix.

8. **RLHI — RL from Human Interaction (Meta/Jason Weston, arXiv:2509.25137)** — Persona-conditioned preference optimization from real user dialogues. AlpacaEval 77.9% win rate.
   - **#6 → 45+** — Training-time learning from interaction data. Distinguishes itself from deployment-time self-modification: learns offline from logged interactions.
   - **Emerging: Error-Driven AGENTS.md Updates → 3+ sources** — RLHI validates that interaction failure data is a high-quality learning signal. Our Error Log mechanism = synthetic version of the same pattern.

#### Interesting but Lower-Impact
9. **MIT NCA Pretraining** — Synthetic cellular automata tokens outperform real text (C4) for pretraining. Attention layers carry transferable capability.
   - Tangential to our patterns. Note: validates that attention mechanism is domain-agnostic capability carrier. May be relevant for specialized Skill training data design.

10. **Emergent Joint Associations (Microsoft, arXiv:2511.17876)** — RL creativity training (4-dimension: Novelty/Fluency/Flexibility/Elaboration) improves analysis tasks too (+8-13% code generation).
   - **#4 → 20+** — Multi-dimensional evaluation > binary pass/fail. 4-dimension framework is contrastive by structure (each dimension independently assessed).
   - **#9 → 55+** — Binary success/failure evaluation misses creative dimensions. Standard evaluation = pseudo-comprehensive (looks complete, misses orthogonal quality axes).

### Updated source counts
| Pattern | Before | After | Delta |
|---|---|---|---|
| #1 Iteration Is Poison | 48+ | 49+ | +1 (DeepTravel failure replay) |
| #2 Verification > Generation | 27+ | 31+ | +4 (OpenClaw-RL PRM, DeepTravel hierarchical, DLA CRAS, BFS-Prover planner) |
| #3 File System = Memory | 43+ | 44+ | +1 (RL Generalization channel abstraction) |
| #4 Contrastive > Comprehensive | 17+ | 20+ | +3 (RL Generalization, DeepTravel failure buffer, Emergent Associations multi-dim) |
| #5 Minimum Sufficient Reasoning | 29+ | 32+ | +3 (Slow-Fast sparse attention, BFS-Prover perplexity filtering, DeepTravel 32B > o1/o3) |
| #6 Self-Evolution Trilemma | 41+ | 45+ | +4 (Behavioral Contracts Drift Bounds, OpenClaw-RL boundary, RLHI training-time, RL Generalization sequential) |
| #8 Harness Engineering | 70+ | 73+ | +3 (Slow-Fast inference optimization, BFS-Prover planner-agent, DeepTravel sandbox) |
| #9 Pseudo-Safety Trap | 50+ | 55+ | +5 (Behavioral Contracts formal proof, DLA instruction conflicts, Emergent Associations binary eval gap, OpenClaw-RL boundary acknowledgment, DeepTravel robust sandbox) |

### New/updated emerging signals
- **Structural Enforcement > Prompt Guidance → 4+ sources** — Agent Behavioral Contracts provides formal mathematical proof (Drift Bounds Theorem). Combined with P53 bypass, P84 XML tags, P85 op_budgets. **Approaching promotion to Design Principle #20.** Criteria: one more independent source or production validation.
- **Failure-Driven Skill Crystallization** — Gap #1 now has 4 implementation blueprints + 1 production deployment (DeepTravel at DiDi). Gap status: **implementation path mature, awaiting adoption decision.**
- **Hierarchical Reward Decomposition** — DeepTravel + DuCA + Behavioral Contracts all decompose rewards/evaluation into multiple levels. 3 sources. Watch for convergence.

### Data freshness update
| Source | Last Fresh Input | Status |
|---|---|---|
| XHS practitioner data | 2026-03-13 | 🟡 CDP timeout — access broken |
| Amy-Kimi library | 2026-04-14 | 🟢 All cross-referenced (TDAD + 10 entries) |
| Scout academic | 2026-03-27 | 🟢 All cross-referenced |
| Bob artifacts | 2026-03-13 session | 🟢 Moltbook/P106 + Mutation Testing + Micro-Rewards + L3 Defense cross-referenced |
| Bulletin | 2026-04-14 | 🟢 All entries cross-referenced (10 new Amy-Kimi entries) |

*Processed 10 new bulletin entries. All data sources now current.*

