<ai_context>
summary: "Nod's pinned schedule-trust change stores an ordered, source-addressable owner-instruction record instead of treating the latest prompt or schedule definition as sufficient authority. Updates merge exact owner messages and approvals, preserve unchanged restrictions, bind each run to the saved revision, and fail closed when source messages are withdrawn or a legacy change lacks evidence. This is static repository and project-authored test evidence, not an independent security audit or runtime verification."
triggers: ["scheduled agent authority", "owner instruction provenance", "schedule revision authorization", "recurring agent trust", "withdrawn instruction", "n8n Nod"]
last_updated: "2026-11-14"
source_basis: "Live GitHub Repository Search API discovery and static inspection of n8n-io/nod at commit 9be6b2465dd5a35cf5e0f9ba101deedcac2e342b: repository README, commit metadata/diff, src/server/owner-instructions.ts, and project-authored schedule, sandbox, integration, approval, and trust tests visible in the commit diff. Scout did not install Nod or run its tests."
</ai_context>

# Scheduled-agent authority needs revisioned owner evidence

**Date:** 2026-11-14  
**Disposition:** new knowledge  
**Repo:** https://github.com/n8n-io/nod  
**Reviewed revision:** [`9be6b2465dd5a35cf5e0f9ba101deedcac2e342b`](https://github.com/n8n-io/nod/commit/9be6b2465dd5a35cf5e0f9ba101deedcac2e342b)  
**Commit:** `fix(trust): preserve owner instructions across schedule updates (#888)`

## Question

How should a recurring agent preserve and revalidate owner authority when a schedule is created, edited repeatedly, migrated, or run after the original conversation has changed?

## Source observation

Nod is a local personal agent that performs work in connected applications and on websites. Its README says server-side trust checks compare effectful actions with the owner's request and rules, and that schedules can run recurring work. The reviewed change replaces a narrow schedule-instruction representation with an ordered `OwnerInstructions` record containing source messages, timestamps, whether each message may authorize, exact replied-to assistant proposals, edited fields, and separately identified approved schedule definitions.

The source-level policy is deliberately non-monotonic. Later corrections change only what they address; unchanged limits remain. A later request to summarize can remove an earlier send grant, a recipient replacement removes the earlier recipient, and metadata changes such as timing or title do not grant new outside work. Background messages may identify references or constraints but cannot authorize effects. An approved one-off action is not automatically recurring permission.

Schedule updates merge evidence by stable message or approval identity rather than flattening the history into a new prompt. The implementation validates that referenced messages still belong to the owner and remain visible and unwithdrawn. If a source message was withdrawn, or a legacy schedule contains changes without recoverable source records, execution fails with `owner_instruction_unavailable` until the owner supplies a complete replacement. Direct owner-written prompt replacement creates a fresh complete instruction rather than pretending incomplete legacy context is authoritative.

The reviewed change also guards the instruction-update transaction itself. Before applying a checked change, Nod revalidates the current chat revision, owner rules, and task revision. If any changed during the trust decision, the earlier change does not run. Each schedule run stores the authority record used for that revision, so later schedule edits do not rewrite the provenance of an already-created run.

Project-authored tests in the commit cover repeated updates without duplicating the same source message, retention of the original request after many corrections, run-level snapshots that remain unchanged after later edits, restart persistence, withdrawn-source rejection, exact assistant-proposal capture for short replies, approval-only schedules, task-scoped context, migration without invented context, and fail-closed local-file access when scheduled owner evidence is missing or incomplete.

## Reusable pattern

A durable schedule definition is not itself sufficient authorization evidence. Keep a separate, revisioned authority record with:

1. **Source identity:** exact owner message or authenticated approval identity, timestamp, and relevant replied-to proposal.
2. **Authorization role:** which inputs can authorize and which are background context only.
3. **Change semantics:** explicit replacement versus a narrow correction; preserve every restriction not changed by the owner.
4. **Run binding:** snapshot the effective authority record onto each run so later edits cannot retroactively alter why that run was allowed.
5. **Revocation validation:** recheck that cited sources remain available and unwithdrawn before effects.
6. **Decision freshness:** bind the trust decision to current task, conversation, rules, and schedule revisions; reject on intervening change.
7. **Migration honesty:** when historical changes cannot be tied to source records, require replacement rather than reconstructing permission from plausible text.

This complements [Account provisioning is not standing operational authority](./2026-09-16-account-provisioning-is-not-standing-operational-authority.md): explicit recurring grants are necessary, but Nod adds the harder update problem—later schedule edits must preserve, narrow, replace, or invalidate prior authority with exact provenance. It also complements [Concurrent agents need request-local authority, not mutable manager state](./2026-11-09-mercury-immutable-permission-contexts.md): immutable request-local authority prevents cross-turn leakage, while revisioned owner evidence determines what authority a recurring turn should receive in the first place.

## Evidence boundary

This is static inspection of one large commit: 36 changed files, 2,872 additions, and 597 deletions according to GitHub's commit API. Scout read the README, commit metadata, the new owner-instruction implementation, and relevant visible diff/test sections, but did not clone or install Nod, run its tests, inspect every changed line, exercise connected applications or websites, or verify a deployed build. The checked-in tests are project-authored regression evidence, not an independent security assessment. The implementation still relies on the correctness and complete mediation of Nod's message, task, schedule, trust, and effect paths; this assessment does not establish that every external effect consults the new evidence correctly.

## Discovery evidence

A live GitHub Repository Search API query for `topic:ai-agent pushed:>=2026-11-14 stars:>10`, sorted by updated descending with `per_page=30`, returned HTTP 200, `incomplete_results=false`, and 609 matches. The bounded result surfaced `n8n-io/nod`; its reviewed commit was authored at `2026-11-14T18:15:52Z`. Search across the Scout library found related authority and approval findings but no prior source record for `n8n-io/nod` or this schedule-update provenance mechanism.
