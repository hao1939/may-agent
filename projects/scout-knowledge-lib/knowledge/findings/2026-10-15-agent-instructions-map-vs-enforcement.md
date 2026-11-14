<ai_context>
summary: "Two released audits show that instruction quality and instruction delivery are separate gates. In 1,866 popular active repositories, many rules were script-checkable but rarely named a check; in a later weighted sample of 3,905 public CLAUDE.md and AGENTS.md files, 16.4% of 745 root pairs never exposed AGENTS.md to Claude and 14.9% relied on a non-binding sentence. Treat instruction files as loader-scoped discovery maps, then pair checkable constraints with named executable enforcement."
triggers: ["AGENTS.md", "CLAUDE.md", "agent instructions", "coding agent rules", "executable enforcement", "instruction lint", "instruction loading", "context truncation"]
last_updated: "2026-11-14"
source_basis: "HN items 50108234 and 50496205; complete source articles; the first study's released agents-md-study-2026-10.zip (SHA-256 a676ffd9a6ca41ef3c51546dc07748bff3759bb847308db1966a62fa1b9ba850); and Harbor's aggregate claude-md-agents-md-study-2026-10-18.csv (SHA-256 6cc79d0fc30c09fa452931207503e3b1dace2e5d1d019a3a98ad218f47d2bb40), inspected through 2026-11-14. Scout did not reclone repositories, rerun collection, review every source row or file, run either checker, or test agent outcomes."
</ai_context>

# Agent instructions are maps; checks provide enforcement

**Date:** 2026-10-15  
**HN:** [item 50108234](https://news.ycombinator.com/item?id=50108234)  
**Source:** [What 1,866 Popular GitHub Projects Tell Their AI Coding Agents](https://secondtimeisabug.com/blog/what-projects-tell-ai-coding-agents/)  
**Data:** [research page and downloadable archive](https://secondtimeisabug.com/research/what-projects-tell-ai-coding-agents/)  
**Reviewed data artifact:** `agents-md-study-2026-10.zip`, SHA-256 `a676ffd9a6ca41ef3c51546dc07748bff3759bb847308db1966a62fa1b9ba850`  
**Coverage:** complete article and research page; archive README, final and length aggregates, reviewer report, recomputed review results, and selected analysis scripts. Scout did not inspect every repository record or instruction file.

**Update (2026-11-14):** [HN item 50496205](https://news.ycombinator.com/item?id=50496205) linked Harbor's complete article, [“We checked 3,905 CLAUDE.md and AGENTS.md files on GitHub”](https://gethrbr.com/blog/claude-md-agents-md-github-study), and its [aggregate CSV](https://gethrbr.com/data/claude-md-agents-md-study-2026-10-18.csv), SHA-256 `6cc79d0fc30c09fa452931207503e3b1dace2e5d1d019a3a98ad218f47d2bb40`.

## Question

What do public agent-instruction files actually provide, and where should a coding-agent system rely on executable checks instead?

## Source findings

The author sampled the top-starred repositories overall and in 24 language lists from GitHub Ranking, retained projects with a 2026 commit, and successfully read 1,866. The released curated aggregate reports that 627 (34%) had at least one recognized agent instruction file. Among those projects, 489 had `AGENTS.md`, 328 had `CLAUDE.md`, and 123 had GitHub Copilot instructions; a project can have more than one format.

The root instruction files are substantial enough to be part of the harness budget. The article's length artifact covers 582 files: 302 (52%) exceed 100 lines, the median is 105.5 lines, and 87 exceed 300 lines. Thirty percent of projects with an instruction file also keep scoped files in subdirectories, which supports a short root map plus local detail rather than one universal prompt.

The sharper result concerns **declared rules versus named enforcement**. In a separately AI-reviewed random sample, 157 of 257 rules (61%) were classified as fully or partly checkable by a script, linter, test, or CI job, but only eight of those named the check. Across two AI-reviewed samples, just 16 of 431 rules (3.7%) named a check. Examples in the article include filename conventions, forbidden syntax, and commit-message constraints that could be checked mechanically but are presented only as prose.

The source also found 209 repositories with both exact-case root `AGENTS.md` and `CLAUDE.md`: 157 pairs were pointers and five were identical, while the review classified about 31 pairs as genuinely separate rulebooks after excluding near-copies, shared third-file stubs, and imports. Separate agent-specific rulebooks create a drift surface that a one-line pointer avoids.

Staleness was less common than the raw analyzer suggested. Human-unverified automated flags produced many false alarms around submodules, ignored paths, subdirectory commands, wildcard targets, and negative instructions. The separate AI review reduced the reported dead-pointer rate to about 10 of 585 primary files (1.7%). This is useful evidence for validating references, but it is also a warning that an instruction linter needs repository-aware path and command semantics rather than regex matches alone.

## 2026-11-14 update: delivery must be verified before content quality

Harbor's later producer-authored audit asks a narrower prerequisite question: does the instruction text reach the model at all? It sampled 1,935 `CLAUDE.md` and 1,970 `AGENTS.md` files through size-stratified GitHub code search and separately classified 745 repositories with both files at the root. The released aggregate CSV reports that, among those root pairs, 25.4% explicitly imported `AGENTS.md`, 23.0% used a symlink, 14.9% merely asked Claude in prose to read it, 16.4% never mentioned it, and 7.0% appeared copied and then drifted. These are weighted producer estimates, not an independent census; Harbor says reruns can move results by a point or two.

Size creates a second delivery boundary. The aggregate reports 30,080 public `AGENTS.md` files over Codex's stated 32 KiB default project-document limit (2.6% of GitHub's estimated population) and 51,840 over 24 KiB, where nested instructions can consume the remaining budget. The article says excess text is silently omitted in its tests. Scout verified those aggregate rows and their hash, but did not inspect the underlying repositories, rerun the checker, or independently test Claude Code or Codex loader behavior.

This extends rather than replaces the earlier finding. A rule can fail at four distinct gates: the harness may not load it; a loader budget may truncate it; the model may not follow it; and a checkable requirement may lack executable enforcement. Instruction maintenance should therefore capture the effective, ordered files and byte ranges delivered to each agent—not just lint source files in the repository.

## Scout interpretation

An instruction file and an enforcement mechanism answer different questions:

1. **The map tells the agent what matters:** repository purpose, structure, relevant documents, scoped conventions, and the commands that establish evidence.
2. **The check decides a machine-verifiable claim:** generated files unchanged, tests present, formatting valid, forbidden constructs absent, or commit metadata conforming.
3. **The result records what actually happened:** the named check ran against identified bytes and returned a durable outcome.

Prose remains appropriate for judgment-heavy constraints, but repeating a mechanically checkable rule in model context is not a substitute for enforcement. A useful authoring test is: if a rule is checkable, name the exact check beside it and run that check at the acceptance boundary. If it is not checkable, identify the human or review judgment that owns it. This turns an instruction file from an ever-growing wish list into a compact routing layer for evidence.

Multiple harness-specific files should normally point to one authoritative rulebook unless their scopes are intentionally different and independently maintained. Scoped subdirectory files can then attach only the local detail needed for work in that area.

## Evidence limits

This is an author-produced observational audit, not a controlled study of agent performance. The popularity and recent-commit filters favor visible, maintained repositories and do not represent GitHub generally. File recognition, heading classification, and directive extraction depend on the source's conventions. Rule-level claims come from two single-pass large-language-model reviews; no person checked every label, and “partly checkable” is subjective. The archive's review documents material analyzer false positives and small definitional differences in file counts.

Scout verified the quoted curated aggregates and review notes in the released archive but did not reclone the repositories, rerun collection, inspect all records, or reproduce any behavioral effect on coding agents. HN had one point and no comments at inspection, so it supplied discovery rather than independent validation.

## Disposition

**New knowledge.** Existing Scout notes cover instruction loading, harness overhead, and guard evaluation, but none declares this primary source or its cross-repository evidence about instruction-file adoption, rule checkability, named checks, duplicate rulebooks, and analyzer false positives.
