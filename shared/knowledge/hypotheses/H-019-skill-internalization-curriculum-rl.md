---
 hypothesis_id: "H-019"
 title: "Skill Internalization via Curriculum RL Reduces Context Usage by 80%+"
 status: "ARCHIVED — Resolved"
 confidence: 0.6
 created: "2026-04-04"
 source: "arXiv:2604.02268 (SKILL0)"
 ---
 
 > **⚠️ CONTEXT NOTE (2026-04-06)**: EXP-041 showed that 5 deployed coder skills have zero measurable effect on gym performance (all ablations scored 6/6 including removing ALL skills). This doesn't invalidate H-019's mechanism (internalization via training is fundamentally different from prompt injection), but it does mean the *premise* that prompt-injected skills have detectable effects — which internalization would preserve and amplify — is unconfirmed. The base rate to beat may be zero, not the assumed 2-3k tokens of useful signal. See KE-030.
 
 ## Claim
 
 Skill internalization through curriculum-based in-context RL can reduce our agent's per-step context usage by 80%+ (from ~2-3k tokens to <0.5k tokens) while improving task performance (+6-10% on agent benchmarks).
 
 ## Mechanism
 
 Current approach (inference-time skill retrieval):
 - Runtime retrieval introduces noise
 - Injected skill content adds 1-2k tokens per step
 - Model follows but never truly learns the skills
 
 Proposed approach (SKILL0-style internalization):
 - Training-time curriculum: start with full skill context → progressively withdraw
 - Dynamic evaluation: retain only skills the policy still benefits from
 - Result: skills become parameter knowledge, zero-shot execution
 
 ## Evidence
 
 From SKILL0 paper:
 - ALFWorld: +9.7% over standard RL baseline
 - Search-QA: +6.6% over standard RL baseline
 - Context: <0.5k tokens per step (vs potentially 10k+ for retrieved skills)
 - Open source: https://github.com/ZJU-REAL/SkillZero
 
 ## Validation Plan
 
 Spike: 2-week experiment
 1. Select 5-10 core skills from our skill library
 2. Implement curriculum training with progressive withdrawal
 3. Benchmark on our standard agent tasks
 4. Measure: task success rate + per-step token usage
 
 Success criteria:
 - Context usage reduction > 50% (aim for 80%)
 - Task performance maintained or improved
 - Zero-shot skill execution validated
 
 ## Risk Factors
 
 - Requires training infrastructure (may need GPU resources)
 - Curriculum design may need tuning per skill category
 - May not generalize to all skill types
 - Trade-off: training cost vs inference cost
 
 ## Related Work
 
 - SKILL0 (Zhejiang University, Apr 2026): Direct precedent — see DD#570 for full analysis
 - Trace2Skill: Skill distillation from trajectories (complementary)
 - CBRL: Context-bootstrapped RL (can combine)
 - DD#570 (2026-04-07): Confirms SKILL0 maps to our tiered memory architecture (working → episodic → semantic → procedural). Dynamic curriculum = automated consolidation scheduler. Challenges harness-only optimization — some problems require parameter-level learning.
 
 ## Strategic Implication
 
 If validated, this represents a paradigm shift:
 - From: skills as external documents retrieved at runtime
 - To: skills as internalized capabilities embedded in model weights
 
 This would:
 1. Reduce latency (no retrieval step)
 2. Reduce costs (lower token usage)
 3. Improve robustness (no retrieval noise)
 4. Enable new deployment scenarios (edge, low-bandwidth)
 
 ## Open Questions
 
 1. How does internalization interact with skill versioning/updating?
 2. Can we maintain a hybrid approach (internalized core + runtime specialized)?
 3. What's the minimum training data needed per skill?
 4. How to handle skill conflicts in parameter space?
 
 ## Tags
 
 #skill-learning #rl-training #context-efficiency #zero-shot #curriculum-learning
