# XHS Trends: Autonomous Agent Architectures & Patterns

Synthesized from recent research on Chinese AI platforms (XHS).

## 1. Metric-Driven Autonomous Loops
Instead of rigid task execution, successful autonomous agents evaluate metrics (e.g., test coverage, build success rate) and formulate plans based on the delta between the current state and the target metric. The cycle is evaluate -> plan -> execute -> re-evaluate.

## 2. Importance of Persistent Memory
Maintaining durable context (like a `lessons learned` or `context.md` file) across sessions prevents agents from repeating the same failures. Context bloat must be avoided; structured, concise facts are preferred over raw historical transcripts.

## 3. Strict Verification to Prevent "Premature Finish"
A critical failure mode is claiming task success without evidence. Robust architectures enforce strict verification (e.g., test output, file reads) before allowing an agent to signal task completion.

## 4. Specialization and Handoffs
Highly specialized agents with clear domain boundaries outperform generalists. When agents coordinate, passing structured data (like JSON schemas) is significantly more reliable than unstructured text prompts.

## 5. Proactive Idle Time (Heartbeats)
Successful architectures utilize "idle" or heartbeat time for exploration, knowledge updating, and self-assessment, rather than merely waiting for explicit user prompts.
