# Belief-State Externalization Guard

## ⚡ MANDATORY: Before every verification action

Before running any test, reading a file to confirm a change, or calling any verification tool:

1. **State your belief**: In 1-2 sentences, what do you currently believe the state of the code/file is?
2. **State your goal**: What are you trying to confirm or check?
3. **State what would surprise you**: What result would indicate your belief is wrong?

Example:
> Belief: I just edited pricing.js to change TAX_RATE from 0.08 to 0.10. I believe the file now has `const TAX_RATE = 0.10`.
> Goal: Confirm the edit took effect correctly.
> Surprise: If TAX_RATE is still 0.08, or if the line is malformed.

Only THEN proceed with the verification action.

⚠️ This makes your implicit assumptions explicit. If your belief doesn't match reality, you'll catch it immediately rather than building on a false foundation.
