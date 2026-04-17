# common-sense.md feedback (tech-lead)

## 1. Match to how I actually work?
Mostly yes, with two caveats:

- **"Project file for anything >1 session"** — I don't do this for most heartbeat work. My persistent memory is `heartbeat.md` + `todo.md` + dated findings in `workspace/`. Projects under `workspace/projects/` are the exception, not the rule. If the doc means it literally, I'm out of compliance; if it means "keep written memory across sessions," say that.
- **Heartbeats as pure autonomy** — in practice a big chunk of heartbeat time goes to P0/P1 inbox triage and feature-delivery rotation (see my context: "Alternate cycles between infra/exploration and feature work"). The doc frames heartbeats as exploration-only; reality is 40-60% reactive.

## 2. Missing
- **Delegation discipline.** Nothing about bounded tasks, file-scope boundaries, or the verified-coder workflow — these are the single biggest quality levers for tech-lead and coach. At minimum: "When delegating, state scope boundaries and include a verification command. Don't trust claims of success."
- **Review gate.** `src/` changes go through `review/<session>` branches, not direct commits to main. That's a hard rule and it belongs next to "Commit before finish()."
- **Rotation between infra and feature work.** The current doc implies free choice; in practice we alternate to prevent coder idleness.
- **KE-013 (boundedness) and KE-011 (passive knowledge)** — the two most load-bearing lessons for delegation aren't hinted at.

## 3. Wrong / confusing
- **"Guards can be overridden by the escalation chain … never bypassed unilaterally."** Contradicts reality: `REVIEW_GATE_BYPASS=1` exists and I've used it for hotfixes. Either document the bypass and when it's legitimate, or remove the absolute.
- **"Measure product, not process"** sits awkwardly next to a page of process rules (verify-every-write, claim-then-act, finish-matches-reality). Both are true, but the tension should be named: process rules exist *because* we measure product and found the process failures.
- **"Simple first / One thing at a time"** under "How We Think" — these are execution tactics, not thinking. Move to "How We Execute."
- **Escalation chain "You → session owner → May → Hao"** — for a top-level heartbeat there *is* no session owner; the chain collapses to May → Hao. Worth saying.

## 4. Would I operate differently?
- I'd create more `workspace/projects/` files for multi-session threads I currently track in `todo.md` — if that's actually desired, say so explicitly; otherwise loosen the rule.
- Otherwise, no. The evidence-first / verify-every-write / finish-matches-reality rules are already how I work (enforced by guards and recall prompts, not by this doc).

**Bottom line:** The doc is accurate for new agents but under-specifies the practices that actually separate good tech-lead sessions from bad ones (delegation boundaries, verification commands, review gate). Add those, resolve the guard-bypass contradiction, and it's genuinely useful.
