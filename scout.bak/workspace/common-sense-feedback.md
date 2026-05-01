# Scout feedback on common-sense.md

Reviewed 2026-04-17. Overall: matches my actual operation well. Specific notes:

## 1. Does this match how I work?

**Mostly yes.** The three-mechanism framing (Projects / Heartbeats / Metrics) maps cleanly onto what I do. Heartbeat-as-exploration is accurate — my best discoveries happen when I pick up a loose thread rather than drain a queue.

**Mismatches / friction:**
- **Projects under-used in my practice.** Most of my work is DD/CR writeups that complete in one session — they aren't projects. I use `workspace/todo.md` and `deep-dives/INDEX.md` as the memory spine, not `projects/`. The doc implies projects are the default unit; for Scout they're the exception. Consider naming this so agents without multi-session work don't feel they're doing it wrong.
- **"Active = concrete next action ready NOW" is the rule I break most.** I sometimes leave projects `active` with a vague next step. Good rule — I should enforce it, but noting it's aspirational.
- **Heartbeat dispatcher pattern is missing.** My heartbeat.md explicitly forbids inline research and forks work sessions. This "look inline, fork the doing" split is load-bearing for me and isn't captured in the general doc. Worth a sentence.

## 2. What's important and missing?

- **Read-then-edit discipline.** I rely on this constantly (KE C1.1). The doc says "verify every write" but the *read-before-write* half — which prevents the mistake, not just detects it — is absent.
- **Counters / canonical state files.** My DD / CR / Session counters live in `workspace/state.json` with a `counters.sh` wrapper. Similar canonical-state discipline exists across agents. The doc should mention: "each agent has canonical state files; edit via the provided script, not by grepping prose."
- **Duplicate-avoidance before writing.** For a research agent, the default "always grep discoveries.md / covered_ids.txt before adding" is a core practice. Generalization: "check for prior art in your library before producing new artifacts."
- **Request-DB as the handoff substrate.** Pending tasks reach me via the request DB injected into heartbeats; closing them needs `finish().completed_items`. The doc mentions escalation but not the actual plumbing agents use to hand work to each other.
- **Active-recall failures.** The top-of-session recall of past FM failures visibly shapes my behavior. Worth naming as a mechanism alongside Projects/Heartbeats/Metrics, or folded into "How We Think."

Nothing in the doc is actively wrong. The gaps are about *mechanisms I use daily* that a newcomer reading this wouldn't learn exist.

## 3. Wrong or confusing?

- **"Heartbeats are YOUR time — don't waste them on routine checks or exiting early"** tensions with my dispatcher doctrine: lean triage + fork + exit is correct behavior for Scout, not waste. Reconcile, or note role docs refine this.
- **"Guards can be overridden by the escalation chain, never bypassed unilaterally."** Silent on false-positive guards (e.g., verify-wrap flagging literal "todo" strings). Needs a "annotate-with-evidence-and-proceed" path.
- **Escalation chain "you → session owner → May → Hao":** for heartbeat-triggered sessions there is no session owner distinct from me — ambiguous first hop.

## 4. Would I operate differently?

Marginally. Two concrete changes:
- Call `finish(partial|blocked)` instead of stretching to `success` — I've failed FM-3.3 twice this week on exactly this.
- Commit-before-finish more reflexively (also a recent FM-3.3).

**arXiv windowing**: keep it OUT of common-sense. It's Scout triage mechanics — belongs in `scout/heartbeat.md` / `adaptive-heartbeats.md`. Common-sense should be role-agnostic; per-role mechanics dilute the genuinely shared rules (evidence, verify, match-finish-to-reality).
