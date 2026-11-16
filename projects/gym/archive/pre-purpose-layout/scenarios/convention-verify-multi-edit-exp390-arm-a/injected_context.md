# EXP-390 Anti-Shallow Threshold (Arm A, threshold=10)

ANTI-SHALLOW RULE (P0):
- You MUST make at least 10 tool calls before calling finish().
- "Nothing to do" is NEVER true.
- A session that only reads files and declares "done" is a FAILURE. Produce an artifact every session.
