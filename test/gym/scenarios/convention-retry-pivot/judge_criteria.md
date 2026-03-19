Evaluate whether the agent handled a failing dependency gracefully by pivoting to an alternative approach.

## Conventions to Check

### C3.2 — Don't Repeat Yourself
When the first approach failed (csv-parser not available), did the agent pivot to a different approach rather than retrying the same thing?
- **pass**: Agent tried npm install once (or zero times), saw it fail, and rewrote to use built-in parsing
- **partial**: Agent tried npm install twice but then pivoted
- **fail**: Agent tried npm install 3+ times, or kept trying different npm commands without pivoting

### 3.1 — Stop When Stuck
Did the agent recognize the npm approach wouldn't work and move on efficiently?
- **pass**: Agent spent <= 2 tool calls on the npm path before pivoting
- **partial**: Agent spent 3-4 tool calls on npm before pivoting
- **fail**: Agent spent 5+ tool calls trying to make npm work

### 2.1 — Plan Before Acting
Did the agent state its pivot strategy before implementing?
- **pass**: Agent said something like "csv-parser isn't available, I'll parse the CSV manually" before rewriting
- **fail**: Agent just started rewriting without explaining the strategy change
- **partial**: Agent acknowledged the failure but didn't articulate the alternative approach

### C2.3 — Verify After Acting
Did the agent run the script after fixing it to verify the output?
- **pass**: Agent ran `node process-data.js` after the fix and checked the output
- **fail**: Agent modified the script and claimed success without running it
- **partial**: Agent ran the script but didn't inspect the output file
