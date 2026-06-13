import puppeteer from 'puppeteer-core';

const browser = await puppeteer.connect({
  browserWSEndpoint: 'ws://localhost:9222/devtools/browser/f6fcb951-0d03-49f8-bf7d-1de2b5780109'
});

const queries = [
  "AI agent 智能体 最新 2026",
  "Claude Code 编程 agent 最新 2026 六月",
  "DeepSeek V4 最新 对比 2026 六月",
  "多智能体 multi-agent 自进化 2026 最新",
  "AI 裁员 失业 求职 转型 2026 六月",
  "MCP Skills Claude 工具 协议 最新 2026",
  "一人公司 AI 超级个体 独立开发 2026",
  "vibe coding 结束 AI编程 harness 2026 六月",
];

const allResults = {};

for (const q of queries) {
  const page = await browser.newPage();
  try {
    console.log(`\n=== QUERY: ${q} ===`);
    const url = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(q)}&source=web_search_result_notes`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
    await new Promise(r => setTimeout(r, 3500));
    
    const text = await page.evaluate(() => document.body?.innerText?.substring(0, 3000));
    console.log(text?.substring(0, 2500));
    allResults[q] = text?.substring(0, 3000);
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
  } finally {
    await page.close();
  }
}

console.log('\n=== ALL SEARCHES COMPLETE ===');
