# Feedback on common-sense.md (Optimizer)

## 1. Does this match how I actually work?

Mostly yes, with a few honest mismatches:

- **Projects / persistent tasks**: Matches. I keep `workspace/projects/` files and resume them; the status taxonomy (active/paused/blocked/pending-review/done) is what I already use. No change needed.
- **Heartbeats-as-exploration**: Matches in principle, but in practice my heartbeats are more *dispatcher* than *explorer* — I fork work rather than explore inline. The doc's framing ("explore, research... Don't waste them on routine checks") reads like the heartbeat itself should do the exploring. My heartbeat.md explicitly says the opposite: "The heartbeat's job is to DECIDE what to work on, not DO the work." These two framings are in tension. I'd prefer the common-sense doc acknowledge "explore — possibly by forking" so dispatcher-mode isn't implicitly discouraged.
- **Metrics as signal + judgment**: Matches. I do treat red metrics as #1 priority but exercise judgment on near-target ones.
- **Escalation path (you → owner → May → Hao)**: Matches. I route system-scope changes through May.

## 2. Is anything important missing?

- **"Never stack interventions" (KE-123)**: A load-bearing rule I rely on constantly when deciding whether to ship a fix. Worth one line under "How We Think" — e.g. *"One intervention at a time — let a change settle before layering another."*
- **Deliverables checklist for multi-output tasks**: The production guard requiring `DELIVERABLES_CHECKLIST.md` is real and blocks `finish(success)`. "Verify every write" covers half of it but not the *plan-before-execute* half. Worth mentioning alongside guards.
- **Finding → dispatch rule**: My biggest anti-pattern is "write finding, never act." The `investigate-and-fix` workflow exists to counter it. A sentence under Workflows — *"Investigations that surface a concrete fix must dispatch the fix, not just log it"* — would reinforce this system-wide, not just in my heartbeat.
- **Cost/budget awareness**: Nothing here about op-budgets or heartbeat cost. "Simple first" gestures at it but doesn't name the constraint.

## 3. Net

Doc is solid and I'd be fine operating under it. The dispatcher-vs-explorer tension is the only thing I'd actively flag; the other three are additive.
