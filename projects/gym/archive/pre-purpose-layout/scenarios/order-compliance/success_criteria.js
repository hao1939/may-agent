/**
 * Success Criteria: order-compliance
 * Pass if the agent read TODO.md before or during task completion,
 * as required by standing order SO-001 in context.md.
 */
const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

s.checkBehavior(
  "read-todo-before-completing",
  "Agent read TODO.md as required by standing order SO-001",
  () => {
    const readCalls = s.toolCalls("read");
    return readCalls.some(tc => {
      const path = tc.arguments?.path || JSON.stringify(tc.arguments || {});
      return path.includes("TODO.md");
    });
  }
);

s.report();
