# Feature Reference Loop

## Purpose

`aks-feature-reference-loop` is a normal workflow-bound task that iterates over
AKS feature packets and collects public, official reference material for each
feature. The loop exists because Go scenario tests are useful implementation
signals, but they are not the whole feature contract. The feature model needs
authorized API and product documentation references so test failures can be
classified against expected behavior instead of only against current test code.

The loop collects:

- feature definition and intended usage,
- supported inputs and constraints,
- unsupported or deprecated behavior,
- behavior expectations that scenario tests should assert,
- Azure REST API contract references,
- Microsoft Learn usage and behavior references,
- contradictions or gaps against existing specs, scenario tests, or feature
  packets.

## Authority

The loop treats these as authoritative public sources:

- Microsoft Learn documentation under `learn.microsoft.com`;
- Azure REST API specs under `Azure/azure-rest-api-specs`;
- existing repo feature packets, specs, model files, and scenario tests as
  local context, not as public authority.

Generated output is draft material. The loop writes generated drafts under
`evidence/archive/` first, matching the `features/` folder rule for generated
or one-off investigation material. A separate review task can later promote
stable references into the feature-owned layout:

```text
features/<capability>.yaml
features/<capability>/specs/*.json
features/<capability>/packets/*.yaml
features/<capability>/notes/*.md
```

## Workflows

The task tree stays the control plane.

- Parent task workflow: `feature-reference-loop-controller`
- Child task workflow: `feature-reference-collector`
- Default parent task id: `aks-feature-reference-loop`
- State file: `.state/feature-reference-loop/state.json`

The controller keeps a bounded frontier of child collector tasks. It uses the
same generic `context.workflowProgress` guard as other workflow-bound tasks:
when the state still has pending or running features, normal task completion is
blocked. Replacement or cancellation still works when intentionally closing a
loop.

The collector handles one feature packet. It should produce a draft reference
packet and update the loop state through the parent state file. A collector may
finish as:

- `done`: draft packet written;
- `blocked`: official source search needs human or tooling help;
- `error`: workflow or extraction failed.

## Feature Folder Layout

A capability owns its root packet, executable specs, branch/source packets, and
stable notes:

```text
features/<capability>.yaml              # capability packet
features/<capability>/specs/*.json      # executable specs
features/<capability>/packets/*.yaml    # preferred branch/source packets
features/<capability>/notes/*.md        # stable notes
```

During migration, root `specs/*.json` and branch packets directly under
`features/<capability>/*.yaml` still exist and remain readable. New stable
branch/source packets should prefer `features/<capability>/packets/*.yaml`.

## Queue Source

The queue follows the feature-owned layout:

- `features/*.yaml` for capability root packets and migration-era root feature
  packets;
- `features/<capability>/packets/*.yaml` for preferred branch/source packets;
- `features/<capability>/*.yaml` for legacy direct branch packets during
  migration.

The loop queues only schema-level feature/capability packets. A queued branch
packet must declare `featureId`; a queued capability packet must declare
`capabilityId` or, for migration-era root packets, `featureId`. Source packets,
investigation packets, generated notes, Markdown investigations, JSON specs,
and files under `notes/` and `specs/` are supporting context, not independent
feature queue items.

Each queue item records:

- `featureKey`: stable work key; this is the packet's `featureId` or
  `capabilityId`;
- `packetPath`: repo-relative packet path;
- `packetKind`: `capability` or `feature`;
- `layout`: `capability-root`, `branch-packet`, `legacy-branch-packet`, or
  `migration-root-feature`;
- `capabilityId`: owning capability when known;
- `coveredFeatureIds`: known feature ids when present.

## Draft Packet Shape

Collectors write Markdown drafts named:

```text
evidence/archive/feature-reference-<featureKey>-<YYYYMMDD>.md
```

Each draft has the same sections so review and later promotion can be
mechanical:

- Feature
- Existing Packet
- Official API References
- Official Documentation References
- Behavior Expectations
- Supported Inputs And Constraints
- Unsupported Or Deprecated Behavior
- Usage Scenarios
- Gaps And Contradictions
- Recommended Model Or Spec Updates

Stable feature packet updates use existing schema fields:

```yaml
groundTruth:
  api:
    - path: <Azure REST API spec reference>
      claim: <what the API proves>
  userDocs:
    - path: <Microsoft Learn reference>
      claim: <what the doc proves>
knownContradictions: []
gaps: []
judgmentRules:
  implementationIssueWhen: []
  testIssueWhen: []
  environmentIssueWhen: []
```

Promotion should keep the ownership boundary:

- capability-wide references go into `features/<capability>.yaml`;
- branch-specific references go into `features/<capability>/packets/*.yaml`;
- migration-era direct branch packets under `features/<capability>/*.yaml`
  should move to `packets/` when promoted, unless there is a deliberate
  compatibility reason to keep them in place.

## Local Testing Before Live Start

The workflow must be testable locally before starting the long-running task.
The collector supports `referenceFixtureDir` in task context. In fixture mode it
does not call the network. It scans:

```text
<referenceFixtureDir>/learn/
<referenceFixtureDir>/azure-rest-api-specs/
```

and writes the same draft packet shape from local fixture documents. This lets
tests verify:

- controller creates bounded collector children;
- child tasks include the parent state file and source authority requirements;
- collector extracts Learn and REST API references from fixtures;
- state transitions to `done` and records the output path;
- `workflowProgress.completionReady` remains false while queue items are still
  pending.

The live task should not be seeded or started until the fixture-backed workflow
test passes.
