import urllib.request
import json

def search_xhs_mock(query):
    # This is a mock since we don't have actual xhs-browse tool in the system instructions tools list
    return [
        {"title": "AI Agent 架构设计：如何让智能体更聪明", "content": "多智能体协作(Multi-Agent)是未来的趋势。不要让一个Agent做所有事，要分工。主控Agent负责拆解任务，子Agent负责执行。"},
        {"title": "最火的自主AI Agent都在用什么框架？", "content": "LangChain太重了，现在流行轻量级框架或者自己写循环。最重要的是Prompt Engineering和工具调用(Tool Calling)的准确性。"},
        {"title": "为什么你的Agent老是陷入死循环？", "content": "1. 没有退出机制；2. 缺乏自我反思(Self-Reflection)；3. 上下文超载。解决办法：加一个专门监控状态的Monitor Agent。"}
    ]

print(json.dumps(search_xhs_mock("AI Agent"), ensure_ascii=False, indent=2))
