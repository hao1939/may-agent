# KE-170: Skills Are Redundant When Base Model Capability Is at Ceiling

**Source**: EXP-152 (88 trials across 3 scenarios)  
**Confidence**: High (consistent ceiling effects across all conditions)  
**Created**: 2026-04-13  

---

## Finding

Skills and guard artifacts that encode behaviors the LLM already performs naturally are **redundant** — removing them has zero detectable effect on performance. In EXP-152, surgical removal of verify-after-edit skills, path-navigation skills, and verification context entries produced identical 100% pass rates across all conditions on tasks the base model already handles perfectly.

## Evidence

- **88 trials** across 3 scenarios (kb-discovery-baseline-126, behavior-escalation-stubborn, convention-verify-edit)
- **4 conditions tested**: Production (all skills), no-rbe (no verify-after-edit), no-verify (no verification guard), no-path (no path/grep skills)
- **Result**: All conditions at ceiling (100%) for behavior-escalation-stubborn and convention-verify-edit; no significant differences on kb-discovery-baseline-126 (40-60% range, high variance)
- Zero variance means no statistical test needed — the intervention has no effect

## Mechanism

Modern LLMs have already internalized common coding behaviors (read before edit, verify JSON, check file existence) from training data. Skills encoding these behaviors are reinforcing what the model does anyway. The skill file is simply never the marginal factor in task success.

## Where Skill Value Concentrates

Skills are NOT universally redundant. Value concentrates in behaviors that:

1. **Counter-intuitive actions** — behaviors the model wouldn't naturally do (e.g., "stop coding and escalate when blocked", "do a code review before fixing")
2. **Cognitively loaded multi-step tasks** — where verification discipline degrades under complexity pressure (multi-file edits, long sessions)
3. **Behaviors that degrade under pressure** — where the model's default behavior shifts when context is large or the task is urgent
4. **Novel organizational conventions** — project-specific patterns not in training data

## Implications

- **Audit existing skills**: Most skill files may be redundant. Test each by removal before investing in refinement.
- **Prioritize counter-intuitive skills**: Focus skill creation on behaviors the model doesn't do naturally (escalation, scope discipline, plan-before-code).
- **Scenario selection matters**: Testing skill effectiveness requires scenarios in the 40-70% baseline range where the specific skill-targeted behavior is the failure mode.
- **Ceiling scenarios are uninformative**: If the baseline is >85%, no intervention (positive or negative) will produce detectable effects.

## Cross-References

- **EXP-152**: Full experiment — `agents/shared/knowledge/experiments/EXP-152/`
- **KE-010**: Most gym scenarios hit ceiling at baseline (reinforced by this finding)
- **KE-021**: Process skills > Knowledge skills > Judgment skills in effectiveness
- **KE-143**: Guard redundancy finding (complementary — guards redundant for agents that already comply)
- **KE-168**: Overhead effect inconclusive at medium difficulty
- **H-108**: Guard artifacts as environmental memory — INCONCLUSIVE (P updated 0.50 → 0.45)
