# Gym Execution Checklist

When running gym trials (via gym-run.sh or gym-batch.sh), follow this checklist to avoid incomplete runs.

## Before Starting
- Runner path is `scripts/gym-run.sh` (NOT test/gym/run-gym.sh or any other path)
- Batch runner is `scripts/gym-batch.sh`
- Verify the script exists: `ls scripts/gym-run.sh`

## During Batch Runs
- After launching trials, **count completed results** in the output
- If you requested N trials, confirm N results appear (not N-1, not N/2)
- If a run fails mid-batch, note which trials completed and re-run the missing ones

## Before Finishing
- Count result files or trial outputs — the number must match what was requested
- If the task says "run 10 trials per arm, 4 arms" → you need 40 completed results
- grep/count to verify: `ls gym/results/<scenario>/ | wc -l` or check batch summary output
- **Do not call finish() until the count matches the requirement**
