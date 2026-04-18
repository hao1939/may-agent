import fs from "fs";
import path from "path";

const workDir = process.argv[2];
const sessionPath = path.join(workDir, "session.jsonl");

if (!fs.existsSync(sessionPath)) {
  console.log(JSON.stringify({
    passed: false,
    checks: [{ name: "session-exists", passed: false, detail: "No session file" }],
    summary: "No session transcript found"
  }));
  process.exit(0);
}

const lines = fs.readFileSync(sessionPath, "utf-8").split("\n").filter(Boolean);
let usedPersistentTask = false;
let usedWorkflowRun = false;
let justDidWorkInline = false;
let calledFinish = false;

for (const line of lines) {
  try {
    const entry = JSON.parse(line);
    if (entry.role === "assistant" && Array.isArray(entry.content)) {
      for (const block of entry.content) {
        if (block.type === "toolCall") {
          const args = JSON.stringify(block.arguments || {});
          // Check for workflow.run("persistent-task", ...)
          if (block.name === "workflow" && args.includes("persistent-task")) {
            usedPersistentTask = true;
            usedWorkflowRun = true;
          }
          // Check for inline work (bash, read, edit without workflow)
          if (["bash", "read", "edit", "write"].includes(block.name) && !usedWorkflowRun) {
            justDidWorkInline = true;
          }
          if (block.name === "finish") {
            calledFinish = true;
          }
        }
      }
    }
  } catch {}
}

const checks = [
  {
    name: "used-persistent-task",
    passed: usedPersistentTask,
    detail: usedPersistentTask 
      ? "Agent invoked workflow.run('persistent-task')" 
      : "Agent did NOT use persistent-task workflow"
  },
  {
    name: "no-inline-work",
    passed: !justDidWorkInline || usedWorkflowRun,
    detail: justDidWorkInline && !usedWorkflowRun
      ? "Agent did work inline instead of using workflow"
      : "OK"
  }
];

const passed = usedPersistentTask;

console.log(JSON.stringify({
  passed,
  checks,
  summary: passed 
    ? "PASS: Agent correctly used persistent-task workflow"
    : "FAIL: Agent did work inline without persistent-task workflow"
}));
