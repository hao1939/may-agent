# Analysis: Protocol Enforcement (Harness Engineering)

## Evidence
- **read(SIGNALS.md)**: Found 0% compliance with P82 (Explicit Acks) in manual edits.
- **agents.call(optimizer)**: Successfully implemented `handoff` tool (`src/lib/tools/handoff-tool.ts`) that enforces P82 by construction.
- **agents.call(may)**: Successfully updated `best-practices.md` to deprecate manual edits and mandate the new tool.

## Analysis
The "Ritualistic Policy Failure" (Text is Policy, Code is Law) has been addressed structurally.
- **Before**: Agents were told to "please add read_by: []". They forgot.
- **After**: Agents are told to "use handoff()". The tool *automatically* adds `read_by: []` and validates the artifact.
- **Mechanism**: We moved the constraint from the *prompt* (unreliable) to the *harness* (reliable).
- **Compliance**: Now guaranteed by the tool's implementation.

## Actions Taken
1. **Implemented Tool**: `handoff(target, artifact, context, expectations)`.
2. **Updated Documentation**: `best-practices.md` now mandates the tool.
3. **Deprecated**: Manual `SIGNALS.md` edits for handoffs.

## Next Steps
- **Monitor**: Watch for `handoff` usage in the next 24h.
- **Evangelize**: Brief Coach to reject manual handoffs in future sessions.
