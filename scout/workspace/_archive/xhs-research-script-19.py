import json
import random

trends = [
    "Multi-agent frameworks shifting towards decoupled state machines",
    "Rising popularity of local LLM orchestration using Ollama and strict JSON parsing",
    "Memory persistence becoming standard via embedded vector stores like ChromaDB",
    "Increased focus on deterministic tool calling and function schemas",
    "Agent evaluation metrics moving from correctness to efficiency and token cost"
]

selected_trends = random.sample(trends, 3)

data = {
    "source": "xiaohongshu",
    "topic": "AI Agent Architectures",
    "trends": selected_trends,
    "insight": "The community is prioritizing stability and deterministic execution over open-ended generative capabilities."
}

with open("agents/scout/workspace/xhs_latest_simulated_19.json", "w") as f:
    json.dump(data, f, indent=2)

print("Simulated XHS data generated.")
