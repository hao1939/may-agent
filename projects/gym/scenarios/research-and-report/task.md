# Task: Research Synthesis — Agent Memory Architectures

You have 3 research paper summaries in `environment/papers/` covering different approaches to agent memory:

1. `episodic-memory.md` — Episode-based recall systems
2. `semantic-memory.md` — Knowledge-graph structured memory
3. `procedural-memory.md` — Skill/action-pattern memory

## Your job

1. **Read all 3 papers** in `environment/papers/`
2. **Write a synthesis report** to `synthesis-report.md` (in the environment directory) that:
   - Summarizes each paper's approach (2-3 sentences each)
   - Compares their strengths and weaknesses in a structured way
   - Identifies which approach best fits a **multi-agent coding assistant system** (like ours) and explains why
   - Notes any complementary combinations worth exploring
3. **Call `finish()`** with:
   - `status`: your completion status
   - `summary`: a concrete summary of what you did
   - `deliverables`: include the synthesis report path
   - `verification_evidence`: cite your reads and the written report

## Constraints

- The report must reference all 3 papers by name
- The recommendation must be specific and justified (not "it depends")
- You must call finish() with structured output — don't just stop
