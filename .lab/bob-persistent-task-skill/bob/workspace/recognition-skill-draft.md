# Recognition Skill Draft — EXP-RECOGNITION Arm B

## Design Principles

1. **Short** — under 200 words. Long skills get skipped (KE-011).
2. **Additive framing** — "while you're reading..." not "before you fix..."
3. **Specific** — targets the exact failure pattern (code inconsistencies beyond tests)
4. **No examples** — KE-133 shows examples harm discovery tasks

## Candidate Skill: `recognition-review.md`

---

### Version 1: Minimal Additive (PREFERRED)

```markdown
# Code Consistency Check

When fixing a bug, don't stop at "tests pass."

After reading any source file, scan the WHOLE file for:
- Values that don't match between files (e.g., a config key in one file spelled differently in another)
- Error messages that don't match the actual logic (e.g., check says > 50 but message says "at most 100")
- Comments that contradict the code
- Hardcoded values that conflict with configuration

If you find inconsistencies, fix them too — even if no test catches them. Real-world code quality means catching things tests miss.
```

**Word count**: 89  
**Framing**: Additive — "after reading any source file" rides the existing read-file action  
**Specificity**: Directly names the two failure patterns (config key mismatch, error message mismatch) without being so specific it only works on these scenarios  

---

### Version 2: Interruptive (CONTROL COMPARISON)

```markdown
# Before Fixing: Full File Review

BEFORE making any code changes, read EVERY file listed in the task completely.

For each file, write down:
- What the file does
- Any inconsistencies with other files
- Any mismatch between logic and error messages/comments

Create NOTES.md with your findings. Then fix all issues — both the test failure AND anything else you found.
```

**Word count**: 63  
**Framing**: Interruptive — "BEFORE making any code changes"  
**Prediction**: ~10% compliance (KE-176)  

---

### Version 3: Post-Fix Review (Alternative Additive)

```markdown
# Post-Fix Consistency Scan

After making tests pass, take one more look at every file you modified or read.

Ask yourself: "Is there anything else wrong in this file that tests don't check?"

Look for:
- Mismatched names/keys between files  
- Error messages that don't match the actual validation logic
- Stale comments or documentation

Fix anything you find.
```

**Word count**: 60  
**Framing**: Post-fix additive — "after making tests pass"  
**Risk**: By this point, the agent may have already entered "done" mode  

---

## Recommendation

**Use Version 1 for the experiment.** It's additive, specific, and targets the exact failure mode. The framing "when fixing a bug" and "after reading any source file" ride the agent's existing behavioral momentum.

Version 2 would be interesting as a comparison to KE-176's findings but would require a separate arm. Since we're comparing skill (Ch1) vs gate (Ch2), one skill version is sufficient.

## Why This Might Work (Against KE-176's 10% Prediction)

The recognition skill differs from EXP-154's investigation skill in a critical way:
- EXP-154: "Write FINDINGS.md BEFORE fixing" → INTERRUPTIVE (fights fix-mode momentum)
- This skill: "After reading a file, also scan for inconsistencies" → ADDITIVE (extends read-file behavior)

If the compliance difference between additive and interruptive is real (KE-176: 100% vs 10%), this skill should get high compliance on the "scan" part. The question is whether compliance (agent does scan the file) translates to recognition (agent actually notices the inconsistency).

## Why This Might Fail

1. **Scanning ≠ Seeing**: Agent may "scan" the file (comply with the skill) but still not notice the inconsistency. The issue isn't whether the agent reads the whole file — it's whether its attention latches onto things beyond the primary bug.
2. **Generic advice**: "Scan for inconsistencies" is vague. The agent may check for the types of issues it already cares about and still miss the specific pattern.
3. **Attention narrowing is model-level**: The BLIND FIX pattern may be baked into how LLMs process code. A text instruction can't change how the model allocates attention during a read operation.
