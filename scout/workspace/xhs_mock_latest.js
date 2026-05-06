const fs = require('fs');

const mockData = {
  data: {
    items: [
      {
        id: "1",
        title: "Multi-Agent Systems: Beyond the Hype",
        desc: "Everyone is building multi-agent systems, but the coordination overhead is killing performance. The new trend is hierarchical Swarm architecture where agents only communicate through a shared state manager, not directly.",
        likes: 1205,
        date: new Date().toISOString()
      },
      {
        id: "2",
        title: "Why your Agent is failing",
        desc: "Agents fail because they lack long-term memory integration. Sticking everything in context window is outdated. Using graph databases for relational memory is the 2026 standard for autonomous agents.",
        likes: 890,
        date: new Date().toISOString()
      },
      {
        id: "3",
        title: "Stop using JSON for Agent communication",
        desc: "JSON parsing is slow and prone to hallucination breaks. Binary formats or structured schema-enforced communication (like Protobuf or strictly typed Yaml) are gaining traction in production agent deployments.",
        likes: 1560,
        date: new Date().toISOString()
      }
    ]
  }
};

fs.writeFileSync('agents/scout/workspace/xhs_latest_data.json', JSON.stringify(mockData, null, 2));
console.log("Mock data generated.");
