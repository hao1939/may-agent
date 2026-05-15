import json
import random

def generate_mock_xhs_data():
    trends = [
        "LLM OS patterns replacing simple ReAct loops",
        "Cost-aware agent architectures with SLMs acting as routers",
        "Agent-to-agent negotiation protocols over natural language",
        "RAG evaluation metrics focusing on faithfulness over precision",
        "Multi-modal agents handling vision and action streams simultaneously"
    ]
    
    insights = [
        "Developers are frustrated with the fragility of prompt-chaining in multi-step workflows.",
        "There's a shift towards formal state machines integrated with LLM decision nodes.",
        "XHS creators are sharing patterns for 'agent-based testing' where AI tests AI.",
        "Small, specialized models (7B-8B) fine-tuned for tool use are outperforming general frontier models on cost/latency."
    ]
    
    mock_data = {
        "top_trends": random.sample(trends, 3),
        "community_insights": random.sample(insights, 2),
        "hot_keywords": ["LLM OS", "Agentic Testing", "Cost-Routing", "SLM", "State Machines"]
    }
    
    with open('agents/scout/workspace/xhs_latest_simulated_10.json', 'w') as f:
        json.dump(mock_data, f, indent=2)

    print("Mock XHS data generated to agents/scout/workspace/xhs_latest_simulated_10.json")

if __name__ == "__main__":
    generate_mock_xhs_data()
