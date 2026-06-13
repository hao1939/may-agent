# Layer-4 Stress Test — Tracing Tasks Through Old vs New AGENTS.md

For each test task, I trace what master *would* do under each prompt. The new
AGENTS.md must (a) fix the original failure, (b) not break already-working cases,
and (c) handle edge cases the design hasn't seen.

## Setup
- Old AGENTS.md = `agents/master/AGENTS.md` (56 lines, the failing one)
- New AGENTS.md = `/tmp/AGENTS-new.md` (schema-organized, has worked example)

---

## Task 1 — the original failure (must fix)
**User:** *"let's setup the aks-rp-e2e project together"*

### Trace under OLD AGENTS.md
- "Senior engineer who orchestrates CLI" → engineer frame.
- "Read ALL related files first" → runs cc to find/cat package.json.
- "project" has no anchor; defaults to code-package interpretation.
- **Predicted call 1**: `cc_worker(prompt: "find . -maxdepth 3...")` ← shell, no user task forwarded.
- This is exactly what happened. ❌

### Trace under NEW AGENTS.md
- `[WHEN A USER GIVES YOU A TASK]` step 1: identify ambiguous noun → "project" is on the list.
- Step 1 demands: "pin the doc that defines it" → `docs/projects.md`.
- Step 2: `user_task` is verbatim.
- The WORKED EXAMPLE is *literally this task*. Master almost has to follow it.
- **Predicted call 1**: cc_worker with USER TASK = verbatim user msg, CONTEXT including `docs/projects.md`, ASK = investigate + 3-5 question plan.
- ✅ Fixed.

**Verdict: ✅ fixes the original.**

But — I baked the answer into the worked example. That's *training on the test set*. Need fresh tasks.

---

## Task 2 — different may-agent concept noun
**User:** *"the heartbeat is getting too noisy, can we trim it?"*

### Trace under NEW AGENTS.md
- Ambiguous noun: "heartbeat" — on the list.
- Step 1: pin `docs/heartbeat.md`.
- Step 2: `user_task` = "the heartbeat is getting too noisy, can we trim it?"
- Step 3: state frame → "I'm reading this as the may-agent heartbeat mechanism, not git history."
- Predicted call: cc_worker with pinned `docs/heartbeat.md`, ASK = investigate, deliverable = "list of noisy heartbeat sources + 2-3 trim options".
- ✅ Forces correct frame.

### Failure mode to probe
What if the user means *"my smartwatch app's heartbeat module is noisy"*? Then "heartbeat" should NOT pin `docs/heartbeat.md`. The schema says "When a user mentions … they mean may-agent's" — that's an *assumption*. Step 3 (state frame back) is the safety net: master writes "I'm reading this as may-agent's heartbeat. Correct me if you meant something else." Good — graceful, recoverable.

**Verdict: ✅ correct frame, with recovery path.**

---

## Task 3 — no ambiguous noun, plain coding task (must NOT break)
**User:** *"fix the typescript error in agents/master/tools/devbox.ts"*

### Trace under NEW AGENTS.md
- Step 1: no may-agent concept noun → no doc-pin trigger.
- Step 2: `user_task` = verbatim.
- Predicted call: cc_worker with USER TASK + CONTEXT (pin = the .ts file + tsconfig + any test), ASK = implement, deliverable = "patch + `bun run tsc` exits 0".
- ✅ Same shape, just no doc pinning.

### Failure mode to probe
Does the envelope add overhead on truly simple tasks? Maybe. For a 1-line typo fix, the 4-block prompt is heavier than `cc_worker({prompt: "fix typo X in file Y"})`. Token cost +200 bytes per call. Not a behavior failure, but a possible regression on cheap tasks.

**Verdict: ✅ works, with mild ceremony tax on trivial tasks.**

---

## Task 4 — heartbeat invocation (no user message at all)
**Context:** master spawned by may handler with task `"heartbeat: review your projects"`.

### Trace under NEW AGENTS.md
- Step 2: `user_task` = ???  There is no human user — the "user" is the system/handler.
- Either: master treats `task` as user_task (works, but "verbatim" implies a literal human utterance), OR
- Master leaves `user_task` empty and the validation gate rejects it.

**This is a gap in the design.** The schema implicitly assumes a human user. Need to extend: `user_task` is the *originating instruction*, whether from a human or a handler. Or split into `originator_task` and `originator_kind: human | handler | parent_agent`.

**Verdict: ⚠️ ambiguity — need to clarify what `user_task` means when origin isn't a human.**

---

## Task 5 — chained user correction mid-session (this turn)
**Context:** master previously made wrong-framed call. User says: *"see the doc about project"*.

### Trace under NEW AGENTS.md
- `user_task` for this turn = "see the doc about project" — but this is a *correction*, not a fresh task. Forwarding verbatim might confuse cc ("see what doc?").
- Need either: master concatenates ("Original task: X. User correction: Y") into user_task, OR
- The envelope has a separate `correction` or `latest_user_msg` field.
- The schema doesn't specify. Master will improvise.

**Verdict: ⚠️ second gap — multi-turn user inputs need explicit handling.**

---

## Task 6 — destructive request (the AGENTS.md "judgment" case)
**User:** *"clean up the .state directory, it's huge"*

### Trace under NEW AGENTS.md
- Ambiguous noun: "state directory" — could mean app state (`.state/`, dangerous) or generic disposable files.
- The old AGENTS.md had explicit guidance: *"Destructive requests: Classify items as critical vs disposable. Only delete disposable."*
- **I dropped that guidance in the new AGENTS.md.** ❌
- Master will likely delegate to cc with "clean up" — cc might wipe `.state/sessions/`, destroying audit logs.

**Verdict: ❌ regression — I removed the safety rules to make room for the schema.**

---

## Task 7 — tight task, cc as bash genuinely feels right
**User:** *"what's in /tmp/foo.log right now? Just dump it."*

### Trace under NEW AGENTS.md
- The hard rule says: "Never send a bare shell command as prompt".
- But this user *literally asked for a bash dump*. The envelope is overkill.
- Master must still write USER TASK + CONTEXT + ASK + RETURN FORMAT for a `cat`.
- Predicted: master complies but the prompt is 5× the data.

**Verdict: ⚠️ third gap — no escape hatch for legitimately-trivial reads. Token waste; not a behavior failure.**

---

## Aggregate verdict (7 tasks)

| Task | Old | New | Notes |
|------|-----|-----|-------|
| 1. aks-rp-e2e project | ❌ | ✅ | The original failure, now fixed (but test data = training data) |
| 2. trim noisy heartbeat | ❌ likely | ✅ | Schema generalizes to other concept nouns |
| 3. fix tsc error | ✅ | ✅ | No regression |
| 4. handler-launched heartbeat | n/a | ⚠️ | `user_task` ambiguous when origin isn't a human |
| 5. mid-session correction | ⚠️ | ⚠️ | Multi-turn semantics underspecified |
| 6. destructive cleanup | ⚠️ | ❌ | I dropped the safety rules to make room — regression |
| 7. trivial dump | ✅ | ⚠️ | Envelope overhead on truly cheap tasks |

**3 hits, 3 partial, 1 regression.**

## What the stress test exposed (real issues)

1. **The schema overlooks non-human origins** (task 4). Heartbeat-launched master sessions have no "user". The envelope needs `originator_kind`.
2. **Multi-turn user inputs are unspecified** (task 5). After the first turn, what becomes `user_task`?
3. **No escape hatch for trivial work** (task 7). The 4-block envelope is wrong shape for "read this small file."
4. **I regressed the safety rules** (task 6). The old AGENTS.md had explicit destructive-request handling; my rewrite dropped it.
5. **Test-set contamination on task 1** — the worked example *is* the test. Can't claim verification from this trace alone; would need a held-out task with a different may-agent noun (task 2 partially does this, but I wrote both, so still biased).

## Honest grade

Layer 4 is **directionally right** but **not ready to ship**. The schema fixes the dominant failure (3 of 7 tasks), is neutral on 1, and *regresses* 1 due to my own carelessness. The two ambiguity gaps (handler origin, multi-turn) are real and need a spec'd answer before this lands.

Next-step priority list:
1. Re-add destructive-request rules — non-negotiable.
2. Spec `originator_kind` (human / handler / parent_agent) and what `user_task` means in each case.
3. Define multi-turn behavior — probably "user_task = latest user msg, prior turns summarized in CONTEXT.prior_attempts".
4. Add an escape hatch for trivial tasks — maybe `ask.kind: "quick_read"` with a relaxed envelope.
5. Get a held-out test (someone gives master a task I haven't seen) before declaring victory.
