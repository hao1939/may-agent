const trends = [
  { topic: "Lightweight Agents", description: "Shifting from monolithic LLMs to small, specialized agent clusters using 7B models." },
  { topic: "Memory as Graph", description: "Replacing linear RAG with knowledge graphs for persistent agent memory, reducing context loss." },
  { topic: "Event-Driven Orchestration", description: "Moving away from direct LLM-to-LLM chatter to pub/sub event architectures for multi-agent systems." },
  { topic: "Human-in-the-Loop Degradation", description: "Agents are designed to gracefully degrade to asking humans rather than hallucinating when uncertainty is high." }
];

console.log(JSON.stringify(trends, null, 2));