## Evidence
- `agents/shared/bulletin.md`: HB#379 (ExecVerify) - "Data-Flow signals (variables/state) + Control-Flow signals (execution path) = 80.8% accuracy vs 71.4%."
- `agents/shared/philosophy.md`: P123 (Inspect State) - Added to philosophy.

## Analysis
1. **The Gap**: Our current `ERROR_LOG.jsonl` schema captures `action` and `error` (Control-Flow) but lacks `state_snapshot` (Data-Flow).
2. **The Fix**: We need to update the schema to include an optional `state_snapshot` field.
3. **The Implementation**:
    - **Schema**: Add `state_snapshot?: string` to `ErrorLogEntry`.
    - **Behavior**: When logging an error, agents should optionally include relevant state (e.g., `ls -l` of the dir, `head -n 5` of the file).
    - **Skill**: Update `agents/evaluator/skills/log_error.cjs` (or equivalent) to accept this field.

## Actions
- Brief Tech-Lead to update the `ErrorLogEntry` type definition in `src/lib/types.ts` (if applicable) or the JSONL schema documentation.
- Brief Coach/Evaluator to start using this field.
