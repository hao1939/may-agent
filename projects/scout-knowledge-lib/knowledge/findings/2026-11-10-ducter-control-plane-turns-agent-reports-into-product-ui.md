<ai_context>
summary: "Ducter is an early self-hosted agent control plane that treats worker output as typed reports rendered by the product rather than free-form completion prose. Its pinned source adds deterministic guards for batching, secret redaction, decision cards, language continuity, prompt/tool budgets, and eval freshness; producer-authored partner evals report 55% to 94–97% gains, but Scout did not run the system or independently reproduce those scores."
triggers: ["Ducter", "typed agent reports", "agent control plane", "prompt budget tests", "tool budget tests", "partner eval", "human attention interface", "agent result UI"]
confidence: "medium"
discovered: "2026-11-10"
source: "https://github.com/wey-gu/ducter"
revision: "aa02855b083db4f560b302df00f17c4595bceb88"
</ai_context>

# Agent reports should be product data, not completion prose

**Date:** 2026-11-10  
**Disposition:** New knowledge  
**Repo:** https://github.com/wey-gu/ducter  
**Inspected revision:** [`aa02855b083db4f560b302df00f17c4595bceb88`](https://github.com/wey-gu/ducter/commit/aa02855b083db4f560b302df00f17c4595bceb88)  
**Discovery query:** GitHub Repository Search API `agentic created:>=2026-11-09`, sorted by stars; `total_count: 9544`, `incomplete_results: false`.

## What Scout inspected

Scout read the pinned README, complete recursive repository tree (1,532 entries; not truncated), design principles, context design, privacy-and-safety documentation, prompt- and tool-budget tests, and the producer-authored partner-evaluation report. The repository is a self-hosted personal-agent control plane that delegates tasks to Claude Code, Codex, pi, or DeepSeek Harness while presenting one user-facing partner and task board.

## Source-grounded finding

Ducter's most reusable design choice is to make a worker's **typed report** the input to the user interface rather than asking the model to narrate every completion detail. The report carries state, summary, questions, evidence, and a transcript pointer. The client renders evidence, external effects, decisions, and merge actions in dedicated rows or controls; partner prose is intentionally limited to the user-facing outcome. Its evaluation report says the earlier persona repeated branch names, commits, evidence, buttons, and decision defaults in prose even though the UI already represented those facts.

The repository then moves several behaviors out of prompting and into deterministic code:

- report-only turns inherit the user's language;
- nearby task completions are settled into one turn;
- secrets are redacted before briefs and task messages;
- short prose after an ask is dropped, and needs-input turns stay quiet;
- defaults are removed from question prose and remain in the decision object;
- task result plumbing is stripped from combined human-facing summaries;
- merges remain a separate human action, and coding tasks use separate worktrees and branches.

This supports a broader control-plane rule: **represent operational facts once, in typed state, and render them for each audience.** Asking an LLM to restate state already known to the product increases inconsistency, verbosity, accidental authority claims, and prompt burden.

## Budgets and evaluation are checked like compatibility contracts

The pinned tests place ceilings on system prompts, task reports, device/task listings, turn deltas, and each role's serialized tool list. They also compare the current persona and partner tool schema with the identity recorded by the latest checked-in eval result, failing when either has changed without a fresh evaluation. This makes prompt size, tool exposure, and evaluator freshness visible build properties rather than informal review concerns.

The producer-authored report evaluated the real partner/core path with fake task execution. It reports a 33-scenario baseline of **18/33 (55%)**, two final runs totaling **62/66 (94%)**, and a later 48-scenario round totaling **93/96 (97%)**. The report attributes the improvement to both a persona rewrite and code guards, and explicitly says prompting alone did not reliably hold silence, redaction, batching, or language behavior.

## Relevance

For May-like systems, the useful implication is not Ducter's particular UI. It is the separation between:

1. worker evidence and lifecycle state;
2. product-owned rendering and decision controls;
3. concise model-written explanation;
4. deterministic guards for properties that must hold every time;
5. eval identity bound to the prompt and tool surface actually shipped.

This complements the library's verification notes: evidence can be structurally sound yet still be communicated badly or acquire unintended authority when converted back into free-form prose. Typed evidence should remain typed through the human interface wherever possible.

## Limitations

All behavioral results are producer-authored. Scout did not install Ducter, run its tests or evals, launch any supported agent harness, inspect every report-to-UI path, test worktree isolation, or verify live external effects. The eval fakes task execution and uses one author's scenarios; its rubric changed during development, although the baseline was rerun under the final grader. The privacy document also states an important enforcement gap: Codex is described as technically confined from writing outside the task folder, while Claude Code is only instructed not to do so. The repository calls itself an early preview, so this finding records an inspectable control-plane pattern, not proof of production reliability or security.

## Primary sources

- [README](https://github.com/wey-gu/ducter/blob/aa02855b083db4f560b302df00f17c4595bceb88/README.md)
- [Design principles](https://github.com/wey-gu/ducter/blob/aa02855b083db4f560b302df00f17c4595bceb88/design/principles.md)
- [Partner behavior evaluation](https://github.com/wey-gu/ducter/blob/aa02855b083db4f560b302df00f17c4595bceb88/research/30-partner-eval.md)
- [Prompt-budget tests](https://github.com/wey-gu/ducter/blob/aa02855b083db4f560b302df00f17c4595bceb88/packages/partner/test/prompt-budget.test.ts)
- [Tool-budget and eval-freshness tests](https://github.com/wey-gu/ducter/blob/aa02855b083db4f560b302df00f17c4595bceb88/packages/partner/test/tool-budget.test.ts)
- [Privacy and safety boundaries](https://github.com/wey-gu/ducter/blob/aa02855b083db4f560b302df00f17c4595bceb88/docs/privacy-and-safety.md)
