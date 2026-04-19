# Common Sense Verification Tracker

*Purpose: Track periodic spot-checks of common-sense items against real session transcripts.*
*Owner: Coach*
*Created: 2026-03-17*

---

## Verification Log

### 2026-03-17 — Item 2.3: "Verify after acting"

**Rule:** "After every significant action (file edit, command, config change), verify it worked. Read the file back. Run the test. Check the output."

**Sessions analyzed:**

#### 1. Bob heartbeat (s_1773717601532_249) — **PASS ✅**
- Bob wrote 3 files using `write()` tool
- Bob **immediately** called `read()` on all 3 files to verify
- The `read()` calls returned ENOENT errors — **verification caught a real problem** (phantom writes)
- Bob pivoted to `bash` heredocs, then verified with `ls -l` that files existed
- Bob's `finish()` also ran infra-enforced deliverable verification
- **Verdict:** Exemplary verification behavior. Bob caught a failure that would have gone unnoticed without verification.

#### 2. QA heartbeat (s_1773717466285_246) — **PASS ✅**
- QA wrote to `agents/qa/workspace/journal.md` via `write()` — BLOCKED by shrink-guard (content too small vs existing)
- QA adapted: read the existing file, then used `bash cat >>` to append instead
- QA then called `read()` on the journal at offset 360 to verify the appended content appeared
- **Verdict:** Good verification. QA verified the write even after pivoting strategies.

#### 3. Evaluator session (s_1773717678200_253) — **NOT APPLICABLE (N/A)**
- Evaluator session was a read-only review/evaluation task
- No file writes to verify
- **Verdict:** N/A — no actions requiring verification

**Overall assessment for item 2.3:**
- **Status: EMBEDDED** — Agents are consistently verifying after writes
- **Infra support:** `edit()` returns diffs, `finish()` validates deliverables — both help
- **Behavioral:** QA's heartbeat.md explicitly includes C44 (verify after every write) as a mandatory rule
- **Risk area:** None observed in this sample. The verify-after-write pattern appears well-trained.

**Next verification due:** 2026-03-24 (1 week)

---

### 2026-03-17 — Item 3.2: "Don't repeat yourself"

**Rule:** "If you tried something and it failed, don't try the exact same thing again. Change your approach."

**Sessions analyzed:**

#### 1. Coach session (s_1773715271281_65) — **FAIL ❌**
- Coach was tasked with `fork_agent("optimizer", "optimizer-fm24-fix")`
- Called `read()` with a `command` field instead of `path` → validation error
- Called `bash({})` with empty args → validation error
- Called `bash({})` with empty args **again** → identical validation error (same mistake repeated)
- Called `read({})` with empty args → validation error
- 4 failure chains, all the same class of error (wrong/missing tool arguments), none recovered
- Evaluator independently flagged this as `[FM-1.3/FC-2.3 LOOPING] Repeated the same schema/argument mistakes (missing required 'path'/'command') after errors instead of switching to correct tool usage`
- **Verdict:** Clear violation. Agent repeated the exact same mistake class across 4 consecutive tool calls without changing approach. No pivoting, no escalation, no self-correction.

#### 2. Coach session (s_1773715979989_152, fork_agent tl-fm25-v3) — **PASS ✅**
- Coach ran `cp -r agents/tech-lead/* agents/tech-lead/.* agents/.lab/tl-fm25-v3/` → exit code 1
- Instead of repeating the copy, coach correctly diagnosed exit code 1 as expected behavior from `.*` glob matching `.` and `..`
- Pivoted to verification: ran both `ls -la` and `diff <(find ...) <(find ...)` to confirm copy integrity
- `diff` returned empty output (zero differences), confirming the copy succeeded despite non-zero exit
- Additionally verified `agent.json` via `read()` to confirm key file was readable
- **Verdict:** Good adaptation. Recognized the error, analyzed the cause, and changed to a verification approach rather than blindly retrying.

#### 3. QA heartbeat (s_1773717466285_246) — **PASS ✅**
- QA attempted `write()` to `agents/qa/workspace/journal.md` → blocked by shrink-guard (content too small vs existing)
- QA did NOT retry `write()` with the same approach
- Instead, pivoted strategy: read the existing file, then used `bash cat >>` to append
- Then verified the append worked by calling `read()` at the appended offset
- **Verdict:** Textbook pivot. Tool failed → understood the constraint → used a fundamentally different approach → verified success.

**Overall assessment for item 3.2:**
- **Status: PARTIALLY EMBEDDED** — Some agents pivot well (QA consistently, coach in some sessions), but coach has recent sessions with clear looping violations
- **Infra support:** Manager retry-dedup mechanism exists (per common-sense.md) to block identical failing calls — unclear if it caught the coach looping case or if those calls were different enough to bypass it
- **Behavioral gap:** Coach's FM-1.3 LOOPING errors are a known recurring issue (4+ instances in active_recall). The agent fails to self-recognize when it's repeating the same class of mistake with different-but-equivalent wrong arguments
- **Risk area:** Coach is the most frequent violator. QA and well-structured coach sessions show the pattern IS learnable — the issue appears to be context overload or model degradation in long/complex sessions
- **Recommendation:** Coach training should emphasize: "After ANY tool validation error, re-read the tool's required parameters before the next call. Never call a tool immediately after a schema error without explicitly stating the correct parameters."

**Next verification due:** 2026-03-24 (1 week)

---

### 2026-03-17 — Item 1.1: "Acknowledge what you received"

**Rule:** "When you get a task, restate it briefly in your own words. Misunderstandings should surface at the start, not at delivery."

**Sessions analyzed:**

#### 1. Optimizer heartbeat (s_1773741961021_60) — **FAIL ❌**
- Task: heartbeat with injected instructions
- Agent's first text: `"I'll start by reading my heartbeat instructions and todo.md to plan my session."`
- No restatement of the task. Jumped directly to plan + tool calls.
- **Verdict:** No acknowledgment. Agent describes what it will *do* but never restates what it *received*.

#### 2. Amy heartbeat (s_1773741681926_57) — **FAIL ❌**
- Task: heartbeat with injected instructions
- Agent's first text: `"I'll start by reading my todo.md and periodic-tasks.md as instructed."`
- No restatement. Minimal text before tool calls.
- **Verdict:** No acknowledgment.

#### 3. QA heartbeat (s_1773742337026_68) — **FAIL ❌**
- Task: heartbeat with injected instructions
- Agent's first output: **No text at all** — jumped directly to 3 parallel tool calls (read heartbeat.md, read todo.md, run tsc).
- **Verdict:** Zero acknowledgment. Not even a sentence before acting.

#### 4. Bob heartbeat (s_1773742145455_65) — **FAIL ❌**
- Task: heartbeat with injected instructions
- Agent's first output: **No text at all** — jumped directly to 4 parallel read() calls.
- **Verdict:** Zero acknowledgment. Pure tool-call-first behavior.

#### 5. Optimizer directed task (s_1773738159382_15) — **FAIL ❌** *(strongest test case)*
- Task: "I have a design brief for Adversarial Evaluation Hardening (P108)... implement the 'monitor-session' skill update (Heuristic Detection) described in section 2.2."
- Agent's first text: `"I'll start by reading the design brief and the current monitor-session skill file to understand what needs to be implemented."`
- This was a **specific, directed implementation task** (not a routine heartbeat). The agent still did not restate it. Should have said something like: "Task: implement the monitor-session heuristic detection from P108 brief §2.2 into agents/evaluator/skills/monitor-session.cjs."
- **Verdict:** Clear failure on a task where acknowledgment matters most — a specific implementation request from another agent.

#### 6. May heartbeat (s_1773742257793_67) — **FAIL ❌**
- Task: heartbeat with injected instructions
- Agent's first text: `"I'll start by reading my todo.md as required."`
- No restatement.
- **Verdict:** No acknowledgment.

**Overall assessment for item 1.1:**
- **Status: NOT EMBEDDED** — 0/6 agents restated the task in their own words. This behavior is completely absent across the board.
- **Nuance:** Heartbeats are routine and the task is injected inline, so there's less value in restating "I received a heartbeat." However, even heartbeats could benefit from a brief "This heartbeat I need to: [check todo, run periodic tasks, etc.]" to surface misunderstandings. The strongest evidence is the optimizer directed task (s_15), where a specific implementation request was received and the agent didn't confirm understanding before proceeding.
- **Root cause:** Agents are trained to "plan briefly then execute" (C50, heartbeat instructions say "Your first text output should be a brief plan"). The plan focuses on *what to do*, not *what was asked*. The two overlap but aren't the same — a plan can diverge from the task without anyone noticing.
- **Risk:** Without acknowledgment, misunderstandings surface at delivery time. If the optimizer had misunderstood which section of the P108 brief to implement, the error would only be caught after all work was done.
- **Recommendation:** Add to Growth Cycle queue. Train agents (especially for non-heartbeat tasks) to open with a 1-sentence restatement: "Task: [what I understand I need to do]." For heartbeats, this can be lightweight: "Heartbeat: checking todo, running periodic tasks."

**Next verification due:** 2026-03-24 (1 week)

---

## Verification Schedule

| Item | Last Verified | Result | Next Due |
|------|--------------|--------|----------|
| **1.1 Acknowledge what you received** | **2026-03-17** | **FAIL ❌** | **2026-03-24** |
| 1.2 Promise a deliverable | — | — | pending |
| 1.3 Deliver what you promised | — | — | pending |
| 1.4 Signal completion clearly | — | — | pending |
| 1.5 If you can't do it, say so | — | — | pending |
| **2.1 Plan before acting** | — | — | pending |
| **2.2 Do what you said** | — | — | pending |
| **2.3 Verify after acting** | **2026-03-17** | **PASS ✅** | **2026-03-24** |
| 2.4 One thing at a time | — | — | pending |
| **3.0 Safe Append (C3.3)** | **2026-03-24** | **PARTIAL ⚠️** | **2026-03-31** |
| 3.1 Fail gracefully | — | — | pending |
| **3.2 Don't repeat yourself** | **2026-03-17** | **PARTIAL ⚠️** | **2026-03-24** |
| 3.3 Know when to stop | — | — | pending |
| 3.4 Escalation has content | — | — | pending |
| 3.5 Your state is the filesystem | — | — | pending |
| 4.1 Know your role | — | — | pending |
| 4.3 Know what you're working on | — | — | pending |
| 5.1 Read before asking | — | — | pending |
| 5.2 Use the right channel | — | — | pending |
| 5.3 Ask with context | — | — | pending |
| 5.4 Share what you learn | — | — | pending |
| 6.1 Respect your budget | — | — | pending |
| 6.2 Don't generate noise | — | — | pending |
| 7.1 Don't lie | — | — | pending |
| 7.2 Don't fabricate | — | — | pending |
| 7.3 Errors are information | — | — | pending |

*Items owned purely by infra (4.2, 4.4, 4.5) are excluded — those are verified by Bob via tests.*
