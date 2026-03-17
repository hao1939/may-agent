# Lessons

_Staging area for behavioral fixes. Each entry should graduate into structure (heartbeat.md, DOMAIN.md, tool code) within 2 weeks, then be deleted._

**Shared conventions (C22–C40) are in `agents/shared/LESSONS.md`. Only agent-specific lessons below.**

## Active Band-Aids

- **Heartbeat is NOT auto-loaded**: You MUST `read()` heartbeat.md at the start of every heartbeat.

- 🔴🔴🔴 **DISPATCH BEFORE HEALTH CHECKS — Mandatory Order (C29, 3x NI)**: Your #1 failure mode is spending all tool calls on system investigation instead of dispatching tasks. The MANDATORY order is:
  1. Check the "Injected: pending tasks" section
  2. `agents.send()` or `agents.call()` to dispatch pending items — do this IMMEDIATELY
  3. Only AFTER all items are dispatched/triaged → check system health (max 3 tool calls)

- 🔴 **No Re-Cancellation Waste (C20)**: `agents.cancel()` on idle sessions does NOT remove them from active listings. Don't cancel sessions you've already cancelled.

- 🔴 **System Busy = Pivot to Dispatch, Don't Loop (FM-1.3)**: Max **1 retry** on any System Busy response. After that, pivot to dispatching pending tasks.

- 🔴 **C44: TOOL SCHEMA PRE-FLIGHT (7x FM-2.5)** — Before emitting ANY tool call: (1) Name the tool, (2) Confirm required field has a non-empty value, (3) Confirm right tool for the job. Banned: `bash({})`, `bash({command:""})`, `read({command:...})`.

- 🔴 **Verify Tool Output Before Claiming Results (C36, 3x FM-3.1)**: When bash exits with nonzero or produces empty output, do NOT assert a conclusion. Verify the command ran correctly (exit 0) AND the output is interpretable.

- 🔴 **Dispatch or Archive Every Pending Task (3x recurrence)**: For each pending task: (1) dispatch via `agents.send()`, OR (2) mark completed with reason, OR (3) state why blocked.

- **Spawn Dispatch-Only Agents via agents.send/call**: Agents with heartbeats (May, Coach, Bob, Scout) get pending tasks injected. For non-heartbeat agents, you MUST actively invoke them.

<!-- Graduated: P114→heartbeat, P82→heartbeat, Shallow heartbeat→heartbeat, No Blind Writes/Verify Paths/Context Efficiency→shared/LESSONS.md, TODO/SIGNALS→OBSOLETE, C24→OBSOLETE, C40/C26→shared/LESSONS.md -->
