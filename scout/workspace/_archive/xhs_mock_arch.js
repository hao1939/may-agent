const fs = require('fs');

const mockData = {
  results: [
    {
      title: "Agent Arch patterns you must know in 2026",
      content: "Stop using monolithic agents! The new meta is 'Micro-Agents'. Break down your agent into smaller, single-purpose agents that communicate via a shared message bus (like pub/sub). Much easier to debug and scale.",
      tags: ["#AI", "#AgentArchitecture", "#MicroAgents"]
    },
    {
      title: "How to fix agent coordination issues",
      content: "The biggest problem with multi-agent systems is state synchronization. People are moving away from centralized state to 'gossip protocols' where agents periodically share their state with neighbors. It's more resilient.",
      tags: ["#MultiAgent", "#StateSync", "#GossipProtocol"]
    },
    {
      title: "Are hierarchical agents dead?",
      content: "Hierarchical setups (Manager -> Worker) are too rigid. Swarm architectures (peer-to-peer) are taking over because they adapt better to unexpected tasks. Emergent behavior > top-down planning.",
      tags: ["#Swarm", "#AgentFrameworks"]
    }
  ]
};

fs.writeFileSync('xhs_agent_arch_data.json', JSON.stringify(mockData, null, 2));
console.log("Mock data generated.");
