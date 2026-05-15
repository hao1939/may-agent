import json
import random

trends = [
    {"topic": "Multi-Agent Evaluation", "keyword": "多智能体评估", "insight": "Moving from static benchmarks to dynamic, adversarial evaluation environments.", "sentiment": "critical", "popularity": 85},
    {"topic": "Agent Memory", "keyword": "智能体记忆", "insight": "Graph-based memory structures (like Mem0 but specialized) are outperforming flat vector stores for complex reasoning.", "sentiment": "positive", "popularity": 92},
    {"topic": "Cost Optimization", "keyword": "大模型成本控制", "insight": "Routing queries to smaller, specialized local models for routine tasks to save API costs in agent swarms.", "sentiment": "practical", "popularity": 78},
    {"topic": "Self-Correction", "keyword": "自我纠错", "insight": "Agents that self-correct without external feedback are hitting plateaus. Human-in-the-loop or cross-agent critique is necessary for robust correction.", "sentiment": "mixed", "popularity": 88}
]

# Simulate fetching trending data
selected_trends = random.sample(trends, 2)
print(json.dumps(selected_trends, indent=2))
