# Scout Autonomous Artifact Integrity Loop

**Status:** Historical implementation and rollout record. Current behavior is
defined by `../scout-knowledge-library-process.md`.

**Scope:** Prevent and autonomously repair Scout finding-path and digest-identity
collisions.

**Does not change:** May task types, the generic reconciler, database schema,
source schedules, agent/app boundary, library layout, or ownership model.

## Problem

Scout is autonomous for source exploration, but the library is not yet
self-correcting when two runs choose the same finding identity.

The observed failure is concrete:

- two GitHub runs selected `2026-07-20-github-scan-536.md` for different
  findings;
- the later write replaced the earlier file;
- the digest retained both `GitHub Scan #536` sections; and
- the task still converged because the new exact-source admission check detects
  duplicate sources, not replacement of a distinct existing artifact.

The task tree is healthy, but a healthy task tree does not prove a coherent
library. Waiting for a human or evaluator message leaves the quality loop only
partly autonomous.

## Decision summary

Use the components already present, with one host-level safety prerequisite:

```text
May fences any executor from an older runtime
  -> Scout runs one shared-library writer at a time
  -> scout-explore prevents an avoidable target collision
  -> library-health detects any surviving identity mismatch
  -> existing project.owner.requested(reason=library-health-signal)
  -> existing library-maintenance task
  -> knowledge-planner repairs one bounded collision
  -> next health observation proves the fact closed
```

Add no new agent, controller, maintain task, database table, artifact registry,
archive directory, or cleanup daemon.

Set the Scout app budget to `maxConcurrent: 1`. Source lanes write the same
knowledge tree and digest, so parallel task execution is not safe or useful
inside one Scout app instance. This is the concurrency boundary, not a new
queue or lock service.

May must not recover a task while its older executor can still write. Recovery
must first cancel or fence that executor. This is a generic autonomous-host
invariant and remains outside Scout's workflow. Scout must not import May
runtime APIs to solve it.

## 1. Prevent avoidable collisions during exploration

Refine the existing `scout-explore` task instructions:

1. search existing knowledge before choosing an output;
2. prefer updating an existing finding only when it represents the same
   subject and retains its existing primary sources;
3. before creating a finding, inspect the target path and choose an unused
   path;
4. use a descriptive topic slug rather than treating a scan number as a shared
   allocator; and
5. read every changed output back before returning it.

Examples:

```text
good:  findings/2026-07-21-agent-command-preflight.md
bad:   findings/2026-07-21-github-scan-537.md chosen only because 536 exists
```

Numbered historical files remain valid. This rule changes new output choice;
it does not rename the existing library in bulk.

The workflow retains a pre-run map of existing admitted output paths to their
explicit primary-source declarations (`Source:` and `Repo:`). If a run reports
an existing file and any previous primary source is absent afterward, reject
convergence with typed `existing-output-replaced` evidence.

This check is evidence, not concurrency control. Two writers can both inspect
the same free path. Serialization and May's recovery fence prevent that race;
the post-run comparison catches a surviving integrity failure.

This is detection, not rollback. Do not restore a pre-run copy automatically:
a concurrent legitimate update may have changed the same file, and blind
restoration could destroy newer work. The normal result is visible task
attention followed by the bounded maintenance path below.

## 2. Observe artifact identity as a library fact

Extend the deterministic `library-health` observer with one fact kind:

```text
artifact-identity-collision
```

The observer checks only explicit identities already present in current domain
files:

- finding frontmatter titles such as `GitHub Scan #536`;
- matching digest headings; and
- their date and source when declared.

A collision exists only when one `(source, date, explicit scan ID)` maps to
more than one distinct title. The observer reads current findings, the working
digest, and the most recent dated digest so rollover cannot hide a collision.
Repeated mentions of the same title are not a collision.

The fact contains bounded evidence:

```json
{
  "kind": "artifact-identity-collision",
  "subject": "github:2026-07-20:536",
  "observedValue": 2,
  "evidence": {
    "findingPaths": ["knowledge/findings/2026-07-20-github-scan-536.md"],
    "digestHeadings": [
      {
        "path": "agents/scout/workspace/digest/today.md",
        "heading": "GitHub Scan #536 — Exo-Agent Control & Shared Memory"
      },
      {
        "path": "agents/scout/workspace/digest/today.md",
        "heading": "GitHub Scan #536 — Agent Memory Encryption & Command Preflight"
      }
    ]
  }
}
```

Use exact parsing only. Do not add semantic similarity, redirect resolution,
or fuzzy title matching.

The existing health history already suppresses unchanged repeated wakes. A new
collision wakes Scout immediately; an unchanged collision follows the normal
bounded review interval. No new metric or alert is required.

## 3. Repair through the existing maintenance owner

The existing health workflow already emits:

```text
project.owner.requested(reason=library-health-signal)
```

The existing resolver already maps that event to `library-maintenance`, and
`knowledge-planner` already owns the smallest useful library repair. Keep that
path. Declare the working digest as an exact `library-maintenance` output so
the workflow has explicit authority to repair it.

For `artifact-identity-collision`, the planner should:

1. inspect every current finding and digest section named in the fact;
2. preserve every distinct source-grounded finding that still has recoverable
   evidence;
3. assign descriptive, unused topic paths and headings;
4. repair digest references without inventing missing prose;
5. report an exact unresolved evidence gap when overwritten content cannot be
   recovered from current Scout-owned artifacts; and
6. read the repaired files back and verify that the exact collision no longer
   exists.

One health wake repairs one bounded collision. It must not become a broad
historical renaming pass.

An unresolved repair attempt may converge as a bounded maintenance attempt, but
it must not claim the integrity fact is closed. The fact remains observable and
will be reviewed again by the existing health cadence.

The current scan-536 incident may use an operator-prepared extract from the
existing Scout session transcript as recovery evidence. Reading infrastructure
session history is a one-off recovery action outside Scout's normal execution
flow, not a runtime dependency for Scout.

## 4. Preserve the behavior in Gym

Add one focused Scout scenario:

```text
an existing finding path contains a different source-grounded finding
  -> Scout opens and preserves the existing file
  -> Scout chooses an unused descriptive path for the new finding
  -> both source sets remain present
  -> digest headings are distinct
  -> Scout reads the new output back before success
```

Use deterministic pass/fail checks:

- original finding remains byte-for-byte unchanged;
- one new finding exists at a different admitted path;
- both primary `Source:`/`Repo:` declaration sets remain present; ordinary
  repeated links within one section are allowed;
- no duplicate explicit digest identity exists; and
- the transcript proves target inspection and read-back.

Do not add an LLM judge or Scout-specific runner.

## 5. Rollout and verification

Apply in this order:

1. ensure May fences an older recovery executor before it retries a task;
2. serialize Scout task execution;
3. add the preventive exploration instruction and replacement admission;
4. give maintenance explicit digest output authority;
5. add the exact deterministic health fact and focused unit tests;
6. recover and split the current GitHub scan-536 collision from prepared
   evidence;
7. add and run the Gym scenario;
8. deploy when no Scout reconciliation is active;
9. invoke the existing `health-check` action once; and
10. observe one natural GitHub cycle.

Acceptance:

- the two current GitHub findings exist under distinct paths and headings;
- the digest contains distinct headings and retains both source sets;
- `library-health` reports no artifact-identity collision after repair;
- a deliberate fixture collision produces one owner wake;
- the existing `library-maintenance` resource repairs or precisely reports the
  bounded gap and returns to `converged`;
- the Gym scenario passes;
- the next natural GitHub event produces one current reconciliation result;
- no existing finding is silently replaced; and
- task-tree integrity remains empty.

## Non-goals

- no globally allocated scan sequence;
- no artifact registry or database index;
- no automatic rollback of concurrent files;
- no semantic deduplication service;
- no second maintenance task;
- no archive/history directory; and
- no broad renaming of historical findings.

## Resulting invariant

Scout remains a standalone agent with filesystem tools. May only schedules and
serializes work, prepares trigger context, and fences recovery. Integrity is
proved from Scout-owned artifacts by deterministic workflow code, and repair
continues through the existing Scout maintenance workflow.
