# Console and Telegram Information Experience — Evidence and Prototype

**Historical context:** [Human Control Surfaces](../../2a-design/human-control-surfaces.md). Retained rationale and evidence; this record does not define the current contract.

**Status:** Superseded review evidence. The accepted Task-focused interface and
current Tier-2 adapter designs now govern.
**Task:** `console-telegram-ux-evidence-design`
**Reviewed against:** `human-control-surfaces.md`, `may-console.md`, and `telegram-notifications.md`

## Decision summary

Keep one shared `Conversation may:primary` and all existing work, approval, trace, control, and delivery semantics. Improve only presentation: make work state, current action, dependency, result, and available next control visually distinct; use a compact terminal layout in Console and a short mobile layout in Telegram instead of rendering almost the same dense text on both surfaces.

The proposal is intentionally not a production patch. Activation remains pending human approval of the exact change in [Production boundary](#production-boundary).

## Method and limits

This review used a structured walkthrough of current renderer code, accepted design contracts, and existing automated journeys. It is a heuristic comparison, not a claim of moderated user research or measured task-completion time.

Representative journeys:

1. open a surface and understand whether work is active without creating work;
2. scan a mixed active/history list and open one item;
3. distinguish request, current progress, dependency, and terminal result;
4. continue a conversation from the other surface;
5. issue an explicit session control without changing bare-text routing;
6. read and answer an approval request without confusing delivery with approval state.

## Current baseline

### Current Console

The Console is quiet by default and correctly separates bare conversation from explicit controls. Its current work list compresses request, state, age, changed age, progress, and sometimes result into an unstructured block:

```text
Active work:
  1. Review the May design — Analyzing · 8m · changed 4m
     Codex is reviewing the implementation.
  2. Review AKS tasks — Queued · 15m
```

Detail is complete but label-heavy and gives every field nearly equal weight:

```text
Work 1:
  Request: Review the May design
  Status: Analyzing
  Progress: Codex is reviewing the implementation.
  Created: 2026-08-17 08:20:00 UTC
  Started: 2026-08-17 08:21:00 UTC
  Changed: 2026-08-17 08:25:00 UTC
  Waiting on: analysis:analysis-review
```

Current strengths:

- startup/reconnect is passive;
- normal mode hides transport and unrelated runtime noise;
- `/work`, `/work all`, and `/work N` preserve exact visible ordering and request identity;
- bare text never silently steers a watched session;
- exact session controls are named on every invocation.

Current friction:

- a list line has three competing scan targets (request, state, and two relative times);
- progress, dependency, and result do not have consistent visual roles between list and detail;
- the detail puts audit timestamps at the same hierarchy level as the current state;
- the fallback `No durable progress update yet.` is presented as progress even when there is simply no progress fact;
- the accepted Console design specifies a stable `may>` prompt while the current executable renders `you>`; this contract/implementation mismatch must be resolved explicitly and is outside an unreviewed presentation rollout.

### Current Telegram

Telegram currently renders almost the same work grammar as Console:

```text
Active work:
1. Review the May design — Analyzing · 8m · changed 4m
   Codex is reviewing the implementation.
2. Review AKS tasks — Queued · 15m
```

The work detail is a flat sequence of labels. Long results are placed directly after `Result:` and generic mirrored messages use a mechanical header such as `Console · You`.

Current strengths:

- ordinary text enters the shared Conversation;
- `/work` reads shared work and records exactly what the human saw only after delivery;
- provider replies retain the exact chat/topic/message target;
- persisted semantic result and provider delivery state remain separate;
- long sends split without dropping content, and uncertain multipart sends are not reported as delivered.

Current friction:

- terminal-oriented line density transfers poorly to a narrow mobile viewport;
- result and progress text can dominate the list, making state comparison harder;
- the list gives no concise hint for opening an item;
- source mirroring is traceable but reads like an event label rather than conversational context;
- Telegram presentation uses little channel-native hierarchy despite the accepted contract allowing it.

## Prioritized findings

| Priority | Finding | Evidence | Design response |
|---|---|---|---|
| P0 | Preserve semantics while changing layout | Accepted human-control contract: presentation must not own state; all 12 adapter behaviors remain mandatory | No new state, command, event, queue, selection, approval, or delivery lifecycle |
| P0 | Console prompt contract and executable disagree (`may>` vs `you>`) | `docs/2a-design/may-console.md`; `packages/terminal/bin/may-console.cjs` | Do not silently normalize it in this rollout; require a separate accepted-design decision or align implementation to the accepted prompt |
| P1 | Work lists are dense and have weak hierarchy | Both renderers combine request, state, ages, progress, and result with similar emphasis | Make state and request the first scan row; put current fact and changed age on a subordinate row; keep result out of active list unless terminal/history is requested |
| P1 | Details obscure “what is happening now” | Current details give progress, audit times, execution, and dependency equal weight | Group `Now`, `Waiting on`, `Result`, and `Timeline`; omit absent groups rather than inventing placeholder progress |
| P1 | Telegram looks like terminal output | `renderTelegramWorkList` closely matches Console grammar | Use shorter mobile blocks and a final `/work N` hint; retain plain-text fallback and stable ordering |
| P2 | Cross-surface source labels are mechanical | Telegram mirror is `${surface} · ${speaker}`; Console uses `speaker[channel]` | Use a short “From Console/Telegram” context header while retaining message identity and source metadata |
| P2 | Approval content lacks a shared presentation grammar | Control semantics are accepted, but channel layout is adapter-owned | Present the exact decision, consequence, proof reference, and allowed direct controls as distinct blocks; never infer approval from prose or delivery |

## Reviewable prototype

### Console — active work

```text
Active work (2)

1  ANALYZING  Review the May design
   Now: Codex is reviewing the implementation.        changed 4m ago

2  QUEUED     Review AKS tasks                         waiting 15m

Open details: /work 1    History: /work all
```

Rules:

- `state + request` is the primary row;
- the second row contains one durable current fact and the semantic-change age;
- queued age says `waiting`, not an unlabeled duration;
- active lists omit terminal result bodies; `/work all` may show a one-line result summary;
- hints are local presentation only and create no Conversation message until the human invokes a view.

### Console — work detail

```text
Work 1 · ANALYZING
Review the May design

Now
  Codex is reviewing the implementation.

Waiting on
  analysis:analysis-review

Timeline
  created  2026-08-17 08:20:00 UTC
  started  2026-08-17 08:21:00 UTC
  changed  2026-08-17 08:25:00 UTC
```

A terminal item replaces `Now`/`Waiting on` with a prominent `Result` block. `Execution` remains available as trace detail below the human-readable state. Missing progress produces no `Now` block; the renderer does not manufacture a progress statement.

### Telegram — active work

```text
Active work · 2

1. Review the May design
   Analyzing · changed 4m ago
   Now: Codex is reviewing the implementation.

2. Review AKS tasks
   Queued · waiting 15m

Open one: /work 1
```

This deliberately differs from the aligned terminal layout. It fits narrow screens, keeps one item per visual block, retains the exact ordinal-to-request mapping, and uses no Markdown-dependent meaning.

### Telegram — work detail

```text
Review the May design
ANALYZING

Now
Codex is reviewing the implementation.

Waiting on
analysis:analysis-review

Changed 2026-08-17 08:25 UTC
Created 2026-08-17 08:20 UTC
```

Telegram may add safe emphasis or native buttons later, but the plain text must remain complete and controls must retain exact typed targets.

### Cross-surface conversation

Current mechanical source label:

```text
Console · You
Please compare the two views.
```

Proposed Telegram presentation:

```text
From Console
You: Please compare the two views.
```

Proposed Console presentation:

```text
you[telegram]> Please compare the two views.
```

Console keeps the compact terminal convention; Telegram uses a conversational header. Both render the same stable Conversation message and append no mirror.

### Approval presentation

```text
Approval needed

Change
  Activate the reviewed Console and Telegram presentation update.

Effect
  Layout and wording only; Conversation, work, controls, trace, approval,
  and delivery semantics stay unchanged.

Proof
  Cross-adapter contract checks pass; comparison artifact reviewed.

Choose
  approve · reject · hold
```

The visible choices are presentation. Approval still requires the existing exact typed control/Condition identity; arbitrary ordinary text is interpreted by May and never defaulted to approval.

## Comparative usability evidence

The comparison is structural and reproducible from the mockups above:

| Journey question | Current | Prototype | Evidence-backed improvement |
|---|---|---|---|
| “What state is each item in?” | State is embedded between request and age | State begins the primary Console row or its own Telegram line | Consistent state landmark per item |
| “What is happening now?” | Progress is an unlabeled continuation line | Durable progress is explicitly introduced by `Now` | Separates request intent from current fact |
| “Why is it waiting?” | Dependency appears only among detail labels | `Waiting on` is a distinct group | Dependency is distinguishable from execution and audit data |
| “What changed most recently?” | Two unlabeled relative durations can compete | One labeled `changed … ago`; queue duration uses `waiting …` | Removes age/changed-age ambiguity |
| “How do I open this?” | Command knowledge is assumed | Each list ends with one concise view hint | Makes the next read-only action discoverable without adding work |
| “Is this a result or a delivery receipt?” | Result is labeled, but may be crowded into a list | Result has a terminal-only block; delivery remains absent | Reinforces semantic-result/delivery separation |
| “Where did this message come from?” | Mechanical adapter/speaker token | Channel-appropriate source header | Preserves provenance with more natural reading |

No semantic object is added. The prototype uses only fields already present in `AppWorkView` or Conversation message metadata, so the comparison does not depend on hidden state.

## Regression and safety proof

### Current focused run

A focused baseline run on 2026-08-18 covered Console, Telegram ingress, Telegram client delivery, and Telegram outbound ownership:

```text
bun test packages/terminal/src/may-console.test.ts \
  src/app/transport/telegram-input.test.ts \
  src/app/transport/telegram-client.test.ts \
  src/app/transport/telegram-outbound.test.ts --timeout 30000
```

Result: **41 passed, 1 failed**. The failing Console test was `queues early work commands until the initial Conversation view arrives`; expected queued-input feedback was absent in that run. This is baseline evidence, not caused or fixed by this proposal. The other focused checks passed, including exact Telegram reply identity, long-message preservation, uncertain multipart delivery handling, exact originating target, direct-reply admission, proactive-attention gating, and overlapping-turn isolation.

A follow-up cross-surface contract run added the App inbox host/runtime/store, event interface, and Telegram end-to-end suites:

```text
bun test packages/terminal/src/may-console.test.ts \
  src/app/app-inbox-host.test.ts \
  src/app/app-inbox-runtime.test.ts \
  src/app/app-inbox-store.test.ts \
  src/app/event-interface.test.ts \
  test/e2e/telegram-reply-e2e.test.ts --timeout 30000
```

Result: **106 passed, 0 failed, 508 expectations**. The previously failing early-input Console test passed on rerun, which makes the first failure a flakiness signal rather than a supported product regression; it still must remain green in implementation and pre-activation runs. The Telegram end-to-end work test asserts that `/work all` reads shared Conversation work, renders the result, and records the delivered command view with ordered `requestIds`.

### Required cross-adapter control-surface checks

Any implementation of this proposal must keep the accepted 12-check contract green:

| # | Required behavior | Existing proof area / required rollout assertion |
|---|---|---|
| 1 | ordinary text maps to `may:primary` | Console integration; Telegram E2E shared-conversation ingress |
| 2 | retry admits one human App request | event-interface/App inbox idempotency tests |
| 3 | opening/reconnecting creates no work | Console startup test; Telegram startup seed behavior |
| 4 | command/tool messages add context without work | Console `/work`; Telegram E2E `/work all` command record |
| 5 | transient presentation adds neither context nor work | App inbox/runtime Conversation tests |
| 6 | explicit session controls do not change bare-text routing | Console explicit-control test; Telegram command routing tests |
| 7 | persisted result is readable from another adapter without delivery state | shared Conversation resource and cross-surface mirror tests |
| 8 | failed/uncertain delivery does not change result content | Telegram client/outbound uncertainty tests |
| 9 | requested command views are visible to a later May turn | command-authored Conversation projection tests |
| 10 | restart reconstructs the same Conversation | App inbox store/host reconstruction tests |
| 11 | one adapter’s new message renders on the other without duplicate work/message | Console Conversation wake test and Telegram mirror E2E |
| 12 | feedback advances represented active work without another work item | App inbox host/runtime represented-work feedback tests |

Rollout proof must test both prototype renderers with the same fixture and assert semantic parity: identical request ordering and IDs, state, progress/result selection, dependency/executor identity, command metadata, and no added work. Byte-identical output is explicitly not required.

## Production boundary

### Exact proposed production change

If approved, change only these presentation functions and their focused tests:

1. `../may-agent/packages/terminal/bin/may-console.cjs`
   - `renderWorkList`
   - `renderWorkDetail`
   - cross-surface speaker formatting in `renderConversation`
2. `../may-agent/src/app/transport/telegram.ts`
   - `renderTelegramWorkList`
   - `renderTelegramWorkDetail`
   - `renderTelegramConversationMessage`
3. Update focused expectations in:
   - `../may-agent/packages/terminal/src/may-console.test.ts`
   - `../may-agent/test/e2e/telegram-reply-e2e.test.ts`
   - add or extend a shared semantic-parity fixture/test covering the 12 contract behaviors above.

Do **not** change Conversation identity, App admission, task/work projection, typed control events, approval interpretation, trace correlation, delivery state, provider retry policy, daemon subscriptions, or production configuration. Do not bundle the `may>`/`you>` contract mismatch into this presentation patch without a separate accepted-design decision.

### Approval and activation

Current disposition: **hold activation**. Human approval is required for the exact presentation change above. After approval, the accountable may-agent app owner must review the artifact and regression proof, use the supervisor-owned deployment path, and verify the intended live Console and Telegram behavior; a build, test pass, deploy receipt, or provider send alone is not terminal live proof.

If the flaky/failing Console baseline persists, semantic-parity evidence is missing, any of the 12 checks fails, or the prompt contract remains entangled with the patch, stop rollout and replan on this task lineage rather than weakening the proof bar or creating a parallel lifecycle.
