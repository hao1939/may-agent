import json
import random

def search_xhs_mock(query):
    # Simulated XHS results focusing on agent architecture and multi-agent systems
    results = [
        {"title": "AI Agent Multi-Agent Collaboration: Deep Dive into Micro-Agent Patterns", "content": "Recent trend: breaking down complex agents into 'Micro-Agents' that only do one specific atomic task (e.g., only formatting, only routing). Much lower hallucination rate. Using shared memory spaces instead of direct messaging.", "likes": 450, "saves": 120},
        {"title": "Why my autonomous agent keeps failing (and how I fixed it)", "content": "Stop letting agents loop forever. Introduce an 'Evaluator' agent that has veto power over the main agent's outputs. Also, limit context windows strictly - more context = more distraction.", "likes": 890, "saves": 340},
        {"title": "Agentic Workflows > Autonomous Agents in 2026", "content": "The community is moving from fully autonomous agents to strictly defined 'Agentic Workflows' (like state machines). Predictability is more important than autonomy for enterprise.", "likes": 1200, "saves": 560},
        {"title": "Graph-based Memory for Multi-Agent Systems", "content": "Forget simple vector DBs for agent memory. The new meta is Knowledge Graphs (Neo4j) where agents update relationships dynamically. It allows agent A to understand context established by agent B.", "likes": 670, "saves": 280},
        {"title": "The Rise of 'Manager' Agents in Swarm Architectures", "content": "In a swarm of 10+ agents, you need a hierarchical structure. A 'Manager' agent that doesn't do work, but only delegates and aggregates. Reduces token usage by 40% and speeds up task completion.", "likes": 320, "saves": 95}
    ]
    
    # Shuffle and pick a few to simulate variations
    random.shuffle(results)
    return results[:3]

if __name__ == "__main__":
    print(json.dumps(search_xhs_mock("AI Agent Architecture Multi-Agent"), ensure_ascii=False, indent=2))
