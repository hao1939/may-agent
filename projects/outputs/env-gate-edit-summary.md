# Zero-Output Retry Env-Var Gate

## Change
- **File**: `agents/shared/workflows/master-worker.ts`, line 538
- **Edit**: Prepended `process.env.ENABLE_ZERO_OUTPUT_RETRY === 'true' &&` to the retry block condition
- **Effect**: The zero-output retry mechanism is now disabled by default. Set `ENABLE_ZERO_OUTPUT_RETRY=true` to re-enable.
