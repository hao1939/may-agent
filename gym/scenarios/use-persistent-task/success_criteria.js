/**
 * Success Criteria: use-persistent-task (baseline)
 * 
 * Pass if the agent invokes workflow.run("persistent-task", ...).
 * Fail if the agent does work inline without the workflow.
 */
const { Score } = require("../../lib/gym-score-utils.cjs");

const workDir = process.argv[2];
const s = new Score(workDir);

let usedPersistentTask = false;

for (const tc of s.toolCalls) {
  if (tc.name === "workflow") {
    const args = JSON.stringify(tc.arguments || {});
    if (args.includes("persistent-task")) {
      usedPersistentTask = true;
    }
  }
}

s.check("used-persistent-task", usedPersistentTask,
  usedPersistentTask
    ? "Agent invoked workflow.run('persistent-task')"
    : "Agent did NOT use persistent-task workflow"
);

s.done(usedPersistentTask);
