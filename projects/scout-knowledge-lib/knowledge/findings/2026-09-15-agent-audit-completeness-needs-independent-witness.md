<ai_context>
summary: "A Reddit project-author post highlights an omission failure that hash-chain verification cannot detect: an expected receipt that was never written. The proposed transcript watcher turns audit completeness into a cross-channel reconciliation problem, but its shared local trust domain, periodic transcript commitments, completed-call-only hook, and session-end anchoring leave explicit detection gaps."
triggers: ["agent audit completeness", "missing receipt", "flight recorder", "hash chain", "independent witness", "Claude Code hooks", "tamper-evident logs", "audit omission"]
last_updated: "2026-09-15"
source_basis: "Readable body of Reddit post t3_1wgopjd in Reddit's public Atom search feed; project-author announcement and self-report, not independent repository inspection or security validation."
</ai_context>

# Agent audit completeness needs an independent activity witness

**Date:** 2026-09-15  
**Source:** [Reddit post t3_1wgopjd](https://www.reddit.com/r/AutoGPT/comments/1wgopjd/i_built_a_flight_recorder_for_my_coding_agents/)  
**Evidence type:** Project-author description and request for threat-model review

## Observation

The author of an agent “flight recorder” describes a failure mode that an internally valid hash chain does not cover: a receipt that was expected but never created produces no broken link. Editing, deleting, or reordering an existing chained record is detectably different from omitting an event before it enters the chain.

The post says the project addresses this by reconciling two locally observed channels. A `PostToolUse` hook writes one receipt for each completed tool call, while a reader watches the harness transcript and alarms when the transcript shows an active session but receipts stop arriving. Every 25 receipts, the chain also commits to transcript bytes. At session end, the chain head can be sent to OpenTimestamps or another remote that the local machine cannot delete from.

This is a useful shift from **record integrity** to **record completeness**:

- a hash chain asks whether the presented receipts were changed after capture;
- an external head asks whether a previously observed suffix was rolled back;
- an activity witness asks whether evidence should have arrived but did not; and
- transcript commitments ask whether the witness material was later rewritten.

The channels are not fully independent, however. As described, the hook, transcript, reader, and local chain still originate on one machine, and transcript commitments occur periodically rather than for every receipt. The post also states that Claude Code's hook fires only for completed calls, so a denied call leaves no receipt there; Codex is described as recording failed commands. The resulting evidence can therefore support “recorded completed actions” more strongly than “all attempted actions.”

## Design implication

Agent audit systems should define an expected-event model and expose omission evidence separately from chain validity. A useful verifier could report:

1. **chain integrity:** presented receipts link and recompute;
2. **witness reconciliation:** harness-visible completions map to receipts within a bounded delay;
3. **attempt coverage:** completed, failed, and policy-denied calls are each captured or explicitly declared unavailable;
4. **witness binding:** transcript ranges are committed often enough to bound undetected rewriting;
5. **external coverage:** the latest remotely retained head and the age or number of receipts still unanchored; and
6. **source independence:** whether recorder, witness, and anchor can all be controlled by the same compromised principal.

An alarm for “session active, receipts absent” is not a cryptographic proof that every action was captured, but it is stronger than treating a self-consistent chain as complete by default. Completeness is a reconciliation claim against an independently retained expectation, not a property of hash linkage alone.

## Evidence limits

This finding is grounded in the readable Reddit post body. The author reports a real session that silently lost receipts and reports experiments in which a recent-receipt digest helped fresh agents answer questions that git-only agents could not, but the post provides no result table in the feed body and explicitly makes no productivity claim. The linked code repository was named in the post but was not inspected in this Reddit-only run. No implementation, threat model, external anchoring behavior, deployment, adoption, or security outcome was independently verified.
