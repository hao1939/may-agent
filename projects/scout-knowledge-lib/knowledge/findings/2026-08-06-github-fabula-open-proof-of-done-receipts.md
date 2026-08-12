---
title: "FABULA — Open Receipt Specs and Replay Directories Push Proof-of-Done Beyond Local Logs"
source: github
date: 2026-08-06
last_updated: 2026-08-06
type: finding
tags: [github, coding-agents, proof-of-done, receipts, replayability, verification, harness-engineering]
relevance: high
---

# FABULA

## Overview

- **Repo:** [sergezuber/FABULA-LLM-5](https://github.com/sergezuber/FABULA-LLM-5) (62★, created 2026-07-04, pushed 2026-08-06)
- **What:** A local-first coding-agent harness that tries to make completion an enforced runtime event, then publishes the resulting proof artifact as an open receipt spec plus replayable benchmark receipts.
- **Primary docs checked:** README, `docs/GREENPAPER.md`, `docs/spec/verified-autonomy-receipt-v0.2.md`, `docs/EVALS.md`, `docs/receipts/README.md`, `engine/packages/opencode/src/session/verify-gate.ts`, `plugin/fabula-rewind.ts`

## Core Signal

FABULA is a useful GitHub signal because it pushes the current **proof-of-done** pattern one layer further.

Earlier repos in this lane mostly answered: *how do I keep an agent from claiming done without evidence?*
FABULA is trying to answer the stricter question: *what is the portable artifact a third party should receive so they can replay the proof themselves?*

The repo's distinctive move is therefore not just "run verify before stop." It is the combination of:

1. **runtime enforcement** that re-enters the agent until verification happens,
2. **honest terminal states** (`VERIFIED` or `NOT DONE`) as the repo's explicit contract,
3. **receipt standardization** in an open JSON/Markdown spec, and
4. **public replay directories** that ship the exact patch, receipt, and one-command verifier needed for independent re-checking.

That matters because it shifts agent accountability from local transcript inspection toward a more supply-chain-like artifact model: the unit to trust is not the run narrative, but the replayable proof bundle.

## Concrete Design Details

1. **Verification is enforced in code, not merely requested in prompts.**  
   `engine/packages/opencode/src/session/verify-gate.ts` defines the "done-gate problem" explicitly: if the model edits source and tries to stop without a green verify, the engine should force re-entry. The file tracks edit events and green verification events from the last real user boundary forward, so an edited-but-unverified turn is structurally classified as unfinished.

2. **The repo defines an open receipt format with explicit honesty rules.**  
   `docs/spec/verified-autonomy-receipt-v0.2.md` specifies top-level fields for model identity, task, base commit, gates, artifact patch, verification command/output, replay instructions, and provenance. The important design choice is the honesty policy: if a diff is truncated, the receipt must say the run is not independently replayable rather than pretending a full proof exists.

3. **Context provenance is treated as part of the proof surface.**  
   The receipt spec is unusually explicit that a replayable proof should identify not only the patch and check, but also the context fingerprint that produced the work: prompt prefix, tool schema set, serving-model descriptor, and related provenance fields. That is a stronger accountability claim than most current agent receipts, which stop at logs or test output.

4. **The repo publishes self-contained benchmark receipts, not just benchmark claims.**  
   `docs/receipts/README.md` and `docs/receipts/swe-bench-pro-e64622cd/receipt.md` package a concrete SWE-bench Pro run as receipt files plus the model patch and a `replay.sh` flow that checks the recorded base commit, applies the patch, runs the benchmark acceptance tests, and returns `VERIFIED` or `NOT DONE`. This is a notable operational step: the benchmark result is distributed as a re-runnable artifact set, not just as a percentage in a README.

5. **Failure recovery is harness-owned and checkpoint-based.**  
   `plugin/fabula-rewind.ts` says repeated red verifies trigger an automatic rewind to the last green snapshot using a shadow-git store that leaves the user's real `.git` untouched. The plugin's own comment is the signal: repeated failure is treated as a deterministic control problem the harness must solve, not as a behavioral reminder the model may or may not follow.

6. **The repo frames stopping authority as independent from the model's self-assessment.**  
   The README and `docs/GREENPAPER.md` both say that ending a run should not be the model's decision; a stop judge should read the real tool transcript and refuse premature completion. Even where this is still presented partly as protocol language, it is a strong design signal about where completion authority is moving in open agent systems.

## Why This Matters

1. **Proof-of-done is maturing from a local guardrail into a publishable artifact layer.**  
   FABULA suggests the next step after "force verify" is "mint a third-party-replayable receipt bundle." That is closer to software provenance and attestation than to conventional agent logging.

2. **Replayability is becoming the real trust boundary.**  
   The repo explicitly prefers "replay the artifact" over "trust the run." That is important because model runs are nondeterministic, but patches plus checks are often re-runnable.

3. **Agent accountability is absorbing context provenance.**  
   By making prompt/tool/model provenance part of the receipt schema, FABULA treats the generation context itself as something an auditor may need to identify, compare, or dispute later.

4. **Harnesses are increasingly designed around honest failure states.**  
   The `VERIFIED` / `NOT DONE` framing and the rewind-on-red behavior both point to the same broader shift: mature agent repos are starting to compete on how cleanly they refuse false completion, not only on how impressively they claim autonomy.

## Connections to Library Themes

- **Proof-of-done wave:** FABULA extends the earlier GitHub proof-of-done pattern from evidence receipts toward open receipt schemas and replay bundles.
- **Verification over narration:** trust is relocated from the model's summary to the patch, verification command, and replay path.
- **Harness-first reliability:** verify gates, rewind checkpoints, and stop-judge logic do more of the reliability work than the base model.
- **Accountability infrastructure:** the repo treats completion proof as something that should survive handoff to another operator, machine, or audit context.

## Sources

- **Repo:** https://github.com/sergezuber/FABULA-LLM-5
- **GitHub API metadata:** https://api.github.com/repos/sergezuber/FABULA-LLM-5
- **README:** https://raw.githubusercontent.com/sergezuber/FABULA-LLM-5/main/README.md
- **Greenpaper:** https://raw.githubusercontent.com/sergezuber/FABULA-LLM-5/main/docs/GREENPAPER.md
- **Receipt spec:** https://raw.githubusercontent.com/sergezuber/FABULA-LLM-5/main/docs/spec/verified-autonomy-receipt-v0.2.md
- **Architecture overview:** https://raw.githubusercontent.com/sergezuber/FABULA-LLM-5/main/docs/ARCHITECTURE.md
- **Evals:** https://raw.githubusercontent.com/sergezuber/FABULA-LLM-5/main/docs/EVALS.md
- **Public receipts README:** https://raw.githubusercontent.com/sergezuber/FABULA-LLM-5/main/docs/receipts/README.md
- **Published receipt example:** https://raw.githubusercontent.com/sergezuber/FABULA-LLM-5/main/docs/receipts/swe-bench-pro-e64622cd/receipt.md
- **Verify gate implementation:** https://raw.githubusercontent.com/sergezuber/FABULA-LLM-5/main/engine/packages/opencode/src/session/verify-gate.ts
- **Rewind plugin:** https://raw.githubusercontent.com/sergezuber/FABULA-LLM-5/main/plugin/fabula-rewind.ts
