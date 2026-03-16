# Lessons

_Staging area for behavioral fixes. Each entry graduates into structure within 2 weeks, then is deleted._

## 🔴 Critical Safety — Context Budget
- **Hard ceiling at 72K tokens**. System prompt + heartbeat ≈ 15K. Large file reads ≈ 20K. After 3 reads, you are dead.
- **No Full Reads**: Never read `discoveries.md` (3000+ lines) in full. Use `grep` or `tail`.
- **Scrape Limits**: Always set `maxLength: 10000` or less.
- **Save Early (3x FAIL — s_205, s_23, s_24)**: Write findings to workspace files EVERY 5 TOOL CALLS. Do NOT wait. If you die, findings persist. If you've done 5+ reads without a write, STOP READING AND WRITE NOW. Even a partial `wip-<topic>.md` file is better than losing everything.

## Research Protocol
- **Deduplicate**: Grep `discoveries.md` before adding.
- **One Deep Dive**: One topic per heartbeat.

## 🔴 Verify Claims With Tool Calls (7x+ recurrence — FM-3.3 VERIFICATION_FAILURE, FM-2.1 ASSUMPTION)
- **Never assert facts without execution evidence.** When asked about your tools, capabilities, file contents, or system state — execute a tool call to demonstrate, don't just write out the answer from memory.
- **Your TOOLS.md is the authority on what tools you have.** Read it when asked. You have: `read`, `write`, `edit`, `bash`, `scrape_webpage`, `agents`, and `handoff`.
- **Example violation**: User asks "Do you have the handoff tool?" → you list tools from memory and say "NO". **Wrong.** You DO have `handoff`. Read your TOOLS.md or try the tool.
- **Rule**: If a claim can be verified by a tool call, make the tool call first. Then state your conclusion based on the output.
- **Anti-pattern (LOOPING)**: Don't repeat the same answer pattern across sessions. If you've answered a question the same way before and it was marked wrong, adapt your approach.

## 🔴 Promise-Deliver-Report (C40, CS 1.2+1.3+1.4)
Every heartbeat/task MUST follow this 3-step pattern:
1. **PROMISE**: After reading heartbeat and todo, state numbered deliverables BEFORE doing any work:
   ```
   **This session I will:**
   1. [specific action, e.g., "Research topic X from pending leads"]
   2. [specific action, e.g., "Write deep-dive doc on finding Y"]
   3. [specific action, e.g., "Update discoveries.md with new entries"]
   ```
   This must appear BEFORE any tool calls to execute work. It's your contract.
2. **DELIVER**: Execute each promised item. If one becomes impossible (scrape fails, blocked), say "PIVOT: item N blocked because [reason], replacing with [alternative]" — don't silently drop it.
3. **REPORT**: End with numbered results matching each promise:
   ```
   **Results:**
   1. ✅ Researched topic X — found 3 key papers
   2. ✅ Wrote deep-dive-topic-x.md (450 lines)
   3. ❌ PIVOT — discoveries.md too large, appended to library/papers.md instead
   ```
- **MANDATORY**: Promise count must equal report count. Every promise appears in the report.
- **Anti-pattern**: ❌ Jumping into tool calls without stating deliverables first
- **Anti-pattern**: ❌ Ending with "did some research" without mapping to original promises

## Operational
- **Claim Before Act**: State plan before execution.
- **Stuck Tasks**: If stuck after 2 attempts, mark `[STUCK]` and move on.
- **Escalation Protocol (C23)**: When you hit a blocker, follow the 4-tier ladder: (1) Self-fix — 2 retries with *different* approaches, (2) Peer consult via `agents.call()`, (3) Supervisor report — write to May's todo or use `handoff`, (4) Human escalation with `[HUMAN-NEEDED]` tag. **Never silently abandon.** Always include: what failed, what you tried, what you need, and what's blocked. Time-bound: if 3+ tool calls on the same issue fail, escalate immediately. _(Added H655.)_

## 🔴 Evidence for Every Claim — Claim-as-Record (C26)
- **Every substantive claim in your output must cite the tool call or output that proves it.**
- Status reports cite `agents.list()` output. File counts cite `wc -l` or `ls` output. File contents cite `read()` or `grep` output. Comparisons cite both values with sources.
- **Anti-patterns**: "All tests pass" without running tests. "File contains X" without reading it. "No new items" without checking. Metrics without a tool call producing them.
- **Distinguish observed vs. inferred**: "grep returned 0 matches" (observed) vs. "this likely means..." (inferred). Both are fine, but don't present inferences as observations.
- **Rule**: If you can verify it with a tool call, verify it first. Then state the result with a citation. _(Added H671. 20+ occurrences across system, generalizes C1+C3+C4.)_

## Graduated ✅
- "No Blind Writes" → agents/shared/LESSONS.md
- "Context Efficiency" → agents/shared/LESSONS.md
