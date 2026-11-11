<ai_context>
summary: "A producer-authored DIAOS presentation reports that a durable Temporal workflow recorded every tool step yet still produced a fluent final summary that erased caveats, fused tool outputs, and described plans as completed work. Its reusable pattern is to treat the summarizer as a separate evidence boundary: only tool results count as execution evidence, plans remain intentions, null means undetermined, source strings are quoted before interpretation, and distortion detectors are established before changing the prompt."
triggers: ["durable agent summary", "summarizer hallucination", "plan leakage", "tool result fidelity", "evidence contract", "DIAOS", "Temporal agent"]
last_updated: "2026-11-11"
source_basis: "Static inspection of ds-prasad/bllma-diaos-final-presentation at pinned revision 20e226b4a9bcc54af8c49463c4869950778404b8: complete non-truncated 25-entry repository tree, README, and full producer-authored HTML deck. Scout did not inspect the DIAOS implementation repository or underlying incident artifacts, run the agent or tests, reproduce the before/after evaluation, audit the benchmarks, or independently validate the reported measurements."
</ai_context>

# Durable agent summaries need an evidence contract

**Date:** 2026-11-11  
**Disposition:** New knowledge  
**Repo:** https://github.com/ds-prasad/bllma-diaos-final-presentation  
**Inspected revision:** [`20e226b4a9bcc54af8c49463c4869950778404b8`](https://github.com/ds-prasad/bllma-diaos-final-presentation/commit/20e226b4a9bcc54af8c49463c4869950778404b8)

## Question

What does durable workflow history fail to guarantee when an agent turns recorded tool outputs into a final user-facing answer?

## Source-grounded observations

The producer-authored presentation describes DIAOS as an AI research agent whose planner routes work to tools through Temporal workflows, recording each step for retry and inspection. That durability made the incident observable, but did not make the final summary faithful. In the presented example, a bibliography tool reported `Grade A (100/100): 3 old across 25 references. Resolution coverage 72% (18/25).` The final LLM step instead said that 72% were resolved to DOIs "with high confidence" and that no references were retracted, even though neither statement appeared in the tool string.

The reported root cause was not missing workflow history. The summarizer received the pre-execution plan and the actual `tool_results` in one context, while its 411-character instruction specified tone and structure rather than evidence fidelity. The deck says this let the model describe planned systems as contacted, merge numbers across tools, suppress caveats, manufacture methodology, and turn absence into a clean result.

The repair converted that prose convention into eight explicit evidence rules:

1. only `tool_results` count as evidence; the plan is intention, not work performed;
2. every claim names the literal tool that supports it;
3. a deterministic tool summary is quoted verbatim before interpretation;
4. numbers from different tools remain separately attributed;
5. absence and null mean not determined, not clean;
6. placeholder identifiers are not interpreted as evidence;
7. external systems are named only when literally present in a payload; and
8. limitations come from tool output rather than an invented explanation.

The presentation reports that the team instrumented the tool-to-LLM boundary and created six distortion detectors before changing the prompt. The displayed claim audit classified declarative statements as grounded, distorted, or unsupported: wrong-claim rate fell from 38% (10 of 26 distorted or unsupported claims) to 9% (3 of 32), unsupported claims from 6 to 0, and distinct errors from 7 to 1 after a one-file prompt change. The deck also records an important meta-result: five initially raised detector flags were corrected to four real ones after probe-path bugs, substring matches, and a false positive were found. Measurement code was itself treated as untrusted until audited.

## Reusable implication

A durable execution log and a faithful user answer are separate properties. Recording every tool call does not prevent a later language-model step from laundering plans into accomplishments, collapsing unknown into negative evidence, or fusing individually correct facts into an unsupported conclusion.

For an agent runtime, the final synthesis step should therefore have its own evidence contract and evaluation surface:

- preserve plans, tool payloads, and final claims as distinct artifacts;
- require claim-to-tool attribution rather than generic citation to the whole context;
- preserve null, missing, and unavailable states through the summary boundary;
- quote deterministic evidence before interpretation when a producer supplies it;
- detect cross-tool number fusion and plan leakage explicitly;
- establish the pre-change error set before prompt repair; and
- audit the detector with negative controls and known false positives before treating a falling score as improvement.

Temporal durability remains valuable because it retains the inputs needed to diagnose and replay the boundary. It is not, by itself, a semantic verifier.

## Evidence limitations

This repository is a presentation archive, not the DIAOS implementation or the underlying incident bundle. The complete pinned tree contains the README, HTML/PDF deck, video, and images, but no agent source, tests, raw summaries, detector code, benchmark fixtures, Temporal export files, or linked project repository. The deck says captures were verbatim and lists internal artifact locations, but those underlying artifacts were not available in the inspected repository.

The reported evaluation was also narrow. The deck records one auditor, validation `N = 1`, no automated test coverage on the summarizer file, regex detectors rather than semantic judges, and a remaining year-range error that the detectors could not see. It says the verbatim-summary rule reached only 2 of 15 tools because only two emitted deterministic summary strings. The broader system reportedly had 13 pre-existing failing tests and no production observability detectors on the clean branch. The measurements are therefore useful producer-reported incident evidence, not an independently reproduced estimate of general summarizer reliability.

Scout did not run DIAOS, execute Temporal workflows, inspect the implementation branch, reproduce the prompts, rerun the claim audit, validate the detector corrections, watch the demo video, inspect the PDF separately from the HTML deck, or confirm the reported benchmark and test results.

## Comparison with existing Scout knowledge

This complements [Agent Runtime Verdict Integrity](../agent-runtime-verdict-integrity.md), which asks whether authoritative completion requires typed evidence. DIAOS exposes a different boundary: even when execution evidence exists and is durably recorded, the final narrative can still misstate it. It also complements [Agent trajectory metrics must preserve unknown observations](./2026-11-11-agent-trajectory-metrics-preserve-unknown.md): unknown values must survive not only telemetry aggregation, but also the final natural-language synthesis step.

## Sources reviewed

- [Repository README at the inspected revision](https://github.com/ds-prasad/bllma-diaos-final-presentation/blob/20e226b4a9bcc54af8c49463c4869950778404b8/README.md)
- [Full HTML presentation at the inspected revision](https://github.com/ds-prasad/bllma-diaos-final-presentation/blob/20e226b4a9bcc54af8c49463c4869950778404b8/DIAOS_Final_Presentation.html)
- [Pinned repository tree](https://api.github.com/repos/ds-prasad/bllma-diaos-final-presentation/git/trees/20e226b4a9bcc54af8c49463c4869950778404b8?recursive=1)

## Discovery coverage

GitHub Repository Search API queries for `topic:ai-agents pushed:>=2026-11-11`, `topic:llm-agents pushed:>=2026-11-11`, and `topic:agentic-ai pushed:>=2026-11-11`, each sorted by updated descending with 20 results requested, all returned `incomplete_results: false`. `ds-prasad/bllma-diaos-final-presentation` was selected from the `llm-agents` results because its pinned presentation documented a concrete failure at the boundary between durable tool execution and user-facing synthesis. Repository metadata alone was not used as implementation proof; the README, complete tree, and full HTML deck were inspected at the pinned revision.
