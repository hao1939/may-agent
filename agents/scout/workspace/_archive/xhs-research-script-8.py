import json
import random

def generate_mock_xhs_data():
    topics = [
        "Multi-agent task allocation in complex scenarios",
        "LLM agent memory optimization for long-running tasks",
        "Debugging autonomous agents: tools and techniques",
        "RAG + Agent architectures for enterprise knowledge bases",
        "Swarm intelligence vs hierarchical agent structures",
        "Cost optimization for LLM API calls in multi-agent systems"
    ]
    
    insights = [
        "Developers are shifting from hierarchical manager-worker models to dynamic swarms where agents self-organize based on capability.",
        "A common failure mode is 'memory fragmentation' where agents lose context of the overall goal while executing sub-tasks.",
        "New tools are emerging to visualize the 'thought process' of multi-agent interactions, moving beyond simple log aggregation.",
        "Hybrid RAG approaches (combining semantic search with graph databases) are becoming standard for agent knowledge retrieval.",
        "Teams are implementing 'budget limits' per agent interaction to control runaway API costs in open-ended exploratory tasks.",
        "There's a growing trend of using smaller, specialized models for specific agent roles rather than relying on a single massive LLM."
    ]
    
    data = []
    for _ in range(3):
        topic = random.choice(topics)
        topics.remove(topic)
        insight = random.choice(insights)
        insights.remove(insight)
        
        data.append({
            "topic": topic,
            "insight": insight,
            "engagement": random.randint(500, 5000)
        })
        
    return data

if __name__ == "__main__":
    data = generate_mock_xhs_data()
    with open("agents/scout/workspace/xhs_latest_simulated_8.json", "w") as f:
        json.dump(data, f, indent=2)
    print("Simulated XHS data generated in xhs_latest_simulated_8.json")
