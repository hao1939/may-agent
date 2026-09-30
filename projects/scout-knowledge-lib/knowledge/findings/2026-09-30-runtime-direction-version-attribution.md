<ai_context>
summary: "Kyno models an organization's mission and tradeoff principles as versioned runtime direction that agents pull at step boundaries. Its useful pattern is to preserve content version, retrieval status, and delivery receipt separately; a current version can be pulled, stale-but-cached, or absent, while delivery still does not prove compliance, completion, permission, or policy enforcement."
triggers: ["Kyno", "runtime direction", "constitution version", "direction receipt", "cached instruction", "agent mission update"]
last_updated: "2026-09-30"
source_basis: "HN item 49911977, complete Kyno product page, and static inspection of cizambra/kyno documentation, SDK pull policy, integration tests, recovery tests, and repository tree at pinned revision e06bb1d2287d12600015f4116e3c0377f698d4a6. Scout did not install or run Kyno, execute its test suite, inspect a deployed server, or evaluate agent behavior under changed direction."
</ai_context>

# Runtime direction needs version, retrieval status, and use attribution

**Date:** 2026-09-30  
**Disposition:** New knowledge  
**Source:** https://news.ycombinator.com/item?id=49911977  
**Product page:** https://cizambra.github.io/kyno/  
**Repo:** https://github.com/cizambra/kyno  
**Inspected revision:** [`e06bb1d2287d12600015f4116e3c0377f698d4a6`](https://github.com/cizambra/kyno/commit/e06bb1d2287d12600015f4116e3c0377f698d4a6)

## Question

What is useful about treating organizational direction as a runtime primitive, and what evidence is required to know which direction an agent actually used?

## The useful separation

Kyno separates three concerns that prompt-centric systems often blur:

- a **task instruction** says what a step should do;
- a **policy or permission** limits what actions are allowed; and
- **direction** states the mission and principles for judging tradeoffs within those limits.

An operator applies a named constitution containing a mission and ordered principles. Each change appends a version. An adapter pulls the current version before an execution boundary and supplies a rendered block to the model. This allows an organization's objective to change while a workflow's task remains the same.

The architectural signal is not the word “constitution.” It is making mutable guidance a separately named, versioned input rather than silently editing global prompt text. A run can then identify the exact guidance revision it received, and recovery can append known-good content as a new revision without pretending that earlier work was rewritten.

## Currentness is a per-read property

The SDK exposes three binding states:

- `pulled`: a successful read confirmed the returned version at that boundary;
- `cached`: a pull failed or an older overlapping response arrived, so the binder retained a prior value; and
- `empty`: no direction had been cached when the read failed.

The default policy is fail-open: a failed pull can return cached or empty direction. `PullPolicy(fail_closed=True)` instead raises before downstream work. The inspected LangGraph integration tests assert that fail-closed prevents the work node from running and that binding status survives checkpoint serialization. The tests also preserve the distinction between a resumed checkpoint and a fresh pull: resuming without another pull does not relabel old direction as newly confirmed.

This yields a reusable rule: **content version and retrieval status are independent fields**. “Version 7” does not by itself say whether version 7 was successfully read for this step, reused from cache after an outage, or restored from a checkpoint. Conversely, `pulled` establishes freshness only at the instant of that read; it does not promise that the version stayed current afterward.

## Delivery is not use, compliance, or authority

Kyno can record a delivery and return a `record_id`, but its documentation explicitly limits the receipt. It identifies the response that supplied direction. The application must associate that response with its own model call, output, or step. A cached fallback retains the earlier delivery receipt; that receipt does not describe the later failed attempt.

Even a correctly linked receipt establishes only that specified direction was supplied. It does not prove that the model followed it, that the call completed, that an external effect occurred, or that the action was permitted. Kyno's direction guides judgment; application policy and authorization controls still enforce boundaries.

A robust run record should therefore keep separate:

1. constitution identity and content version;
2. binding status (`pulled`, `cached`, `empty`, or unknown);
3. delivery-record identity when available;
4. the application's step or model-call identity;
5. permission/grant evidence for consequential actions; and
6. outcome and effect-verification receipts.

Collapsing those fields into “used latest policy” creates an unsupported claim.

## Recovery preserves history but not past effects

Kyno's documented recovery procedure reads reviewed historical content and applies it as a new version. Its end-to-end recovery test checks that versions 1 and 2 remain while the restored content becomes version 3. The documentation also warns that revoking credentials does not clear cached direction, in-flight work is not rewritten, and restoring content does not repair outputs or effects produced under the bad version.

Operationally, affected work must be found by matching application receipts to constitution and version, then inspecting associated step and effect records. Without that linkage, server request logs can only bound when reads occurred; they cannot establish which version every model call received because cached direction may be used without another successful server request.

## Evaluation boundary

The pinned source contains concrete documentation and tests for versioned reads, binding status, fail-open/fail-closed behavior, checkpoint preservation, and append-only recovery. Scout inspected those artifacts statically but did not execute them. They support an inspectable contract, not evidence that changing principles predictably changes model decisions or improves task outcomes.

The project does not solve semantic evaluation: applications still need scenario-based tests for conflicts, ambiguous principles, delayed updates, stale caches, and behavior under an unavailable direction service. It also does not turn principles into enforcement. A versioned advisory block remains advisory unless a separate authoritative control applies the relevant policy.

## Comparison with existing Scout knowledge

This complements [prompt routing's policy/enforcement/scheduling split](./2026-09-29-prompt-routing-policy-enforcement-scheduling.md). That note shows why injected instructions do not enforce target selection or scheduling. Kyno addresses a different question: how to identify and update the organizational guidance supplied at an execution boundary. Together they imply that provenance for advisory context is useful, but should never be promoted into an enforcement or outcome claim.

## Sources reviewed

- [HN item 49911977](https://news.ycombinator.com/item?id=49911977)
- [Kyno product page](https://cizambra.github.io/kyno/)
- [Runtime direction documentation](https://github.com/cizambra/kyno/blob/e06bb1d2287d12600015f4116e3c0377f698d4a6/docs/direction.md)
- [Adapter behavior and binding status](https://github.com/cizambra/kyno/blob/e06bb1d2287d12600015f4116e3c0377f698d4a6/docs/adapters.md)
- [MCP contract](https://github.com/cizambra/kyno/blob/e06bb1d2287d12600015f4116e3c0377f698d4a6/docs/contract.md)
- [Recovery procedure](https://github.com/cizambra/kyno/blob/e06bb1d2287d12600015f4116e3c0377f698d4a6/docs/recovery.md)
- [LangGraph direction checkpoint tests](https://github.com/cizambra/kyno/blob/e06bb1d2287d12600015f4116e3c0377f698d4a6/tests/surface/integration/test_direction_checkpoints.py)
- [Recovery end-to-end tests](https://github.com/cizambra/kyno/blob/e06bb1d2287d12600015f4116e3c0377f698d4a6/tests/core/e2e/test_direction_recovery.py)

## Discovery coverage

The live HN Algolia `search_by_date` query for `AI agent` stories newer than Unix time `1790782656` returned 10 items: 49911977, 49911914, 49911878, 49911747, 49911737, 49911459, 49911411, 49911111, 49911044, and 49910856. Kyno was selected because its open repository exposed a concrete contract for versioning, retrieval state, checkpoint attribution, and recovery. The other results were news, product announcements, opinion pieces, or proposals with weaker inspectable evidence for a distinct reusable finding in this bounded scan.
