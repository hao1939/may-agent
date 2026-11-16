# Running one improvement stage manually

The [trial plan](standalone-improvement-plan.md) defines the milestones. The
entry point at `projects/alex.app/scripts/standalone-stage.ts` calls the public
SDK `run()` and retains evidence. It creates no Host Task or schedule.

## Prepare an isolated invocation

Use an external linked Git worktree with `.state/` ignored. Both `cwd` (where
tools execute) and `projectRoot` (where App definitions are discovered) must be
linked worktrees. They may be the same worktree. Make its existing dependencies
available and pin its SDK source or installed artifact; the receipt identifies
the SDK actually resolved by the runner.

Save a JSON configuration. Paths resolve relative to the configuration file:

```json
{
  "target": "alex/diagnose-improvement",
  "input": { "baselineDir": "inputs/captured-run" },
  "task": {
    "outcome": "Diagnose the captured run and select a bounded next action",
    "acceptance": ["Separate execution failures from behavior and missing evidence"],
    "constraints": ["Diagnosis only; preserve captured evidence"]
  },
  "cwd": "/root/workspace-worktrees/alex-manual",
  "projectRoot": "/root/workspace-worktrees/alex-manual",
  "outputRoot": "invocations/diagnosis-001",
  "timeoutMs": 120000
}
```

Use a fresh `outputRoot` for each invocation. Existing directories are rejected
to preserve earlier evidence. A later invocation may reuse the same working
candidate and valid development evidence in its ignored `.state/`.

For prompt Alex scope selection, set `target` to `alex`, make `input` the explicit
diagnosis/scope prompt, and use `tools: "readonly"`. For a selected development
change, use `target: "alex/develop-change"` with private input
`{ "verify": ["bun", "test", "./path/to/focused.test.ts"] }`; its outcome and
acceptance belong in `task`.

Optional `outputSchemaFile` supplies the caller's JSON result schema. Optional
`fixtureFile` names a local TypeScript module exporting `agentFixtures`, using the
SDK's `DirectAgentFixtureHandler` contract. Its presence explicitly selects
fixture mode; omission runs the configured live models. Fixtures can override
selected specialists while leaving real Git and verification intact.

## Run and observe

From the worktree with the pinned SDK:

```bash
bun projects/alex.app/scripts/standalone-stage.ts /absolute/path/to/stage.json
```

The command prints the evidence directory at startup and the final receipt path
at completion. Inspect `events.jsonl` while it runs. Send Ctrl+C to cancel;
cancellation flows through the SDK's execution allowance and cleanup path.

| File | What to inspect |
| --- | --- |
| `config.json`, `input.json`, `task.json` | Resolved invocation input and standalone Task identity |
| `provenance.json` | Source commits/working status, runner hash, SDK path/hash and fixture identity |
| `events.jsonl` | Timestamped steps, logs, notices and completion |
| `trace/run.json` | SDK execution report, limits and cleanup |
| `result.json` | Full result and child-session transcript paths |
| `receipt.json` | Running/final status, elapsed time, exit code and evidence references |
| `error.json` | Runner/setup error after the evidence directory was created, if any |

Early invalid configuration or worktree errors fail before creating an invocation.
SDK drift or unconfirmed cleanup prevents a success receipt. Exit codes are `0`
for a done stage, `2` for blocked, `130` for interruption and `1` for error.
A done diagnosis can contain an insufficient-evidence decision; successful stage
execution is separate from candidate readiness or completion of the whole cycle.

Results retain the authored workflow's output shape. Diagnosis currently stores
the proposal at `result.result.output.output`; its metadata is alongside that
proposal. Keep this distinction when inspecting raw JSON rather than flattening
every workflow into a new result contract.

Review child-session trails for model usage/cost where exposed. Missing usage
remains unknown. Fixtures establish mechanics, not live model quality, and a
standalone result does not settle any existing Host Task.

## Hand off evidence from a hosted trial

Choose a retained output location before starting a hosted experiment. Promised
evidence must live outside its disposable Task worktree or in durable public
records. A clean hosted worktree can be removed at settlement, including ignored
`.state/` files. For manual invocations inside such a worktree, put `outputRoot`
outside it when the caller needs the evidence afterward.

Keep one compact cycle record that links the agreed objective and hypothesis,
input/source identities, actual executions, supporting artifacts, owner decision
and limits, time/cost scope, manual interventions and next owner/action. Bind
local evidence links to file hashes and give direct JSON pointers or exact public
raw-line references where ordinary previews are truncated. Historical execution
paths identify where work ran; label absent paths and reference surviving evidence.
Report full Task estimates separately from specialist-only usage and unknown
billing. A retained recommendation does not commission the suggested target edit.

Before finishing, read back the record and verify its live artifact references.
Resolve each declared JSON pointer against the referenced document as well as
checking its file hash, and derive record/validation timestamps from the clock.
Return its absolute path and hash in the accepted Task result. The caller then
checks the record after Task closure, using only it and its direct evidence links.
Preserve failed/inconclusive results and distinguish transcript recovery from
original artifact copies. This is an evidence handoff check; it does not establish
unattended recovery or improved target behavior.

## Recover a development invocation manually

The runner creates a fresh invocation and does not restore a previous Task
result automatically. A stable Task id alone does not restore development
evidence. The SDK accepts a full `TaskDetail` through the JSON `task` field;
use that envelope from the first invocation when testing recovery:

```json
{
  "id": "standalone/manual-development",
  "parentId": "root",
  "generation": 1,
  "status": "running",
  "outcome": "Review and verify the existing candidate",
  "acceptance": ["The candidate satisfies the assigned executable check"],
  "input": {
    "kind": "goal",
    "data": {
      "outcome": "Review and verify the existing candidate",
      "acceptance": ["The candidate satisfies the assigned executable check"],
      "constraints": ["Preserve existing work; return local evidence"]
    }
  },
  "conditions": [],
  "acceptedEvidence": { "available": false, "maxPageSize": 8 }
}
```

After a development invocation returns retained evidence, select that invocation
as the checkpoint. Its `result.json` contains the Task result at
`result.output`; the reusable development delivery is under
`result.output.result.development`. Put the prior `result.output.result` in the
full Task's `result` field. Preserve its id, requirements, generation, working
directory, source root and verification arguments. Allocate a new output directory.

This recipe reads the runner's resolved configuration and full Task envelope:

```bash
python3 - /absolute/path/to/checkpoint /absolute/path/to/new-output /absolute/path/to/resume-stage.json <<'PY'
import json
import pathlib
import sys

checkpoint = pathlib.Path(sys.argv[1])
config = json.loads((checkpoint / "config.json").read_text())
task = json.loads((checkpoint / "task.json").read_text())
receipt = json.loads((checkpoint / "receipt.json").read_text())
assert receipt["status"] == "done" and receipt["cleanupConfirmed"]
assert receipt["exitCode"] == 0 and not receipt["sdkChanged"]
assert all(key in task for key in ("status", "conditions", "acceptedEvidence")), "Use the full TaskDetail envelope"
delivery = json.loads((checkpoint / "result.json").read_text())["result"]["output"]["result"]
assert "development" in delivery, "Checkpoint must contain retained development evidence"
task["result"] = delivery
config["task"] = task
config["outputRoot"] = str(pathlib.Path(sys.argv[2]).resolve())
pathlib.Path(sys.argv[3]).write_text(json.dumps(config, indent=2) + "\n")
PY
bun projects/alex.app/scripts/standalone-stage.ts /absolute/path/to/resume-stage.json
```

The workflow validates the archived artifacts, Task requirements and current
candidate before reuse. An unchanged verified candidate can reuse its check
receipt; a changed commit needs fresh verification and review. The short Task
envelope is normalized into a fresh Task and does not carry a prior result.

Cancellation preserves files and invocation traces but does not deliver the
workflow's in-memory checkpoint. Retry from a result actually retained before
interruption. If none exists, start a fresh invocation with the same Task and
working directory so the workflow can inspect unfinished edits. Do not reset
the candidate or treat the interrupted receipt as successful development.

The [recovery trial](standalone-recovery-trial-20261116.md) demonstrates these
boundaries with actual Git and executable checks. Manual checkpoint selection
does not establish automatic Host persistence or recovery.

## Focused verification

```bash
bun test ./projects/alex.app/scripts/standalone-stage.test.ts \
  ./projects/alex.app/agents/alex/workflows/diagnose-improvement.test.ts
```

The runner tests exercise real standalone diagnosis, blocked output, cancellation,
evidence preservation, worktree isolation and fixture import errors. The existing
development tests cover real Git, executable verification, review and recovery.
