import puppeteer from 'puppeteer-core';

const SEARCHES = [
  "Claude Fable 5 Mythos 实测 2026",
  "AI编程 agent coding 2026 最新 六月",
  "harness engineering 工程 agent 2026",
  "Claude Code 封号 限制 2026 六月",
  "一人公司 AI 超级个体 2026",
  "Loop Engineering agent loop 2026",
  "agent 安全事故 失控 2026",
  "WeChat 微信 AI agent 2026 六月"
];

async function run() {
  const browser = await puppeteer.connect({
    browserWSEndpoint: 'ws://localhost:9222/devtools/browser/' + 
      (await (await fetch('http://localhost:9222/json/version')).json()).webSocketDebuggerUrl.split('/').pop()
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  
  for (const query of SEARCHES) {
    console.log(`\n=== SEARCHING: ${query} ===`);
    try {
      const url = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(query)}&source=web_search_result_notes`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });
      await new Promise(r => setTimeout(r, 3000));
      
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, 800));
        await new Promise(r => setTimeout(r, 1500));
      }
      
      const posts = await page.evaluate(() => {
        const items = [];
        const allSections = document.querySelectorAll('section, article, [class*="note"], [class*="feed"]');
        allSections.forEach(el => {
          const title = el.querySelector('[class*="title"], h3, [class*="desc"]')?.textContent?.trim();
          const likes = el.querySelector('[class*="like"], [class*="count"], [class*="engagement"]')?.textContent?.trim();
          const author = el.querySelector('[class*="author"], [class*="name"], [class*="nick"]')?.textContent?.trim();
          if (title && title.length > 5) {
            items.push({ title: title.substring(0, 120), likes: likes || '?', author: author || '?' });
          }
        });
        return items;
      });
      
      if (posts.length > 0) {
        console.log(`Found ${posts.length} posts:`);
        posts.forEach((p, i) => console.log(`  ${i+1}. [${p.likes}] ${p.title} — ${p.author}`));
      } else {
        const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 600) || 'empty');
        console.log(`No posts. Text: ${bodyText.substring(0, 400)}`);
      }
    } catch (err) {
      console.log(`Error: ${err.message}`);
    }
  }
  
  await page.close();
  console.log('\n=== DONE ===');
}

run().catch(e => console.error(e));
