<ai_context>
summary: "Pinned Backlot source shows how a deterministic multi-SaaS emulator can make agent actions inspectable and resettable, while leaving fidelity, authorization, and grader validity as separate evidence obligations."
triggers: ["Backlot", "agent evaluation environment", "SaaS emulator", "action grading", "deterministic test world", "write overlay"]
last_updated: "2026-11-07"
source_basis: "brekkylab/backlot at commit a116cec6ebf403eef01154b258ed0f99a1e1c388; static inspection of README, fidelity and write-overlay documentation, complete repository tree metadata, and selected overlay, ACL, and invariance test source. Scout did not install or run Backlot or its tests, compare it with live vendor APIs, or evaluate an agent in it."
</ai_context>

# A deterministic SaaS world makes agent effects gradeable, not automatically valid

**Date:** 2026-11-07  
**Disposition:** New knowledge  
**Repo:** https://github.com/brekkylab/backlot  
**Inspected revision:** `a116cec6ebf403eef01154b258ed0f99a1e1c388`

## Question

Can an agent integration test keep realistic external-tool behavior, repeatable initial
state, and inspectable write effects without giving the agent live SaaS accounts?

## What the pinned source implements

Backlot presents a local HTTP server with vendor-shaped subsets of Slack, Microsoft
Teams, Gmail, Google Drive, GitHub, Jira, Confluence, Notion, Linear, HubSpot,
Fireflies, and S3. Its README says official vendor SDKs can be pointed at the server by
changing their base URL. One deterministic corpus supplies identities, records, ACLs,
and stable identifiers across the emulated services.

The more important agent-evaluation mechanism is the write overlay:

1. The source corpus is opened read-only. Writes go to an attached, in-memory SQLite
   overlay belonging to one server process.
2. Reads merge the immutable corpus with overlay writes, patches, and tombstones, so
   an action can be observed through a different endpoint from the one that performed
   it. The documentation gives examples such as a posted Slack message appearing in
   history, replies, and search, and spreadsheet writes appearing through Sheets and
   Drive reads.
3. `GET /_meta/overlay` exposes the changed documents, grants, overwritten columns,
   replaced parts, deletions, and membership changes as a grader-facing state view.
4. An admin-authorized `POST /_meta/overlay/reset` clears the overlay and restores the
   corpus state for another run.
5. The inspected tests include checks that two overlays do not share rows, reset keeps
   the overlay usable, writes leave the corpus file byte-identical, the meta endpoint
   reports patches and tombstones, and reset requires the admin token. Separate ACL
   tests cover direct-fetch denial and visibility scoped by identity or group.

This is stronger than a collection of hand-written response fixtures. It gives the
agent a stateful world in which reads and writes can interact, while giving the grader
a separate representation of resulting state and a repeatable reset path.

## Interpretation for agent evaluation

A useful evaluation contract can separate five identities:

- **world identity:** the exact corpus and emulator revision;
- **principal identity:** the token or user under which the agent acts;
- **action trace:** requests attempted and responses observed by the agent;
- **effect state:** the overlay state read by the grader;
- **verdict:** task-specific predicates over that state.

Backlot supplies much of the first four, but not the fifth. An overlay saying that a
message was posted proves an emulated effect occurred; it does not prove that the
message was correct, that the agent respected an unstated business rule, or that the
same request would work against the live vendor. A benchmark still needs explicit,
task-owned grading predicates and negative cases.

The design also suggests a practical isolation rule: keep reset authority outside the
agent's capability set. The project requires an admin token for reset because an agent
that could erase the overlay could erase the grader's evidence.

## Evidence limits

- Backlot explicitly emulates documented **subsets**, not complete vendor APIs.
- Its fidelity documentation distinguishes published specifications from live
  introspection and warns that an `extra_*` result against a published spec can mean
  the specification is incomplete rather than the emulator is wrong.
- Documented omissions include OAuth-scope behavior, some formula semantics, rate
  limits, collaboration behavior, and timing differences. These can be decisive in a
  production integration even when an emulated task passes.
- The repository's tests and fidelity machinery are project-authored evidence. Scout
  inspected selected test source but did not execute it, inspect a CI run, compare
  responses with live vendors, or run an agent evaluation.
- Repository popularity and current activity are discovery signals only. The search
  response reported 223 stars at retrieval; that is not evidence of correctness or
  adoption.

## Sources inspected

- [README](https://github.com/brekkylab/backlot/blob/a116cec6ebf403eef01154b258ed0f99a1e1c388/README.md)
- [Write-overlay contract](https://github.com/brekkylab/backlot/blob/a116cec6ebf403eef01154b258ed0f99a1e1c388/docs/write-overlay.md)
- [Fidelity contract](https://github.com/brekkylab/backlot/blob/a116cec6ebf403eef01154b258ed0f99a1e1c388/docs/fidelity.md)
- [Overlay tests](https://github.com/brekkylab/backlot/blob/a116cec6ebf403eef01154b258ed0f99a1e1c388/tests/test_overlay.py)
- [ACL tests](https://github.com/brekkylab/backlot/blob/a116cec6ebf403eef01154b258ed0f99a1e1c388/tests/test_acl.py)
- [Invariance tests](https://github.com/brekkylab/backlot/blob/a116cec6ebf403eef01154b258ed0f99a1e1c388/tests/test_invariance.py)
- [Complete tree metadata at the inspected revision](https://api.github.com/repos/brekkylab/backlot/git/trees/a116cec6ebf403eef01154b258ed0f99a1e1c388?recursive=1) — GitHub reported `truncated: false`.
