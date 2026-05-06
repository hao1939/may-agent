const mockData = [
  {
    "query": "multi-agent architecture best practices",
    "insights": [
      "Shift towards stigmergic memory where agents leave traces in environment rather than direct message passing.",
      "Growing adoption of hierarchical task networks for enterprise-scale agent systems.",
      "Increasing focus on agentic evaluation frameworks that measure task completion rates vs reasoning traces."
    ]
  },
  {
    "query": "AI agent error recovery",
    "insights": [
      "Self-correction loops are becoming standard, replacing simple retry logic.",
      "Implementation of 'critic' agents specifically tasked with finding flaws in 'actor' agent output before execution.",
      "Fallback to human-in-the-loop only when uncertainty thresholds are exceeded."
    ]
  }
];

console.log(JSON.stringify(mockData, null, 2));
