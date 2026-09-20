<ai_context>
summary: "A current XHS explainer reports that CoEvoSkills uses a generator plus an independent verifier to co-evolve multi-file agent skill packages without human-labelled feedback, reaching 71.1% on SkillsBench versus 53.5% for human-authored skills and transferring 35–44 percentage-point gains to six other models. Because the post does not link the paper, repository, benchmark version, or statistical details, these numbers are a discovery signal rather than validated evidence; the durable implication is that claims about self-authored skills must identify the authoring loop, verifier independence, benchmark split/version, and transfer protocol."
triggers: ["CoEvoSkills", "self-authored agent skills", "skill co-evolution", "independent skill verifier", "SkillsBench", "skill transfer", "XHS agent skills"]
source_basis: "Body-level inspection of XHS note 6a7c1c9f0000000005029c5e on 2026-09-20; the post is a secondary summary and supplies no primary paper or repository link."
</ai_context>

# CoEvoSkills claim makes verifier design part of the self-authored-skill question

**Date observed:** 2026-09-20  
**Disposition:** new source signal; primary verification required  
**Coverage:** Full visible title, description, tags, engagement counts, and body text of one XHS video note. The video frames/images were not transcribed, and no linked paper, repository, appendix, or benchmark artifact was available in the post.

## Source

- **XHS note:** https://www.xiaohongshu.com/explore/6a7c1c9f0000000005029c5e
- **Displayed author:** 光头不砍树
- **Displayed title:** “AI Agent自写技能包，比人写的更强”
- **Displayed date:** 08-12

## Question

Does the current XHS source provide a useful new signal about agents authoring their own reusable skills, rather than repeating generic claims that reflection improves performance?

## What the post reports

The post attributes a system called **CoEvoSkills** to a UIC team. Its description says the system co-evolves a generator and an independent verifier so that an agent can produce multi-file skill packages without human-labelled feedback. It reports:

- **71.1%** pass rate on SkillsBench;
- **53.5%** for human-authored skills; and
- **35–44 percentage-point** improvements when the skills are transferred to six other models.

These are claims made by the XHS author, not independently checked results. The visible post does not identify the researchers, paper title/ID, repository, SkillsBench version, evaluation split, number of trials, confidence intervals, or the six transfer models.

## Why this is a useful signal

Earlier library coverage records that SkillAxe found naïvely LLM-authored skills produced no measurable SkillsBench gain, while human-authored skills improved pass rates by 16.2 points. Later primary-source coverage of SkillAlchemy found that a structured, source-grounded creation and admission pipeline reached 55.8% avg@5 versus 54.4% for human-curated skills, while explicitly warning that the observed lead did not establish statistical superiority.

CoEvoSkills therefore matters less as another “AI beats humans” headline than as a **method-sensitive counter-signal**. If its reported result survives primary inspection, the relevant variable is not merely whether a model wrote the skill. It is whether generation is coupled to an evaluator that can reject, repair, and retest a package, and whether the resulting package transfers beyond the model that produced it.

That suggests a better comparison contract for self-authored skills:

1. name the exact SkillsBench version, held-out assets, aggregation rule, and trial count;
2. separate first-draft generation from iterative verifier-guided search;
3. establish verifier independence by disclosing its model, information access, and whether it shares failure-correlated assumptions with the generator;
4. report compute and evaluation attempts, so iterative search is not compared with one-shot human authoring as if budgets were equal;
5. test transfer by model and task family, including regressions, rather than reporting only a pooled improvement range; and
6. retain the package, generator revision, verifier verdicts, and benchmark receipts needed to reproduce admission.

The practical implication is provisional but useful: **“LLM-authored skills work” and “LLM-authored skills do not work” are both under-specified claims.** Authoring loop, verifier boundary, test budget, benchmark version, and transfer protocol are part of the result.

## Limitations and verification queue

The post is a concise secondary explainer. Its use of “independent verifier” does not establish organizational, model, data, or failure-mode independence. A verifier can still reward benchmark leakage, overfit through repeated trials, or share the generator's blind spots. The 35–44-point transfer claim is uninterpretable without per-model baselines and task composition, and a 71.1% versus 53.5% headline cannot establish superiority without the unit of analysis and uncertainty.

Before promoting the numbers into a benchmark comparison, locate and inspect the primary paper and artifacts; reconcile its protocol with SkillAxe and SkillAlchemy; and verify that no held-out verifier, oracle artifact, or benchmark-derived material entered generation. Until then, the post is evidence of a concrete claimed design and an evaluation question—not proof that autonomous skill authoring outperforms human curation.

## Related library coverage

- [SkillAlchemy: discover missing requirements before compiling sources into skills](./2026-08-25-source-grounded-open-world-skill-creation.md)
- [June arXiv triage: SkillAxe self-refinement result](./2026-06-19-arxiv-ai-agent-triage.md#260610546-skillaxe-self-refinement-of-llm-authored-agent-skills)
