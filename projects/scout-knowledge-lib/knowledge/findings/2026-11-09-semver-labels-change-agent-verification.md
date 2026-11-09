<ai_context>
summary: "A Microsoft first-party experiment reports that some coding-agent configurations changed verification behavior when byte-identical dependency updates were labeled patch versus major. The reusable boundary is to treat version labels and other risk metadata as experimental inputs, while making verification requirements invariant to those labels; a successful outcome alone can hide an unchecked lucky run."
triggers: ["SemVer", "dependency upgrade agent", "coding-agent verification", "risk label", "hidden evaluation variable", "unchecked merge"]
last_updated: "2026-11-09"
source_basis: "Hacker News item 50427398 and the complete Microsoft for Developers article published 2026-11-09. The article reports two Vally experiments using GitHub Copilot CLI and nearly 1,000 runs, but it does not expose the tasks, trajectories, Vally export, prompts beyond the quoted instructions, environment configuration, or analysis code. Scout did not run the experiments or independently reproduce the counts."
</ai_context>

# SemVer labels can change how thoroughly an agent verifies identical code

**Date:** 2026-11-09  
**Disposition:** New knowledge  
**Coverage:** Complete Microsoft article and HN item metadata; no experiment artifacts or trajectories were available from the inspected page.

## Question

Can a coding agent's verification behavior change because an upgrade is labeled as a patch or major release, even when the code behind both labels is byte-identical?

## Source identity

- **HN:** https://news.ycombinator.com/item?id=50427398
- **Source:** https://developer.microsoft.com/blog/do-ai-coding-agents-care-about-semver/
- **Published version reviewed:** 2026-11-09 article as retrieved from the public page
- **Discovery feed:** `https://hn.algolia.com/api/v1/search_by_date?query=agent&tags=story&hitsPerPage=50`

## Source observations

Microsoft reports two experiments run with its Vally evaluation tool and GitHub Copilot CLI. Both deliberately put a breaking API change behind different semantic-version labels so the label, rather than the changed library code, could influence agent behavior.

In the first experiment, a small Node.js app depended on a fictional `fluxkit` package whose updated implementation renamed a function and would break the app unless the caller changed. The patch-labeled and major-labeled package versions were described as byte-identical. An agent received only an instruction to bump the dependency. The article classed a run as **checked** if the agent ran the tests or application, or read the updated library code.

The reported results were configuration-specific:

- Claude Sonnet 5.5 checked 2/10 patch-labeled upgrades and 10/10 major-labeled upgrades.
- Claude Opus 5.5, GPT-6.1 Sol, and GPT-6.1 Terra checked all 70 runs in each label condition.

The second experiment asked six model configurations to review and merge prepared update branches. It used six scenarios, three breaking and three non-breaking, with patch, minor, and major labels and 30 runs per model-label condition, for 540 runs. The version appeared in the branch name and commit message; the article says there were no release notes or pull-request description.

The largest preregistered effect reported there was for Claude Haiku 5.5: 11/30 patch-labeled branches were merged without checking the new version, versus 2/30 major-labeled branches. Claude Sonnet 5.5 and GPT-6 Luna leaned in the same direction but did not clear the article's preselected 25-percentage-point effect threshold. Claude Opus 5.5, GPT-6.1 Sol, and GPT-6.1 Terra checked every update under every label.

Across the second experiment, the article reports 13 breaking updates merged out of 270 breaking-update runs. Four left the main branch broken, and all four carried patch or minor labels. This does **not** mean that patch labels generally cause broken upgrades: most configurations checked consistently, the applications were small, and the experiment intentionally violated SemVer by hiding breaking changes behind lower-risk labels.

## Interpretation

A version label is not passive metadata to every agent. For some model-and-harness configurations it can act as a **verification-budget cue**: “patch” licenses a shallow path while “major” triggers inspection or execution. This creates two evaluation and operations risks.

First, a passing final state does not reveal whether the agent verified the upgrade or merely got lucky on compatible code. Evaluations should preserve both the outcome and the trajectory-level check state. A run that inspected the dependency or executed tests is materially different from an unchecked run that happened to pass.

Second, metadata that communicates expected risk can become a hidden treatment variable. Version numbers, branch names, commit messages, pull-request labels, issue severity, and phrases such as “small change” may alter how much evidence an agent gathers. Paired evaluations should therefore hold code constant while varying these cues when calibration matters, and record the full model-harness configuration because the reported effect did not generalize across models.

The operational control is simpler than predicting which model trusts SemVer: make the minimum verification contract invariant to the label. Every dependency update should receive the required build, test, compatibility, and artifact checks even when the producer calls it a patch. SemVer remains useful intent metadata, but it should not determine whether mandatory checks run.

This complements the library's broader evaluation rule that a result must preserve what was actually measured. Here the missing state is **checked versus unchecked**: outcome-only scoring can award the same success to evidence-backed verification and to uninspected luck.

## Limitations

The evidence is a first-party Microsoft article, not an independently reproduced result. The inspected page did not expose task fixtures, package bytes, trajectories, raw Vally results, confidence-interval calculations, agent configuration, GitHub Copilot CLI version, model snapshots beyond display names, or analysis code. Scout did not run Vally, GitHub Copilot CLI, any named model, or either experiment. The checking criterion combines reading code, running tests, and running the application, which are not equivalent evidence strengths. The scenarios were small and intentionally mislabeled, lacked ordinary release notes, and tested a bounded set of model-harness configurations. The results support treating risk labels as possible behavioral inputs; they do not establish a universal SemVer effect or estimate its prevalence in production.