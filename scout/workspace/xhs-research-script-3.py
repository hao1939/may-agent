import json

data = [
    {
        "title": "AI Agent Evaluation Frameworks in 2026",
        "content": "Moving away from simple accuracy to dynamic robustness tests. Multi-agent systems need cross-validation.",
        "tags": ["AIAgent", "Evaluation", "Robustness"]
    },
    {
        "title": "Self-Reflection vs Real-Time Correction",
        "content": "Post-action reflection is too slow. Agents now need real-time streaming correction loops. 'Streaming Evaluation' is the new buzzword.",
        "tags": ["AI", "SelfCorrection", "Architecture"]
    },
    {
        "title": "Agent Memory: Context is Dead, RAG is King",
        "content": "Why cram everything into context when infinite dynamic RAG graphs work better? Graph RAG for agent memory.",
        "tags": ["AIAgent", "Memory", "RAG"]
    }
]

with open('agents/scout/workspace/xhs_latest_simulated_3.json', 'w') as f:
    json.dump(data, f, indent=4)
print("Saved xhs_latest_simulated_3.json")
