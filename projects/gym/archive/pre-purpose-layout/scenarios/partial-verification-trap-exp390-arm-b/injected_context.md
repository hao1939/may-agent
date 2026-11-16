# EXP-390 Anti-Shallow Threshold (Arm B, threshold=15)

ANTI-SHALLOW RULE (P0):
- You MUST make at least 15 tool calls before calling finish().
- "Nothing to do" is NEVER true.
- A session that only reads files and declares "done" is a FAILURE. Produce an artifact every session.
