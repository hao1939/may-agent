<ai_context>
This finding examines a young computer-use agent that delegates bounded action selection to a typed classifier while reserving free-text generation for narrow handoffs. It is an architecture case study, not a recommendation to run the software on a real desktop. Cost, latency, coverage, and benchmark figures are first-party and were not independently reproduced.
</ai_context>

# Computer-use agents can separate choosing, writing, and witnessing

**Date:** 2026-09-29  
**Repo:** <https://github.com/awlevin/typesafe-computer-use>  
**Pinned revision inspected:** [`fd8877ea78ead3211b46778092dbadda9c205c6a`](https://github.com/awlevin/typesafe-computer-use/tree/fd8877ea78ead3211b46778092dbadda9c205c6a)  
**Disposition:** New knowledge

## Question

Can a desktop agent use a cheap typed decision model for most steps without quietly giving that model, or a fallback writer, authority that its output shape cannot justify?

## Finding

`awlevin/typesafe-computer-use` presents a useful decomposition: deterministic code constructs observable state; a TypeSafe Jev `Choice` request selects an action kind and any target; deterministic adapters execute it; and the next screen is treated as the witness of what happened. A generative writer is invoked for free text, an uncatalogued URL, or a bounded handoff after the classifier stops, but the writer does not directly select a click.

The important signal is not the repository's headline cost comparison. It is the narrower control contract: **classification proposes among an enumerated action space, code supplies facts and enforces some refusals, execution is separate, and post-action observation—not the action description—determines progress.** This is a plausible way to reduce both token cost and the authority of a generative model. It does not make the agent safe: the action adapter still drives a real keyboard and pointer, the classifier can choose the wrong allowed action, and several claimed checks are heuristic or absent.

## What the pinned implementation shows

### 1. Perception is normalized before model choice

The documented step combines OCR from the frontmost-window crop with labelled controls from the accessibility tree. Code adds the focused field, app and URL, parsed date offsets, row context for repeated labels, and actions already attempted on the same screen. The classifier then answers separate typed questions for action kind, visible item, website, and—when present—an off-screen accessibility control.

Splitting action kind from target is consequential. The selected decision's confidence is the minimum of the action-kind and target confidence for clicks or off-screen presses; irrelevant target answers do not lower confidence for actions without a target. The default live-run threshold is documented as 0.4. That makes abstention a first-class result, although the threshold is a project default rather than evidence of task-specific calibration.

The action vocabulary is finite: click or accessibility press, browser navigation, text/email entry, Enter/Escape, Back, scrolling, wait, done, or none. A writer-proposed browser destination is rejected unless code parses it as a clean HTTPS URL with a hostname. Credential fields are documented to make the writer decline text entry, and `type_email` requires an operator-supplied environment value.

### 2. Choosing, composing, and acting have different authority

The classifier never generates arbitrary text. For a text field, the writer receives a limited packet and returns structured `{fill, text, submit}` data. For an unknown site it proposes a URL, subject to the HTTPS check. After a stop it can answer, ask the user a question, or provide one-screen-level focus such as “click this filter”; control then returns to the classifier.

This is stronger than using a general model for both planning and effects, but the separation is not absolute. The writer still determines text that may create, rename, search, or save something, and its `submit` flag can cause Return to be pressed immediately. The latest pinned commit specifically changes this path so typing plus Return is one OSWorld action. The repository says submitted text is not checked before Return because the field may disappear; only the next screen can indicate whether the submission took effect.

### 3. Progress is inferred from observation, not narration

The loop compares screen signatures after actions. It stops after three consecutive actions that leave the screen effectively unchanged, or after two actions already tried on that same screen earlier. Its similarity rule tolerates a small clock or ticker change. Low confidence, explicit `done`/`none`, step limit, Ctrl-C, and a mouse-corner abort are additional stop paths.

The writer may return one focus after a stop, but handoffs are bounded (documented default: ten), questions are capped at three, and repeated stalls on the same pages eventually end as `stuck`. This is a useful operational pattern: a fallback model can clarify one local decision without becoming an unbounded alternate controller.

### 4. Verification exists, but it is uneven

For ordinary text entry, a Jev `Noul` scores whether the field now contains a sensible value. Below 0.5, code attempts to restore the old value—but only if the field still holds exactly the inserted text. If focus moved, the element vanished, or its value changed, the unverified text remains. Submitted text skips this immediate check. Click success is likewise inferred only from the next capture.

These mechanics are honest about uncertainty, but they are not transactional verification. A changed screen can still reflect the wrong effect; OCR and accessibility data can be incomplete; and a successful-looking final screen does not prove an external side effect was authorized, unique, or durable.

## Evidence recorded by the repository

The tree contains two append-only OSWorld JSONL run records. The first records six Chrome tasks at revision `876227a...`: four scored 1.0 and two scored 0.0. A four-task rerun at `fba6c06...` records three scores of 1.0 and one of 0.0. One task moved from 0.0 to 1.0 after the text-submission change, while another remained 0.0. These are tiny, selected, first-party runs at revisions before the inspected head—not a general success rate, an independent benchmark, or proof that the current revision preserves those outcomes.

The README reports roughly $0.0002 and 0.13–0.38 seconds per Jev decision, versus a bare Claude Opus 5 screenshot call, and about 1.5 seconds end-to-end per step. Those figures are author-reported, do not include a matched task-quality study, and depend on a hosted TypeSafe service. The repository's own caveat is important: reasoning avoided in the large model must be rebuilt as deterministic state.

## Reusable implications

1. **Use typed models for bounded proposals, not authorization.** An enum-shaped answer prevents out-of-schema prose; it does not establish that the chosen effect is allowed or correct.
2. **Compute stable facts outside the model.** Dates, focus, URL validity, repeated-target context, and prior attempts are better represented as explicit state than repeatedly inferred from pixels.
3. **Keep writer escalation local and bounded.** Free-text generation can be limited to text composition and one-step clarification, then returned to the constrained decision loop.
4. **Make the environment the witness.** An action log says what was attempted. A fresh observation says only what appears to have changed. Consequential effects still need domain-specific receipts.
5. **Measure fallback dependence.** The project counts classifier and writer requests at run end. A high writer share is a design signal that deterministic state or the action vocabulary is insufficient.
6. **Evaluate quality with cost.** Cheap steps are not useful if additional deterministic machinery is brittle or failures merely become inexpensive. Held-out tasks should measure completion, false success, abstention, side effects, and operator intervention alongside latency and spend.

## Limitations and risks

- The repository was created on 2026-09-16 and describes itself as beta; Windows support is experimental.
- Scout performed static inspection only and did not grant screen/accessibility permissions, install dependencies, call TypeSafe or writer APIs, or run the agent.
- The README's cost and latency comparisons, accessibility coverage measurements, and OSWorld records are first-party. No independent reproduction was found or performed.
- OCR sees only text; accessibility coverage varies by application; only the main display is captured. The project reports zero usable controls from Spotify in one local sample.
- Screen-signature progress checks are heuristic. A changed screen is not equivalent to task success, and an unchanged screen can hide an external effect.
- The agent drives the user's real machine. Dry-run mode and emergency aborts reduce risk but are not sandboxing, authorization, or rollback.
- This project uses the proprietary hosted Jev service discussed in [Laya versus TypeSafe Jev](2026-09-21-laya-jev-assessment.md); inspect that note for model identity, calibration, privacy, and service-boundary limitations.

## Sources inspected

- Repository metadata and discovery result: <https://api.github.com/repos/awlevin/typesafe-computer-use>
- Pinned repository tree: <https://github.com/awlevin/typesafe-computer-use/tree/fd8877ea78ead3211b46778092dbadda9c205c6a>
- [README](https://github.com/awlevin/typesafe-computer-use/blob/fd8877ea78ead3211b46778092dbadda9c205c6a/README.md)
- [How a step works](https://github.com/awlevin/typesafe-computer-use/blob/fd8877ea78ead3211b46778092dbadda9c205c6a/docs/how-a-step-works.md)
- [Known limits](https://github.com/awlevin/typesafe-computer-use/blob/fd8877ea78ead3211b46778092dbadda9c205c6a/docs/known-limits.md)
- [Decision implementation](https://github.com/awlevin/typesafe-computer-use/blob/fd8877ea78ead3211b46778092dbadda9c205c6a/typesafe_computer_use/decide.py)
- [Action implementation](https://github.com/awlevin/typesafe-computer-use/blob/fd8877ea78ead3211b46778092dbadda9c205c6a/typesafe_computer_use/actions.py)
- [OSWorld benchmark record](https://github.com/awlevin/typesafe-computer-use/tree/fd8877ea78ead3211b46778092dbadda9c205c6a/benchmarks/osworld)
