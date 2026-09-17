<ai_context>
summary: "A September 2026 Show HN project turns AI-prose cleanup into a layered check: deterministic sanitation and style linting, then an original-versus-rewrite semantic review. The separation is useful because a high style score cannot detect invented details or dropped caveats. However, only the script gates are executable as shipped; the fresh-subagent review and retry loop are instructions in SKILL.md, so a claimed four-gate pass still depends on harness compliance unless a coordinator records and enforces every verdict."
triggers: ["anti-ai-slop", "AI writing", "semantic fidelity", "independent reviewer", "style linter", "verification boundary", "agent skill conformance"]
last_updated: "2026-09-14"
source_basis: "HN item 49692619 and repository misbahsy/anti-ai-slop inspected at commit 1b7d68f2de11e6dd7221681371d88e3d160eb46a; repository's offline tests run locally."
</ai_context>

# Anti-slop editing needs separate style and fidelity verdicts

**Date:** 2026-09-14  
**Source:** https://news.ycombinator.com/item?id=49692619  
**Repo:** https://github.com/misbahsy/anti-ai-slop  
**Inspected revision:** `1b7d68f2de11e6dd7221681371d88e3d160eb46a`

## Observation

The Show HN project `anti-ai-slop` packages prose cleanup as an agent skill with four advertised gates:

1. remove invisible characters;
2. run a deterministic style linter;
3. give the original and rewrite to a fresh agent for semantic review; and
4. optionally ask another model through LiteLLM.

The important design choice is that the semantic reviewer receives both versions and is asked to look in two directions: stylistic defects left behind and damage introduced by the rewrite. The skill explicitly names invented facts, invented causal links, strengthened claims, and dropped caveats as blocking failures. This recognizes that style conformance and meaning preservation are different verdicts. A rewrite can score 100 on phrase and rhythm rules while still being less truthful than its input.

The deterministic portion is substantive rather than a README-only claim. At the pinned revision, the repository includes a sanitizer, a rule-driven linter, fixtures, masking for code and quotations, suppression syntax, and tests for deterministic scoring. The three documented offline test commands passed locally. The LiteLLM-dependent grader tests were skipped because LiteLLM was not installed, so this run does not validate a live cross-provider review.

## Boundary: four described gates are not one enforced pipeline

The repository does not ship a coordinator that executes all four gates, records their outcomes, and blocks delivery when one is missing. `SKILL.md` tells the host agent to run the scripts, spawn a fresh subagent, retry, and report a score. The executable scripts enforce sanitation and linting, and `grade.py` can invoke an optional model panel, but the default fresh-reader step and the end-to-end retry/admission sequence remain procedural instructions.

That distinction matters when evaluating agent skills:

- **A check exists:** code can produce a verdict.
- **A workflow describes the check:** instructions tell an agent when to invoke it.
- **A delivery boundary enforces the check:** the final artifact cannot be admitted without a recorded passing verdict from every required gate.

`anti-ai-slop` demonstrates the first two levels and a useful reviewer-isolation pattern. It does not by itself prove the third. A harness integrating this skill should execute each required gate outside the editing agent's discretion, retain the original/rewrite pair and verdicts, and distinguish “not run” from “passed.”

## Why this is useful

Earlier anti-slop tools in the library mostly establish demand for style cleanup or controlled language. This project adds a sharper quality model: deterministic checks are good at syntax-like properties, while semantic fidelity needs comparison against the source by a context-isolated reviewer. The reusable principle extends beyond prose editing: when transformation quality has both mechanical and semantic dimensions, keep their verdicts separate and make coverage explicit.

## Evidence limits

- The HN item had 1 point and no comments when checked, so it is a project signal, not evidence of community adoption.
- The repository was created on 2026-09-14 and the inspected revision was its single initial commit; durability and real-world effectiveness are unknown.
- Passing repository fixtures validates the implemented cases, not the completeness of its prose rules or the accuracy of model-based review.
