import puppeteer from 'puppeteer-core';

const browser = await puppeteer.connect({
  browserWSEndpoint: 'ws://localhost:9222/devtools/browser/f6fcb951-0d03-49f8-bf7d-1de2b5780109'
});

const queries = [
  "Qwen 开源 闭源 模型 2026 最新",
  "AI安全 对齐 agent 治理 失控 2026",
  "Codex Cursor 编程 agent 对比 2026",
  "单agent 多agent 写代码 架构 最新 2026",
  "Claude Fable 5 Mythos 最新 2026 六月",
  "Anthropic Claude 封号 限制 降智 六月 2026",
  "harness engineering agent 架构 FDE 2026",
  "SkillHub Skills 生态 Claude Code 开源 2026 六月",
  "AI agent 应用 落地 企业 2026 最新 实际",
];

for (const q of queries) {
  const page = await browser.newPage();
  try {
    console.log(`\n=== QUERY: ${q} ===`);
    const url = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(q)}&source=web_search_result_notes`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
    await new Promise(r => setTimeout(r, 3500));
    
    const text = await page.evaluate(() => document.body?.innerText?.substring(0, 3000));
    console.log(text?.substring(0, 2500));
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
  } finally {
    await page.close();
  }
}

console.log('\n=== ALL SEARCHES COMPLETE ===');
