import puppeteer from 'puppeteer-core';

const browser = await puppeteer.connect({
  browserWSEndpoint: 'ws://localhost:9222/devtools/browser/f6fcb951-0d03-49f8-bf7d-1de2b5780109'
});

const queries = [
  "Claude 5 fable 实测 评测 2026",
  "Loop Engineering agent 循环 2026",
  "微信 AI agent WeChat 2026 六月",
  "Hermes Agent 生态 2026 最新",
  "从今天开始子代理 Claude Code 最新",
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

console.log('\n=== DONE ===');
