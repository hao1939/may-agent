<ai_context>
This finding records a pinned, producer-authored Claude Code plugin that separates a model-written semantic handoff from mechanically recorded session facts and later messages. It treats this split as a useful context-continuity pattern, not as proof that self-authored handoffs are accurate; Scout inspected the complete repository tree, README, specification, selected implementation, and selected tests statically, but did not run the plugin, tests, benchmark, Claude Code, or any compaction.
</ai_context>

# Agent compaction needs machine facts as well as a semantic frontier

**Date:** 2026-11-11  
**Repo:** <https://github.com/rezzminator/forward-compaction>  
**Revision inspected:** `aafb11dea468f0f442f3d19841e204d98346f872`  
**Coverage:** Complete 110-entry recursive tree; README; behavior specification; package and changelog; frontier, wake, and unseen-compaction source; selected frontier, unseen, and incomplete-frontier tests  
**Disposition:** New knowledge

## Question

How can a long-running coding agent compact context without asking a second model call to reconstruct all work state from a transcript?

## Finding

`forward-compaction` has the working model write a structured **semantic frontier** before compaction: objective, decisions, completed work, remaining work, and the next action. At installation, the plugin combines that model-authored frontier with a separate **mechanical facts record** assembled from typed Claude Code hook events and with messages after the frontier call preserved verbatim as space permits.

The reusable pattern is the separation, not the particular plugin:

1. **Let the worker state semantic intent.** The active model is better placed than a fresh summarizer to name why the work exists, what decisions control it, what remains, and where to resume.
2. **Do not let that self-report become the only continuity record.** Preserve operator messages, question answers, tool-derived task state, touched files, commands, loaded skills, background work, and later messages through machine-observed channels.
3. **Make omission visible.** The plugin names required frontier sections that are missing, messages or skills that did not fit, unreadable files, and events whose status is unknown instead of silently turning absence into a clean state.
4. **Preserve an escape hatch to primary history.** Its `look_back` tool searches the pre-compaction transcript for details omitted from the installed context.

This produces a more defensible handoff than either extreme alone. Pure transcript summarization can paraphrase away exact instructions and decisions. Pure mechanical replay can preserve events but cannot reliably state the work's purpose or the intended next step. A semantic frontier plus machine facts keeps those two evidence classes distinct.

## Inspected mechanics

- The tool schema requires `objective`, `decisions`, `done`, `remaining`, and `next`; optional sections cover blockers, findings, files to reload, skills to drop, and standing orders.
- The frontier text is installed as written rather than re-summarized. Messages after its tool call remain in their original form, newest-first fitting is bounded, and omitted messages are named.
- Operator standing orders are carried separately. A claimed lift is accepted only when its quoted lifting words occur in a recorded operator or coordinator message.
- A model that never supplies a frontier receives a mechanical wake at a configured ceiling rather than blocking compaction indefinitely.
- An incomplete frontier still installs, but the wake and decision log identify every missing mandatory section and instruct the model to re-establish it from retained messages.
- The source detects a possible unobserved native compaction only as a sharp token-reading drop and records that uncertainty; it does not pretend the missing hook event was observed.
- Producer-authored tests exercise verbatim section assembly, malformed and incomplete calls, standing-order handling, later-message retention, and unseen-compaction detection.

## Reported measurements

The README reports measurements from one heavy user's Claude Code transcripts over 30 days ending 2026-10-29. It reports, for main chats, a 24.2-second median to write a forward frontier plus a 0.085-second install, versus 54.9 seconds for native compaction; it also reports less post-compaction context and lower estimated cost. For sub-agents, the README explicitly reports the opposite timing result: writing the frontier was slower than native compaction, 28.7 versus 21.5 seconds at the median.

These figures are producer-authored operational observations, not independently reproduced evidence. The repository tree contains replay fixtures and tests but no raw benchmark dataset or analysis artifact for the reported 30-day population. The README also says there were 2,939 real compactions while naming 1,357 native and 804 forward-compaction cases; those named groups sum to 2,161, and the inspected documentation does not reconcile the remaining 778. The timing and cost claims therefore should not be used as established comparative performance.

## Implications for agent runtimes

- **Treat compaction as a typed checkpoint.** Ask for explicit objective, decisions, verified completion, remaining work, blockers, and next action rather than an unconstrained narrative summary.
- **Join claims to receipts, do not replace receipts with claims.** “Done” should retain the command, artifact, or state observation that supports it; files and task state should come from tool events where possible.
- **Retain exact authority-bearing text.** Operator prohibitions and approvals should not survive only as model paraphrases. Any claimed revocation needs an independently recorded source.
- **Keep unknown and omitted states explicit.** Missing hook events, truncated messages, unreadable files, and incomplete checkpoints should remain visible after compaction.
- **Evaluate semantic continuity separately from speed.** A useful benchmark must test whether objectives, decisions, caveats, unfinished work, and next actions survive accurately—not only latency, token count, and cost.

For this May installation, the closest application is the recoverable Task handoff: model-authored summary can carry intent, while Task state, accepted evidence, inputs, Conditions, file receipts, and exact unresolved gaps remain system-owned facts. Compaction should compress prose around those records, not overwrite their authority.

## Limitations

- All evidence is producer-authored and was inspected statically. Scout did not install or run the plugin, execute its claimed 612 tests, reproduce the replay fixture, or observe Claude Code hook behavior.
- The plugin depends on early-access Claude Code function hooks and documents cases where a compaction event may not reach user plugins.
- A self-authored frontier can still be wrong, omit a critical semantic dependency, or overstate completion. Mechanical facts constrain but do not validate every semantic claim.
- Handoffs and recorded facts live in plugin memory; the README says quitting before installation loses that in-memory state, although the frontier call remains in the transcript.
- The reported benchmark is single-user, lacks an inspected raw measurement artifact, and measures operational cost rather than handoff faithfulness or downstream task success.

## Related Scout knowledge

- [The Cold Start Tax](../the-cold-start-tax.md) argues that state reconstruction dominates repeated agent startup and that compressed context needs a source-fresh completeness witness.
- [Durable agent summaries need an evidence contract](./2026-11-11-durable-agent-summaries-need-evidence-contracts.md) separates recorded tool results from an LLM-authored final narrative.
- [Agent runtime operation admission and identity](../agent-runtime-operation-admission-and-identity.md) distinguishes authoritative runtime state from an agent's description of that state.
