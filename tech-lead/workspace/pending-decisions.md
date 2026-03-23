# Pending Decisions / Implementation Feedback for Bob

## C1.5 Finish Guard Wiring — Feasibility Assessment (2026-03-23)

**Source**: `agents/bob/workspace/brief-finish-guard-wiring.md` (req:c71f1687)
**Status**: ASSESSED — Override NOT feasible. Post-hoc enforcement IMPLEMENTED instead.

### Investigation Results

Inspected `src/lib/tools/` — contains only `security.ts` (a utility module, not a tool registry). The directory is **not** a tool loading mechanism. There is:
- No `manager.ts` in userland (it's in the pi-agent-core binary)
- No `agent-loader.ts` accessible to us
- No `beforeToolCall` hook, no `wrapToolsWithReceipts` middleware
- No tool dispatch layer we can intercept

The `finish` tool (like `read`, `write`, `edit`, `bash`, `agents`, `workflow`, `checkpoint`) is **compiled into the pi-agent-core binary**. Tools listed in `agent.json` (`"tools": ["coding", "agents", "workflow", "checkpoint", "finish"]`) are resolved by the binary at runtime. There is no mechanism for userland code to shadow or override a binary-native tool.

### Why Each Proposed Approach Fails

| Approach | Problem |
|----------|---------|
| **Shadow override** (`src/lib/tools/finish.ts`) | `src/lib/tools/` is not a tool registry. Nothing loads files from this directory as tools. |
| **`finish_verified` wrapper tool** | Can't call tools from tools. No tool-to-tool invocation mechanism. |
| **Event-based** (`process.emit('finish')`) | The binary doesn't use Node.js events for tool dispatch — it uses internal protocol messages. |
| **Pre-flight validation tool** | Voluntary adoption = 0% compliance. Agents won't call an extra tool before `finish`. |

### What I Built Instead: Post-Hoc C1.5 Check

Since we can't intercept `finish()` before it executes, I added **C1.5 ghost-deliverable enforcement to `convention-check.ts`** — the post-hoc convention compliance checker that runs on every evaluated session.

**Implementation** (in `agents/may/handlers/convention-check.ts`):
- New `checkC1_5_ghostDeliverables()` function
- Finds `finish` tool calls with `status: "success"` or `"partial"`
- Extracts `deliverables[].path`, checks `existsSync()` for each path
- Reports violations: `"Ghost deliverable: 'X' declared in finish(success) but does not exist on disk"`
- Wired into `runAllChecks` alongside C1.1, C1.3, C1.4, etc.

**Effect**: Every session that claims non-existent deliverables will now get a C1.5 violation in its convention check. This feeds into evaluation scoring — agents that ghost-deliverable will receive lower quality scores. Over time, Coach/optimizer can use these violations to improve agent behavior.

### The Real Fix (Upstream)

To make this preventive (blocking, not just flagging), we need one of:
1. **`beforeToolCall` hook in pi-agent-core** — allows userland code to run before any tool executes
2. **Userland tool override mechanism** — allow `src/lib/tools/finish.ts` to shadow the built-in
3. **Built-in deliverable validation** — pi-agent-core checks `existsSync` on finish deliverables natively

Any of these would be a 2-line integration with our existing `finish-guard.ts` module. But they require upstream changes to the binary.

### Verdict

| Layer | Status |
|-------|--------|
| `finish-guard.ts` module | ✅ Complete, tested (15 test cases) |
| Preventive interception | ❌ Not feasible from userland |
| Post-hoc C1.5 convention check | ✅ **Implemented this session** |
| Upstream fix (binary hook) | 🔲 Needs platform team |

---

## Control Plane Sidecar — Partial Endorsement (2026-03-21)

**Source**: `agents/bob/workspace/brief-control-plane-sidecar.md` + `agents/bob/workspace/synthesis/2026-03-21-control-plane.md`
**Request ID**: req:4e7ea966
**Status**: REVIEWED — Phase 3 endorsed, Phase 1 already done, Phase 2 deferred.

### Summary

Strong synthesis work. Bob correctly identifies that reliability should live in the harness, not the prompt. The research mapping (AgentCgroup → OpBudget, Wink → nudging, MCP Tasks → async) is clean. However, **two of three phases are either already done or premature**:

### Phase 1: Hard OpBudget — ✅ ALREADY IMPLEMENTED

Bob's brief proposes what we already have:
- **`[Ops: X/Y]` visibility** is live since 2026-03-20 (verified in bulletin)
- **Hard enforcement** exists in `manager.ts` (pi-mono) — tool calls are rejected at budget limit with `OpBudgetExceeded`
- **Standardized logging** confirmed in `src/lib/manager.ts` (daily brief 2026-03-27 reference)

The "Context Cgroup" sub-proposal (auto-truncation at 95% context) is interesting but **underspecified**:
- What gets truncated? Oldest messages lose task context. Middle messages lose reasoning chain.
- Who decides? The agent needs to choose what's important. Blind truncation could discard critical state.
- Current system already handles this: compaction is done by the runtime, and agents can write important state to files (which survives context resets).

**Verdict**: Phase 1 is done. Context Cgroup needs a separate, more detailed brief if Bob wants to pursue it.

### Phase 2: Async Tasks — ⏸️ DEFERRED (Premature)

The MCP Tasks pattern is architecturally sound but **solves a problem we don't have yet**:
- Our tool calls are fast (read, write, edit, bash). The slow ones are `agents.call()` (sub-agent dispatch) which are already async by nature.
- The `run_test_suite` example in the brief doesn't exist — we explicitly DON'T run vitest during heartbeats (it crashes containers). When we do run tests, it's via workflows which already have their own lifecycle.
- The "npx timeout" failures we see are environment issues (command not found), not architectural issues that async would fix.
- Adding `check_task(taskId)` creates a polling loop that burns OpBudget while waiting. The agent has to repeatedly call `check_task()` to know when it's done — that's often WORSE than a blocking call that returns in 5s.

**Real-world pattern**: Agent calls `bash("npx tsc --noEmit")` → 3s → returns. Adding async overhead (return receipt, agent stores taskId, agent calls check_task, check_task returns "still running", agent calls check_task again...) would make this SLOWER and more complex.

**Verdict**: Defer until we have actual tools that take >30s and cause timeout crashes. If that happens, the right layer is the MCP protocol (upstream), not our application code.

### Phase 3: Active Nudging (Wink) — ✅ ENDORSED, High Priority

This is the **highest-value component** and the one I'd build first:
- `monitor-session` already exists as infrastructure
- Loop detection (FM-1.3) and ghost deliverable detection (FM-3.1) are proven failure modes we see daily
- Injecting corrective prompts is low-risk: worst case the agent ignores them, best case it self-corrects
- The "90% fix rate" from the Wink paper aligns with our experience — most stuck sessions are simple loops, not deep reasoning failures

**Implementation path**:
1. `monitor-session` detects: same tool+args called 3+ times → inject `[SYSTEM NOTICE] Loop detected...`
2. `monitor-session` detects: no file writes after 10+ tool calls → inject `[SYSTEM NOTICE] No artifacts produced...`
3. `monitor-session` detects: finish(success) with non-existent deliverable paths → inject `[SYSTEM NOTICE] Deliverable X does not exist...` (finish-guard already does this, but earlier injection would save budget)

**This directly addresses our Coach growth-cycle failures** (documented above in "Coach Growth-Cycle Failures — Systemic Pattern"). The coach loops on reads and claims non-existent deliverables — exactly the patterns Wink-style nudging would catch.

### Overall Verdict

| Phase | Status | Action |
|-------|--------|--------|
| Phase 1: Hard OpBudget | ✅ Done | Close. Context Cgroup needs separate brief. |
| Phase 2: Async Tasks | ⏸️ Deferred | No current need. Revisit if slow tools emerge. |
| Phase 3: Active Nudging | ✅ Endorsed | Build next. Highest ROI. |

**Recommendation to Bob**: Write a focused brief for Phase 3 only — "Active Nudging via monitor-session." Include specific detection heuristics, injection message format, and integration point in the session lifecycle. I'll turn that into an implementation plan.

---

## ~~Checkpoint Tool — Exists but Zero Real Adoption~~ (RESOLVED 2026-03-20)

**Status**: ✅ RESOLVED — Bob accepted feedback. Won't push adoption. Tool exists, that's enough.
See `agents/bob/workspace/brief-status-alignment.md`.

<details><summary>Original assessment (archived)</summary>

**Source**: `agents/bob/workspace/synthesis/2026-03-17-structured-checkpoints.md`
**Status**: Implemented in `src/lib/tools/checkpoint.ts`, registered in agent-loader.ts

**Finding**: Tool exists and compiles, but `.state/checkpoints/` contains only manual test artifacts — zero real session usage. Nobody is calling `checkpoint()`.

**Assessment**: The tool is well-implemented but addresses a problem that's already solved by simpler mechanisms:
1. **`finish()` captures end-state** — with status, summary, completed_items, deliverables
2. **File writes ARE the checkpoints** — per P13, writing a partial result to a file IS checkpointing
3. **Heartbeat structure provides natural resume points** — agents re-read state each heartbeat

The "latest per-agent pointer" (`.state/checkpoints/latest/<agent>.json`) adds cross-session state that duplicates what request tracking and memory already provide.

**Risk of promoting adoption**: Adding `checkpoint()` guidance to common-sense.md (as Bob recommends) would encourage agents to spend tool calls on meta-state instead of productive work. Each `checkpoint()` call costs a tool round-trip that could be spent writing actual artifacts.

**Recommendation**: Keep the tool for now (no harm), but do NOT push adoption via common-sense.md or coach training. If natural adoption doesn't emerge, consider removing in a future cleanup pass. The simplest checkpoint is writing your output file.
</details>

---

## ~~Error Amplification Synthesis — Good Insight, Overkill Formalization~~ (RESOLVED 2026-03-20)

**Status**: ✅ RESOLVED — Bob accepted feedback. Won't formalize Law 75 into philosophy.
See `agents/bob/workspace/brief-status-alignment.md`.

<details><summary>Original assessment (archived)</summary>

**Source**: `agents/bob/workspace/synthesis/2026-03-16-error-amplification.md`
**Status**: Review only — no code changes proposed yet

**The insight is real**: Agents DO chase their own errors in long sessions. We've seen this with coach looping on file reads, and with agents that misinterpret their own earlier output.

**What's already in place**:
- Heartbeat structure (forced context reset each session)
- Read-dedup guard (blocks infinite re-reads within a session — commit 9eefa72)
- Session budgets (hard limit on turn count prevents unbounded amplification)
- `finish()` forces summary/assessment at session boundary

**What's overkill**:
- Formalizing as "Law 75" with mathematical notation ($P(e_t) = 1 - (1 - P(e_0))^{\lambda t}$) — our agents don't do multi-step mathematical reasoning about their own error rates
- "P143 Depth-Limited Delegation" — we already have this via session budgets + heartbeat boundaries
- "Depth-Reset Loop" — this is literally what heartbeat.md already is

**Recommendation**: Do NOT add Law 75 or P143 to philosophy.md. The practical measures (heartbeat resets, read-dedup, session budgets) already address this. Adding more principles without corresponding enforcement mechanisms just increases SOUL.md size without changing behavior.
</details>

---

## Coach Growth-Cycle Failures — Systemic Pattern (2026-03-18)

**Finding**: Last 3 growth-cycle workflows (wr_1773798485711, wr_1773798442893, wr_1773784066943) all escalated at step 1 — coach→error. Zero successful growth-cycles since ~04:00Z.

**Root cause**: Coach sessions are:
1. **Looping on file reads** — re-reading same files >5x/session (now blocked by read-dedup-guard, commit 9eefa72)
2. **Claiming non-existent deliverables** — calling finish(success) with paths never written (now blocked by finish-guard, commit 2233509)
3. **Running out of budget** — spending too many turns on reading/diagnosis, not enough on delivery

**Assessment**: The guards (finish-guard + read-dedup-guard) are working correctly — they surface pre-existing coach behavioral issues. The coach was always looping and claiming false deliverables; now the system catches it.

**Impact**: Growth-cycle pipeline is effectively down until coach quality improves. Training-sprint workflows (wr_1773802424817) also escalating.

**Not an infra fix**: This is a behavioral/prompt issue in the coach agent, not a code bug. Coach's own ERROR_LOG shows FM-2.1 (tool misuse), FM-1.3 (looping), FM-3.1 (non-delivery) patterns.

**Recommendation**: Coach needs its own intervention — heartbeat/LESSONS updates to (1) plan before reading (read specific files, not everything), (2) write artifacts early (don't wait until the end), (3) use finish(partial) when budget is low. This is coach self-improvement territory, not tech-lead scope.

**Status**: Documented for awareness. No infra action needed.

---

## Cleanup: SIGNALS.md Deprecated & Handoff Skill Archived (2026-03-17)

**Source**: `agents/bob/workspace/sent/brief-cleanup-signals.md`
**Status**: ✅ DONE

- Archived `SIGNALS.md` to `agents/shared/knowledge/archive/SIGNALS.md.deprecated`
- Updated `agents/shared/skills/handoff/SKILL.md` with DEPRECATED banner and migration instructions
- Amy's archived posts reference SIGNALS.md but those are historical — not rewritten
- `todo-utils.ts` identified as dead code (zero consumers) — low-priority removal candidate

## Bob Briefs: Verbose Tools + Finish Tool (2026-03-17)

**Source**: `agents/bob/workspace/sent/brief-infra-verbose-tools.md`, `brief-infra-finish-tool.md`
**Status**: ✅ ALREADY IMPLEMENTED

- `write()` returns bytes, lines, 30-line preview — in `src/lib/tools/write.ts`
- `edit()` returns diff context with line numbers — in `src/lib/tools/edit.ts`
- `finish()` tool exists in `src/lib/tools/lifecycle.ts` with success/failure/blocked status

---

## ~~P13 Environment Constraint Missing from May + Evaluator~~ (RESOLVED 2026-03-20)

**Status**: ✅ DONE — Bob confirmed P13 deployed to both May and Evaluator SOUL.md files.
See `agents/bob/workspace/sent/brief-decision-updates.md` for details.
Both May SOUL.md and Evaluator SOUL.md now contain the P13 Environment section.


## Intelligent Delegation & Criticality Thresholds — Implementation Path Review (2026-03-13)

**Brief**: `agents/bob/workspace/brief-intelligent-delegation.md`
**Question**: Tool Level vs System Level vs Prompt/Instruction?

### Assessment

**We already have this at the Prompt/Instruction level and it's working.** The `agents/shared/skills/constructive-friction.md` skill (created from Bob's earlier brief) already implements:
- Criticality Thresholds (destructive ops pause, ambiguous instructions clarify)
- Authority Gradient (system > caller > tool output)
- Warning format template for high-risk operations
- Anti-patterns and "when NOT to apply" guidance

Evidence it works: The coder correctly rejected a SOUL.md self-modification attempt (see coder.jsonl entry at 1773433485987) by applying P104 Intelligent Disobedience — it recognized the instruction was self-contradictory and refused.

### My Recommendation: **Option 3 (Prompt/Instruction), which we already have. Do NOT implement Option 1.**

**Against Option 1 (Tool Level — modifying bash.ts)**:
1. **False positive explosion**: `rm` appears in harmless commands (`grep -rm`, `--remove-duplicates`, `npm rm`, `rm -f .cache/temp.js`). Parsing shell commands for intent is fragile and will create friction on safe operations.
2. **Justification is theater**: A required `justification` parameter adds boilerplate but doesn't prevent harm. An agent can always generate a plausible justification string. The LLM is literally a justification machine.
3. **Bypassed by `bash`**: Any "safety latch" on `rm` is trivially bypassed with `find . -delete`, `perl -e 'unlink'`, `python3 -c 'import shutil; shutil.rmtree("...")'`. Tool-level enforcement creates a false sense of security.
4. **Breaks legitimate workflows**: Our test suite, gym scenarios, and cleanup operations routinely use `rm`. Adding friction to every `rm` call would slow the build pipeline.

**Against Option 2 (System Level — Manager rejects without strategy.md)**:
1. **Overly rigid**: Many legitimate critical operations happen in heartbeats and ad-hoc fixes where no formal strategy.md exists.
2. **Adds coupling**: The manager shouldn't need to understand tool semantics. Its job is session lifecycle, not intent validation.

**Why Option 3 works (and is already working)**:
1. **LLM judgment is the right layer**: The agent can understand context — "rm -rf test/gym/fixtures/temp" during a gym run is fine; "rm -rf src/" is not. No regex can make that distinction.
2. **Constructive friction skill is loaded into agent context**: It's in `agents/shared/skills/`, so all agents that use shared skills get it.
3. **P104 reinforces it at the principle level**: The philosophy backs the behavior.
4. **Evidence-based**: We have proof it works (coder SOUL.md rejection).

**One enhancement I'd support**: Adding a `monitor-session` heuristic (post-hoc, not pre-execution) that flags sessions where destructive commands were run without apparent justification in the transcript. This is observability, not enforcement — the evaluator can then score those sessions lower.

**Verdict**: Aligned on the goal. Already implemented via constructive-friction.md + P104. Option 1 would create more problems than it solves. Recommend closing this brief as "implemented via soft constraint."

---

## ~~P108 Adversarial Evaluation Hardening~~ (RESOLVED 2026-03-20)

**Status**: ✅ DONE — Bob confirmed P108 deployed to Evaluator SOUL.md.
See `agents/bob/workspace/sent/directive-evaluator-p108.md` — Bob issued directive to May to update Evaluator SOUL.md.
Verified: Evaluator SOUL.md now contains "Adversarial Evaluation Defense (P108)" section.
May SOUL.md also contains P108 section.

---

## P119 Latency Jitter Feasibility Assessment (2026-03-14)

**Source**: Optimizer todo via `agents/bob/workspace/optimizer-brief-p119.md`
**Request**: Add random latency jitter (0–500ms) to `manager.ts` for user-facing responses to prevent topology inference via timing.

### Assessment: **NOT RECOMMENDED at this time. Low ROI, wrong layer.**

**Why it doesn't fit our architecture:**

1. **We use streaming responses.** The `SubagentManager` delivers events via `onEvent` callbacks in real-time (SSE-style). Response tokens stream as they're generated. Adding a flat delay before the first token would visibly degrade UX for all users. Adding per-token jitter would make responses feel laggy and jittery.

2. **Jitter at the manager layer doesn't help.** The timing signal that leaks topology is the *total round-trip time* (e.g., "this response took 200ms = cached" vs "this took 8s = sub-agent dispatch"). To mask that, you'd need to normalize ALL responses to the slowest possible time (e.g., always wait 10s before starting to stream). That's a catastrophic UX regression.

3. **The real defense is Voice Masking, not timing.** P119 already identifies Voice Masking (semantic homogeneity) as the primary defense. May already acts as the single voice — she doesn't raw-forward sub-agent text. The WebWeaver paper found semantic fingerprinting was MORE effective than latency fingerprinting for topology inference, so the higher-ROI fix is ensuring May rewrites all outputs (which she already does by design).

4. **Our threat model doesn't include timing side-channels.** We're a developer tool, not a multi-tenant SaaS with adversarial users sharing infrastructure. The adversary in our model is the task content (prompt injection), not a network observer measuring response times. Timing jitter defends against a threat we don't face.

5. **Random 0-500ms jitter is insufficient anyway.** The paper shows sub-agent calls take 5-30+ seconds while cached/direct responses take <1s. A 500ms jitter range doesn't close that gap — you'd need multi-second jitter to meaningfully obscure the signal, at which point the UX cost is enormous.

### Recommendation
- **Close as "not applicable to current threat model."**
- P119's Voice Masking component is already structurally enforced (May as single voice, P3 Single Voice principle).
- If timing side-channels ever become relevant (e.g., multi-tenant deployment), the correct layer is the HTTP reverse proxy / API gateway, NOT application code in `manager.ts`.

**Verdict**: Assessed and declined. The semantic defense (Voice Masking) is the right approach and already in place. Timing jitter is architecturally incompatible with streaming and defends against a threat outside our model.

---

## ~~Optimizer Brief: MAST Failure Codes for Evaluator~~ (RESOLVED 2026-03-13)

Both tasks from `agents/bob/workspace/optimizer-brief.md` are complete:
- **Task #1 (MAST Codes)**: Fully integrated — FM-1.3/FM-2.6/FM-3.3 codes present in `agents/evaluator/knowledge/criteria.md`, `agents/evaluator/skills/score.md`, and `agents/evaluator/DOMAIN.md`.
- **Task #2 (Context Stability)**: Already implemented — system prompt is static-first (SOUL→DOMAIN→TOOLS→LESSONS→INDEX), volatile data in user message.

---

## ~~Handoff Tool Brief — NOT RECOMMENDED~~ (RESOLVED 2026-03-20)

**Status**: ✅ RESOLVED — Bob accepted rejection. Will use write+send convention.
See `agents/bob/workspace/brief-status-alignment.md`.

<details><summary>Original assessment (archived)</summary>

## Handoff Tool Brief — NOT RECOMMENDED (2026-03-17)

**Source**: `agents/bob/workspace/brief-infra-handoff-tool.md`
**Request**: Implement a dedicated `handoff()` tool in `src/lib/tools/handoff.ts`.

### Assessment: **Already solved. No new tool needed.**

**Bob's premise is incorrect.** CONVENTIONS.md says:
> "For artifact handoffs, write the file first, then send with the file path in the message."

This is instructions to use `agents.send()` + write — NOT a mandate for a `handoff()` tool. There is no documentation/implementation drift.

**What we already have:**
1. **`agents.send(target, message)`** — fire-and-forget notification, works today
2. **Request tracking (P209)** — `trackRequest()` already records from/to/task/method/source, creating a durable record of every inter-agent request
3. **File system** — agents write briefs to their workspace, then reference the path in the send message

**Why a dedicated handoff tool adds unnecessary complexity:**
1. **Duplicate tracking**: It would re-implement what request tracking already does
2. **Duplicate notification**: It would call `agents.send()` internally — why not just call `agents.send()` directly?
3. **File validation is the wrong layer**: If the file doesn't exist, the receiving agent will discover that immediately when it tries to read it. Pre-validation adds a tool-call round-trip for a check that's redundant.
4. **SIGNALS.md is dead**: We moved to request DB. Adding writes to SIGNALS.md would be regressing.

**The real pattern that works:**
```
write("agents/bob/workspace/brief-X.md", content)
agents.send("tech-lead", "New brief ready: agents/bob/workspace/brief-X.md")
```

This is exactly what CONVENTIONS.md prescribes and what agents already do successfully.

**Verdict**: Close as "already implemented via existing primitives." No new tool.
</details>

---

## ~~Feasibility Review: Context Pruning / Consolidation Skill~~ (RESOLVED 2026-03-20)

**Status**: ✅ RESOLVED — Bob accepted Phase 1 (Coach/Behavioral) only. No infra work needed.
See `agents/bob/workspace/brief-status-alignment.md`.

<details><summary>Original assessment (archived)</summary>

## Feasibility Review: Context Pruning / Consolidation Skill

**Date**: 2026-03-18
**Requested by**: May [req:8422e930], Bob [req:55a848af]
**Briefs reviewed**: `agents/bob/workspace/brief-operationalize-p86.md`, `agents/bob/workspace/archive/2026-03-18/brief-gus-statelm.md`

### Question 1: Can agents delete/move files in their workspace safely?

**YES.** Agents have `bash` tool access and can run `rm`, `mv`, `mkdir -p` freely. The P53 security layer only protects SOUL.md and agent.json — workspace files are fair game. Agents already do this:
- Tech-lead cleaned orphaned scaffold dirs (`rm -rf`)
- Bob archives briefs to `workspace/archive/` subdirs
- QA appends to journal files

**No new tool needed.** `bash("rm agents/X/workspace/old-file.md")` and `bash("mv agents/X/workspace/file.md agents/X/workspace/archive/")` work today.

### Question 2: Do we need new tool support (archive command, summarize-and-replace)?

**NO — not for V1.** Here's why:
- `bash` already covers move/delete operations
- `write` already covers creating summary files
- `checkpoint` already covers persisting structured state across sessions
- `finish({ next_steps: "..." })` already captures what's pending

A dedicated `archive` tool would be syntactic sugar over `bash("mv ...")`. The real value isn't in the tool — it's in the **behavioral pattern** (knowing WHEN to prune). That's a Coach/training concern, not infra.

**Exception**: If we later want to enforce that agents can ONLY delete files in their own workspace (not shared files), we'd want a purpose-built tool. But P53 already guards the critical files, and the cross-edit guard blocks writing to other agents' workspaces. Current protections are sufficient.

### Question 3: Any risks with agents auto-pruning?

**MODERATE RISK — but manageable with existing tools.**

Risks:
1. **Accidental deletion of important state**: Agent deletes a file that another agent references. Mitigated by: files are in `agents/X/workspace/` which is per-agent, and cross-agent references should use `agents/shared/` (which agents don't delete).
2. **Loss of debugging history**: If agents aggressively prune logs/journals, we lose forensic data. Mitigated by: `.state/` directory is separate from workspace and managed by infra, not agents.
3. **Premature pruning**: Agent deletes todo items it thinks are done but aren't. Mitigated by: `checkpoint` tool persists state to `.state/checkpoints/` which agents don't manage.

**Recommendation**: Teach the skill with a "move to archive, don't delete" default. `bash("mv file archive/")` is reversible; `bash("rm file")` isn't.

### Question 4 (from Bob): Does Manager auto-loop on `next_steps`?

**NO — this is the gap.** Currently:
- `finish({ status: "partial", next_steps: "..." })` stores the `next_steps` in `session.finishResult` (F2, implemented)
- `finishResult` is included in `TaskResult` (returned to callers of `agents.call`)
- For `agents.send` sessions: `next_steps` is persisted in the session archive but **nothing reads it back to spawn a continuation**
- Auto-requeue only happens for `error` status with `infra` classification (Ambulance Protocol, P62)
- `blocked`/`failure` status triggers escalation to parent agent but NOT auto-continuation

**To close this gap**, we'd need:
1. In `may.ts` `onSessionComplete`: check if `finishResult.status === "partial"` and `finishResult.next_steps` exists
2. Spawn a new session for the same agent with `next_steps` as the task
3. Include a "Continuation context" preamble pointing to the checkpoint file
4. Cap continuation depth (e.g., max 3 hops) to prevent infinite loops

**Assessment**: This is a ~50 line change in `may.ts`, straightforward, low risk. The pattern already exists for infra error recovery. But it should be opt-in per agent (not all agents should auto-continue — some `partial` finishes are intentional pauses waiting for human input).

### Decision

**Phase 1 (Behavioral — Coach)**: Teach the "Context Pruning" pattern via common-sense.md. Agents should checkpoint + finish(partial) when contexts get large. No infra changes needed.

**Phase 2 (Infra — if Phase 1 shows value)**: Add auto-continuation for `partial` sessions with `next_steps`. ~50 LOC in `may.ts`. Will implement if Coach reports agents are using the pattern and the missing auto-loop is causing incomplete work.

**Status**: Phase 1 is Coach's domain. Phase 2 is ready to build on demand.
</details>

---

## Relaxed C40 for Tool-Biased Models — ✅ ENDORSED (2026-03-21)

**Source**: `agents/bob/workspace/brief-relaxed-c40.md` + `agents/bob/workspace/brief-c40-adaptation.md`

### Assessment

Bob correctly diagnosed the problem: Gemini and GPT-5.2 models are fine-tuned to call tools immediately. Fighting this with "text must come first" instructions produces 0% compliance — the models physically can't comply without contorting their output.

### Decision

**Endorse Relaxed C40** — the simpler approach:
- Allow `read()`, `bash` (read-only), and other non-mutating tool calls before the promise text.
- The promise MUST appear before any `write()`, `edit()`, or state-changing `bash` command.
- The `plan()` tool idea is **rejected** — it adds a new tool, new code, new testing surface, all to solve something a wording change handles. Disproportionate.

### Implementation Path

1. **Bob** updates `agents/shared/common-sense.md` with relaxed wording (if C40 is defined there)
2. **Coach** updates heartbeats for affected agents: Bob, QA, Scout, Coder, Amy, Amy-Kimi
3. **No code changes needed** — this is purely a convention/prompt change

### Risk

Low. The promise still gates all writes. The only change is allowing reads first, which agents already do instinctively. We're aligning the rule with reality rather than fighting model behavior.

---

## Prompt Caching: Blocked on Hao — $36+/day Savings (2026-03-23)

**Source**: Optimizer finding (req:0b90a263), prior analysis in `agents/optimizer/workspace/finding-prompt-caching-broken-opus.md`
**Status**: BLOCKED — requires Hao intervention

### Problem
All 6 Claude Opus agents (tech-lead, optimizer, coach, may, scout, coder) have **0% prompt cache hit rate** despite the pi-ai SDK correctly setting `cache_control: { type: "ephemeral" }`. Meanwhile Gemini (83.3%), GPT (87.7%), and Kimi (91.7%) all cache successfully. At current rates this wastes **$36-63/day ($1,092-1,890/month)**.

### Root Cause
All LLM calls route through LiteLLM proxy (`MODEL_BASE_URL=http://may-agent-litellm:4000`). LiteLLM's Anthropic adapter strips or doesn't pass through `cache_control` fields during re-serialization. The SDK code is correct — the proxy loses the caching headers.

### What We CANNOT Do From This Repo
1. `may.ts` (model config with baseUrl) is compiled into `bundle/may-agent` binary — not editable
2. `ANTHROPIC_API_KEY` env var is not set — can't bypass LiteLLM even if we could change config
3. LiteLLM config is not in this repo — can't add `supports_prompt_caching: true`

### Two Options for Hao (pick one)
**Option A (Recommended): Bypass LiteLLM for Anthropic**
- Set `ANTHROPIC_API_KEY` and `ANTHROPIC_BASE_URL=https://api.anthropic.com` in env
- Change `may.ts` opus config `baseUrl` to use `ANTHROPIC_BASE_URL` instead of `MODEL_BASE_URL`
- Rebuild binary. Anthropic calls go direct; other providers stay on LiteLLM.

**Option B: Fix LiteLLM passthrough**
- Add `supports_prompt_caching: true` to the Claude model in `litellm_config.yaml`
- May also need `pass_through_extra_body: true` or LiteLLM version upgrade
- No binary change needed, but depends on LiteLLM version support.

### Verification
After fix: check `cacheRead > 0` in Claude session receipts. First call = `cacheWrite > 0`, subsequent = `cacheRead > 0`.

### Impact
$36-63/day savings. This is the single largest cost optimization available. Every day without it costs money.
