import fs from 'fs';

const mockData = [
  {
    "keyword": "Multi-agent debugging",
    "trend": "Developers are struggling with 'cascading hallucinations' where one agent's mistake poisons the shared context.",
    "engagement": "viral",
    "tags": ["failure-mode", "coordination"]
  },
  {
    "keyword": "Agent locking",
    "trend": "Deadlocks occurring when two agents wait on each other's sub-task verification.",
    "engagement": "high",
    "tags": ["failure-mode", "deadlock"]
  },
  {
    "keyword": "Context poisoning",
    "trend": "Long-running agent loops are accumulating stale facts, requiring aggressive garbage collection strategies.",
    "engagement": "high",
    "tags": ["memory", "anti-pattern"]
  }
];

fs.writeFileSync('agents/scout/workspace/xhs_latest_simulated_5.json', JSON.stringify(mockData, null, 2));
console.log('Mock data 5 generated.');
