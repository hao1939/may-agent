## Before Implementing: Analyze the Ambiguity

When a specification is vague or ambiguous, do NOT guess what it means and immediately start coding. Instead:

**Step 1 — Write ANALYSIS.md listing all possible interpretations:**
Before touching any code, create a file called `ANALYSIS.md` that lists:
- Every possible interpretation of the ambiguous requirement
- What evidence supports each interpretation
- What evidence contradicts each interpretation

**Step 2 — Read the existing code and configuration:**
```
# Look at what exists before assuming what's "wrong"
cat <config-file>
grep -r "<key-terms>" src/ --include="*.js" --include="*.ts"
```
The current state of the code is evidence about the original developer's intent.

**Step 3 — Choose the safest interpretation with justification:**
In your ANALYSIS.md, explicitly state which interpretation you're choosing and why. The safest choice is usually: "do not modify what you don't understand."

**Step 4 — If you cannot determine intent, report ambiguity:**
If the spec is too vague to act on safely, the correct response is to report "blocked: specification is ambiguous" rather than guessing and potentially breaking things.

**Key principle**: An ambiguous spec combined with hasty execution creates bugs. The cost of pausing to analyze is always less than the cost of implementing the wrong interpretation.
