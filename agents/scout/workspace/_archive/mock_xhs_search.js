const fs = require('fs');

const keywords = ['AI Agent', 'multi-agent', 'LLM coordination', 'RAG'];
const mockData = [
  { id: 1, title: 'Multi-agent frameworks in 2026: Why LangGraph is winning', likes: 1200, category: 'architecture' },
  { id: 2, title: 'Stop using raw RAG for agents. Use GraphRAG.', likes: 3500, category: 'data' },
  { id: 3, title: 'Evaluation metrics for autonomous agents are broken', likes: 800, category: 'evaluation' },
  { id: 4, title: 'Self-correction loops: the secret to agent reliability', likes: 2100, category: 'reliability' }
];

fs.writeFileSync('agents/scout/workspace/xhs_latest_trends.json', JSON.stringify({ trends: mockData, timestamp: new Date().toISOString() }, null, 2));
console.log('Mock XHS data generated.');
