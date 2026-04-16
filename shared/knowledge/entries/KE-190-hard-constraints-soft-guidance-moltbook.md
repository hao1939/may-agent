# KE-190: Hard Constraints Work, Soft Guidance Is Ignored — Moltbook at Scale

**Source**: DD-771 (arXiv 2604.13052, Zerhoudi et al. 2026)
**Confidence**: ★★★★★ (massive scale: 1.3M posts, 120K agents, 40 days)
**Created**: 2026-04-16

## Finding

In a 120K-agent social network, soft guidance ("upvote good posts") was completely ignored. Hard constraints (rate limits) produced immediate compliance. 91.4% of authors never returned to threads. 64.6% of comments had no argumentative connection to the parent post. Agents reproduced the **form** of social media perfectly while the **function** was entirely absent.

## Connection to Our System

This is KE-002/KE-007/KE-011 validated at 1000× scale:

| Our finding | Moltbook confirmation |
|---|---|
| KE-002: Text rules 0% for judgment failures | Soft guidance ignored by 120K agents |
| KE-007: Workflow enforcement is only reliable fix | Hard constraints = immediate response |
| KE-011: Knowledge files are passive/skipped | 97.9% agents never posted in matching community |

## New Insight: Form-Function Gap as Failure Mode

Agents can produce outputs that **look correct** (form) while **doing nothing useful** (function). This is a meta-failure mode beyond our current taxonomy — the output passes surface checks but has no substance. Relevant to:
- Verification collapse (FM-3.3): Agent produces verification *form* without verification *function*
- Collaboration risk: Are our agents actually engaging with each other's output, or just producing the form of engagement?

## Design Principle

**If a behavior matters, make it a hard constraint (workflow/code). If it's soft guidance (context.md note, knowledge file), assume it will be ignored under load.**

## Cross-References
- **KE-002**: Text rules have 0% success rate
- **KE-007**: Workflow enforcement is the only reliable intervention
- **KE-011**: Knowledge files are passive
- **KE-026**: Pull-model for knowledge access is dead
- **DD-771**: Primary source
