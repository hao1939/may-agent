import puppeteer from 'puppeteer-core';

const SEARCHES = [
  "agent 国产 DeepSeek Qwen 全栈 2026",
  "Claude Code cursor 吞噬 替代 平台",
  "agent 落地 ROI 踩坑 成本 失败",
  "agent 记忆 memory 遗忘 context rot 上下文腐烂",
  "agent 安全 skill security 攻击 中毒"
];

async function run() {
  const ver = await (await fetch('http://localhost:9222/json/version')).json();
  const browser = await puppeteer.connect({
    browserWSEndpoint: ver.webSocketDebuggerUrl
  });
  
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  
  for (const query of SEARCHES) {
    console.log(`\n=== SEARCHING: ${query} ===`);
    try {
      const url = `https://www.xiaohongshu.com/search_result?keyword=${encodeURIComponent(query)}&source=web_search_result_notes`;
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
      await new Promise(r => setTimeout(r, 3500));
      
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, 800));
        await new Promise(r => setTimeout(r, 1500));
      }
      
      const posts = await page.evaluate(() => {
        const items = [];
        document.querySelectorAll('section.note-item, [class*="note-item"], [data-note-id]').forEach(el => {
          const title = el.querySelector('[class*="title"], .title, a.title')?.textContent?.trim();
          const likes = el.querySelector('[class*="like-wrapper"] span, [class*="count"]')?.textContent?.trim();
          const author = el.querySelector('[class*="author"], [class*="name"]')?.textContent?.trim();
          if (title && title.length > 3) {
            items.push({ title: title.substring(0, 150), likes: likes || '?', author: author || '?' });
          }
        });
        if (items.length === 0) {
          document.querySelectorAll('a[href*="/explore/"], a[href*="/search_result/"]').forEach(el => {
            const text = el.textContent?.trim();
            if (text && text.length > 10 && text.length < 200) {
              items.push({ title: text.substring(0, 150), likes: '?', author: '?' });
            }
          });
        }
        return items.slice(0, 20);
      });
      
      if (posts.length > 0) {
        console.log(`Found ${posts.length} posts:`);
        posts.forEach((p, i) => console.log(`  ${i+1}. [${p.likes}❤] ${p.title} — ${p.author}`));
      } else {
        const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 300));
        console.log('No posts. Body:', bodyText?.substring(0, 200));
      }
    } catch(e) {
      console.log(`Error: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 4000));
  }
  
  await page.close();
}

run().catch(e => console.error('Fatal:', e));
