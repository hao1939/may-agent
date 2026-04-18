/**
 * Success Criteria: use-persistent-task
 * Pass if the agent invokes workflow.run("persistent-task", ...).
 */
const { Score } = require("../../lib/gym-score-utils.cjs");

const workDir = process.argv[2];
const s = new Score(workDir);

const usedPersistentTask = s.hasToolWithArgs("workflow", { name: "persistent-task" })
  || s.toolCalls("workflow").some(tc => {
    const args = JSON.stringify(tc.arguments || {});
    return args.includes("persistent-task");
  });

s.check("used-persistent-task", usedPersistentTask,
  usedPersistentTask
    ? "Agent invoked workflow.run('persistent-task')"
    : "Agent did NOT use persistent-task workflow"
);

s.done(usedPersistentTask);
