# DD-722: SkillClaw — Collective Skill Evolution from Production Trajectories

**Paper**: arXiv:2604.08377 — "SkillClaw: Let Skills Evolve Collectively with Agentic Evolver" (Ma, Yang, Ji, Wang, Wang, Hu, Huang, Chu — April 9, 2026)
**Rating**: ★★★★½
**Added**: 2026-04-10 Session 575 (Friday scout sweep)

## Why This Matters

Most agent skill systems are static after deployment — skills are defined, packaged, and frozen. SkillClaw treats **cross-user production trajectories as the primary signal for skill improvement**, implementing a feedback loop from deployment back to capability. This is the first framework for "collective skill evolution" in multi-user agent ecosystems.

## Core Contributions

### 1. Cross-User Experience as Learning Signal
- Different users encounter different failure modes for the same skills
- These heterogeneous experiences contain complementary signals
- SkillClaw continuously aggregates trajectories across users
- Pattern recognition identifies when a skill works vs. fails and under what conditions

### 2. Autonomous Evolver Architecture
An autonomous "evolver" agent processes aggregated trajectories:
- **Pattern identification**: Discovers recurring behavioral patterns across users
- **Skill refinement**: Updates existing skills based on observed failure modes
- **Capability extension**: Creates new skills when patterns suggest capability gaps
- **Quality filtering**: Distinguishes signal from noise in trajectory data

### 3. Shared Repository with Synchronization
- Skills maintained in shared repository accessible to all users
- Improvements discovered in one user context propagate system-wide
- No additional effort required from individual users
- Version control for skills enables rollback if updates degrade performance

### 4. WildClawBench Evaluation
- Tested on real-world agent scenarios (not toy tasks)
- With limited interaction data, significantly improves Qwen3-Max performance
- Demonstrates that **small amounts of production feedback compound into meaningful skill improvements**

## Connection to Our Research

### Direct Links
- **EXP-091/104 (Skill Injection)**: DD#711 showed 39/49 skills yield zero improvement. SkillClaw provides a mechanism to discover WHICH skills actually help and iteratively refine them based on production evidence rather than pre-hoc design.
- **KE-101 Laws 2+5**: "Structural interventions > content" — SkillClaw is structural (infrastructure for skill evolution) not content (specific skill definitions). Aligns with our finding that process changes outperform content changes.
- **CR#326 Path A (Production Observation)**: SkillClaw implements the "production observation" approach for skill improvement specifically. Rather than redesigning gyms, learn from production use.
- **DD#716 (Externalization Framework)**: SkillClaw is an implementation of the externalization principle — skills are infrastructure, not weights. Evolution happens in the external skill repository, not via fine-tuning.
- **EXP-109 (19K Production Evals)**: Our production data contains exactly the kind of cross-user trajectory data SkillClaw needs. The 50-70% FM-3.3 success rate means there's rich signal about what works and what doesn't.

### Novel Insight: "Production as Curriculum"
SkillClaw's deepest insight is that **production deployment IS the training data generation process**. Every user interaction generates:
- Positive examples (successful skill applications)
- Negative examples (failure modes)
- Context signals (when/where skills succeed or fail)

This flips the typical relationship between evaluation and improvement:
- **Traditional**: Train → Deploy → Evaluate → Retrain (slow, disconnected)
- **SkillClaw**: Deploy → Observe → Evolve skills → Deploy updated (continuous, connected)

For our system, this suggests that the commit guard data (19K evals with outcomes) could be mined for skill evolution signals — which patterns in agent behavior reliably lead to guard approval vs. rejection?

### The Cross-User Knowledge Transfer Problem
SkillClaw assumes skill improvements transfer across users. This parallels our cross-agent problem:
- Bob and Scout share a knowledge library
- Improvements discovered by one agent should help the other
- But context differences mean not all lessons transfer
- SkillClaw's quality filtering may help distinguish transferable from context-specific improvements

## Limitations
- Work in progress — full evaluation details not yet available
- Unclear how well skill evolution works for novel vs. incremental capability improvements
- Risk of negative transfer — skill updates that help one context may hurt another
- The evolver itself is an LLM, subject to the same failure modes (DD#719 overconfidence, DD#717 miscalibration)

## Predictions
- **P-722a**: Mining our commit guard data for skill evolution signals will yield higher-quality skill updates than human-designed skill injections (cf. DD#711)
- **P-722b**: The "80/20 skill" pattern will emerge — a small number of evolved skills will account for most improvement (matching DD#711's finding that only 7/49 skills help)
- **P-722c**: Cross-user skill transfer will show the same context-dependency as our agent prompts — behavioral skills transfer well, informational skills don't

## Tags
`skill-evolution` `production-learning` `cross-user-transfer` `externalization` `continuous-improvement`
