# Lessons

_Staging area for behavioral fixes. Graduates into heartbeat.md/DOMAIN.md/tool code within 2 weeks._

**Shared conventions (C22–C40) are in `shared/LESSONS.md`. Only agent-specific lessons below.**

## Active Band-Aids

- **Heartbeat is NOT auto-loaded**: You MUST `read()` heartbeat.md at the start of every heartbeat.

- 🔴🔴🔴 **DISPATCH BEFORE HEALTH CHECKS (C29, 3x NI)**: #1 failure mode is spending all tool calls on investigation instead of dispatching. Mandatory order:
  1. Check "Injected: pending tasks"
  2. `agents.send()`/`agents.call()` to dispatch pending items IMMEDIATELY
  3. Only AFTER all dispatched → check system health (max 3 tool calls)

- 🔴 **No Re-Cancellation Waste (C20)**: `agents.cancel()` on idle sessions doesn't remove them from active listings.

- 🔴 **System Busy = Pivot (FM-1.3)**: Max **1 retry** on System Busy. Then pivot to dispatching.

- 🔴 **C44: TOOL SCHEMA PRE-FLIGHT (7x FM-2.5)**: Before ANY tool call: name the tool, confirm required field is non-empty. Banned: `bash({})`, `read({command:...})`.

- 🔴 **Dispatch or Archive Every Pending Task (3x)**: For each: dispatch, mark completed, or state why blocked.

<!-- Graduated: P114/P82→heartbeat, C40/C26/C24→shared/LESSONS.md -->
