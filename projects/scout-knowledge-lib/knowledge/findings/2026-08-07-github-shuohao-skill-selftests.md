---
title: "shuohao-skills — Portable Agent Skills Are Starting to Ship Their Own Deterministic Tests"
source: github
date: 2026-08-07
last_updated: 2026-08-07
type: finding
tags: [github, agent-skills, verification, supply-chain, portability, deterministic-tools, ci]
relevance: high
---

# shuohao-skills

## Overview

- **Repo:** [eternityspring/shuohao-skills](https://github.com/eternityspring/shuohao-skills) (133★, 15 forks, created 2026-08-06)
- **Revision checked:** [`594a0471a5862e267c2af58ce4e37a392b92ad72`](https://github.com/eternityspring/shuohao-skills/commit/594a0471a5862e267c2af58ce4e37a392b92ad72)
- **What:** A small Apache-2.0 collection whose first skill turns fiction into character profiles. It supports Claude Code and Codex, keeps deterministic transformation logic in a zero-dependency Node script, and requires each skill to include both `SKILL.md` and a model-free `scripts/selftest.mjs`.

## Core Signal

**Portable agent skills are beginning to carry executable verification contracts alongside their instructions.**

The interesting artifact is not the fiction workflow itself. It is the package shape: prose tells an agent what to do, a deterministic helper performs operations that can be checked mechanically, fixtures establish expected behavior, and a self-test probes the helper without calling a model. That makes part of a skill reviewable and regression-testable without replaying an expensive, nondeterministic agent session.

The repository also exposes the unfinished part of this pattern. Its six-platform test matrix exists only under `ci/selftest.yml`, not GitHub's active `.github/workflows/` path, while installation uses symlinks so a later `git pull` immediately changes the skill that agents execute. A test-bearing skill is therefore not automatically a test-gated or version-pinned skill.

## Concrete Design Details

1. **A self-test is part of the repository's skill contract.**  
   The README says each `skills/<name>/` directory must contain `SKILL.md` and `scripts/selftest.mjs`. The proposed CI discovers every skill automatically, fails if no self-test exists, separately checks for every `SKILL.md`, and syntax-checks the installer. This is stronger than treating a skill as an unstructured prompt file.

2. **The testable boundary is deliberately separated from model behavior.**  
   `novel-characters.mjs` uses only Node standard-library code for chunking, roster merging, schema validation, and rendering. Its self-test imports those functions directly and uses checked-in story and expected-output fixtures. The test does not invoke a model or consume inference quota.

3. **The tests encode observed agent failure modes.**  
   The validator tests explicitly inject paraphrased rather than verbatim evidence, character names inside image prompts, the wrong language in constrained fields, an invalid importance enum, and missing required structure. The skill instructions then make validation a non-skippable step and require repair-and-rerun until it passes. This is a useful pattern: convert recurring model mistakes into deterministic executable checks rather than adding more admonitions to the prompt.

4. **The verification surface includes output safety and delivery properties.**  
   Beyond domain fields, the 73 checks cover HTML escaping of model-generated values, absence of external scripts/styles, rendering completeness, truncation bounds, alias merging, and edge cases in generated filenames. At the checked revision, a clean clone reported `✓ 73 项自测全部通过`; `bash -n scripts/install.sh` also passed.

5. **The advertised CI is intentionally inactive.**  
   The matrix targets Ubuntu and macOS across Node 18, 22, and 24, but the workflow file is stored at `ci/selftest.yml`. The README plainly says it has not been enabled because moving it into `.github/workflows/` requires a token with workflow permission, and that only macOS plus Node 24 had been tested by the author. GitHub therefore shows no active workflow for the checked tree. The distinction between “a CI specification exists” and “required CI ran” should survive downstream cataloging.

6. **Convenient installation creates a live update channel.**  
   `scripts/install.sh` symlinks the repository's skill directory into Claude Code and/or Codex so `git pull` takes effect immediately. It avoids overwriting real directories and supports uninstall, but it does not pin a commit, run the skill self-test during installation, or gate updates on test success. The installed execution surface can therefore change with the checkout.

## Why This Matters

1. **Agent-skill manifests may need a test entry point, not just metadata.**  
   A portable package becomes materially easier to admit when a registry or host can run a declared deterministic test without executing the model-facing workflow.

2. **Verification can be layered.**  
   Model judgment remains necessary for extraction and writing, while deterministic code owns exact quotation checks, schemas, safe rendering, and bounded transformations. This is a more credible boundary than trying to make every quality property either fully deterministic or fully prompt-enforced.

3. **Skill supply chains need version and activation semantics.**  
   The repo demonstrates three states that catalogs should not collapse: tests are present, tests pass in Scout's checked environment, and tests are enforced on every accepted revision. Only the first two are true here.

4. **Auto-updating skills should be treated like executable dependencies.**  
   A symlink-plus-pull workflow is productive, but safe hosts should record a revision, test before activation, preserve a rollback target, and expose when instruction or helper code changed.

## Practical Pattern

For a portable skill package, require:

- a human-readable skill manifest,
- deterministic helpers isolated from model calls where possible,
- checked-in fixtures and a model-free self-test,
- a declared test command and supported runtime matrix,
- CI in an active, required workflow,
- install/update receipts containing the exact revision and test result,
- atomic activation only after tests pass, with rollback to the prior revision.

## Sources

- **Repo:** https://github.com/eternityspring/shuohao-skills
- **GitHub API metadata:** https://api.github.com/repos/eternityspring/shuohao-skills
- **Revision:** https://github.com/eternityspring/shuohao-skills/commit/594a0471a5862e267c2af58ce4e37a392b92ad72
- **README:** https://raw.githubusercontent.com/eternityspring/shuohao-skills/594a0471a5862e267c2af58ce4e37a392b92ad72/README.md
- **Skill:** https://raw.githubusercontent.com/eternityspring/shuohao-skills/594a0471a5862e267c2af58ce4e37a392b92ad72/skills/novel-characters/SKILL.md
- **Self-test:** https://raw.githubusercontent.com/eternityspring/shuohao-skills/594a0471a5862e267c2af58ce4e37a392b92ad72/skills/novel-characters/scripts/selftest.mjs
- **Proposed CI:** https://raw.githubusercontent.com/eternityspring/shuohao-skills/594a0471a5862e267c2af58ce4e37a392b92ad72/ci/selftest.yml
- **Installer:** https://raw.githubusercontent.com/eternityspring/shuohao-skills/594a0471a5862e267c2af58ce4e37a392b92ad72/scripts/install.sh
