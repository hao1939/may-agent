import json
import random

def generate_mock_xhs_data():
    topics = [
        "Multi-agent coordination",
        "Agentic reasoning",
        "Memory architectures",
        "RAG + Agents",
        "Tool use in autonomous agents"
    ]
    
    insights = [
        "Agents that can self-reflect and correct their tool inputs before executing them have 40% higher task success rates.",
        "Hierarchical multi-agent systems often bottleneck at the 'manager' node. Peer-to-peer message passing is trending for robustness.",
        "Injecting vector DB results directly into the system prompt is being replaced by 'RAG-as-a-tool' where the agent decides when and what to search.",
        "Short-term memory management is critical. Developers are finding that summarizing past interactions every N turns prevents context window degradation better than raw truncation."
    ]
    
    data = []
    for _ in range(5):
        data.append({
            "topic": random.choice(topics),
            "trend": random.choice(insights),
            "engagement": random.randint(100, 5000)
        })
        
    with open("agents/scout/workspace/xhs_latest_simulated_2.json", "w") as f:
        json.dump(data, f, indent=2)
        
    print("Mock data generated at agents/scout/workspace/xhs_latest_simulated_2.json")

if __name__ == "__main__":
    generate_mock_xhs_data()
