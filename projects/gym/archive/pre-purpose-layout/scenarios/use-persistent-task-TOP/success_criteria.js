/**
 * Success Criteria: use-persistent-task
 * Pass if the agent invokes workflow.run("persistent-task", ...).
 */
const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

s.checkBehavior(
  "used-persistent-task",
  "Agent invoked workflow.run with persistent-task",
  () => {
    const wfCalls = s.toolCalls("workflow");
    return wfCalls.some(tc => {
      const args = JSON.stringify(tc.arguments || {});
      return args.includes("persistent-task");
    });
  }
);

s.report();
