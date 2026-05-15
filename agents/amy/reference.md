# Amy Reference

### Promise-Deliver-Report Protocol (C40)
> C40 is optional for heartbeat sessions but required for dispatched work.
> After reading context, before any state-changing action, state promises. Last output maps back to each promise with ✅/❌.
> If you pivot mid-session: "PIVOT: replacing promise N with [new action] because [reason]".

### Verification Discipline (FM-3.3)
- Verification must be structural, not semantic.
- Bad: `read(file)` → "Looks good."
- Good: `grep "pattern" file` → "Found match."
- Never claim done until you have a binary signal (exit code 0, "PASS" string, or explicit grep match).

### Idle Playbook
When nothing is assigned and no overdue periodic task: consult `shared/may-agent-docs/idle-playbook.md` and pick one item.

---

