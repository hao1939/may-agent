# Preserved pre-purpose layout — historical and diagnostic inputs

This is an archive, **not an active case catalog or a second owner**. The active
rule is one case, one purpose benchmark, one folder. See the
[current organization](../../docs/cases-benchmarks-and-agents.md).

## What is preserved

- The complete former global `scenarios/` tree, including 616 runnable legacy
  definitions plus partial/non-runnable historical material.
- The eight original benchmark folders, including original suite versions,
  case bodies, fixtures, evaluator overlays, graders and label records.
- The prior project/benchmark overviews, core selection and organization guide.
  These documents describe the old layout; their relative links are historical.
- `case-owners.json`, a migration report mapping the 119 originally registered
  active case IDs to their new purpose owners. It is not read as an active registry.

Historical `.state/benchmarks/` runs and their frozen definitions/results remain
at their original locations. Nothing here retroactively changes their meaning.
The ignored compiled `dist/` packages are still generated from source, not a
second archived runtime. Original benchmark definitions that point to compiled
packages are historical references, not promises of an independently runnable
archive checkout.

## Active destinations

| Original benchmark | Current purpose owner(s) |
| --- | --- |
| `may-alignment` | `intent-and-follow-through` |
| `may-app-outcome-management` | `outcome-coordination` |
| `core-behavior` | `verified-code-work` |
| `may-judgment` | `authority-and-scope`, `adoption-and-simplicity` |
| `alex-judgment` | `outcome-completion` |
| `bob-judgment` | `authority-and-scope`, `adoption-and-simplicity` |
| `tech-lead-judgment` | `authority-and-scope`, `repair-and-verification` |
| `scout-judgment` | `research-evidence` |

Case IDs and resolved assignments, fixtures, expected outcomes, semantic rubrics,
examples and review records were preserved. Inherited inline task instructions
were made explicit inside their new benchmark-local bodies. Old delegation-only
case scorer wrappers were removed from the active copies in favor of explicit
suite evaluator bindings; their original bytes remain here.

The active `intent-and-follow-through` label catalog contains only its 78 active
cases. Twelve additional labels for retired cases remain unchanged in this
archive rather than appearing as active pending review. All 17 core labels remain
draft. No new approval, baseline or model evidence was created by moving files.

## Compatibility boundaries

One-to-one old benchmark commands resolve through the active
`benchmarks/compatibility.json`. Agent-named collections are retired: select the
purpose benchmark explicitly and start a fresh baseline. Even a one-to-one name
mapping does not authorize comparison against different frozen definitions.

`gym list --legacy`, `gym show <legacy-id>` and the `scenario:*` scripts keep old
inputs available for diagnostic compatibility. `gym run <legacy-id>` may make
model calls and is not active benchmark coverage. Curating an archived case into
active use requires one deliberate purpose owner, valid definitions and the
appropriate review—not a cross-benchmark reference or automatic registration.

`bun run scenario:validate` (inside Gym) validates the preserved legacy corpus.
Metadata/partial-case warnings are retained history, not concealed by migration.
Deterministic migration tests reconstruct all 119 old resolved cases and compare
their tasks, fixtures, expectations, semantic files, metadata and per-case approval
records to the new owners. Those checks do not approve the expectations.

See the [migration check](MIGRATION-CHECK.md) for preservation and clean-checkout
checks, including the limits of the two pre-existing archived Gitlinks. These
checks did not run models or approve expectations.

The relocated intent benchmark canary keeps its old approval provenance, but
**automatic scheduling is disabled** until fresh baseline/review.
